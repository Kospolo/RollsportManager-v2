import type {
  MyProfile,
  MySelfProfile,
  NotificationPrefs,
  PreferenceTheme,
  ProfileVisibility,
  UserPreferences,
} from "@/lib/types";

/**
 * Facade-Segment „Selbstsicht" (App-Shell) — eigenes Profil + Präferenzen.
 * Ausgelagert aus lib/data/types.ts, damit die Datei < 400 Zeilen bleibt; die
 * DataRepository erbt MeRepository (wie Batch4Repository/FinanceRepository).
 *
 * Rechte serverseitig: /me bearbeitet NUR das eigene Profil (member_id = self /
 * auth.uid). user_preferences sind strikt privat pro Nutzer. Kein neuer
 * Endpoint für Suche/Benachrichtigungen — die nutzen bestehende, bereits
 * rollen-gescopte Facade-Reads (RLS scoped automatisch).
 */

/**
 * Patch des EIGENEN Profils. Editierbar sind ausschließlich diese fünf Felder;
 * Rolle/Status/Gültigkeit sind serverseitig gesperrt (Trigger P0001). null
 * leert E-Mail, Geburtsdatum bzw. das Selbst-Profil.
 */
export interface UpdateMyProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  /** ISO-Datum (YYYY-MM-DD) */
  birthDate?: string | null;
  /**
   * Selbst-Profil („Über mich") — freiwilliger Freitext, den JEDES
   * Vereinsmitglied sehen darf. null/"" leert den Eintrag wieder.
   * Wire-Feld: about_me (PATCH /me).
   */
  aboutMe?: string | null;
}

/** Max. Länge des Selbst-Profils — Client-Guard, der Server ist die Wahrheit. */
export const ABOUT_ME_MAX = 280;

/**
 * Selbst-Profil-Grenzen — deckungsgleich mit den DB-CHECK-Constraints (0045:
 * club_members_profile_motto_len_chk = 140, _discipline_len_chk = 60) und dem
 * memberSelfProfileUpdateSchema der API. Client-Guard; die Wahrheit steht in der
 * Datenbank. Bewusst NICHT ABOUT_ME_MAX (280): das war der alte, nie
 * persistierte about_me-Pfad — profile_motto ist auf 140 begrenzt.
 */
export const MOTTO_MAX = 140;
export const DISCIPLINE_MAX = 60;
/** Frühestes plausibles „läuft seit"-Jahr (deckungsgleich mit dem Serverschema). */
export const SKATING_SINCE_MIN = 1900;

/**
 * Patch des EIGENEN Selbst-Profils. Fehlender Schlüssel = unverändert;
 * null/"" leert Motto/Disziplin/Jahr. `visibility` hat kein „leeren" — sie ist
 * immer 'public' oder 'internal' (fehlender Schlüssel = Stufe bleibt).
 * Wire-Weg: PATCH /clubs/{clubId}/members/{memberId}/profile (app.set_self_profile).
 */
export interface UpdateMySelfProfileInput {
  motto?: string | null;
  favoriteDiscipline?: string | null;
  skatingSince?: number | null;
  visibility?: ProfileVisibility;
}

/**
 * Patch der eigenen Präferenzen. notifications wird serverseitig PARTIELL
 * gemergt (fehlende Flags bleiben, gesetzte gewinnen) — ein Teilobjekt genügt.
 */
export interface UpdateMyPreferencesInput {
  locale?: string;
  theme?: PreferenceTheme;
  /** Nur die zu ändernden Flags — Server deep-merged auf den Bestand. */
  notifications?: NotificationPrefs;
}

export interface MeRepository {
  /* ---------- App-Shell: eigenes Profil ---------- */
  /** Selbstsicht: Profilkopf + alle eigenen Mitgliedschaften (GET /me). */
  getMyProfile(): Promise<MyProfile>;
  /** Eigenes Profil ändern (PATCH /me; member_id = self, serverseitig erzwungen). */
  updateMyProfile(patch: UpdateMyProfileInput): Promise<MyProfile>;

  /* ---------- App-Shell: eigenes Selbst-Profil (freiwillig, 0045/0053) ---------- */
  /**
   * Das selbst gepflegte Profil der eingeloggten Person lesen (Motto,
   * Lieblingsdisziplin, „läuft seit", Sichtbarkeit). Quelle ist die eigene
   * club_members-Zeile. null = keine Vereinsmitgliedschaft (Plattform-Persona).
   */
  getMySelfProfile(): Promise<MySelfProfile | null>;
  /**
   * Das eigene Selbst-Profil ändern. Schreibweg ist NICHT PATCH /me, sondern
   * PATCH /clubs/{clubId}/members/{memberId}/profile → app.set_self_profile
   * (die EINE Wahrheit für diese vier Spalten). Serverseitig erzwungen: nur die
   * Person selbst / ihre Erziehungsberechtigten, nur status=active, mit
   * Kontaktdaten-Leitplanke (422) und Längen-CHECKs. Ein Administrator darf hier
   * NICHT schreiben — das ist bewusst kein Verwaltungsrecht.
   */
  updateMySelfProfile(patch: UpdateMySelfProfileInput): Promise<MySelfProfile>;

  /* ---------- App-Shell: eigene Präferenzen (strikt privat) ---------- */
  /** Eigene Präferenzen laden (GET /me/preferences; Locale/Theme/Glocke). */
  getMyPreferences(): Promise<UserPreferences>;
  /** Eigene Präferenzen ändern (PATCH /me/preferences; notifications wird gemergt). */
  updateMyPreferences(patch: UpdateMyPreferencesInput): Promise<UserPreferences>;

  /* ---------- App-Shell: eigenes Profilfoto entfernen ---------- */
  /**
   * Eigenes Profilfoto auf ALLEN eigenen Mitgliedschaften entfernen (DELETE
   * /me/photo — bewusst nicht Teil des OpenAPI-Contracts, roher Media-Fetch mit
   * Bearer). Idempotent; der Blob wird serverseitig best-effort gelöscht, wenn
   * kein Roster ihn mehr referenziert. 404 (keine Mitgliedschaft) wird als
   * no-op (updatedMembers 0) behandelt. Nach Erfolg gilt avatarUrl = null.
   */
  removeMyPhoto(): Promise<RemoveMyPhotoResult>;
}

/** Ergebnis von removeMyPhoto — avatarUrl ist danach immer null. */
export interface RemoveMyPhotoResult {
  /** Anzahl der eigenen Mitgliedschaften, deren Foto geleert wurde. */
  updatedMembers: number;
  /** Anzahl serverseitig gelöschter Blobs (0 im Mock/no-op). */
  removedBlobs: number;
}
