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
