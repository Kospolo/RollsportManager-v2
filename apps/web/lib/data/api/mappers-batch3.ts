import type * as M from "@/lib/api/generated";
import type {
  DutyEntry,
  DutyRequirement,
  ReportsSummary,
  TrainingSlot,
} from "@/lib/types";

/**
 * Mapper der Batch-3-Module (Trainingsplan, Pflichtstunden, Auswertung):
 * API-Wire-Format (snake_case) → View-Typen (lib/types, camelCase).
 * Ausgelagert aus api/mappers.ts, damit beide Dateien < 400 Zeilen bleiben.
 *
 * Numerische Aggregate/Dezimalfelder kommen im Wire-Contract als `number|null`
 * (Server-Aggregat kann NULL sein) → defensiv auf 0 normalisieren.
 */

export function mapTrainingSlot(w: M.TrainingSlot): TrainingSlot {
  return {
    id: w.id,
    clubId: w.club_id,
    teamId: w.team_id ?? undefined,
    // weekday 0..6 (0 = Montag) — die Backend-Konvention wird 1:1 übernommen.
    weekday: w.weekday as TrainingSlot["weekday"],
    startsTime: w.starts_time,
    endsTime: w.ends_time,
    facilityId: w.facility_id ?? undefined,
    location: w.location ?? undefined,
    coachMemberId: w.coach_member_id ?? undefined,
    note: w.note ?? undefined,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapDutyRequirement(w: M.DutyRequirement): DutyRequirement {
  return {
    id: w.id,
    clubId: w.club_id,
    teamId: w.team_id ?? undefined,
    memberId: w.member_id ?? undefined,
    seasonLabel: w.season_label,
    requiredHours: w.required_hours ?? 0,
    periodStart: w.period_start,
    periodEnd: w.period_end,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapDutyEntry(w: M.DutyEntry): DutyEntry {
  return {
    id: w.id,
    clubId: w.club_id,
    memberId: w.member_id,
    hours: w.hours ?? 0,
    activityDate: w.activity_date,
    kind: w.kind,
    note: w.note ?? undefined,
    approved: w.approved,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapReportsSummary(w: M.ReportSummary): ReportsSummary {
  return {
    clubId: w.club_id,
    membersTotal: w.members_total ?? 0,
    membersActive: w.members_active ?? 0,
    membersByRole: w.members_by_role.map((r) => ({
      role: r.role,
      count: r.count ?? 0,
    })),
    membersByTeam: w.members_by_team.map((t) => ({
      teamId: t.team_id,
      teamName: t.team_name,
      memberCount: t.member_count ?? 0,
    })),
    attendanceRate: w.attendance_rate ?? 0,
    openInvoicesTotalCents: w.open_invoices_total_cents ?? 0,
    openInvoicesCount: w.open_invoices_count ?? 0,
    medals: {
      gold: w.medals.gold ?? 0,
      silver: w.medals.silver ?? 0,
      bronze: w.medals.bronze ?? 0,
    },
    upcomingEventsCount: w.upcoming_events_count ?? 0,
    upcomingEvents: w.upcoming_events.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      startsAt: e.starts_at,
    })),
  };
}
