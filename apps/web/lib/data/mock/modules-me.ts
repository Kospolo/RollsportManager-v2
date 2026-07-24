import * as mock from "@/lib/mock";
import type {
  MyProfile,
  MySelfProfile,
  NotificationPrefs,
  ProfileVisibility,
  UserPreferences,
} from "@/lib/types";
import type { MeRepository } from "../inputs-me";
import { selfMember } from "./member-store";
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

// `let`, nicht `const`: Auf der Beta kann die eingeloggte Person über
// /entwickler gewechselt werden. Die Sitzungs-Speicher unten KOPIEREN ihre
// Startwerte von hier — sie bekämen einen Wechsel sonst nie mit und zeigten
// weiter Sandras Profil. Nachgezogen wird das im Block unter den Speichern.
let self = mock.currentUser;
const nowIso = (): string => new Date().toISOString();

/** Editierbare Profilfelder der eingeloggten Persona (Session-Store). */
const profileStore = {
  firstName: self.firstName,
  lastName: self.lastName,
  email: self.email as string | undefined,
  birthDate: self.birthDate as string | undefined,
  // Profilfoto der eingeloggten Persona — removeMyPhoto leert es (→ Initialen).
  avatarUrl: self.avatarUrl as string | undefined,
  // Selbst-Profil („Über mich") der eingeloggten Persona.
  aboutMe: self.aboutMe as string | undefined,
};

/**
 * Selbst-Profil-Store der eingeloggten Persona (0045/0053). Serverseitig lebt
 * das auf denselben club_members-Spalten; im Mock spiegeln wir es in einen
 * eigenen Session-Store, damit der Bearbeiten-Flow auch ohne Dev-Stack greift.
 * Vorgabe der Sichtbarkeit ist 'internal' (fail-safe, wie in der DB).
 */
const selfProfileStore: {
  motto?: string;
  favoriteDiscipline?: string;
  skatingSince?: number;
  visibility: ProfileVisibility;
} = {
  motto: profileStore.aboutMe,
  favoriteDiscipline: undefined,
  skatingSince: undefined,
  visibility: "internal",
};

/** Präferenz-Store der eingeloggten Persona (Default: DE, System-Theme, alles an). */
const preferencesStore: UserPreferences = {
  profileId: MOCK_SELF_PROFILE,
  locale: "de",
  theme: "auto",
  notifications: { events: true, invoices: true, news: true, chat: true },
  updatedAt: nowIso(),
};

/**
 * Personenwechsel auf der Beta (/entwickler): Die drei Speicher oben stehen
 * auf den Werten der VORHERIGEN Person und werden hier neu aufgebaut.
 *
 * Die Objekte werden befüllt, nicht ersetzt (`Object.assign`) — auf sie zeigen
 * bereits Verweise aus den Lesefunktionen weiter unten. Ein neues Objekt käme
 * dort nie an.
 *
 * Ausdrücklich mit `undefined` überschreiben, wo die neue Person nichts
 * hinterlegt hat: Sonst behielte Jürgen Sandras Profilfoto, nur weil sein
 * eigenes Feld leer ist.
 */
mock.onViewerChange(() => {
  self = mock.currentUser;
  Object.assign(profileStore, {
    firstName: self.firstName,
    lastName: self.lastName,
    email: self.email as string | undefined,
    birthDate: self.birthDate as string | undefined,
    avatarUrl: self.avatarUrl as string | undefined,
    aboutMe: self.aboutMe as string | undefined,
  });
  Object.assign(selfProfileStore, {
    motto: profileStore.aboutMe,
    favoriteDiscipline: undefined,
    skatingSince: undefined,
    visibility: "internal" as ProfileVisibility,
  });
  Object.assign(preferencesStore, {
    locale: "de",
    theme: "auto",
    notifications: { events: true, invoices: true, news: true, chat: true },
    updatedAt: nowIso(),
  });
});

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
    // Das Motto („Über mich") gehört NICHT zu /me — es wird über
    // updateMySelfProfile gepflegt (profile_motto). Hier NUR die Stammdaten.
    // DURCHSCHREIBEN in den Verzeichnis-Store: sonst zeigt der Toast Erfolg,
    // die eigene Mitglieder-Karte bleibt aber unverändert (serverseitig ist
    // /me dieselbe Zeile in app.club_members — das muss der Mock spiegeln).
    const me = selfMember();
    me.firstName = profileStore.firstName;
    me.lastName = profileStore.lastName;
    me.email = profileStore.email;
    me.birthDate = profileStore.birthDate;
    me.avatarUrl = profileStore.avatarUrl;
    preferencesStore.updatedAt = nowIso();
    return buildProfile();
  },
  async getMySelfProfile(): Promise<MySelfProfile | null> {
    return {
      memberId: self.id,
      clubId: mock.club.id,
      motto: selfProfileStore.motto,
      favoriteDiscipline: selfProfileStore.favoriteDiscipline,
      skatingSince: selfProfileStore.skatingSince,
      visibility: selfProfileStore.visibility,
    };
  },
  async updateMySelfProfile(patch): Promise<MySelfProfile> {
    if (patch.motto !== undefined) {
      const trimmed = patch.motto?.trim();
      selfProfileStore.motto = trimmed ? trimmed : undefined;
      // „Über mich" ist im Mock dieselbe Angabe wie das Verzeichnis-aboutMe —
      // durchschreiben, damit die eigene Mitglieder-Karte nicht auseinanderläuft.
      profileStore.aboutMe = selfProfileStore.motto;
      selfMember().aboutMe = selfProfileStore.motto;
    }
    if (patch.favoriteDiscipline !== undefined) {
      const trimmed = patch.favoriteDiscipline?.trim();
      selfProfileStore.favoriteDiscipline = trimmed ? trimmed : undefined;
    }
    if (patch.skatingSince !== undefined) {
      selfProfileStore.skatingSince = patch.skatingSince ?? undefined;
    }
    if (patch.visibility !== undefined) selfProfileStore.visibility = patch.visibility;
    preferencesStore.updatedAt = nowIso();
    return {
      memberId: self.id,
      clubId: mock.club.id,
      motto: selfProfileStore.motto,
      favoriteDiscipline: selfProfileStore.favoriteDiscipline,
      skatingSince: selfProfileStore.skatingSince,
      visibility: selfProfileStore.visibility,
    };
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
    // Auch hier durchschreiben — sonst zeigt das Verzeichnis das Foto weiter.
    selfMember().avatarUrl = undefined;
    preferencesStore.updatedAt = nowIso();
    return { updatedMembers: had ? 1 : 0, removedBlobs: 0 };
  },
};
