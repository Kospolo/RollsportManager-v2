import type { OrgRepository } from "../inputs-org";
import { activeClubId, apiClient } from "./client";
import { mapAnniversary, mapDepartment, mapLocker, mapLockerRental } from "./mappers-org";

/**
 * API-Implementierung der Organisations-Module (Abteilungen, Schließfächer,
 * Jubiläen). Ausgelagert aus api/index.ts (< 400 Zeilen).
 *
 * Rechte sind SERVERSEITIG (RLS + Rollencheck + Trigger app.protect_locker):
 * Abteilungen/Schließfächer anlegen+verwalten = is_club_admin; Abteilungs-Roster
 * + Schließfach assign/release = is_club_trainer; Lesen/Jubiläen = is_club_member.
 */

export const moduleApiRepositoryOrg: OrgRepository = {
  /* ---------- Abteilungen ---------- */
  async listDepartments() {
    const rows = await apiClient.getDepartments({ club_id: activeClubId() });
    return rows.map(mapDepartment);
  },
  async createDepartment(input) {
    const created = await apiClient.postDepartments({
      club_id: activeClubId(),
      name: input.name,
      description: input.description,
      lead_member_id: input.leadMemberId,
      sort_order: input.sortOrder,
    });
    return mapDepartment(created);
  },
  async updateDepartment(departmentId, patch) {
    const updated = await apiClient.patchDepartmentsByDepartmentId(departmentId, {
      name: patch.name,
      description: patch.description,
      lead_member_id: patch.leadMemberId,
      sort_order: patch.sortOrder,
    });
    return mapDepartment(updated);
  },
  async deleteDepartment(departmentId) {
    const deleted = await apiClient.deleteDepartmentsByDepartmentId(departmentId);
    return { id: deleted.id };
  },
  async setDepartmentMembers(departmentId, input) {
    const updated = await apiClient.putDepartmentsByDepartmentIdMembers(departmentId, {
      member_ids: input.memberIds,
    });
    return mapDepartment(updated);
  },

  /* ---------- Schließfächer ---------- */
  async listLockers() {
    const rows = await apiClient.getLockers({ club_id: activeClubId() });
    return rows.map(mapLocker);
  },
  async createLocker(input) {
    const created = await apiClient.postLockers({
      club_id: activeClubId(),
      label: input.label,
      location: input.location,
      status: input.status,
      size: input.size,
      price_per_month_cents: input.pricePerMonthCents,
      assigned_member_id: input.assignedMemberId,
      note: input.note,
    });
    return mapLocker(created);
  },
  async updateLocker(lockerId, patch) {
    const updated = await apiClient.patchLockersByLockerId(lockerId, {
      label: patch.label,
      location: patch.location,
      status: patch.status,
      size: patch.size,
      price_per_month_cents: patch.pricePerMonthCents,
      assigned_member_id: patch.assignedMemberId,
      note: patch.note,
    });
    return mapLocker(updated);
  },
  async deleteLocker(lockerId) {
    const deleted = await apiClient.deleteLockersByLockerId(lockerId);
    return { id: deleted.id };
  },
  async assignLocker(lockerId, input) {
    const updated = await apiClient.patchLockersByLockerIdAssign(lockerId, {
      member_id: input.memberId,
    });
    return mapLocker(updated);
  },
  async releaseLocker(lockerId) {
    // Bodyless PATCH (in check.mjs allowlisted) — Server setzt status=free, member=null.
    const updated = await apiClient.patchLockersByLockerIdRelease(lockerId);
    return mapLocker(updated);
  },

  /* ---------- Vermietung (0070) ---------- */
  async listLockerRentals(filter) {
    const rows = await apiClient.getLockerRentals({
      club_id: activeClubId(),
      member_id: filter?.memberId,
      locker_id: filter?.lockerId,
      status: filter?.status,
    });
    return rows.map(mapLockerRental);
  },
  async createLockerRental(input) {
    const created = await apiClient.postLockerRentals({
      club_id: activeClubId(),
      locker_id: input.lockerId,
      member_id: input.memberId,
      // Bewusst KEIN `?? null`: weggelassen soll weggelassen bleiben (dann
      // entscheidet der Server-Default), null ist eine ausdrückliche Angabe.
      price_per_month_cents: input.pricePerMonthCents,
      start_on: input.startOn,
      end_on: input.endOn,
      status: input.status,
      note: input.note,
    });
    return mapLockerRental(created);
  },
  async updateLockerRental(rentalId, patch) {
    const updated = await apiClient.patchLockerRentalsByRentalId(rentalId, {
      price_per_month_cents: patch.pricePerMonthCents,
      start_on: patch.startOn,
      end_on: patch.endOn,
      status: patch.status,
      note: patch.note,
    });
    return mapLockerRental(updated);
  },
  async deleteLockerRental(rentalId) {
    const deleted = await apiClient.deleteLockerRentalsByRentalId(rentalId);
    return { id: deleted.id };
  },

  /* ---------- Jubiläen (reine Lesesicht) ---------- */
  async getAnniversaries() {
    const rows = await apiClient.getReportsAnniversaries({ club_id: activeClubId() });
    return rows.map(mapAnniversary);
  },
};
