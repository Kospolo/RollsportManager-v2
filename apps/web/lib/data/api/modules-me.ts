import type { MeRepository } from "../inputs-me";
import { apiClient } from "./client";
import { mapMyProfile, mapUserPreferences } from "./mappers";

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
    const updated = await apiClient.patchMe({
      first_name: patch.firstName,
      last_name: patch.lastName,
      email: patch.email,
      birth_date: patch.birthDate,
    });
    return mapMyProfile(updated);
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
};
