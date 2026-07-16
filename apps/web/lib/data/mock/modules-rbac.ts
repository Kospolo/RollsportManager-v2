import * as mock from "@/lib/mock";
import type { Id, MemberRole } from "@/lib/types";
import { ApiError } from "../errors";
import type {
  CapabilityLevel,
  CapabilityResolution,
  ClubRoleDef,
  MemberRoleAssignment,
  RbacRepository,
  ResolvedCapability,
  RolePermission,
} from "../inputs-rbac";
import {
  CAPABILITY_CATALOG,
  LEVELS_BY_RANK,
  LEVEL_RANK,
  SYSTEM_ROLE_SEED,
  capMaxRank,
} from "./seed-rbac";

/**
 * Mock-Implementierung von „Rollen & Rechte".
 *
 * ### Warum das hier ERNST gemeint ist ###
 * lib/data/config.ts:16-17 zwingt JEDEN Production-Build auf 'mock'. Fehlte hier
 * eine Methode oder täte sie nur so, wäre die Rechte-Matrix im Default-Modus
 * genau das, was sie vor Phase 3 war: ein Formular, das aussieht, als würde es
 * etwas tun. Der Store unten ist deshalb echt — Änderungen bleiben bis zum
 * Reload sichtbar, Mehrfachrollen wirken auf die angezeigte Auflösung, und die
 * Fehlerfälle des Servers (409/422/403) werden NACHGEBILDET statt verschluckt.
 *
 * ### Was der Mock NICHT ist ###
 * Er setzt nichts durch. Er kennt keine RLS, keine Trigger, keinen Token. Er
 * ist eine plausible Attrappe des Servers — die Wahrheit ist im api-Modus der
 * Server. Wo der Mock und der Server auseinanderlaufen könnten, wurde der
 * Server abgeschrieben, nicht geraten (siehe seed-rbac.ts: der Katalog ist aus
 * rsm2-pg-dev abgezogen).
 *
 * ### Die eingeloggte Person ###
 * mock.currentUser ist Sandra Vogel (coach). Damit die Matrix im Mock
 * BEDIENBAR ist — und der Nutzer die Seite ohne Dev-Stack überhaupt sieht —
 * bekommt sie hier zusätzlich die Inhaber-Rolle. Das ist eine Anzeige-
 * Entscheidung des Mocks, keine Rechteänderung: im api-Modus entscheidet
 * ausschließlich app.cap_rank.
 */

/**
 * Ein Server-Fehler, wie der generierte Client ihn wirft (RFC 7807). Der Mock
 * baut ihn originalgetreu: errorMessage() liest problem.detail — wer hier nur
 * eine message setzt, testet die UI-Behandlung an einem Fehler, den es so nie
 * gibt.
 */
function problem(status: number, title: string, detail: string): ApiError {
  return new ApiError(
    status,
    { type: "about:blank", title, status, detail },
    detail,
  );
}

const CLUB_ID: Id = mock.club.id;

/** Stabile, sprechende Ids — der Mock hat keine Datenbank, die welche vergibt. */
function roleIdFor(key: string): Id {
  return `role-${key}`;
}

interface RoleRow extends ClubRoleDef {
  permissions: Map<string, CapabilityLevel>;
}

/** Die Rollen des Vereins (Systemrollen aus dem Seed + im Mock angelegte). */
const roleStore: RoleRow[] = SYSTEM_ROLE_SEED.map((r) => ({
  id: roleIdFor(r.key),
  clubId: CLUB_ID,
  key: r.key,
  nameDe: r.nameDe,
  nameEn: r.nameEn,
  isSystem: r.isSystem,
  protected: r.protected,
  sort: r.sort,
  permissions: new Map(Object.entries(r.permissions) as [string, CapabilityLevel][]),
}));

/**
 * Wer hat welche Rollen. Start = die Primärrolle jeder Person, gespiegelt —
 * genau das, was der Trigger sync_member_role_to_member_roles (0024:78-127) in
 * der Datenbank tut.
 */
const memberRoleStore = new Map<Id, Id[]>(
  mock.members.map((m) => [m.id, [roleIdFor(m.role as MemberRole)]]),
);

// Die eingeloggte Mock-Persona bekommt zusätzlich die Inhaber-Rolle, damit die
// Steuerzentrale ohne Dev-Stack bedienbar ist (siehe Kopfkommentar).
memberRoleStore.set(mock.currentUser.id, [roleIdFor("owner"), roleIdFor(mock.currentUser.role)]);

function toClubRoleDef(r: RoleRow): ClubRoleDef {
  return {
    id: r.id,
    clubId: r.clubId,
    key: r.key,
    nameDe: r.nameDe,
    nameEn: r.nameEn,
    isSystem: r.isSystem,
    protected: r.protected,
    sort: r.sort,
  };
}

function findRole(roleId: Id): RoleRow {
  const role = roleStore.find((r) => r.id === roleId);
  if (!role) {
    throw problem(404, "Not Found", "Rolle nicht gefunden. / Role not found.");
  }
  return role;
}

