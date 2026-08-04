import { ApiClient } from "@/lib/api/generated";
import { readSession, writeSession } from "@/lib/auth/storage";
import { readOperatorClub } from "../operator-club";
import { API_BASE_URL, DEV_CLUB_ID } from "../config";

/**
 * Konfigurierte Instanz des GENERIERTEN API-Clients (lib/api/generated —
 * nie von Hand ändern; bei Contract-Lücken services/api-Zod anpassen und
 * die Codegen-Pipeline laufen lassen, siehe packages/contracts/codegen/).
 *
 * Der Token kommt aus der Dev-Auth-Session (localStorage rsm.dev.auth),
 * deshalb funktioniert der api-Modus nur in Client-Komponenten.
 */

/**
 * Selbstheilung veralteter Token (siehe services/api/src/lib/token.ts).
 *
 * Der Guard `requireClubMember` liest die Vereinsrolle AUS DEM TOKEN. Wer nach
 * dem Login einen Verein GRÜNDET oder freigegeben wird, trägt die neue
 * Mitgliedschaft in der DB, aber noch nicht im Token — jede vereinsbezogene
 * Route antwortet dann 403 „Not a member of this club", obwohl die DB die
 * Person längst führt (RLS liest die Tabelle, nicht den Claim). Genau diesen
 * einen 403 fangen wir hier ab: EINMAL POST /auth/refresh (frische Claims aus
 * der DB), Token tauschen, Anfrage wiederholen. Kein Re-Login nötig.
 */
const RETRY_MARKER = "x-rsm-token-healed";
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const session = readSession();
  if (!session?.token) return false;
  // Parallele 403 teilen sich EINEN Refresh (kein Thundering Herd).
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await globalThis.fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { authorization: `Bearer ${session.token}`, "content-type": "application/json" },
        });
        if (!res.ok) return false;
        const body = (await res.json()) as { access_token: string; expires_in: number };
        const current = readSession();
        if (!current) return false;
        // Nur Token + Ablauf tauschen — aktiver Verein/Profil bleiben erhalten.
        writeSession({
          ...current,
          token: body.access_token,
          expiresAt: Date.now() + body.expires_in * 1000,
        });
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

const healingFetch: typeof fetch = async (input, init) => {
  const res = await globalThis.fetch(input, init);
  // Nur den Stale-Token-403 heilen, und nur einmal (Marker verhindert Schleife).
  if (res.status !== 403) return res;
  const headers = new Headers(init?.headers);
  if (headers.has(RETRY_MARKER)) return res;
  let isStale = false;
  try {
    const body = (await res.clone().json()) as { detail?: string };
    isStale = typeof body?.detail === "string" && body.detail.includes("Not a member of this club");
  } catch {
    isStale = false;
  }
  if (!isStale) return res;
  const ok = await refreshAccessToken();
  if (!ok) return res;
  const token = readSession()?.token;
  headers.set(RETRY_MARKER, "1");
  if (token) headers.set("authorization", `Bearer ${token}`);
  return globalThis.fetch(input, { ...init, headers });
};

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken: () => readSession()?.token ?? null,
  fetch: healingFetch,
});

/**
 * ÖFFENTLICHE Client-Variante OHNE Auth-Header — für die login-freie Kür-Ansicht
 * (`GET /public/routines/{token}`, die einzige unauthentifizierte Route). Kein
 * getAccessToken: es wird NIE ein Bearer-Token angehängt, auch wenn eine
 * Dev-Session existiert. So funktioniert getPublicRoutine ohne Login.
 */
export const publicApiClient = new ApiClient({
  baseUrl: API_BASE_URL,
});

/**
 * club_id, den die Portal-Aufrufe mitschicken (Fallback: der eine Demo-Verein
 * aus dem Seed).
 *
 * BETREIBER-EINSICHT: hat ein Plattform-Admin über den Vereins-Umschalter einen
 * Verein gewählt (lib/data/operator-club.ts), gilt DIESER — sonst hätte er zwar
 * seine Konsole, käme aber in keinen Verein hinein (er hat selbst keine
 * club_id: die Plattform-Persona trägt dort null, siehe lib/auth/storage.ts).
 * Genau das war der gemeldete Befund.
 *
 * Das ist eine reine ANZEIGE-Wahl, kein Rechte-Trick: der Token bleibt
 * unverändert. Ob der Betreiber den Verein sehen darf, entscheidet allein der
 * Server — und dort hängt die Einsicht am Protokoll (Migration 0051). Wer diesen
 * Wert ohne Plattform-Admin-Claim setzt, bekommt 403; readOperatorClub() prüft
 * den Claim ohnehin selbst und ist fail-closed.
 */
export function activeClubId(): string {
  const viewing = readOperatorClub();
  if (viewing !== null) return viewing.id;
  return readSession()?.profile.club_id ?? DEV_CLUB_ID;
}
