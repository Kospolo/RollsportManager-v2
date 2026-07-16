import type { Id } from "./types";

/**
 * View-Typen der Organisations-Module (Abteilungen, Schließfächer, Jubiläen).
 * Ausgelagert aus lib/types.ts (< 400 Zeilen) und dort per
 * `export type * from "./types-org"` wieder unter "@/lib/types" verfügbar.
 *
 * Rechte serverseitig: Abteilungen/Schließfächer anlegen+verwalten = is_club_admin;
 * Zuordnung (Abteilungs-Roster, Schließfach assign/release) = is_club_trainer;
 * Lesen inkl. Jubiläen = is_club_member.
 */

/* ---------- Abteilungen ---------- */

/**
 * Abteilung des Vereins. Anlegen/Ändern/Löschen=is_club_admin,
 * Mitglieder-Zuordnung=is_club_trainer, Lesen=is_club_member. memberIds ist der
 * aggregierte, AKTIVE Roster (soft-deleted ausgefiltert). Serverseitig bereits
 * nach (sortOrder, name) sortiert geliefert.
 */
export interface Department {
  id: Id;
  clubId: Id;
  name: string;
  description?: string;
  /** Abteilungsleitung — verweist auf ein Mitglied, null wenn unbesetzt. */
  leadMemberId?: Id;
  /** Manuelle Sortierung (aufsteigend), Default 0. */
  sortOrder: number;
  /** Aggregierte aktive Mitglieder-IDs der Abteilung. */
  memberIds: Id[];
  createdAt: string;
  updatedAt: string;
}

/* ---------- Schließfächer ---------- */

/** Belegungsstatus eines Schließfachs: frei/belegt/defekt. */
export type LockerStatus = "free" | "assigned" | "broken";

/**
 * Schließfach. Stammdaten (label/location/note) anlegen+ändern=is_club_admin;
 * Belegung (status/assignedMemberId via assign/release)=is_club_trainer.
 * assignedMemberId ist gesetzt, solange status === "assigned".
 */
export interface Locker {
  id: Id;
  clubId: Id;
  label: string;
  location?: string;
  status: LockerStatus;
  /** Belegt durch dieses Mitglied — null wenn frei/defekt. */
  assignedMemberId?: Id;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Jubiläen ---------- */

/** Art eines Jubiläums: Mitgliedschaft (Vereinsjahre) oder runder Geburtstag. */
export type AnniversaryKind = "membership" | "birthday";

/**
 * Jubiläums-Eintrag (reine Lesesicht, is_club_member). Horizont = nächste 365
 * Tage. Meilensteine: Mitgliedschaft = Vielfache von 5, Geburtstag = Vielfache
 * von 10. Liste kommt bereits nach (daysUntil, kind, memberName) sortiert.
 */
export interface Anniversary {
  memberId: Id;
  /** Vor- und Nachname des Mitglieds. */
  memberName: string;
  kind: AnniversaryKind;
  /** ISO-Datum (YYYY-MM-DD) des nächsten Vorkommens. */
  date: string;
  /**
   * Erreichte Jahre — NUR bei kind="membership" ("10 Jahre dabei").
   *
   * Bei kind="birthday" IMMER null: dort waere es das ALTER, und `date` minus
   * `years` ergaebe das exakte Geburtsdatum. Der Verein soll wissen, WANN
   * jemand Geburtstag hat, nicht WIE ALT er wird (services/api reports.ts).
   */
  years: number | null;
  /** Ganze Tage ab heute bis zum Jubiläum (aufsteigend sortiert). */
  daysUntil: number;
}
