import type { Id } from "./types";

/**
 * View-Typ der Sparten (Migration 0062–0064) — die fachlichen Grossbereiche
 * eines Vereins (z. B. Rollkunstlauf, Eiskunstlauf). Ein Mitglied kann in
 * mehreren Sparten sein (n:m), ein Team gehoert zu genau einer Sparte.
 *
 * Ausgelagert aus lib/types.ts (< 400 Zeilen) und dort per
 * `export type * from "./types-sparten"` wieder unter "@/lib/types" verfuegbar.
 *
 * Rechte SERVERSEITIG (RLS + Rollencheck): Anlegen/Aendern/(De-)Aktivieren/
 * Loeschen/Roster/Team-Zuordnung = can_manage_sparten (Super-Admin, owner,
 * admin, treasurer — NICHT coach/member/moderator). Lesen = jedes Mitglied.
 * Die Sichtbarkeit im UI ist Komfort; die Wahrheit ist der Server (403 → Toast).
 */
export interface Sparte {
  id: Id;
  clubId: Id;
  name: string;
  /** Icon-Name (Shell-IconName, z. B. "routines"), null wenn ohne Icon. */
  icon?: string;
  /** Akzentfarbe als Hex (#RRGGBB), null wenn ohne eigene Farbe. */
  color?: string;
  /** Aktiv = im Verein in Benutzung. Inaktive bleiben lesbar, aber abgesetzt. */
  active: boolean;
  /** Manuelle Sortierung (aufsteigend), Default 0. */
  sortOrder: number;
  /**
   * Eigene Finanzen/Beitraege: die Sparte fuehrt ihre Beitraege getrennt.
   * Nur sinnvoll, solange das Finanz-Modul des Vereins ueberhaupt an ist.
   */
  ownFinances: boolean;
  /** Aggregierte aktive Mitglieder-IDs der Sparte (n:m). */
  memberIds: Id[];
  createdAt: string;
  updatedAt: string;
}
