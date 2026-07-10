import { attendance, club, invoices, members, teams, upcomingEvents } from "@/lib/mock";
import type {
  DutyEntry,
  DutyRequirement,
  MemberRole,
  ReportRoleCount,
  ReportsSummary,
  ReportTeamCount,
  TrainingSlot,
} from "@/lib/types";
import type { DataRepository } from "../types";
import { openInvoices } from "../derive";
import { achievementSeed } from "./seed-batch2";
import { dutyEntrySeed, dutyRequirementSeed, trainingSlotSeed } from "./seed-batch3";

/**
 * Mock-Implementierung der Batch-3-Module (Trainingsplan, Pflichtstunden-Soll,
 * Pflichtstunden-Ist, Auswertung). Eigene In-Memory-Stores (Session-Lebensdauer),
 * kein echter Rechtecheck — die Wahrheit ist im api-Modus der Server. `approved`
 * kann hier frei gesetzt werden (serverseitig NUR Trainer, DB-Trigger + 403).
 */

const clubId = club.id;

const nowIso = (): string => new Date().toISOString();

/** 'HH:MM' → 'HH:MM:SS'; 'HH:MM:SS' bleibt unverändert. */
const normalizeTime = (t: string): string => (/^\d{2}:\d{2}$/.test(t) ? `${t}:00` : t);

const slotStore: TrainingSlot[] = trainingSlotSeed.map((s) => ({ ...s }));
const requirementStore: DutyRequirement[] = dutyRequirementSeed.map((r) => ({ ...r }));
const entryStore: DutyEntry[] = dutyEntrySeed.map((e) => ({ ...e }));

let slotSeq = slotStore.length;
let reqSeq = requirementStore.length;
let entSeq = entryStore.length;

/** Die 13 Batch-3-Modul-Methoden — wird in mockRepository gespreizt. */
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

/** Plausible Auswertung aus den Mock-Daten ableiten (nur Lesesicht). */
function buildReportsSummary(): ReportsSummary {
  const membersByRole: ReportRoleCount[] = [];
  const roleOrder: MemberRole[] = [
    "owner",
    "admin",
    "moderator",
    "treasurer",
    "coach",
    "member",
    "guest_coach",
  ];
  for (const role of roleOrder) {
    const count = members.filter((m) => m.role === role).length;
    if (count > 0) membersByRole.push({ role, count });
  }

  const membersByTeam: ReportTeamCount[] = teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    // Skater je Team = Mitglieder (Rolle member) mit Teamzuordnung.
    memberCount: members.filter((m) => m.role === "member" && m.teamIds.includes(t.id)).length,
  }));

  const present = attendance.filter((a) => a.status === "present" || a.status === "late").length;
  const attendanceRate =
    attendance.length > 0 ? Math.round((present / attendance.length) * 10_000) / 10_000 : 0;

  const open = openInvoices(invoices);
  const medals = { gold: 0, silver: 0, bronze: 0 };
  for (const a of achievementSeed) {
    if (a.medal) medals[a.medal] += 1;
  }

  const upcoming = upcomingEvents(365);
  return {
    clubId,
    membersTotal: members.length,
    membersActive: members.filter((m) => m.status === "active").length,
    membersByRole,
    membersByTeam,
    attendanceRate,
    openInvoicesTotalCents: open.reduce((sum, i) => sum + i.amountCents, 0),
    openInvoicesCount: open.length,
    medals,
    upcomingEventsCount: upcoming.length,
    upcomingEvents: upcoming.slice(0, 5).map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      startsAt: e.startsAt,
    })),
  };
}

