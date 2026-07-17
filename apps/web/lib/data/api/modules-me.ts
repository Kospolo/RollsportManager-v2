import { readSession } from "@/lib/auth/storage";
import { ApiError, type ClubMember, type ClubMemberSelfProfileUpdate } from "@/lib/api/generated";
import type { Id, MySelfProfile } from "@/lib/types";
import { API_BASE_URL } from "../config";
import type { MeRepository } from "../inputs-me";
import { activeClubId, apiClient } from "./client";
import { mapMyProfile, mapUserPreferences } from "./mappers";
import { authHeaders, mediaError } from "./media-fetch";

/**
 * Die eigene club_members-Zeile → Selbst-Profil-Sicht. Die vier profile_*-Felder
 * sind für die Person SELBST immer unredigiert (server: _self_or_guardian), also
 * lesen wir sie direkt. profile_visibility ist in der DB NOT NULL DEFAULT
 * 'internal'; ein hier fehlender/redigierter Wert fällt fail-safe auf 'internal'.
 */
function mapMySelfProfile(m: ClubMember, memberId: Id, clubId: Id): MySelfProfile {
  const motto = m.profile_motto?.trim();
  const discipline = m.profile_favorite_discipline?.trim();
  return {
    memberId,
    clubId,
    motto: motto ? motto : undefined,
    favoriteDiscipline: discipline ? discipline : undefined,
    skatingSince: m.profile_skating_since ?? undefined,
    visibility: m.profile_visibility ?? "internal",
  };
}

/** Eigene Mitgliedschaft (memberId + clubId) aus der Dev-Session auflösen. */
function selfMembership(): { memberId: Id; clubId: Id } | null {
  const session = readSession();
  const memberId = session?.profile.member_id;
  if (!memberId) return null;
  return { memberId, clubId: session?.profile.club_id ?? activeClubId() };
}

/**
 * API-Implementierung der App-Shell-Selbstsicht (eigenes Profil + Präferenzen).
 * Nutzt den GENERIERTEN Client — kein club_id nötig, der Server bindet die
 * eingeloggte Person über auth.uid() (WHERE profile_id = auth.uid()).
 *
 * PATCH /me schickt ausschließlich die vier editierbaren Felder; Rolle/Status
 * kann der Client gar nicht senden (Contract-Typ MeUpdate lässt sie nicht zu,
 * der Trigger protect_club_membership blockt sie zusätzlich). notifications wird
 * serverseitig deep-gemergt — ein Teilobjekt genügt.
 */

export const moduleApiRepositoryMe: MeRepository = {
  async getMyProfile() {
    return mapMyProfile(await apiClient.getMe());
  },
  async updateMyProfile(patch) {
    // about_me ergänzt gerade der Backend-Trupp; die GENERIERTEN Contract-Typen
    // (MeUpdate) kennen das Feld noch nicht, deshalb der eng gefasste Cast.
    // ⚠️ NACH der Contract-Regenerierung: Cast entfernen, Feld direkt setzen.
    const body = {
      first_name: patch.firstName,
      last_name: patch.lastName,
      email: patch.email,
      birth_date: patch.birthDate,
      ...(patch.aboutMe !== undefined ? { about_me: patch.aboutMe } : {}),
    };
    const updated = await apiClient.patchMe(body as Parameters<typeof apiClient.patchMe>[0]);
    return mapMyProfile(updated);
  },
  async getMySelfProfile() {
    const self = selfMembership();
    if (!self) return null;
    // Die eigene Zeile aus dem Roster lesen (RLS liefert die eigene immer). Kein
    // eigener „ein Mitglied"-Endpunkt nötig; das 360-Grad-Profil wäre für vier
    // Felder zu schwer.
    const roster = await apiClient.getClubsByClubIdMembers(self.clubId);
    const me = roster.find((m) => m.id === self.memberId);
    if (!me) return null;
    return mapMySelfProfile(me, self.memberId, self.clubId);
  },
  async updateMySelfProfile(patch) {
    const self = selfMembership();
    if (!self) throw new ApiError(401, null, "Nicht angemeldet (Dev-Login fehlt)");
    // Nur die gesetzten Felder senden — set_self_profile hat Patch-Semantik
    // (fehlender Schlüssel = unverändert). Leerstring → null (Angabe löschen);
    // die Route lehnt einen leeren Body serverseitig ab (refine „empty update").
    const body: ClubMemberSelfProfileUpdate = {};
    if (patch.motto !== undefined) body.motto = patch.motto === "" ? null : patch.motto;
    if (patch.favoriteDiscipline !== undefined)
      body.favorite_discipline = patch.favoriteDiscipline === "" ? null : patch.favoriteDiscipline;
    if (patch.skatingSince !== undefined) body.skating_since = patch.skatingSince;
    if (patch.visibility !== undefined) body.visibility = patch.visibility;
    const updated = await apiClient.patchClubsByClubIdMembersByMemberIdProfile(
      self.clubId,
      self.memberId,
      body,
    );
    return mapMySelfProfile(updated, self.memberId, self.clubId);
  },
  async getMyPreferences() {
    return mapUserPreferences(await apiClient.getMePreferences());
  },
  async updateMyPreferences(patch) {
    const updated = await apiClient.patchMePreferences({
      locale: patch.locale,
      theme: patch.theme,
      notifications: patch.notifications,
    });
    return mapUserPreferences(updated);
  },
  async removeMyPhoto() {
    // DELETE /me/photo ist NICHT im Contract → roher fetch mit Bearer. 404
    // (keine Mitgliedschaft) ist ein harmloses no-op im eingeloggten Zustand.
    const res = await fetch(`${API_BASE_URL}/me/photo`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    });
    if (res.status === 404) return { updatedMembers: 0, removedBlobs: 0 };
    if (!res.ok) throw await mediaError(res, "Profilfoto entfernen");
    const j = (await res.json()) as { updated_members?: number; removed_blobs?: number };
    return { updatedMembers: j.updated_members ?? 0, removedBlobs: j.removed_blobs ?? 0 };
  },
};
