import type { DutyKind, Id, Weekday } from "@/lib/types";

/**
 * Eingabe-Typen der Batch-3-Module (Trainingsplan, Pflichtstunden-Soll,
 * Pflichtstunden-Ist). Ausgelagert aus lib/data/types.ts, damit beide Dateien
 * < 400 Zeilen bleiben. Re-exportiert über lib/data/index.ts.
 *
 * Rechte sind SERVERSEITIG (RLS + Rollencheck): Trainings-Slots und
 * Pflichtstunden-Soll schreiben = Trainerstab+; Ist-Stunden = eigenes Mitglied
 * ODER Trainer, `approved` NUR Trainer (DB-Trigger + API-403).
 */

/* ---------- Trainingsplan (Trainings-Slots) ---------- */

/**
 * Trainings-Slot anlegen (is_club_trainer). weekday 0..6 (0 = Montag!).
 * startsTime/endsTime akzeptieren 'HH:MM' ODER 'HH:MM:SS'.
 */
export interface CreateTrainingSlotInput {
  weekday: Weekday;
  /** 'HH:MM' oder 'HH:MM:SS' */
  startsTime: string;
  /** 'HH:MM' oder 'HH:MM:SS' */
  endsTime: string;
  teamId?: Id;
  facilityId?: Id;
  location?: string;
  coachMemberId?: Id;
  note?: string;
}

/** Trainings-Slot ändern (is_club_trainer). null leert das jeweilige Feld. */
export interface UpdateTrainingSlotInput {
  weekday?: Weekday;
  /** 'HH:MM' oder 'HH:MM:SS' */
  startsTime?: string;
  /** 'HH:MM' oder 'HH:MM:SS' */
  endsTime?: string;
  teamId?: Id | null;
  facilityId?: Id | null;
  location?: string | null;
  coachMemberId?: Id | null;
  note?: string | null;
}

/* ---------- Pflichtstunden-Soll (Duty Requirements) ---------- */

/**
 * Pflichtstunden-Soll anlegen (is_club_trainer). Kaskade über team/member:
 * beide leer = Vereinsregel, nur team = Teamregel, member = Mitgliedsregel.
 */
export interface CreateDutyRequirementInput {
  seasonLabel: string;
  requiredHours: number;
  /** ISO-Datum (YYYY-MM-DD) */
  periodStart: string;
  /** ISO-Datum (YYYY-MM-DD) */
  periodEnd: string;
  teamId?: Id;
  memberId?: Id;
}

/** Pflichtstunden-Soll ändern (is_club_trainer). null löst die team/member-Bindung. */
export interface UpdateDutyRequirementInput {
  seasonLabel?: string;
  requiredHours?: number;
  periodStart?: string;
  periodEnd?: string;
  teamId?: Id | null;
  memberId?: Id | null;
}

/* ---------- Pflichtstunden-Ist (Duty Entries) ---------- */

/**
 * Ist-Stunden erfassen. memberId setzt die UI: Nicht-Trainer FEST auf das
 * eigene Mitglied, nur Trainer dürfen ein anderes Mitglied wählen. hours > 0;
 * kind default 'training'. `approved` NUR durch Trainer setzbar (sonst 403).
 */
export interface CreateDutyEntryInput {
  memberId: Id;
  hours: number;
  /** ISO-Datum (YYYY-MM-DD) */
  activityDate: string;
  kind?: DutyKind;
  note?: string;
  /** Nur Trainer — Mitglieder-Setzen wird serverseitig geblockt (403). */
  approved?: boolean;
}

/** Ist-Stunden ändern (eigene ODER Trainer). null leert die Notiz. */
export interface UpdateDutyEntryInput {
  hours?: number;
  activityDate?: string;
  kind?: DutyKind;
  note?: string | null;
  /** Nur Trainer — Mitglieder-Setzen wird serverseitig geblockt (403). */
  approved?: boolean;
}
