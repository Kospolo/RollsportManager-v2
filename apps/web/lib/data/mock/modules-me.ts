import * as mock from "@/lib/mock";
import type { MyProfile, NotificationPrefs, UserPreferences } from "@/lib/types";
import type { MeRepository } from "../inputs-me";
import { MOCK_SELF_PROFILE } from "./seed";

/**
 * Mock-Implementierung der App-Shell-Selbstsicht (eigenes Profil + Präferenzen).
 * Die eingeloggte Mock-Persona ist stabil (Sandra Vogel, mock.currentUser);
 * Profil- und Präferenz-Store leben in-memory für die Session-Dauer, damit die
 * Bearbeitungs-Flows auch ohne Dev-Stack erfahrbar sind.
 *
 * notifications wird — wie serverseitig — SHALLOW gemergt (gesetzte Flags
 * gewinnen, fehlende bleiben), damit ein Teilobjekt zum Umschalten genügt.
 */

const self = mock.currentUser;
const nowIso = (): string => new Date().toISOString();

/** Editierbare Profilfelder der eingeloggten Persona (Session-Store). */
const profileStore = {
  firstName: self.firstName,
  lastName: self.lastName,
  email: self.email as string | undefined,
  birthDate: self.birthDate as string | undefined,
  // Profilfoto der eingeloggten Persona — removeMyPhoto leert es (→ Initialen).
  avatarUrl: self.avatarUrl as string | undefined,
};

/** Präferenz-Store der eingeloggten Persona (Default: DE, System-Theme, alles an). */
const preferencesStore: UserPreferences = {
  profileId: MOCK_SELF_PROFILE,
  locale: "de",
  theme: "auto",
  notifications: { events: true, invoices: true, news: true, chat: true },
  updatedAt: nowIso(),
};

function buildProfile(): MyProfile {
  const displayName = `${profileStore.firstName} ${profileStore.lastName}`.trim();
  return {
    profileId: MOCK_SELF_PROFILE,
    displayName,
    locale: preferencesStore.locale,
    memberships: [
      {
        id: self.id,
        clubId: mock.club.id,
        clubName: mock.club.name,
        clubShortName: mock.club.shortName,
        firstName: profileStore.firstName,
        lastName: profileStore.lastName,
        email: profileStore.email,
        birthDate: profileStore.birthDate,
        role: self.role,
        status: self.status,
        joinedOn: self.joinedAt || undefined,
        validUntil: self.guestAccessUntil,
        avatarUrl: profileStore.avatarUrl,
        createdAt: `${self.joinedAt || "2015-01-01"}T00:00:00.000Z`,
        updatedAt: preferencesStore.updatedAt,
      },
    ],
  };
}

export const moduleRepositoryMe: MeRepository = {
  async getMyProfile(): Promise<MyProfile> {
    return buildProfile();
  },
  async updateMyProfile(patch): Promise<MyProfile> {
    if (patch.firstName !== undefined) profileStore.firstName = patch.firstName;
    if (patch.lastName !== undefined) profileStore.lastName = patch.lastName;
    if (patch.email !== undefined) profileStore.email = patch.email ?? undefined;
    if (patch.birthDate !== undefined) profileStore.birthDate = patch.birthDate ?? undefined;
    preferencesStore.updatedAt = nowIso();
    return buildProfile();
  },
  async getMyPreferences(): Promise<UserPreferences> {
    return {
      ...preferencesStore,
      notifications: { ...preferencesStore.notifications },
    };
  },
  async updateMyPreferences(patch): Promise<UserPreferences> {
    if (patch.locale !== undefined) preferencesStore.locale = patch.locale;
    if (patch.theme !== undefined) preferencesStore.theme = patch.theme;
    if (patch.notifications !== undefined) {
      // Shallow-Merge wie serverseitig (existing || patch): rechts gewinnt.
      const merged: NotificationPrefs = {
        ...preferencesStore.notifications,
        ...patch.notifications,
      };
      preferencesStore.notifications = merged;
    }
    preferencesStore.updatedAt = nowIso();
    return {
      ...preferencesStore,
      notifications: { ...preferencesStore.notifications },
    };
  },
  async removeMyPhoto() {
    // Mock: Foto der Persona leeren → buildProfile liefert avatarUrl undefined,
    // der Avatar fällt auf die Initialen zurück. Kein echter Blob → 0 entfernt.
    const had = profileStore.avatarUrl !== undefined;
    profileStore.avatarUrl = undefined;
    preferencesStore.updatedAt = nowIso();
    return { updatedMembers: had ? 1 : 0, removedBlobs: 0 };
  },
};
