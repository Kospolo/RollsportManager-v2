import { ApiClient } from "@/lib/api/generated";
import { readSession } from "@/lib/auth/storage";
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

/** club_id der aktiven Session (Fallback: der eine Demo-Verein aus dem Seed). */
export function activeClubId(): string {
  return readSession()?.profile.club_id ?? DEV_CLUB_ID;
}
