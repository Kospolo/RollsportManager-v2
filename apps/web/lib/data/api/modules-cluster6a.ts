import { ApiError } from "@/lib/api/generated";
import type { ChildCreated, UploadMyPhotoResult } from "@/lib/types";
import { readSession } from "@/lib/auth/storage";
import { API_BASE_URL } from "../config";
import type { Cluster6aRepository } from "../inputs-cluster6a";
import { activeClubId, apiClient } from "./client";
import { mapGuardianship, mapMember, mediaUrl } from "./mappers";
import { mapBudget, mapBudgetReport, mapWaitlistEntry } from "./mappers-cluster6a";

/**
 * API-Implementierung des Cluster 6a (Wartelisten, Budgetplanung,
 * Familie-Selfservice, Profilfoto). Nutzt den GENERIERTEN Client; einzige
 * Ausnahme ist uploadMyPhoto — die Route POST /me/photo ist bewusst NICHT im
 * OpenAPI-Contract und läuft daher als eigener multipart-fetch mit Bearer-Token.
 *
 * Rechte sind SERVERSEITIG (RLS + API-Autorisierung): Wartelisten-Sicht kommt
 * per RLS (Mitglied = eigene, Trainer+ = ganze Queue), Budget = can_manage_finance,
 * Familie = eigenes Kind (Selfservice) ODER is_club_admin.
 */

/** Bearer-Header aus der Dev-Auth-Session (leer, wenn nicht angemeldet). */
function authHeaders(): Record<string, string> {
  const token = readSession()?.token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export const moduleApiRepositoryCluster6a: Cluster6aRepository = {
  /* ---------- Familie ---------- */
  async createChild(input): Promise<ChildCreated> {
    const created = await apiClient.postClubsByClubIdChildren(activeClubId(), {
      first_name: input.firstName,
      last_name: input.lastName,
      birth_date: input.birthDate,
      joined_on: input.joinedOn,
      guardian_member_id: input.guardianMemberId,
      relation: input.relation,
    });
    return {
      child: mapMember(created.child),
      guardianship: mapGuardianship(created.guardianship),
    };
  },
  async addGuardianship(input) {
    const created = await apiClient.postClubsByClubIdGuardianships(activeClubId(), {
      child_member_id: input.childMemberId,
      guardian_member_id: input.guardianMemberId,
      relation: input.relation,
    });
    return mapGuardianship(created);
  },
  async removeGuardianship(guardianshipId) {
    const deleted = await apiClient.deleteClubsByClubIdGuardianshipsByGuardianshipId(
      activeClubId(),
      guardianshipId,
    );
    return { id: deleted.id };
  },

  /* ---------- Wartelisten ---------- */
  async listWaitlists(kind) {
    const rows = await apiClient.getWaitlists({ club_id: activeClubId(), kind });
    return rows.map(mapWaitlistEntry);
  },
  async joinWaitlist(input) {
    const created = await apiClient.postWaitlists({
      club_id: activeClubId(),
      member_id: input.memberId,
      kind: input.kind,
      target_id: input.targetId,
      note: input.note,
    });
    return mapWaitlistEntry(created);
  },
  async updateWaitlist(waitlistId, patch) {
    const updated = await apiClient.patchWaitlistsByWaitlistId(waitlistId, {
      status: patch.status,
      note: patch.note,
    });
    return mapWaitlistEntry(updated);
  },
  async leaveWaitlist(waitlistId) {
    const deleted = await apiClient.deleteWaitlistsByWaitlistId(waitlistId);
    return { id: deleted.id };
  },

  /* ---------- Budget ---------- */
  async listBudgets(year) {
    const rows = await apiClient.getBudgets({ club_id: activeClubId(), year });
    return rows.map(mapBudget);
  },
  async upsertBudget(input) {
    // id gesetzt → bestehende Planzeile ändern (PATCH); sonst neu anlegen (POST).
    if (input.id) {
      const updated = await apiClient.patchBudgetsByBudgetId(input.id, {
        planned_cents: input.plannedCents,
        note: input.note,
      });
      return mapBudget(updated);
    }
    const created = await apiClient.postBudgets({
      club_id: activeClubId(),
      year: input.year,
      category_id: input.categoryId,
      planned_cents: input.plannedCents,
      note: input.note,
    });
    return mapBudget(created);
  },
  async deleteBudget(budgetId) {
    const deleted = await apiClient.deleteBudgetsByBudgetId(budgetId);
    return { id: deleted.id };
  },
  async getBudgetReport(year) {
    return mapBudgetReport(
      await apiClient.getReportsBudget({ club_id: activeClubId(), year }),
    );
  },

  /* ---------- Profilfoto (POST /me/photo, multipart, nicht im Contract) ---------- */
  async uploadMyPhoto(file): Promise<UploadMyPhotoResult> {
    const form = new FormData();
    // Feldname 'file' wie serverseitig erwartet; KEIN content-type setzen —
    // der Browser setzt multipart/form-data inkl. boundary selbst.
    form.set("file", file);
    const res = await fetch(`${API_BASE_URL}/me/photo`, {
      method: "POST",
      headers: { ...authHeaders() },
      body: form,
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const problem = (await res.json()) as { detail?: string; title?: string };
        detail = problem.detail ?? problem.title ?? detail;
      } catch {
        // non-JSON body — detail bleibt statusText
      }
      throw new ApiError(res.status, null, `Profilfoto-Upload → ${res.status}: ${detail}`);
    }
    const j = (await res.json()) as {
      avatar_key: string;
      avatar_url: string;
      updated_members: string[];
    };
    return {
      avatarKey: j.avatar_key,
      // Relative /media/<key>-URL mit der API-Basis präfixen (wie im Roster/Profil).
      avatarUrl: mediaUrl(j.avatar_url) ?? j.avatar_url,
      updatedMemberIds: j.updated_members,
    };
  },
};
