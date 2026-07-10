import type { DataRepository } from "../types";
import { activeClubId, apiClient } from "./client";
import {
  mapAchievement,
  mapBooking,
  mapEquipment,
  mapFacility,
  mapReservation,
} from "./mappers-batch2";

/**
 * API-Implementierung der Batch-2-Module (Hallen, Buchungen, Equipment,
 * Reservierungen, Erfolge). Ausgelagert aus api/index.ts (< 400 Zeilen).
 *
 * Rechte sind SERVERSEITIG (RLS + Rollencheck): Hallen/Equipment/Erfolge
 * schreiben = Trainer+; Buchungen/Reservierungen anlegen = Selbst ODER Trainer,
 * ändern/löschen = Ersteller ODER Trainer. Die Facade reicht nur durch —
 * booked_by/reserved_by bestimmt der aufrufende Screen (Self-Service-UI).
 */

/** Nur die 20 Batch-2-Modul-Methoden — wird in apiRepository gespreizt. */
type ModuleMethods = Pick<
  DataRepository,
  | "listFacilities"
  | "createFacility"
  | "updateFacility"
  | "deleteFacility"
  | "listFacilityBookings"
  | "createBooking"
  | "updateBooking"
  | "deleteBooking"
  | "listEquipment"
  | "createEquipment"
  | "updateEquipment"
  | "deleteEquipment"
  | "listReservations"
  | "createReservation"
  | "updateReservation"
  | "deleteReservation"
  | "listAchievements"
  | "createAchievement"
  | "updateAchievement"
  | "deleteAchievement"
>;

export const moduleApiRepositoryBatch2: ModuleMethods = {
  /* ---------- Hallen ---------- */
  async listFacilities() {
    const rows = await apiClient.getFacilities({ club_id: activeClubId() });
    return rows.map(mapFacility);
  },
  async createFacility(input) {
    const created = await apiClient.postFacilities({
      club_id: activeClubId(),
      name: input.name,
      kind: input.kind,
      address: input.address,
      capacity: input.capacity,
      notes: input.notes,
    });
    return mapFacility(created);
  },
  async updateFacility(facilityId, patch) {
    const updated = await apiClient.patchFacilitiesByFacilityId(facilityId, {
      name: patch.name,
      kind: patch.kind,
      address: patch.address,
      capacity: patch.capacity,
      notes: patch.notes,
    });
    return mapFacility(updated);
  },
  async deleteFacility(facilityId) {
    const deleted = await apiClient.deleteFacilitiesByFacilityId(facilityId);
    return { id: deleted.id };
  },

  /* ---------- Hallenbuchungen ---------- */
  async listFacilityBookings(facilityId) {
    const rows = await apiClient.getFacilityBookings({
      club_id: activeClubId(),
      facility_id: facilityId,
    });
    return rows.map(mapBooking);
  },
  async createBooking(input) {
    const created = await apiClient.postFacilityBookings({
      club_id: activeClubId(),
      facility_id: input.facilityId,
      booked_by_member_id: input.bookedByMemberId,
      team_id: input.teamId,
      title: input.title,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      status: input.status,
    });
    return mapBooking(created);
  },
  async updateBooking(bookingId, patch) {
    const updated = await apiClient.patchFacilityBookingsByBookingId(bookingId, {
      title: patch.title,
      team_id: patch.teamId,
      starts_at: patch.startsAt,
      ends_at: patch.endsAt,
      status: patch.status,
    });
    return mapBooking(updated);
  },
  async deleteBooking(bookingId) {
    const deleted = await apiClient.deleteFacilityBookingsByBookingId(bookingId);
    return { id: deleted.id };
  },

  /* ---------- Equipment ---------- */
  async listEquipment() {
    const rows = await apiClient.getEquipment({ club_id: activeClubId() });
    return rows.map(mapEquipment);
  },
  async createEquipment(input) {
    const created = await apiClient.postEquipment({
      club_id: activeClubId(),
      name: input.name,
      category: input.category,
      total_quantity: input.totalQuantity,
      // Default: verfügbar = gesamt, wenn nicht explizit gesetzt (<= total).
      available_quantity: input.availableQuantity ?? input.totalQuantity,
      condition: input.condition,
      notes: input.notes,
    });
    return mapEquipment(created);
  },
  async updateEquipment(equipmentId, patch) {
    const updated = await apiClient.patchEquipmentByEquipmentId(equipmentId, {
      name: patch.name,
      category: patch.category,
      total_quantity: patch.totalQuantity,
      available_quantity: patch.availableQuantity,
      condition: patch.condition,
      notes: patch.notes,
    });
    return mapEquipment(updated);
  },
  async deleteEquipment(equipmentId) {
    const deleted = await apiClient.deleteEquipmentByEquipmentId(equipmentId);
    return { id: deleted.id };
  },

  /* ---------- Equipment-Reservierungen ---------- */
  async listReservations(equipmentId) {
    const rows = await apiClient.getEquipmentReservations({
      club_id: activeClubId(),
      equipment_id: equipmentId,
    });
    return rows.map(mapReservation);
  },
  async createReservation(input) {
    const created = await apiClient.postEquipmentReservations({
      club_id: activeClubId(),
      equipment_id: input.equipmentId,
      reserved_by_member_id: input.reservedByMemberId,
      quantity: input.quantity,
      from_at: input.fromAt,
      to_at: input.toAt,
      status: input.status,
    });
    return mapReservation(created);
  },
  async updateReservation(reservationId, patch) {
    const updated = await apiClient.patchEquipmentReservationsByReservationId(reservationId, {
      quantity: patch.quantity,
      from_at: patch.fromAt,
      to_at: patch.toAt,
      status: patch.status,
    });
    return mapReservation(updated);
  },
  async deleteReservation(reservationId) {
    const deleted = await apiClient.deleteEquipmentReservationsByReservationId(reservationId);
    return { id: deleted.id };
  },

  /* ---------- Erfolge/Medaillen ---------- */
  async listAchievements(memberId) {
    const rows = await apiClient.getAchievements({
      club_id: activeClubId(),
      member_id: memberId,
    });
    return rows.map(mapAchievement);
  },
  async createAchievement(input) {
    const created = await apiClient.postAchievements({
      club_id: activeClubId(),
      member_id: input.memberId,
      title: input.title,
      competition_name: input.competitionName,
      placement: input.placement,
      medal: input.medal,
      achieved_on: input.achievedOn,
      note: input.note,
    });
    return mapAchievement(created);
  },
  async updateAchievement(achievementId, patch) {
    const updated = await apiClient.patchAchievementsByAchievementId(achievementId, {
      title: patch.title,
      competition_name: patch.competitionName,
      placement: patch.placement,
      medal: patch.medal,
      achieved_on: patch.achievedOn,
      note: patch.note,
    });
    return mapAchievement(updated);
  },
  async deleteAchievement(achievementId) {
    const deleted = await apiClient.deleteAchievementsByAchievementId(achievementId);
    return { id: deleted.id };
  },
};