function sortedRoles(): RoleRow[] {
  return [...roleStore].sort((a, b) => a.sort - b.sort || a.key.localeCompare(b.key));
}

/** Ist die eingeloggte Mock-Persona Inhaberin? (Für owner_only, wie app.is_club_owner.) */
function isOwner(): boolean {
  const own = memberRoleStore.get(mock.currentUser.id) ?? [];
  return own.some((id) => roleStore.find((r) => r.id === id)?.protected === true);
}

/**
 * Der aufgelöste Rang einer Fähigkeit für die eingeloggte Persona — das
 * Gegenstück zu app.cap_rank (0025), inklusive des protected-Kurzschlusses:
 * die Inhaber-Rolle zählt überall 5, auch über der Skala.
 */
function capRank(capabilityKey: string): number {
  const own = memberRoleStore.get(mock.currentUser.id) ?? [];
  let max = 0;
  for (const roleId of own) {
    const role = roleStore.find((r) => r.id === roleId);
    if (!role) continue;
    if (role.protected) return 5; // Kurzschluss wie app.cap_rank (0025:232)
    const level = role.permissions.get(capabilityKey);
    if (level) max = Math.max(max, LEVEL_RANK[level]);
  }
  return max;
}

function resolveCapabilities(): ResolvedCapability[] {
  return CAPABILITY_CATALOG.map((c) => {
    const rank = capRank(c.key);
    // level = derselbe Rang auf der Skala DIESER Fähigkeit (app.cap_ranks, 0032):
    // level_of_rank(least(rank, cap_max_rank)). Für den Inhaber fallen rank und
    // level dadurch auseinander — das ist Absicht, nicht ein Bug.
    const level = LEVELS_BY_RANK[Math.min(rank, capMaxRank(c.allowedLevels))] ?? "none";
    return { ...c, allowedLevels: [...c.allowedLevels], rank, level };
  });
}

let roleSeq = 0;

