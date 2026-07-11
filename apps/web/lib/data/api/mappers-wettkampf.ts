import type * as M from "@/lib/api/generated";
import type {
  CompetitionStandingRow,
  CompetitionStandings,
  PublicRoutine,
  RoutineShare,
} from "@/lib/types";

/**
 * Mapper: API-Wire-Format (snake_case) → View-Typen (lib/types, camelCase) für
 * das Wettkampf-Modul (Rangliste, Kür-Teilen, öffentliche Ansicht). Ausgelagert
 * aus api/mappers.ts (< 400 Zeilen), analog mappers-org/mappers-finance*.
 */

export function mapStandingRow(w: M.CompetitionStandingRow): CompetitionStandingRow {
  return {
    category: w.category,
    rank: w.rank,
    entryId: w.entry_id,
    memberId: w.member_id,
    firstName: w.first_name,
    lastName: w.last_name,
    routineId: w.routine_id,
    routineTitle: w.routine_title,
    technicalScore: w.technical_score,
    componentsScore: w.components_score,
    totalScore: w.total_score,
    placement: w.placement,
    delta: w.delta,
  };
}

export function mapStandings(w: M.CompetitionStandings): CompetitionStandings {
  return {
    competitionId: w.competition_id,
    name: w.name,
    rows: w.rows.map(mapStandingRow),
  };
}

export function mapRoutineShare(w: M.RoutineShareCreated): RoutineShare {
  return {
    token: w.token,
    url: w.url,
    expiresAt: w.expires_at,
  };
}

export function mapPublicRoutine(w: M.PublicRoutine): PublicRoutine {
  return {
    title: w.title,
    discipline: w.discipline,
    clubName: w.club_name,
    musicTitle: w.music_title,
    musicArtist: w.music_artist,
    musicBpm: w.music_bpm,
    musicDurationMs: w.music_duration_ms,
    markers: w.markers.map((m) => ({
      timeMs: m.time_ms,
      label: m.label,
      elementCode: m.element_code,
    })),
    scores: w.scores.map((s) => ({
      scoredOn: s.scored_on,
      technicalScore: s.technical_score,
      componentsScore: s.components_score,
      totalScore: s.total_score,
      placement: s.placement,
    })),
  };
}
