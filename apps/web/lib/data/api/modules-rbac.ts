import type * as M from "@/lib/api/generated/types";
import type {
  CapabilityResolution,
  ClubRoleDef,
  RbacRepository,
  ResolvedCapability,
  RolePermission,
} from "../inputs-rbac";
import { activeClubId, apiClient } from "./client";

/**
 * API-Implementierung von „Rollen & Rechte" (RBAC-DESIGN §7).
 *
 * Nutzt den GENERIERTEN Client — zehn seiner Methoden hatten bis Phase 3
 * NULL Aufrufer. Die Rechte setzt ausschliesslich der Server durch (RLS +
 * Trigger + requireCap); hier wird nichts vorgeprüft, sondern nur abgebildet.
 *
 * Die Mapper sind bewusst hier und nicht in mappers-*.ts: sie gehören zu genau
 * diesem Modul, sind trivial (snake_case → camelCase) und wandern sonst in eine
 * Datei, die schon 400 Zeilen fremder Zuordnungen trägt.
 */

function mapResolvedCapability(c: M.ResolvedCapability): ResolvedCapability {
  return {
    key: c.capability_key,
    labelDe: c.label_de,
    labelEn: c.label_en,
    allowedLevels: c.allowed_levels,
    sort: c.sort,
    rank: c.rank,
    level: c.level,
    ownerOnly: c.owner_only,
    enforcement: c.enforcement,
  };
}

function mapClubRoleDef(r: M.ClubRoleDef): ClubRoleDef {
  return {
    id: r.id,
    clubId: r.club_id,
    key: r.key,
    nameDe: r.name_de,
    nameEn: r.name_en,
    isSystem: r.is_system,
    protected: r.protected,
    sort: r.sort,
  };
}

function mapRolePermission(p: M.RolePermission): RolePermission {
  return { capabilityKey: p.capability_key, level: p.level };
}

export const moduleApiRepositoryRbac: RbacRepository = {
  async getMyCapabilities(): Promise<CapabilityResolution> {
    const club = activeClubId();
    const res = await apiClient.getMeCapabilities({ club_id: club });
    return {
      clubId: res.club_id,
      roleKeys: res.role_keys,
      isPlatformAdmin: res.is_platform_admin,
      capabilities: res.capabilities.map(mapResolvedCapability),
    };
  },

  async listClubRoles() {
    const rows = await apiClient.getClubsByClubIdRoles(activeClubId());
    return rows.map(mapClubRoleDef);
  },

  async createClubRole(input) {
    const created = await apiClient.postClubsByClubIdRoles(activeClubId(), {
      key: input.key,
      name_de: input.nameDe,
      name_en: input.nameEn,
      sort: input.sort,
    });
    return mapClubRoleDef(created);
  },

  async updateClubRole(roleId, patch) {
    const updated = await apiClient.patchClubsByClubIdRolesByRoleId(activeClubId(), roleId, {
      name_de: patch.nameDe,
      name_en: patch.nameEn,
      sort: patch.sort,
    });
    return mapClubRoleDef(updated);
  },

  async deleteClubRole(roleId) {
    await apiClient.deleteClubsByClubIdRolesByRoleId(activeClubId(), roleId);
  },

  async getRolePermissions(roleId) {
    const rows = await apiClient.getClubsByClubIdRolesByRoleIdPermissions(activeClubId(), roleId);
    return rows.map(mapRolePermission);
  },

  async setRolePermissions(roleId, permissions) {
    const rows = await apiClient.putClubsByClubIdRolesByRoleIdPermissions(activeClubId(), roleId, {
      permissions: permissions.map((p) => ({ capability_key: p.capabilityKey, level: p.level })),
    });
    return rows.map(mapRolePermission);
  },

  async listMemberRoles() {
    const rows = await apiClient.getClubsByClubIdMemberRoles(activeClubId());
    return rows.map((r) => ({ memberId: r.member_id, roleIds: r.role_ids }));
  },

  async setMemberRoles(memberId, roleIds) {
    const rows = await apiClient.putClubsByClubIdMembersByMemberIdRoles(activeClubId(), memberId, {
      role_ids: roleIds,
    });
    return rows.map(mapClubRoleDef);
  },

  async setTeamCoaches(teamId, memberIds) {
    return apiClient.putClubsByClubIdTeamsByTeamIdCoaches(activeClubId(), teamId, {
      member_ids: memberIds,
    });
  },
};
