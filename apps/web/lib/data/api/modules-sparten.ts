import type { SpartenRepository } from "../inputs-sparten";
import { activeClubId, apiClient } from "./client";
import { mapSparte } from "./mappers-sparten";
import { mapTeam } from "./mappers";

/**
 * API-Implementierung der Sparten (Migration 0062–0064) ueber den GENERIERTEN
 * Contract-Client (lib/api/generated). Rechte SERVERSEITIG (RLS + Rollencheck):
 * Schreiben/Verwalten = can_manage_sparten (Super-Admin/owner/admin/treasurer),
 * Lesen = jedes Vereinsmitglied.
 */
export const moduleApiRepositorySparten: SpartenRepository = {
  async getSparten() {
    const rows = await apiClient.getClubsByClubIdSparten(activeClubId());
    return rows.map(mapSparte);
  },
  async createSparte(input) {
    const created = await apiClient.postClubsByClubIdSparten(activeClubId(), {
      name: input.name,
      icon: input.icon,
      farbe: input.color,
      aktiv: input.active,
      sortierung: input.sortOrder,
      eigene_finanzen: input.ownFinances,
    });
    return mapSparte(created);
  },
  async updateSparte(sparteId, patch) {
    const updated = await apiClient.patchClubsByClubIdSpartenBySparteId(activeClubId(), sparteId, {
      name: patch.name,
      icon: patch.icon,
      farbe: patch.color,
      aktiv: patch.active,
      sortierung: patch.sortOrder,
      eigene_finanzen: patch.ownFinances,
    });
    return mapSparte(updated);
  },
  async deleteSparte(sparteId) {
    const deleted = await apiClient.deleteClubsByClubIdSpartenBySparteId(activeClubId(), sparteId);
    return { id: deleted.id };
  },
  async setSparteMembers(sparteId, memberIds) {
    const updated = await apiClient.putClubsByClubIdSpartenBySparteIdMembers(
      activeClubId(),
      sparteId,
      { member_ids: memberIds },
    );
    return mapSparte(updated);
  },
  async setTeamSparte(teamId, sparteId) {
    const updated = await apiClient.putClubsByClubIdTeamsByTeamIdSparte(activeClubId(), teamId, {
      sparte_id: sparteId,
    });
    return mapTeam(updated);
  },
};
