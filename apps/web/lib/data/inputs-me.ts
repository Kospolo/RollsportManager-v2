import type { MyProfile, NotificationPrefs, PreferenceTheme, UserPreferences } from "@/lib/types";

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
