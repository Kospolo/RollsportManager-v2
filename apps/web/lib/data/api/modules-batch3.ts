import type { DataRepository } from "../types";
import { activeClubId, apiClient } from "./client";
import {
  mapDutyEntry,
  mapDutyRequirement,
  mapReportsSummary,
  mapTrainingSlot,
} from "./mappers-batch3";

/**
 * API-Implementierung der Batch-3-Module (Trainingsplan, Pflichtstunden-Soll,
 * Pflichtstunden-Ist, Auswertung). Ausgelagert aus api/index.ts (< 400 Zeilen).
 *
 * Rechte sind SERVERSEITIG (RLS + Rollencheck): Trainings-Slots und
 * Pflichtstunden-Soll schreiben = Trainerstab+; Ist-Stunden lesen/schreiben =
 * eigenes Mitglied ODER Trainer (RLS liefert Mitglied nur eigene), `approved`
 * NUR Trainer (DB-Trigger 42501 + API-403); Auswertung = Trainerstab/Admin.
 * Die Facade reicht nur durch — member_id bestimmt der aufrufende Screen.
 */

/** 'HH:MM' → 'HH:MM:SS'; 'HH:MM:SS' bleibt unverändert (undefined bleibt undefined). */
function normalizeTime(t?: string): string | undefined {
  if (t === undefined) return undefined;
  return /^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t;
}

/** Nur die 13 Batch-3-Modul-Methoden — wird in apiRepository gespreizt. */
type ModuleMethods = Pick<
  DataRepository,
  | "listTrainingSlots"
  | "createTrainingSlot"
  | "updateTrainingSlot"
  | "deleteTrainingSlot"
  | "listDutyRequirements"
  | "createDutyRequirement"
  | "updateDutyRequirement"
  | "deleteDutyRequirement"
  | "listDutyEntries"
  | "createDutyEntry"
  | "updateDutyEntry"
  | "deleteDutyEntry"
  | "getReportsSummary"
>;

export const moduleApiRepositoryBatch3: ModuleMethods = {
  /* ---------- Trainingsplan (Trainings-Slots) ---------- */
  async listTrainingSlots(teamId) {
    const rows = await apiClient.getTrainingSlots({
      club_id: activeClubId(),
      team_id: teamId,
    });
    return rows.map(mapTrainingSlot);
  },
  async createTrainingSlot(input) {
    const created = await apiClient.postTrainingSlots({
      club_id: activeClubId(),
      weekday: input.weekday,
      starts_time: normalizeTime(input.startsTime) as string,
      ends_time: normalizeTime(input.endsTime) as string,
      team_id: input.teamId,
      facility_id: input.facilityId,
      location: input.location,
      coach_member_id: input.coachMemberId,
      note: input.note,
    });
    return mapTrainingSlot(created);
  },
  async updateTrainingSlot(slotId, patch) {
    const updated = await apiClient.patchTrainingSlotsBySlotId(slotId, {
      weekday: patch.weekday,
      starts_time: normalizeTime(patch.startsTime),
      ends_time: normalizeTime(patch.endsTime),
      team_id: patch.teamId,
      facility_id: patch.facilityId,
      location: patch.location,
      coach_member_id: patch.coachMemberId,
      note: patch.note,
    });
    return mapTrainingSlot(updated);
  },
  async deleteTrainingSlot(slotId) {
    const deleted = await apiClient.deleteTrainingSlotsBySlotId(slotId);
    return { id: deleted.id };
  },

  /* ---------- Pflichtstunden-Soll (Duty Requirements) ---------- */
  async listDutyRequirements(teamId) {
    const rows = await apiClient.getDutyRequirements({
      club_id: activeClubId(),
      team_id: teamId,
    });
    return rows.map(mapDutyRequirement);
  },
  async createDutyRequirement(input) {
    const created = await apiClient.postDutyRequirements({
      club_id: activeClubId(),
      season_label: input.seasonLabel,
      required_hours: input.requiredHours,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      team_id: input.teamId,
      member_id: input.memberId,
    });
    return mapDutyRequirement(created);
  },
  async updateDutyRequirement(requirementId, patch) {
    const updated = await apiClient.patchDutyRequirementsByRequirementId(requirementId, {
      season_label: patch.seasonLabel,
      required_hours: patch.requiredHours,
      period_start: patch.periodStart,
      period_end: patch.periodEnd,
      team_id: patch.teamId,
      member_id: patch.memberId,
    });
    return mapDutyRequirement(updated);
  },
  async deleteDutyRequirement(requirementId) {
    const deleted = await apiClient.deleteDutyRequirementsByRequirementId(requirementId);
    return { id: deleted.id };
  },

  /* ---------- Pflichtstunden-Ist (Duty Entries) ---------- */
  async listDutyEntries(memberId) {
    const rows = await apiClient.getDutyEntries({
      club_id: activeClubId(),
      member_id: memberId,
    });
    return rows.map(mapDutyEntry);
  },
  async createDutyEntry(input) {
    const created = await apiClient.postDutyEntries({
      club_id: activeClubId(),
      member_id: input.memberId,
      hours: input.hours,
      activity_date: input.activityDate,
      kind: input.kind,
      note: input.note,
      approved: input.approved,
    });
    return mapDutyEntry(created);
  },
  async updateDutyEntry(entryId, patch) {
    const updated = await apiClient.patchDutyEntriesByEntryId(entryId, {
      hours: patch.hours,
      activity_date: patch.activityDate,
      kind: patch.kind,
      note: patch.note,
      approved: patch.approved,
    });
    return mapDutyEntry(updated);
  },
  async deleteDutyEntry(entryId) {
    const deleted = await apiClient.deleteDutyEntriesByEntryId(entryId);
    return { id: deleted.id };
  },

  /* ---------- Auswertung (Reports Summary) ---------- */
  async getReportsSummary() {
    const summary = await apiClient.getReportsSummary({ club_id: activeClubId() });
    return mapReportsSummary(summary);
  },
};
