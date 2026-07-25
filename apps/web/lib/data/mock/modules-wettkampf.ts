import * as mock from "@/lib/mock";
import type {
  Competition,
  CompetitionStandingRow,
  CompetitionStandings,
  FinanceExport,
  Id,
  PublicRoutine,
  RollArtScore,
  RoutineShare,
} from "@/lib/types";
import type {
  CreateCompetitionInput,
  UpdateCompetitionInput,
  WettkampfRepository,
} from "../inputs-wettkampf";

/**
 * Mock-Implementierung des Wettkampf-Moduls (Rangliste, Live-Wertung,
 * Verbandsmeldung-Export, Kür-Teilen + öffentliche Token-Ansicht). Plausible
 * Ableitungen aus den bestehenden Mock-Daten (Wettkämpfe, Küren, Mitglieder);
 * kein echter Rechtecheck — die Wahrheit ist im api-Modus der Server.
 *
 * Rangliste: pro Kategorie nach total_score (desc) gerankt; delta = Differenz
 * des jüngsten total_score zur unmittelbaren Vorwertung derselben Kür (2 NK).
 * Kür-Links leben in einer Session-Registry (create/revoke/list). Die
 * öffentliche Ansicht ist ein STUB (auch im Prod-mock) — nicht personenbezogen.
 */

const STARTGELD_STATUS_DE: Record<number, string> = {
  0: "gemeldet",
  1: "bestätigt",
  2: "zurückgezogen",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Fortlaufende Nummer für lokal (in dieser Session) angelegte Wettkämpfe. */
let competitionSeq = 0;

/** Session-Registry der Live-Wertungen (mock) — pro Kür an die Historie gehängt. */
const scoreStore = new Map<Id, RollArtScore[]>();
let scoreSeq = 0;

/** Alle Wertungen einer Kür (Seed + in dieser Session erfasste), chronologisch. */
function routineScores(routineId: Id): RollArtScore[] {
  const seed = mock.routineById(routineId)?.scores ?? [];
  const extra = scoreStore.get(routineId) ?? [];
  return [...seed, ...extra].sort((a, b) => a.date.localeCompare(b.date));
}

/** Eine Ranglistenzeile aus einer Kür ableiten (jüngste Wertung + delta). */
function standingRow(routineId: Id): CompetitionStandingRow | null {
  const routine = mock.routineById(routineId);
  if (!routine) return null;
  const scores = routineScores(routineId);
  const latest = scores[scores.length - 1];
  const previous = scores.length > 1 ? scores[scores.length - 2] : undefined;
  const memberId = routine.memberIds[0] ?? "";
  const member = memberId ? mock.memberById(memberId) : undefined;
  return {
    category: routine.category || "Ohne Kategorie",
    rank: null, // wird nach der Gruppierung gesetzt
    entryId: `entry-${routineId}`,
    memberId,
    firstName: member?.firstName ?? null,
    lastName: member?.lastName ?? null,
    routineId,
    routineTitle: routine.title,
    technicalScore: latest?.technical ?? null,
    componentsScore: latest?.components ?? null,
    totalScore: latest?.total ?? null,
    placement: latest?.placement ?? null,
    delta: latest && previous ? round2(latest.total - previous.total) : null,
  };
}

/** Zeilen pro Kategorie nach total_score (desc) ranken (1-basiert). */
function rankByCategory(rows: CompetitionStandingRow[]): CompetitionStandingRow[] {
  const byCategory = new Map<string, CompetitionStandingRow[]>();
  for (const row of rows) {
    const list = byCategory.get(row.category) ?? [];
    list.push(row);
    byCategory.set(row.category, list);
  }
  const ranked: CompetitionStandingRow[] = [];
  for (const [, list] of [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0], "de"))) {
    list
      .sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1))
      .forEach((row, i) => ranked.push({ ...row, rank: row.totalScore == null ? null : i + 1 }));
  }
  return ranked;
}

/** Session-Registry der öffentlichen Kür-Links (mock) — pro Kür. */
const shareStore = new Map<Id, RoutineShare[]>();
let shareSeq = 0;

function csvExport(rows: string[][], filename: string): FinanceExport {
  const body = rows.map((cols) => cols.join(";")).join("\r\n");
  const blob = new Blob([`﻿${body}\r\n`], { type: "text/csv;charset=utf-8" });
  return { blob, filename, contentType: "text/csv;charset=utf-8" };
}