export const moduleRepositoryBatch3: ModuleMethods = {
  /* ---------- Trainingsplan (Trainings-Slots) ---------- */
  async listTrainingSlots(teamId): Promise<TrainingSlot[]> {
    const list = teamId ? slotStore.filter((s) => s.teamId === teamId) : slotStore;
    return [...list].sort(
      (a, b) => a.weekday - b.weekday || a.startsTime.localeCompare(b.startsTime),
    );
  },
  async createTrainingSlot(input): Promise<TrainingSlot> {
    const now = nowIso();
    const created: TrainingSlot = {
      id: `slot-local-${++slotSeq}`,
      clubId,
      teamId: input.teamId,
      weekday: input.weekday,
      startsTime: normalizeTime(input.startsTime),
      endsTime: normalizeTime(input.endsTime),
      facilityId: input.facilityId,
      location: input.location,
      coachMemberId: input.coachMemberId,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    };
    slotStore.push(created);
    return created;
  },
  async updateTrainingSlot(slotId, patch): Promise<TrainingSlot> {
    const item = slotStore.find((s) => s.id === slotId);
    if (!item) throw new Error(`Trainings-Slot ${slotId} nicht gefunden (mock)`);
    if (patch.weekday !== undefined) item.weekday = patch.weekday;
    if (patch.startsTime !== undefined) item.startsTime = normalizeTime(patch.startsTime);
    if (patch.endsTime !== undefined) item.endsTime = normalizeTime(patch.endsTime);
    if (patch.teamId !== undefined) item.teamId = patch.teamId ?? undefined;
    if (patch.facilityId !== undefined) item.facilityId = patch.facilityId ?? undefined;
    if (patch.location !== undefined) item.location = patch.location ?? undefined;
    if (patch.coachMemberId !== undefined) item.coachMemberId = patch.coachMemberId ?? undefined;
    if (patch.note !== undefined) item.note = patch.note ?? undefined;
    item.updatedAt = nowIso();
    return item;
  },
  async deleteTrainingSlot(slotId): Promise<{ id: string }> {
    const idx = slotStore.findIndex((s) => s.id === slotId);
    if (idx >= 0) slotStore.splice(idx, 1);
    return { id: slotId };
  },

  /* ---------- Pflichtstunden-Soll (Duty Requirements) ---------- */
  async listDutyRequirements(teamId): Promise<DutyRequirement[]> {
    const list = teamId ? requirementStore.filter((r) => r.teamId === teamId) : requirementStore;
    return [...list].sort((a, b) => a.seasonLabel.localeCompare(b.seasonLabel, "de"));
  },
  async createDutyRequirement(input): Promise<DutyRequirement> {
    const now = nowIso();
    const created: DutyRequirement = {
      id: `duty-req-local-${++reqSeq}`,
      clubId,
      teamId: input.teamId,
      memberId: input.memberId,
      seasonLabel: input.seasonLabel,
      requiredHours: input.requiredHours,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      createdAt: now,
      updatedAt: now,
    };
    requirementStore.push(created);
    return created;
  },
  async updateDutyRequirement(requirementId, patch): Promise<DutyRequirement> {
    const item = requirementStore.find((r) => r.id === requirementId);
    if (!item) throw new Error(`Pflichtstunden-Soll ${requirementId} nicht gefunden (mock)`);
    if (patch.seasonLabel !== undefined) item.seasonLabel = patch.seasonLabel;
    if (patch.requiredHours !== undefined) item.requiredHours = patch.requiredHours;
    if (patch.periodStart !== undefined) item.periodStart = patch.periodStart;
    if (patch.periodEnd !== undefined) item.periodEnd = patch.periodEnd;
    if (patch.teamId !== undefined) item.teamId = patch.teamId ?? undefined;
    if (patch.memberId !== undefined) item.memberId = patch.memberId ?? undefined;
    item.updatedAt = nowIso();
    return item;
  },
  async deleteDutyRequirement(requirementId): Promise<{ id: string }> {
    const idx = requirementStore.findIndex((r) => r.id === requirementId);
    if (idx >= 0) requirementStore.splice(idx, 1);
    return { id: requirementId };
  },

  /* ---------- Pflichtstunden-Ist (Duty Entries) ---------- */
  async listDutyEntries(memberId): Promise<DutyEntry[]> {
    const list = memberId ? entryStore.filter((e) => e.memberId === memberId) : entryStore;
    return [...list].sort((a, b) => b.activityDate.localeCompare(a.activityDate));
  },
  async createDutyEntry(input): Promise<DutyEntry> {
    const now = nowIso();
    const created: DutyEntry = {
      id: `duty-entry-local-${++entSeq}`,
      clubId,
      memberId: input.memberId,
      hours: input.hours,
      activityDate: input.activityDate,
      kind: input.kind ?? "training",
      note: input.note,
      // Serverseitig darf NUR Trainer approven — im Mock ohne Rechtecheck.
      approved: input.approved ?? false,
      createdAt: now,
      updatedAt: now,
    };
    entryStore.unshift(created);
    return created;
  },
  async updateDutyEntry(entryId, patch): Promise<DutyEntry> {
    const item = entryStore.find((e) => e.id === entryId);
    if (!item) throw new Error(`Pflichtstunden-Eintrag ${entryId} nicht gefunden (mock)`);
    if (patch.hours !== undefined) item.hours = patch.hours;
    if (patch.activityDate !== undefined) item.activityDate = patch.activityDate;
    if (patch.kind !== undefined) item.kind = patch.kind;
    if (patch.note !== undefined) item.note = patch.note ?? undefined;
    if (patch.approved !== undefined) item.approved = patch.approved;
    item.updatedAt = nowIso();
    return item;
  },
  async deleteDutyEntry(entryId): Promise<{ id: string }> {
    const idx = entryStore.findIndex((e) => e.id === entryId);
    if (idx >= 0) entryStore.splice(idx, 1);
    return { id: entryId };
  },

  /* ---------- Auswertung (Reports Summary) ---------- */
  async getReportsSummary(): Promise<ReportsSummary> {
    return buildReportsSummary();
  },
};
