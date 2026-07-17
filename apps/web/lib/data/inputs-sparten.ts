import type { Id, Sparte, Team } from "@/lib/types";

/**
 * Eingabe-Typen + Facade-Segment der Sparten (Migration 0062–0064). Die
 * SpartenRepository wird von der DataRepository geerbt (analog OrgRepository).
 *
 * Rechte sind SERVERSEITIG (RLS + Rollencheck): Anlegen/Aendern/(De-)Aktivieren/
 * Loeschen, Roster (n:m Mitglied<->Sparte) und Team->Sparte-Zuordnung =
 * can_manage_sparten (Super-Admin/owner/admin/treasurer — NICHT coach/member/
 * moderator). Lesen = jedes aktive Vereinsmitglied. Die Facade reicht nur
 * durch; das Gating in der UI ist Anzeige, ein 403 bleibt jederzeit moeglich.
 */

/** Sparte anlegen (can_manage_sparten). sortOrder default 0, active default true (Server). */
export interface CreateSparteInput {
  name: string;
  /** Shell-IconName (z. B. "routines") oder weglassen. */
  icon?: string | null;
  /** Akzentfarbe als Hex (#RRGGBB) oder weglassen. */
  color?: string | null;
  active?: boolean;
  sortOrder?: number;
  /** Eigene Finanzen/Beitraege (nur sinnvoll bei aktivem Finanz-Modul). */
  ownFinances?: boolean;
}

/** Sparte aendern/(de)aktivieren (can_manage_sparten). null leert icon/color. */
export interface UpdateSparteInput {
  name?: string;
  icon?: string | null;
  color?: string | null;
  active?: boolean;
  sortOrder?: number;
  ownFinances?: boolean;
}

/**
 * VOLL-Replace des Sparten-Rosters (can_manage_sparten). Fehlende Mitglieder
 * werden serverseitig soft-detached, zuvor entfernte reaktiviert (Revive per
 * on-conflict). memberIds muessen zum Verein gehoeren. Weggelassen = leerer Satz.
 */
export interface SetSparteMembersInput {
  memberIds: Id[];
}

/**
 * Facade-Segment der Sparten. DataRepository erbt es (analog OrgRepository).
 * Lese-Methoden scopen serverseitig ueber den aktiven Verein (activeClubId),
 * daher parameterlos — wie listDepartments()/getTeams().
 */
export interface SpartenRepository {
  /** Sparten des aktiven Vereins (serverseitig nach sortOrder,name sortiert). */
  getSparten(): Promise<Sparte[]>;
  /** Sparte anlegen (can_manage_sparten) — liefert die erzeugte Sparte zurueck. */
  createSparte(input: CreateSparteInput): Promise<Sparte>;
  /** Sparte aendern/(de)aktivieren (can_manage_sparten). */
  updateSparte(sparteId: Id, patch: UpdateSparteInput): Promise<Sparte>;
  /** Sparte soft-loeschen (can_manage_sparten) — liefert die geloeschte ID zurueck. */
  deleteSparte(sparteId: Id): Promise<{ id: Id }>;
  /** Sparten-Roster als VOLL-Replace setzen (can_manage_sparten). */
  setSparteMembers(sparteId: Id, memberIds: Id[]): Promise<Sparte>;
  /**
   * Team einer Sparte zuordnen oder die Zuordnung loesen (can_manage_sparten).
   * sparteId === null entfernt die Zuordnung. Liefert das aktualisierte Team.
   */
  setTeamSparte(teamId: Id, sparteId: Id | null): Promise<Team>;
}
