/**
 * Zentrale Datenquellen-Konfiguration des Portals.
 *
 * NEXT_PUBLIC_DATA_SOURCE=mock|api — Default ist IMMER "mock".
 *
 * Der api-Modus wird jetzt AUCH in Produktions-Builds erlaubt, aber nur wenn
 * NEXT_PUBLIC_DATA_SOURCE=api ausdrücklich gesetzt ist. Ohne diese Umgebung
 * bleibt es bei "mock" — die öffentliche Beta ist und bleibt eine Mock-Demo
 * (kein echter Login). Erst mit gesetztem Flag spricht das Portal die echte
 * API an (https://api.rollsportmanager.de), inklusive E-Mail/Passwort-Login.
 */

export type DataSourceName = "mock" | "api";

const requested = process.env.NEXT_PUBLIC_DATA_SOURCE;

/** Aktive Datenquelle — "api" nur bei NEXT_PUBLIC_DATA_SOURCE=api, sonst "mock". */
export const DATA_SOURCE: DataSourceName = requested === "api" ? "api" : "mock";

/**
 * Basis-URL der API. Ohne NEXT_PUBLIC_API_URL zeigt sie auf den lokalen
 * Dev-Stack (scripts/dev-stack.sh up → Port 3022). Für die echte Anbindung
 * setzt der Betrieb NEXT_PUBLIC_API_URL=https://api.rollsportmanager.de.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3022";

/** Der eine Demo-Verein aus dem Seed (Fallback, solange kein Login-Profil da ist). */
export const DEV_CLUB_ID = "c1ab0000-0000-4000-8000-000000000001";
