import { ApiClient } from "@/lib/api/generated";
import { readSession } from "@/lib/auth/storage";
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

export const apiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getAccessToken: () => readSession()?.token ?? null,
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
