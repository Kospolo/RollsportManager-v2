import type {
  CompetitionStandings,
  FinanceExport,
  Id,
  PublicRoutine,
  RollArtScore,
  RoutineShare,
} from "@/lib/types";

/**
 * Eingabe-Typen + Facade-Segment des Wettkampf-Moduls (Rangliste, Live-Wertung,
 * Verbandsmeldung-Export, Kür-Teilen + öffentliche Token-Ansicht). Ausgelagert
 * aus lib/data/types.ts, damit die Datei < 400 Zeilen bleibt; die
 * DataRepository erbt WettkampfRepository (wie OrgRepository/FinanceRepository).
 *
 * Rechte sind SERVERSEITIG (RLS + Rollencheck):
 *  - Rangliste lesen (getCompetitionStandings) = is_club_member.
 *  - Live-Wertung erfassen (saveRoutineScore), Verbandsmeldung-Export
 *    (federationExportUrl) und Kür-Teilen (create/revoke/listRoutineShares)
 *    = is_club_trainer+ (im UI nur Trainer+ anzeigen).
 *  - Die ÖFFENTLICHE Ansicht (getPublicRoutine) ist UNAUTHENTIFIZIERT und geht
 *    über eine Client-Variante OHNE Auth-Header (PUBLIC_ROUTES, /public/-Prefix).
 * Die Facade reicht nur durch — Gating in der UI ist reine Anzeige.
 */

/**
 * Live-Wertung einer Kür (is_club_trainer+). `scoredOn` ist ein ISO-Datum
 * (YYYY-MM-DD). Technische/Komponenten-/Gesamtwertung sind optional; der Server
 * ergänzt total ggf. aus technical+components. `placement` ist die 1-basierte
 * Platzierung in der Kategorie, `competitionId` verknüpft die Wertung mit einem
 * Wettkampf (für Rangliste + delta). `scoringSystem` default "RollArt" (Server).
 */
export interface SaveRoutineScoreInput {
  /** ISO-Datum (YYYY-MM-DD) der Wertung. */
  scoredOn: string;
  scoringSystem?: string;
  technicalScore?: number;
  componentsScore?: number;
  totalScore?: number;
  competitionId?: Id;
  placement?: number;
  note?: string;
}

/**
 * Facade-Segment des Wettkampf-Moduls. DataRepository erbt es (analog
 * OrgRepository). Lese-/Schreibpfade scopen serverseitig über RLS; die
 * öffentliche Ansicht ist die EINZIGE login-freie Route.
 */
export interface WettkampfRepository {
  /* ---------- Rangliste (Lesen = is_club_member) ---------- */
  /**
   * Rangliste eines Wettkampfs — pro Kategorie gruppiert + gerankt. Zeilen
   * kommen bereits sortiert (category, rank, last_name); fürs UI nach `category`
   * gruppieren. `delta` = total_score minus Vorwertung derselben Kür (2 NK).
   */
  getCompetitionStandings(competitionId: Id): Promise<CompetitionStandings>;

  /* ---------- Live-Wertung erfassen (is_club_trainer+) ---------- */
  /** Wertung einer Kür anlegen (is_club_trainer) — liefert die erzeugte Wertung. */
  saveRoutineScore(routineId: Id, input: SaveRoutineScoreInput): Promise<RollArtScore>;

  /* ---------- Verbandsmeldung-Export (is_club_trainer+) ---------- */
  /**
   * Verbandsmeldung als CSV (Starter;Kategorie;Kür;Startgeld-Status;Verein).
   * KEIN JSON — echter Datei-Download via Bearer-fetch (wie die Finanz-Exporte),
   * liefert Blob + Dateiname für einen Download-Link/-Button. Member = 403.
   */
  federationExportUrl(competitionId: Id): Promise<FinanceExport>;

  /* ---------- Kür-Teilen (create/revoke/list = is_club_trainer+) ---------- */
  /** Öffentlichen Kür-Link erstellen (is_club_trainer). expiresAt weglassen = nie ablaufend. */
  createRoutineShare(routineId: Id, expiresAt?: string): Promise<RoutineShare>;
  /** Kür-Link widerrufen (is_club_trainer) — der Token wird sofort ungültig. */
  revokeRoutineShare(routineId: Id, token: string): Promise<{ revoked: boolean }>;
  /**
   * Aktive (in dieser Session erstellte) Kür-Links einer Kür (is_club_trainer).
   * Der Server bietet keinen Listen-Endpoint; die Facade führt daher eine
   * clientseitige Session-Registry (aus create/revoke), damit das Teilen-UI
   * (Copy/QR/WhatsApp wie v1) die eigenen Links anzeigen und widerrufen kann.
   */
  listRoutineShares(routineId: Id): Promise<RoutineShare[]>;

  /* ---------- Öffentliche Kür-Ansicht (UNAUTHENTIFIZIERT) ---------- */
  /**
   * Login-freie Kür-Ansicht per Token — nutzt eine Client-Variante OHNE
   * Auth-Header. Liefert nur minimale, nicht personenbezogene Daten. Unbekannter,
   * widerrufener oder abgelaufener Token = null (UI: „Link ungültig/abgelaufen").
   */
  getPublicRoutine(token: string): Promise<PublicRoutine | null>;
}
