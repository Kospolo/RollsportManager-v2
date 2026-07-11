import type { FinanceExport, Id, RoutineShare } from "@/lib/types";
import { ApiError } from "@/lib/api/generated";
import { readSession } from "@/lib/auth/storage";
import { API_BASE_URL } from "../config";
import type { WettkampfRepository } from "../inputs-wettkampf";
import { apiClient, publicApiClient } from "./client";
import { mapScore } from "./mappers";
import { mapPublicRoutine, mapRoutineShare, mapStandings } from "./mappers-wettkampf";

/**
 * API-Implementierung des Wettkampf-Moduls (Rangliste, Live-Wertung,
 * Verbandsmeldung-Export, Kür-Teilen + öffentliche Token-Ansicht). Ausgelagert
 * aus api/index.ts (< 400 Zeilen).
 *
 * Rechte SERVERSEITIG (RLS + Rollencheck): Rangliste lesen = is_club_member;
 * Live-Wertung + Verbandsmeldung + Kür-Teilen = is_club_trainer+ (Member = 403).
 *
 * EXPORT: /competitions/{id}/federation-export ist KEINE typisierte Route
 * (plain Hono, CSV-Datei), daher NICHT über den generierten Client, sondern per
 * Bearer-fetch als echter Datei-Download (wie die Finanz-Exporte).
 *
 * ÖFFENTLICH: getPublicRoutine nutzt den publicApiClient OHNE Auth-Header
 * (auth:false + kein getAccessToken); listRoutineShares hat serverseitig keinen
 * Listen-Endpoint und wird daher aus einer Session-Registry (create/revoke)
 * bedient.
 */

/** Verbandsmeldung-CSV via Bearer-fetch holen (nicht-typisiert, Datei-Download). */
async function fetchFederationExport(competitionId: Id): Promise<FinanceExport> {
  const token = readSession()?.token ?? null;
  const res = await fetch(
    `${API_BASE_URL}/competitions/${encodeURIComponent(competitionId)}/federation-export`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) throw new ApiError(res.status, null, `federation_export_failed_${res.status}`);
  return {
    blob: await res.blob(),
    filename: `verbandsmeldung_${competitionId}.csv`,
    contentType: res.headers.get("content-type") ?? "text/csv;charset=utf-8",
  };
}

/**
 * Session-Registry der in dieser Session erstellten Kür-Links pro Kür. Der
 * Server bietet keinen GET-Listen-Endpoint für Shares — die Facade hält die
 * eigenen Links, damit das Teilen-UI sie anzeigen + widerrufen kann.
 */
const shareRegistry = new Map<Id, RoutineShare[]>();

function rememberShare(routineId: Id, share: RoutineShare): void {
  const list = shareRegistry.get(routineId) ?? [];
  shareRegistry.set(routineId, [...list.filter((s) => s.token !== share.token), share]);
}

function forgetShare(routineId: Id, token: string): void {
  const list = shareRegistry.get(routineId);
  if (list) shareRegistry.set(routineId, list.filter((s) => s.token !== token));
}

export const moduleApiRepositoryWettkampf: WettkampfRepository = {
  /* ---------- Rangliste (is_club_member) ---------- */
  async getCompetitionStandings(competitionId) {
    return mapStandings(await apiClient.getCompetitionsByCompetitionIdStandings(competitionId));
  },

  /* ---------- Live-Wertung erfassen (is_club_trainer) ---------- */
  async saveRoutineScore(routineId, input) {
    const created = await apiClient.postRoutinesByRoutineIdScores(routineId, {
      scored_on: input.scoredOn,
      scoring_system: input.scoringSystem,
      technical_score: input.technicalScore,
      components_score: input.componentsScore,
      total_score: input.totalScore,
      competition_id: input.competitionId,
      placement: input.placement,
      note: input.note,
    });
    return mapScore(created);
  },

  /* ---------- Verbandsmeldung-Export (is_club_trainer, Bearer-fetch) ---------- */
  async federationExportUrl(competitionId) {
    return fetchFederationExport(competitionId);
  },

  /* ---------- Kür-Teilen (is_club_trainer) ---------- */
  async createRoutineShare(routineId, expiresAt) {
    const created = await apiClient.postRoutinesByRoutineIdShare(routineId, {
      expires_at: expiresAt,
    });
    const share = mapRoutineShare(created);
    rememberShare(routineId, share);
    return share;
  },
  async revokeRoutineShare(routineId, token) {
    const result = await apiClient.deleteRoutinesByRoutineIdShareByToken(routineId, token);
    forgetShare(routineId, token);
    return { revoked: result.revoked };
  },
  async listRoutineShares(routineId) {
    return shareRegistry.get(routineId) ?? [];
  },

  /* ---------- Öffentliche Kür-Ansicht (UNAUTHENTIFIZIERT, kein Bearer) ---------- */
  async getPublicRoutine(token) {
    try {
      return mapPublicRoutine(await publicApiClient.getPublicRoutinesByToken(token));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
};
