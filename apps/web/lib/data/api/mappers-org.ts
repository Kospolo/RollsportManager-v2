import type * as M from "@/lib/api/generated";
import type { Anniversary, Department, Locker, LockerRental } from "@/lib/types";

/**
 * Mapper der Organisations-Module (Abteilungen, Schließfächer, Jubiläen):
 * API-Wire-Format (snake_case) → View-Typen (lib/types, camelCase). Ausgelagert
 * aus api/mappers.ts, damit beide Dateien < 400 Zeilen bleiben.
 */

export function mapDepartment(w: M.Department): Department {
  return {
    id: w.id,
    clubId: w.club_id,
    name: w.name,
    description: w.description ?? undefined,
    leadMemberId: w.lead_member_id ?? undefined,
    sortOrder: w.sort_order,
    memberIds: [...w.member_ids],
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapLocker(w: M.Locker): Locker {
  return {
    id: w.id,
    clubId: w.club_id,
    label: w.label,
    location: w.location ?? undefined,
    status: w.status,
    size: w.size,
    // Beträge werden NICHT mit ?? undefined entschärft: null ist hier eine
    // Aussage („kein Preis festgelegt") und muss von 0 („kostenlos")
    // unterscheidbar bleiben. undefined würde beides zu „nichts" einebnen.
    pricePerMonthCents: w.price_per_month_cents,
    hasActiveRental: w.has_active_rental,
    assignedMemberId: w.assigned_member_id ?? undefined,
    note: w.note ?? undefined,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapLockerRental(w: M.LockerRental): LockerRental {
  return {
    id: w.id,
    clubId: w.club_id,
    lockerId: w.locker_id,
    memberId: w.member_id,
    // Siehe mapLocker: null bleibt null.
    pricePerMonthCents: w.price_per_month_cents,
    startOn: w.start_on,
    endOn: w.end_on,
    status: w.status,
    note: w.note ?? undefined,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapAnniversary(w: M.Anniversary): Anniversary {
  return {
    memberId: w.member_id,
    memberName: w.member_name,
    kind: w.kind,
    date: w.date,
    years: w.years,
    daysUntil: w.days_until,
  };
}
