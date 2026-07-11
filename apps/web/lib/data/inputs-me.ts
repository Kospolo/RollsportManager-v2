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
 * Patch des EIGENEN Profils. Editierbar sind ausschließlich diese vier Felder;
 * Rolle/Status/Gültigkeit sind serverseitig gesperrt (Trigger P0001). null
 * leert E-Mail bzw. Geburtsdatum.
 */
export interface UpdateMyProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  /** ISO-Datum (YYYY-MM-DD) */
  birthDate?: string | null;
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

  /* ---------- App-Shell: eigene Präferenzen (strikt privat) ---------- */
  /** Eigene Präferenzen laden (GET /me/preferences; Locale/Theme/Glocke). */
  getMyPreferences(): Promise<UserPreferences>;
  /** Eigene Präferenzen ändern (PATCH /me/preferences; notifications wird gemergt). */
  updateMyPreferences(patch: UpdateMyPreferencesInput): Promise<UserPreferences>;
}
