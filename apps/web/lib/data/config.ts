/**
 * Zentrale Datenquellen-Konfiguration des Portals.
 *
 * NEXT_PUBLIC_DATA_SOURCE=mock|api — Default ist IMMER "mock".
 * Der api-Modus ist reine Entwicklung (Dev-Login, lokaler Stack) und wird
 * in Produktions-Builds hart verweigert: `next build` läuft mit
 * NODE_ENV=production, dadurch fällt DATA_SOURCE dort immer auf "mock"
 * zurück, egal was in der Umgebung steht.
 */

export type DataSourceName = "mock" | "api";

const requested = process.env.NEXT_PUBLIC_DATA_SOURCE;

/** Aktive Datenquelle — api nur im Dev-Modus (`next dev`). */
export const DATA_SOURCE: DataSourceName =
  requested === "api" && process.env.NODE_ENV !== "production" ? "api" : "mock";

/** Basis-URL der lokalen Dev-API (scripts/dev-stack.sh up → Port 3022). */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:3022";

/** Der eine Demo-Verein aus dem Seed (Fallback, solange kein Login-Profil da ist). */
export const DEV_CLUB_ID = "c1ab0000-0000-4000-8000-000000000001";
