import { club } from "@/lib/mock";
import type {
  Achievement,
  Equipment,
  EquipmentReservation,
  Facility,
  FacilityBooking,
} from "@/lib/types";
import type { DataRepository } from "../types";
import {
  achievementSeed,
  bookingSeed,
  equipmentSeed,
  facilitySeed,
  reservationSeed,
} from "./seed-batch2";

/**
 * Mock-Implementierung der Batch-2-Module (Hallen, Buchungen, Equipment,
 * Reservierungen, Erfolge). Eigene In-Memory-Stores (Session-Lebensdauer),
 * kein echter Rechtecheck — die Wahrheit ist im api-Modus der Server.
 * booked_by/reserved_by kommt aus dem Input (Self-Service-UI-Logik im Screen).
 */

const clubId = club.id;

const nowIso = (): string => new Date().toISOString();

const facilityStore: Facility[] = facilitySeed.map((f) => ({ ...f }));
const bookingStore: FacilityBooking[] = bookingSeed.map((b) => ({ ...b }));
const equipmentStore: Equipment[] = equipmentSeed.map((e) => ({ ...e }));
const reservationStore: EquipmentReservation[] = reservationSeed.map((r) => ({ ...r }));
const achievementStore: Achievement[] = achievementSeed.map((a) => ({ ...a }));

let facSeq = facilityStore.length;
let bokSeq = bookingStore.length;
let equSeq = equipmentStore.length;
let resSeq = reservationStore.length;
let achSeq = achievementStore.length;

/** Die 20 Batch-2-Modul-Methoden — wird in mockRepository gespreizt. */
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

