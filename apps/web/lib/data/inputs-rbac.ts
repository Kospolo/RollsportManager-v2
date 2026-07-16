import type { Id } from "@/lib/types";

/**
 * Facade-Segment „Rollen & Rechte" (RBAC-DESIGN §7) — die Steuerzentrale, in
 * der die Rechte TATSÄCHLICH eingestellt werden. Bis Phase 3 rief die Facade
 * KEINE der zehn RBAC-Methoden des generierten Clients auf (gemessen: 0
 * Aufrufer je Methode); die alte Rollen-Seite war eine Attrappe aus
 * hartkodierten Konstanten.
 *
 * ### Rechte serverseitig ###
 * Alles unten ist gated: Schreiben = `roles:manage`, Trainer-Zuordnung =
 * `team_coaches:manage` (NICHT `teams:manage` — den trägt der Coach selbst,
 * 0031), geschützte Fähigkeiten (owner_only) = nur der Vereinsinhaber. Die
 * Facade prüft NICHTS davon: sie zeigt nur, was der Server ohnehin durchsetzt.
 * Ein 403 ist hier eine normale Antwort, kein Programmfehler.
 *
 * ### Sofortwirksam ###
 * Rechte werden serverseitig aus der DATENBANK aufgelöst (app.cap_rank, 0025),
 * nicht aus dem Token. Jede Änderung hier wirkt SOFORT — auch für Personen, die
 * gerade angemeldet sind. Das ist kein Nebeneffekt, sondern der Zweck.
 */

/** Die Stufen-Skala (RBAC-DESIGN §2). Geordnet: none < … < manage. */
export type CapabilityLevel = "none" | "read_own" | "read_team" | "read_all" | "edit" | "manage";

/**
 * Wie weit die eingestellte Stufe TATSÄCHLICH durchgesetzt wird (0033).
 * Die Grundlage der Beschriftung — nie einer Berechtigung.
 *
 * - `enforced`   Die Stufe wirkt auf das Lesen. „keine" entzieht den Zugriff
 *                wirklich. Nur hier darf die Oberfläche „kein Zugriff" sagen.
 * - `partial`    Die Stufe wirkt nur auf einen TEIL des Lesens. „kein Zugriff"
 *                wäre hier eine Täuschung — sie verspräche Vertraulichkeit, die
 *                nachweislich nicht existiert (finance, member_contact).
 * - `write_only` Die Stufe wirkt nur auf das Schreiben. Gelesen wird weiter.
 * - `unenforced` Die Stufe wirkt nirgends (18 von 32).
 */
export type CapabilityEnforcement = "enforced" | "partial" | "write_only" | "unenforced";

/** Eine Fähigkeit samt aufgelöster Stufe der eingeloggten Person. */
export interface ResolvedCapability {
  key: string;
  labelDe: string;
  labelEn: string;
  /** Die im Admin wählbare Teilmenge der Skala — das Dropdown zeigt NUR diese. */
  allowedLevels: CapabilityLevel[];
  sort: number;
  /**
   * Numerischer Rang 0..5 = was DURCHGESETZT wird. Für Vergleiche IMMER diesen
   * nehmen, nie rankOf(level): beim Vereinsinhaber fallen beide auseinander
   * (protected-Kurzschluss, 0032 — live bei 17 von 32 Fähigkeiten gemessen:
   * rank=5 bei level=read_all).
   */
  rank: number;
  /** Dieselbe Berechtigung auf der Skala DIESER Fähigkeit — für die Anzeige. */
  level: CapabilityLevel;
  /** Geschützte Fähigkeit: nur der Vereinsinhaber darf sie ändern (0032). */
  ownerOnly: boolean;
  /** Was die Stufe wirklich bewirkt (0033) — für die Beschriftung. */
  enforcement: CapabilityEnforcement;
}

/** Die aufgelösten Rechte der eingeloggten Person in ihrem Verein. */
export interface CapabilityResolution {
  clubId: Id;
  /**
   * Alle Rollen-Keys der Person — aus der DATENBANK, nicht aus dem Token. Bei
   * Mehrfachrollen stehen hier mehrere, während der Claim nur einen kennt.
   */
  roleKeys: string[];
  /** Plattform-Admin ist KEINE Vereinsrolle, sondern ein Token-Claim (§5). */
  isPlatformAdmin: boolean;
  capabilities: ResolvedCapability[];
}

