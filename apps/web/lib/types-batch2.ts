import type { Id } from "./types";

/**
 * View-Typen der Batch-2-Module (Hallen, Buchungen, Equipment, Reservierungen,
 * Erfolge). Ausgelagert aus lib/types.ts (< 400 Zeilen) und dort per
 * `export type * from "./types-batch2"` wieder unter "@/lib/types" verfügbar.
 */

/** Art einer Trainingsstätte: Halle/Raum/Aussenbereich/Sonstiges. */
export type FacilityKind = "hall" | "room" | "outdoor" | "other";
/** Trainingsstätte. Anlegen/Verwalten=Trainer+, Lesen=Mitglied. */
export interface Facility {
  id: Id;
  clubId: Id;
  name: string;
  kind: FacilityKind;
  address?: string;
  capacity?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Status einer Hallenbuchung: bestätigt/angefragt/storniert. */
export type BookingStatus = "confirmed" | "pending" | "cancelled";
/** Hallenbuchung. Anlegen=Selbst/Trainer, Ändern/Löschen=Ersteller/Trainer. endsAt > startsAt; Überschneidungen NICHT DB-erzwungen. */
export interface FacilityBooking {
  id: Id;
  facilityId: Id;
  clubId: Id;
  bookedByMemberId: Id;
  teamId?: Id;
  title: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

/** Zustand eines Ausrüstungsgegenstands: gut/brauchbar/defekt. */
export type EquipmentCondition = "good" | "fair" | "defect";
/** Ausrüstung. Anlegen/Verwalten=Trainer+, Lesen=Mitglied. availableQuantity <= totalQuantity. */
export interface Equipment {
  id: Id;
  clubId: Id;
  name: string;
  category?: string;
  totalQuantity?: number;
  availableQuantity?: number;
  condition: EquipmentCondition;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Status einer Equipment-Reservierung: aktiv/zurückgegeben/storniert. */
export type ReservationStatus = "active" | "returned" | "cancelled";
/** Equipment-Reservierung. Anlegen=Selbst/Trainer, Ändern/Löschen=Ersteller/Trainer. toAt > fromAt. */
export interface EquipmentReservation {
  id: Id;
  equipmentId: Id;
  clubId: Id;
  reservedByMemberId: Id;
  quantity?: number;
  fromAt: string;
  toAt: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

/** Medaille eines Erfolgs: Gold/Silber/Bronze. */
export type Medal = "gold" | "silver" | "bronze";
/** Erfolg/Medaille. Lesen=Mitglied, Vergeben=Trainer+. medal/placement undefined = ohne; achievedOn = YYYY-MM-DD. */
export interface Achievement {
  id: Id;
  clubId: Id;
  memberId: Id;
  title: string;
  competitionName?: string;
  placement?: number;
  medal?: Medal;
  achievedOn: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