export const moduleRepositoryBatch2: ModuleMethods = {
  /* ---------- Hallen ---------- */
  async listFacilities(): Promise<Facility[]> {
    return [...facilityStore].sort((a, b) => a.name.localeCompare(b.name, "de"));
  },
  async createFacility(input): Promise<Facility> {
    const now = nowIso();
    const created: Facility = {
      id: `fac-local-${++facSeq}`,
      clubId,
      name: input.name,
      kind: input.kind ?? "other",
      address: input.address,
      capacity: input.capacity,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
    facilityStore.push(created);
    return created;
  },
  async updateFacility(facilityId, patch): Promise<Facility> {
    const item = facilityStore.find((f) => f.id === facilityId);
    if (!item) throw new Error(`Halle ${facilityId} nicht gefunden (mock)`);
    if (patch.name !== undefined) item.name = patch.name;
    if (patch.kind !== undefined) item.kind = patch.kind;
    if (patch.address !== undefined) item.address = patch.address ?? undefined;
    if (patch.capacity !== undefined) item.capacity = patch.capacity ?? undefined;
    if (patch.notes !== undefined) item.notes = patch.notes ?? undefined;
    item.updatedAt = nowIso();
    return item;
  },
  async deleteFacility(facilityId): Promise<{ id: string }> {
    const idx = facilityStore.findIndex((f) => f.id === facilityId);
    if (idx >= 0) facilityStore.splice(idx, 1);
    return { id: facilityId };
  },

  /* ---------- Hallenbuchungen ---------- */
  async listFacilityBookings(facilityId): Promise<FacilityBooking[]> {
    const list = facilityId
      ? bookingStore.filter((b) => b.facilityId === facilityId)
      : bookingStore;
    return [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },
  async createBooking(input): Promise<FacilityBooking> {
    const now = nowIso();
    const created: FacilityBooking = {
      id: `bok-local-${++bokSeq}`,
      facilityId: input.facilityId,
      clubId,
      bookedByMemberId: input.bookedByMemberId,
      teamId: input.teamId,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: input.status ?? "confirmed",
      createdAt: now,
      updatedAt: now,
    };
    bookingStore.push(created);
    return created;
  },
  async updateBooking(bookingId, patch): Promise<FacilityBooking> {
    const item = bookingStore.find((b) => b.id === bookingId);
    if (!item) throw new Error(`Buchung ${bookingId} nicht gefunden (mock)`);
    if (patch.title !== undefined) item.title = patch.title;
    if (patch.teamId !== undefined) item.teamId = patch.teamId ?? undefined;
    if (patch.startsAt !== undefined) item.startsAt = patch.startsAt;
    if (patch.endsAt !== undefined) item.endsAt = patch.endsAt;
    if (patch.status !== undefined) item.status = patch.status;
    item.updatedAt = nowIso();
    return item;
  },
  async deleteBooking(bookingId): Promise<{ id: string }> {
    const idx = bookingStore.findIndex((b) => b.id === bookingId);
    if (idx >= 0) bookingStore.splice(idx, 1);
    return { id: bookingId };
  },

  /* ---------- Equipment ---------- */
  async listEquipment(): Promise<Equipment[]> {
    return [...equipmentStore].sort((a, b) => a.name.localeCompare(b.name, "de"));
  },
  async createEquipment(input): Promise<Equipment> {
    const now = nowIso();
    const created: Equipment = {
      id: `equ-local-${++equSeq}`,
      clubId,
      name: input.name,
      category: input.category,
      totalQuantity: input.totalQuantity,
      // Default: verfügbar = gesamt, wenn nicht explizit gesetzt.
      availableQuantity: input.availableQuantity ?? input.totalQuantity,
      condition: input.condition ?? "good",
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
    equipmentStore.push(created);
    return created;
  },
  async updateEquipment(equipmentId, patch): Promise<Equipment> {
    const item = equipmentStore.find((e) => e.id === equipmentId);
    if (!item) throw new Error(`Ausrüstung ${equipmentId} nicht gefunden (mock)`);
    if (patch.name !== undefined) item.name = patch.name;
    if (patch.category !== undefined) item.category = patch.category ?? undefined;
    if (patch.totalQuantity !== undefined) item.totalQuantity = patch.totalQuantity;
    if (patch.availableQuantity !== undefined) item.availableQuantity = patch.availableQuantity;
    if (patch.condition !== undefined) item.condition = patch.condition;
    if (patch.notes !== undefined) item.notes = patch.notes ?? undefined;
    item.updatedAt = nowIso();
    return item;
  },
  async deleteEquipment(equipmentId): Promise<{ id: string }> {
    const idx = equipmentStore.findIndex((e) => e.id === equipmentId);
    if (idx >= 0) equipmentStore.splice(idx, 1);
    return { id: equipmentId };
  },

  /* ---------- Equipment-Reservierungen ---------- */
  async listReservations(equipmentId): Promise<EquipmentReservation[]> {
    const list = equipmentId
      ? reservationStore.filter((r) => r.equipmentId === equipmentId)
      : reservationStore;
    return [...list].sort((a, b) => a.fromAt.localeCompare(b.fromAt));
  },
  async createReservation(input): Promise<EquipmentReservation> {
    const now = nowIso();
    const created: EquipmentReservation = {
      id: `res-local-${++resSeq}`,
      equipmentId: input.equipmentId,
      clubId,
      reservedByMemberId: input.reservedByMemberId,
      quantity: input.quantity,
      fromAt: input.fromAt,
      toAt: input.toAt,
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    };
    reservationStore.push(created);
    return created;
  },
  async updateReservation(reservationId, patch): Promise<EquipmentReservation> {
    const item = reservationStore.find((r) => r.id === reservationId);
    if (!item) throw new Error(`Reservierung ${reservationId} nicht gefunden (mock)`);
    if (patch.quantity !== undefined) item.quantity = patch.quantity;
    if (patch.fromAt !== undefined) item.fromAt = patch.fromAt;
    if (patch.toAt !== undefined) item.toAt = patch.toAt;
    if (patch.status !== undefined) item.status = patch.status;
    item.updatedAt = nowIso();
    return item;
  },
  async deleteReservation(reservationId): Promise<{ id: string }> {
    const idx = reservationStore.findIndex((r) => r.id === reservationId);
    if (idx >= 0) reservationStore.splice(idx, 1);
    return { id: reservationId };
  },

  /* ---------- Erfolge/Medaillen ---------- */
  async listAchievements(memberId): Promise<Achievement[]> {
    const list = memberId
      ? achievementStore.filter((a) => a.memberId === memberId)
      : achievementStore;
    return [...list].sort((a, b) => b.achievedOn.localeCompare(a.achievedOn));
  },
  async createAchievement(input): Promise<Achievement> {
    const now = nowIso();
    const created: Achievement = {
      id: `ach-local-${++achSeq}`,
      clubId,
      memberId: input.memberId,
      title: input.title,
      competitionName: input.competitionName,
      placement: input.placement,
      medal: input.medal,
      achievedOn: input.achievedOn,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    };
    achievementStore.unshift(created);
    return created;
  },
  async updateAchievement(achievementId, patch): Promise<Achievement> {
    const item = achievementStore.find((a) => a.id === achievementId);
    if (!item) throw new Error(`Erfolg ${achievementId} nicht gefunden (mock)`);
    if (patch.title !== undefined) item.title = patch.title;
    if (patch.competitionName !== undefined) {
      item.competitionName = patch.competitionName ?? undefined;
    }
    if (patch.placement !== undefined) item.placement = patch.placement ?? undefined;
    if (patch.medal !== undefined) item.medal = patch.medal;
    if (patch.achievedOn !== undefined) item.achievedOn = patch.achievedOn;
    if (patch.note !== undefined) item.note = patch.note ?? undefined;
    item.updatedAt = nowIso();
    return item;
  },
  async deleteAchievement(achievementId): Promise<{ id: string }> {
    const idx = achievementStore.findIndex((a) => a.id === achievementId);
    if (idx >= 0) achievementStore.splice(idx, 1);
    return { id: achievementId };
  },
};