/** Eine Rolle des Vereins (app.roles): Systemrolle oder frei angelegt. */
export interface ClubRoleDef {
  id: Id;
  clubId: Id;
  /** Stabiler Schlüssel. Unveränderlich — auch bei eigenen Rollen. */
  key: string;
  nameDe: string;
  nameEn: string;
  /** Systemrolle = Vorlage. Nicht löschbar; Name und Rechte sind änderbar. */
  isSystem: boolean;
  /** Inhaber-Rolle: Name UND Rechte gesperrt (sonst sperrt sich der Verein aus). */
  protected: boolean;
  sort: number;
}

/** Eine Zelle der Rechte-Matrix: Fähigkeit → Stufe. */
export interface RolePermission {
  capabilityKey: string;
  level: CapabilityLevel;
}

/** Wer hat welche Rollen (Mehrfachrollen, §1.3). */
export interface MemberRoleAssignment {
  memberId: Id;
  roleIds: Id[];
}

/** Eine eigene Rolle anlegen. Sie startet OHNE jedes Recht (fail-closed). */
export interface CreateClubRoleInput {
  /** ^[a-z][a-z0-9_]{1,40}$ — der Server weist alles andere mit 422 ab. */
  key: string;
  nameDe: string;
  nameEn: string;
  sort?: number;
}

/** Eine Rolle umbenennen/umsortieren. `key` fehlt bewusst: er ist unveränderlich. */
export interface UpdateClubRoleInput {
  nameDe?: string;
  nameEn?: string;
  sort?: number;
}

export interface RbacRepository {
  /* ---------- Gating der Oberfläche ---------- */
  /**
   * Die aufgelösten Rechte der eingeloggten Person (GET /me/capabilities).
   * Quelle für das Ausblenden von Knöpfen — Kosmetik über der echten
   * Durchsetzung, die serverseitig bleibt.
   */
  getMyCapabilities(): Promise<CapabilityResolution>;

  /* ---------- Rollen ---------- */
  /** Die Rollen des Vereins (jedes Mitglied darf sie lesen — die Chips brauchen Namen). */
  listClubRoles(): Promise<ClubRoleDef[]>;
  /** Eine eigene Rolle anlegen. 409, wenn der Schlüssel im Verein vergeben ist. */
  createClubRole(input: CreateClubRoleInput): Promise<ClubRoleDef>;
  /** Umbenennen/umsortieren. 409 bei der geschützten Inhaber-Rolle. */
  updateClubRole(roleId: Id, patch: UpdateClubRoleInput): Promise<ClubRoleDef>;
  /** Löschen. 409 bei Systemrollen und wenn die Rolle noch zugewiesen ist. */
  deleteClubRole(roleId: Id): Promise<void>;

  /* ---------- Rechte-Matrix ---------- */
  /** Die Matrix EINER Rolle (Fähigkeit → Stufe). Nur gesetzte Zeilen; Rest = none. */
  getRolePermissions(roleId: Id): Promise<RolePermission[]>;
  /**
   * Stufen setzen (Teilmenge genügt, nicht genannte bleiben unverändert).
   * 409 bei der Inhaber-Rolle · 403 bei owner_only ohne Inhaber-Rolle ·
   * 422 bei einer Stufe außerhalb von allowedLevels.
   */
  setRolePermissions(roleId: Id, permissions: RolePermission[]): Promise<RolePermission[]>;

  /* ---------- Mehrfachrollen ---------- */
  /** Wer hat welche Rollen (alle Personen des Vereins auf einmal). */
  listMemberRoles(): Promise<MemberRoleAssignment[]>;
  /** Die Rollen EINER Person setzen (Zielzustand). Rechte = Vereinigung. */
  setMemberRoles(memberId: Id, roleIds: Id[]): Promise<ClubRoleDef[]>;

  /* ---------- Trainer:in ↔ mehrere Teams ---------- */
  /**
   * Die Trainer:innen EINES Teams setzen (Zielzustand). 409, wenn eine Person im
   * Team bereits Skater:in ist (eine Zeile je Person und Team).
   * Gated `team_coaches:manage` — seit 0031 kann sich ein Coach NICHT mehr
   * selbst zuordnen.
   */
  setTeamCoaches(teamId: Id, memberIds: Id[]): Promise<Id[]>;
}
