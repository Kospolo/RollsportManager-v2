import type { Id, MemberRole, MemberStatus } from "./types";

/**
 * View-Typen der App-Shell-Selbstsicht (eigenes Profil + Präferenzen).
 *
 * Gespiegelt aus dem Wire-Format (/me, /me/preferences — snake_case) in die
 * camelCase-Konvention des Portals (mapMyProfile/mapUserPreferences in
 * lib/data/api/mappers.ts). Der /me-Pfad bearbeitet ausschließlich das EIGENE
 * Profil (member_id = self / auth.uid, serverseitig erzwungen); user_preferences
 * sind strikt privat pro Nutzer. Re-exportiert über "@/lib/types".
 */

/** Theme-Präferenz — deckungsgleich mit lib/theme ThemeMode (auto = Systemwahl). */
export type PreferenceTheme = "light" | "dark" | "auto";

/**
 * Benachrichtigungs-Schalter (alle optional — der Server merged partiell,
 * fehlende Flags bleiben unverändert). Steuert die Glocke der Topbar.
 */
export interface NotificationPrefs {
  events?: boolean;
  invoices?: boolean;
  news?: boolean;
  chat?: boolean;
}

/** App-Shell-Präferenzen der eingeloggten Person (Sprache, Theme, Glocke). */
export interface UserPreferences {
  profileId: Id;
  /** BCP-47-Kürzel, im Portal "de" | "en" (Server akzeptiert generisch string). */
  locale: string;
  theme: PreferenceTheme;
  notifications: NotificationPrefs;
  updatedAt: string;
}

/**
 * Eine Vereinsmitgliedschaft der eingeloggten Person, angereichert um
 * Vereinsname/-kürzel. Plattform-Personas haben eine leere memberships-Liste.
 */
export interface MyProfileMembership {
  id: Id;
  clubId: Id;
  clubName: string;
  clubShortName?: string;
  firstName: string;
  lastName: string;
  email?: string;
  /** ISO-Datum (YYYY-MM-DD) */
  birthDate?: string;
  role: MemberRole;
  status: MemberStatus;
  /** ISO-Datum des Vereinsbeitritts */
  joinedOn?: string;
  /** Nur guest_coach: befristeter Zugang bis (ISO-Datum) */
  validUntil?: string;
  /**
   * Profilfoto-URL dieser Mitgliedschaft (im api-Modus bereits mit der
   * API-Basis präfixiert). Fehlt = kein Foto → Avatar zeigt die Initialen.
   */
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Selbstsicht der eingeloggten Person: Profilkopf + alle eigenen
 * Mitgliedschaften. Editierbar sind über updateMyProfile ausschließlich
 * Vor-/Nachname, E-Mail und Geburtsdatum (Rolle/Status sind serverseitig
 * gesperrt).
 */
export interface MyProfile {
  profileId: Id;
  displayName?: string;
  locale: string;
  memberships: MyProfileMembership[];
}

/**
 * Sichtbarkeit des Selbst-Profils (0053). 'public' = alle aktiven
 * Vereinsmitglieder sehen Motto/Disziplin/seit-wann; 'internal' = nur
 * Vorstand/Trainer:innen. Die Durchsetzung ist SERVERSEITIG (redactSelfProfile,
 * members.ts) — dieser Wert steuert sie nur. Fail-safe-Vorgabe: 'internal'.
 */
export type ProfileVisibility = "public" | "internal";

/**
 * Das selbst gepflegte Profil der eingeloggten Person — das freiwillige
 * Gegenstück zu den vereinsverwalteten Stammdaten. Gelesen aus der eigenen
 * club_members-Zeile (profile_motto/-favorite_discipline/-skating_since/
 * -visibility), geschrieben AUSSCHLIESSLICH über app.set_self_profile
 * (PATCH /clubs/{clubId}/members/{memberId}/profile). Für Plattform-Personas
 * ohne Mitgliedschaft existiert es nicht (getMySelfProfile → null).
 */
export interface MySelfProfile {
  /** Eigene Mitgliedschafts-Id (club_members.id). */
  memberId: Id;
  clubId: Id;
  /** „Über mich" (profile_motto). Leer = nichts eingetragen. */
  motto?: string;
  /** Lieblingsdisziplin (profile_favorite_discipline). */
  favoriteDiscipline?: string;
  /** „Seit wann läufst du?" als Jahreszahl (profile_skating_since). */
  skatingSince?: number;
  /** Publikum des Selbst-Profils; serverseitig durchgesetzt. */
  visibility: ProfileVisibility;
}
