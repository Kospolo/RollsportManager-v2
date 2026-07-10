import type {
  BookingStatus,
  EquipmentCondition,
  FacilityKind,
  Id,
  Medal,
  ReservationStatus,
} from "@/lib/types";

/**
 * Eingabe-Typen der Batch-2-Module (Hallen, Buchungen, Equipment,
 * Reservierungen, Erfolge). Ausgelagert aus lib/data/types.ts, damit beide
 * Dateien < 400 Zeilen bleiben. Re-exportiert über lib/data/index.ts.
 */

/* ---------- Hallen ---------- */

/** Halle anlegen (is_club_trainer). kind default = other (server). */
export interface CreateFacilityInput {
  name: string;
  kind?: FacilityKind;
  address?: string;
  capacity?: number;
  notes?: string;
}

/** Halle ändern (is_club_trainer). null leert das jeweilige Feld. */
export interface UpdateFacilityInput {
  name?: string;
  kind?: FacilityKind;
  address?: string | null;
  capacity?: number | null;
  notes?: string | null;
}

/* ---------- Hallenbuchungen ---------- */

/**
 * Hallenbuchung anlegen. bookedByMemberId setzt die UI: Nicht-Trainer FEST auf
 * das eigene Mitglied, nur Trainer dürfen ein Mitglied wählen. endsAt > startsAt.
 */
export interface CreateBookingInput {
  facilityId: Id;
  bookedByMemberId: Id;
  teamId?: Id;
  title: string;
  startsAt: string;
  endsAt: string;
  status?: BookingStatus;
}

/** Hallenbuchung ändern (Ersteller ODER Trainer). null bei teamId löst die Zuordnung. */
export interface UpdateBookingInput {
  title?: string;
  teamId?: Id | null;
  startsAt?: string;
  endsAt?: string;
  status?: BookingStatus;
}

/* ---------- Equipment ---------- */

/**
 * Ausrüstung anlegen (is_club_trainer). availableQuantity Default = totalQuantity;
 * muss <= totalQuantity sein (Zod-refine + Server).
 */
export interface CreateEquipmentInput {
  name: string;
  category?: string;
  totalQuantity?: number;
  availableQuantity?: number;
  condition?: EquipmentCondition;
  notes?: string;
}

/** Ausrüstung ändern (is_club_trainer). null leert category/notes. */
export interface UpdateEquipmentInput {
  name?: string;
  category?: string | null;
  totalQuantity?: number;
  availableQuantity?: number;
  condition?: EquipmentCondition;
  notes?: string | null;
}

/* ---------- Equipment-Reservierungen ---------- */

/**
 * Reservierung anlegen. reservedByMemberId setzt die UI: Nicht-Trainer FEST auf
 * das eigene Mitglied, nur Trainer dürfen ein Mitglied wählen. toAt > fromAt.
 */
export interface CreateReservationInput {
  equipmentId: Id;
  reservedByMemberId: Id;
  quantity?: number;
  fromAt: string;
  toAt: string;
  status?: ReservationStatus;
}

/** Reservierung ändern (Ersteller ODER Trainer). */
export interface UpdateReservationInput {
  quantity?: number;
  fromAt?: string;
  toAt?: string;
  status?: ReservationStatus;
}

/* ---------- Erfolge/Medaillen ---------- */

/** Erfolg vergeben (is_club_trainer). medal weglassen = Teilnahme ohne Medaille. */
export interface CreateAchievementInput {
  memberId: Id;
  title: string;
  competitionName?: string;
  placement?: number;
  medal?: Medal;
  /** ISO-Datum (YYYY-MM-DD) */
  achievedOn: string;
  note?: string;
}

/** Erfolg ändern (is_club_trainer). null leert competitionName/placement/note. */
export interface UpdateAchievementInput {
  title?: string;
  competitionName?: string | null;
  placement?: number | null;
  medal?: Medal;
  achievedOn?: string;
  note?: string | null;
}
