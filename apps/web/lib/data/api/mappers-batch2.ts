import type * as M from "@/lib/api/generated";
import type {
  Achievement,
  Equipment,
  EquipmentReservation,
  Facility,
  FacilityBooking,
} from "@/lib/types";

/**
 * Mapper der Batch-2-Module (Hallen, Buchungen, Equipment, Reservierungen,
 * Erfolge): API-Wire-Format (snake_case) → View-Typen (lib/types, camelCase).
 * Ausgelagert aus api/mappers.ts, damit beide Dateien < 400 Zeilen bleiben.
 */

export function mapFacility(w: M.Facility): Facility {
  return {
    id: w.id,
    clubId: w.club_id,
    name: w.name,
    kind: w.kind,
    address: w.address ?? undefined,
    capacity: w.capacity ?? undefined,
    notes: w.notes ?? undefined,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapBooking(w: M.FacilityBooking): FacilityBooking {
  return {
    id: w.id,
    facilityId: w.facility_id,
    clubId: w.club_id,
    bookedByMemberId: w.booked_by_member_id,
    teamId: w.team_id ?? undefined,
    title: w.title,
    startsAt: w.starts_at,
    endsAt: w.ends_at,
    status: w.status,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapEquipment(w: M.Equipment): Equipment {
  return {
    id: w.id,
    clubId: w.club_id,
    name: w.name,
    category: w.category ?? undefined,
    totalQuantity: w.total_quantity ?? undefined,
    availableQuantity: w.available_quantity ?? undefined,
    condition: w.condition,
    notes: w.notes ?? undefined,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapReservation(w: M.EquipmentReservation): EquipmentReservation {
  return {
    id: w.id,
    equipmentId: w.equipment_id,
    clubId: w.club_id,
    reservedByMemberId: w.reserved_by_member_id,
    quantity: w.quantity ?? undefined,
    fromAt: w.from_at,
    toAt: w.to_at,
    status: w.status,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapAchievement(w: M.Achievement): Achievement {
  return {
    id: w.id,
    clubId: w.club_id,
    memberId: w.member_id,
    title: w.title,
    competitionName: w.competition_name ?? undefined,
    placement: w.placement ?? undefined,
    // medal ist im Wire-Contract non-null, kann fachlich aber fehlen
    // (Teilnahme ohne Medaille) → defensiv auf undefined normalisieren.
    medal: w.medal ?? undefined,
    achievedOn: w.achieved_on,
    note: w.note ?? undefined,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}
