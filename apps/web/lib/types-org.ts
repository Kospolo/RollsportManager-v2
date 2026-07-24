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
 * Baugröße eines Fachs (0070). Die Werte sind DEUTSCH auf dem Draht
 * (klein/mittel/gross) — das ist der Enum-Typ in der Datenbank und wird hier
 * bewusst NICHT auf small/medium/large übersetzt: eine zweite Schreibweise
 * für denselben Wert ist genau die Sorte Übersetzungsschicht, die irgendwann
 * auseinanderläuft. Übersetzt wird nur das ANGEZEIGTE Label (i18n, DE+EN).
 */
export type LockerSize = "klein" | "mittel" | "gross";

/**
 * Schließfach. Stammdaten (label/location/note/size/Listenpreis)
 * anlegen+ändern=is_club_admin; Belegung (status/assignedMemberId via
 * assign/release)=is_club_trainer. assignedMemberId ist gesetzt, solange
 * status === "assigned".
 */
export interface Locker {
  id: Id;
  clubId: Id;
  label: string;
  location?: string;
  status: LockerStatus;
  /** Baugröße — steuert in der Regel den Listenpreis. Default „mittel". */
  size: LockerSize;
  /**
   * LISTENPREIS je Monat in Cent — der VORSCHLAG, nicht der Vertrag.
   *
   * null und 0 sind zwei verschiedene Aussagen und werden nie verschmolzen:
   * null = „noch kein Preis festgelegt", 0 = „ausdrücklich kostenlos". Deshalb
   * `number | null` und NICHT `number | undefined` mit ?? 0 irgendwo darunter.
   */
  pricePerMonthCents: number | null;
  /**
   * Läuft für dieses Fach gerade eine Vermietung? Kommt fertig vom Server
   * (app.locker_has_active_rental) — hier wird bewusst nicht aus der
   * Mietverträge-Liste nachgerechnet: ein Mitglied sieht nur die EIGENEN
   * Verträge und käme sonst bei fremden Fächern zu „nicht vermietet".
   */
  hasActiveRental: boolean;
  /** Belegt durch dieses Mitglied — null wenn frei/defekt. */
  assignedMemberId?: Id;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Zustand einer Vermietung: läuft / regulär beendet / gekündigt.
 * Auch hier deutsche Draht-Werte (DB-Enum app.locker_rental_status).
 */
export type LockerRentalStatus = "aktiv" | "beendet" | "gekuendigt";

/**
 * VERMIETUNG eines Schließfachs an ein Mitglied (0070).
 *
 * Die zweite Preisebene: `pricePerMonthCents` ist der TATSÄCHLICH VEREINBARTE
 * Preis, nicht der Listenpreis des Fachs. Ändert der Verein später den
 * Listenpreis, bleiben laufende Verträge unberührt — deshalb hält der Vertrag
 * seinen eigenen Betrag und die Ansicht fällt NIRGENDS still auf den
 * Listenpreis zurück (kein `rental.price ?? locker.price`).
 *
 * Sichtbarkeit serverseitig (RLS locker_rentals_select): Fach-Verwaltung sieht
 * alle Verträge, alle anderen NUR den eigenen bzw. den des eigenen Kindes —
 * eine Miete ist eine Zahlungspflicht, und wer zahlt, muss sie sehen.
 *
 * Verein/Fach/Mitglied sind unveränderlich (Trigger): ein anderes Fach heißt
 * NEUER Vertrag + alten beenden. Sonst wäre die Zahlungshistorie nicht mehr
 * zuzuordnen.
 */
export interface LockerRental {
  id: Id;
  clubId: Id;
  lockerId: Id;
  memberId: Id;
  /** Vereinbarter Monatspreis in Cent. null = nicht festgelegt, 0 = kostenlos. */
  pricePerMonthCents: number | null;
  /** ISO-Datum (YYYY-MM-DD) — Mietbeginn. */
  startOn: string;
  /** ISO-Datum (YYYY-MM-DD) — Mietende, null solange offen. */
  endOn: string | null;
  status: LockerRentalStatus;
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