export const moduleRepositoryRbac: RbacRepository = {
  async getMyCapabilities(): Promise<CapabilityResolution> {
    const own = memberRoleStore.get(mock.currentUser.id) ?? [];
    return {
      clubId: CLUB_ID,
      roleKeys: own
        .map((id) => roleStore.find((r) => r.id === id)?.key)
        .filter((k): k is string => k !== undefined),
      isPlatformAdmin: false,
      capabilities: resolveCapabilities(),
    };
  },

  async listClubRoles() {
    return sortedRoles().map(toClubRoleDef);
  },

  async createClubRole(input) {
    // 409 wie roles.ts:189 — derselbe Text, damit die UI-Behandlung im Mock
    // wirklich geprobt wird und nicht erst live auffällt.
    if (roleStore.some((r) => r.key === input.key)) {
      throw problem(
        409,
        "Conflict",
        `Der Rollen-Schluessel "${input.key}" ist in diesem Verein bereits vergeben. ` +
          `/ The role key "${input.key}" already exists in this club.`,
      );
    }
    roleSeq += 1;
    const row: RoleRow = {
      id: `role-custom-${roleSeq}`,
      clubId: CLUB_ID,
      key: input.key,
      nameDe: input.nameDe,
      nameEn: input.nameEn,
      isSystem: false,
      protected: false,
      sort: input.sort ?? 100,
      // Eine neue Rolle startet OHNE Rechte (fail-closed, roles.ts:156-157).
      permissions: new Map(),
    };
    roleStore.push(row);
    return toClubRoleDef(row);
  },

  async updateClubRole(roleId, patch) {
    const role = findRole(roleId);
    // 409 wie roles.ts:256: die Inhaber-Rolle ist der Anker des Rechtesystems.
    if (
      role.protected &&
      ((patch.nameDe !== undefined && patch.nameDe !== role.nameDe) ||
        (patch.nameEn !== undefined && patch.nameEn !== role.nameEn))
    ) {
      throw problem(
        409,
        "Conflict",
        "Die Inhaber-Rolle ist geschuetzt — ihr Name laesst sich nicht aendern (sie ist der Anker " +
          "des Rechtesystems). / The owner role is protected — its name cannot be changed (it is " +
          "the anchor of the permission system).",
      );
    }
    if (patch.nameDe !== undefined) role.nameDe = patch.nameDe;
    if (patch.nameEn !== undefined) role.nameEn = patch.nameEn;
    if (patch.sort !== undefined) role.sort = patch.sort;
    return toClubRoleDef(role);
  },

  async deleteClubRole(roleId) {
    const role = findRole(roleId);
    // 409 wie roles.ts:308.
    if (role.isSystem) {
      throw problem(
        409,
        "Conflict",
        "Systemrollen koennen nicht geloescht werden — benenne sie um oder entziehe ihre Rechte. " +
          "/ System roles cannot be deleted — rename them or remove their permissions instead.",
      );
    }
    // 409 wie roles.ts:319 (member_roles.role_id ist ON DELETE RESTRICT).
    const assigned = [...memberRoleStore.values()].filter((ids) => ids.includes(roleId)).length;
    if (assigned > 0) {
      throw problem(
        409,
        "Conflict",
        `Die Rolle ist noch ${assigned} Person(en) zugewiesen — entziehe sie zuerst. ` +
          `/ The role is still assigned to ${assigned} person(s) — revoke it first.`,
      );
    }
    const idx = roleStore.findIndex((r) => r.id === roleId);
    if (idx >= 0) roleStore.splice(idx, 1);
  },

  async getRolePermissions(roleId) {
    const role = findRole(roleId);
    return CAPABILITY_CATALOG.filter((c) => role.permissions.has(c.key)).map((c) => ({
      capabilityKey: c.key,
      level: role.permissions.get(c.key) as CapabilityLevel,
    }));
  },

  async setRolePermissions(roleId, permissions) {
    const role = findRole(roleId);
    // 409 wie roles.ts:375.
    if (role.protected) {
      throw problem(
        409,
        "Conflict",
        "Die Inhaber-Rolle ist geschuetzt — ihre Rechte lassen sich nicht aendern (sonst koennte " +
          "sich ein Verein selbst aussperren). / The owner role is protected — its permissions " +
          "cannot be changed (a club could otherwise lock itself out).",
      );
    }
    // 403 wie roles.ts:407 — geschützte Fähigkeit nur durch die Inhaberin.
    const touchedOwnerOnly = permissions
      .map((p) => p.capabilityKey)
      .filter((k) => CAPABILITY_CATALOG.find((c) => c.key === k)?.ownerOnly === true);
    if (touchedOwnerOnly.length > 0 && !isOwner()) {
      const keys = [...new Set(touchedOwnerOnly)].join(", ");
      throw problem(
        403,
        "Forbidden",
        `Geschuetzte Faehigkeit: "${keys}" darf nur die Vereinsinhaberin oder der Vereinsinhaber ` +
          `aendern. / Protected capability: only the club owner may change "${keys}".`,
      );
    }
    // 422 wie roles.ts:426 — eine Stufe außerhalb der Skala.
    for (const p of permissions) {
      const cap = CAPABILITY_CATALOG.find((c) => c.key === p.capabilityKey);
      if (!cap) {
        throw problem(
          422,
          "Unprocessable Entity",
          `Unbekannte Faehigkeit "${p.capabilityKey}". / Unknown capability "${p.capabilityKey}".`,
        );
      }
      if (!cap.allowedLevels.includes(p.level)) {
        throw problem(
          422,
          "Unprocessable Entity",
          `Stufe "${p.level}" ist fuer "${p.capabilityKey}" nicht zulaessig ` +
            `(erlaubt: ${cap.allowedLevels.join(", ")}). / Level "${p.level}" is not allowed for ` +
            `"${p.capabilityKey}" (allowed: ${cap.allowedLevels.join(", ")}).`,
        );
      }
    }
    for (const p of permissions) role.permissions.set(p.capabilityKey, p.level);
    return this.getRolePermissions(roleId);
  },

  async listMemberRoles(): Promise<MemberRoleAssignment[]> {
    const order = new Map(sortedRoles().map((r, i) => [r.id, i]));
    return [...memberRoleStore.entries()].map(([memberId, roleIds]) => ({
      memberId,
      roleIds: [...roleIds].sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99)),
    }));
  },

  async setMemberRoles(memberId, roleIds) {
    for (const id of roleIds) findRole(id); // 404 wie roles.ts:497
    memberRoleStore.set(memberId, [...roleIds]);
    const order = new Map(sortedRoles().map((r, i) => [r.id, i]));
    return [...roleIds]
      .sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
      .map((id) => toClubRoleDef(findRole(id)));
  },

  async setTeamCoaches(teamId, memberIds) {
    // Der Team-Store liegt in mock/index.ts; hier wird über die Facade-Methode
    // gearbeitet, die es schon gibt (setTeamMembers) — ein zweiter Team-Store
    // wäre eine driftende Zweitwahrheit. Import zur Laufzeit, weil mock/index.ts
    // dieses Modul selbst einbindet (Zyklus).
    const { mockRepository } = await import("./index");
    const teams = await mockRepository.getTeams();
    const team = teams.find((t) => t.id === teamId);
    if (!team) {
      throw problem(404, "Not Found", "Team nicht gefunden. / Team not found.");
    }
    // 409 wie roles.ts:629 — eine Zeile je Person und Team.
    const clash = memberIds.find((id) => team.skaterIds.includes(id));
    if (clash) {
      throw problem(
        409,
        "Conflict",
        "Diese Person ist in dem Team bereits Skater:in — eine Person kann pro Team nur eine " +
          "Rolle haben. Entferne sie zuerst aus dem Roster. / This person is already a skater " +
          "in this team — one row per person and team. Remove them from the roster first.",
      );
    }
    const updated = await mockRepository.setTeamMembers(teamId, {
      coachIds: [...memberIds],
      skaterIds: [...team.skaterIds],
    });
    return updated.coachIds;
  },
};