export const moduleRepositoryWettkampf: WettkampfRepository = {
  /* ---------- Wettkampf-CRUD (mutiert mock.competitions) ---------- */
  async createCompetition(input: CreateCompetitionInput): Promise<Competition> {
    const created: Competition = {
      id: `c-local-${++competitionSeq}`,
      clubId: mock.club.id,
      name: input.name,
      location: input.location ?? "",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      registrationDeadline: input.registrationDeadline,
      status: input.status ?? "upcoming",
      participantIds: input.participantIds ?? [],
      routineIds: input.routineIds ?? [],
    };
    // In den EINEN Store pushen — getCompetitions() gibt eine Kopie zurück,
    // die Referenz ändert sich, der Screen rendert nach reload() neu.
    mock.competitions.push(created);
    return { ...created };
  },

  async updateCompetition(id: Id, patch: UpdateCompetitionInput): Promise<Competition> {
    const index = mock.competitions.findIndex((c) => c.id === id);
    if (index < 0) throw new Error(`Wettkampf ${id} nicht gefunden (mock)`);
    const base = mock.competitions[index];
    const next: Competition = { ...base };
    if (patch.name !== undefined) next.name = patch.name;
    // location ist im View-Modell nicht nullable — null/"" wird zum Leerstring.
    if (patch.location !== undefined) next.location = patch.location ?? "";
    if (patch.startsAt !== undefined) next.startsAt = patch.startsAt;
    if (patch.endsAt !== undefined) next.endsAt = patch.endsAt ?? undefined;
    if (patch.registrationDeadline !== undefined) {
      next.registrationDeadline = patch.registrationDeadline ?? undefined;
    }
    if (patch.status !== undefined) next.status = patch.status;
    if (patch.participantIds !== undefined) next.participantIds = [...patch.participantIds];
    if (patch.routineIds !== undefined) next.routineIds = [...patch.routineIds];
    mock.competitions[index] = next; // Override an Ort und Stelle
    return { ...next };
  },

  async deleteCompetition(id: Id): Promise<{ id: Id }> {
    const index = mock.competitions.findIndex((c) => c.id === id);
    if (index >= 0) mock.competitions.splice(index, 1);
    return { id };
  },

  /* ---------- Rangliste ---------- */
  async getCompetitionStandings(competitionId): Promise<CompetitionStandings> {
    const competition = mock.competitions.find((c) => c.id === competitionId);
    const rows = (competition?.routineIds ?? [])
      .map(standingRow)
      .filter((r): r is CompetitionStandingRow => r !== null);
    return {
      competitionId,
      name: competition?.name ?? "Wettkampf",
      rows: rankByCategory(rows),
    };
  },

  /* ---------- Live-Wertung erfassen ---------- */
  async saveRoutineScore(routineId, input): Promise<RollArtScore> {
    const technical = input.technicalScore ?? 0;
    const components = input.componentsScore ?? 0;
    const score: RollArtScore = {
      id: `score-local-${++scoreSeq}`,
      date: input.scoredOn,
      competitionId: input.competitionId,
      technical,
      components,
      total: input.totalScore ?? technical + components,
      placement: input.placement ?? null,
    };
    scoreStore.set(routineId, [...(scoreStore.get(routineId) ?? []), score]);
    return score;
  },

  /* ---------- Verbandsmeldung-Export ---------- */
  async federationExportUrl(competitionId): Promise<FinanceExport> {
    const competition = mock.competitions.find((c) => c.id === competitionId);
    const header = ["Starter", "Kategorie", "Kür", "Startgeld-Status", "Verein"];
    const rows: string[][] = [header];
    (competition?.routineIds ?? []).forEach((routineId, i) => {
      const routine = mock.routineById(routineId);
      if (!routine) return;
      const member = routine.memberIds[0] ? mock.memberById(routine.memberIds[0]) : undefined;
      const starter = member ? `${member.firstName} ${member.lastName}` : "";
      rows.push([
        starter,
        routine.category || "",
        routine.title,
        STARTGELD_STATUS_DE[i % 3] ?? "gemeldet",
        mock.club.name,
      ]);
    });
    return csvExport(rows, `verbandsmeldung_${competitionId}.csv`);
  },

  /* ---------- Kür-Teilen ---------- */
  async createRoutineShare(routineId, expiresAt): Promise<RoutineShare> {
    const token = `share-mock-${++shareSeq}-${Math.random().toString(36).slice(2, 8)}`;
    const share: RoutineShare = {
      token,
      url: `/wettkampf/kuer/${token}`,
      expiresAt: expiresAt ?? null,
    };
    shareStore.set(routineId, [...(shareStore.get(routineId) ?? []), share]);
    return share;
  },
  async revokeRoutineShare(routineId, token): Promise<{ revoked: boolean }> {
    const list = shareStore.get(routineId);
    if (list) shareStore.set(routineId, list.filter((s) => s.token !== token));
    return { revoked: true };
  },
  async listRoutineShares(routineId): Promise<RoutineShare[]> {
    return shareStore.get(routineId) ?? [];
  },

  /* ---------- Öffentliche Kür-Ansicht (Stub, nicht personenbezogen) ---------- */
  async getPublicRoutine(token): Promise<PublicRoutine | null> {
    // Testbarkeit der 404-UI: offensichtlich ungültige Tokens liefern null.
    if (!token || ["revoked", "expired", "unknown"].includes(token)) return null;
    // Ein widerrufener Session-Token (nicht mehr in der Registry) → ebenfalls null,
    // sobald überhaupt Links erstellt wurden.
    const known = [...shareStore.values()].flat();
    if (known.length > 0 && !known.some((s) => s.token === token)) return null;
    const routine = mock.routines[0];
    return {
      title: routine.title,
      discipline: mock.club.discipline || null,
      clubName: mock.club.name,
      musicTitle: routine.music.title || null,
      musicArtist: routine.music.artist || null,
      musicBpm: routine.music.bpm ?? null,
      musicDurationMs: routine.music.durationMs ?? null,
      markers: routine.markers.map((m) => ({
        timeMs: m.timeMs,
        label: m.label,
        elementCode: m.elementCode ?? null,
      })),
      scores: routine.scores.map((s) => ({
        scoredOn: s.date,
        technicalScore: s.technical,
        componentsScore: s.components,
        totalScore: s.total,
        placement: s.placement ?? null,
      })),
    };
  },
};
