import type { ExerciseCategory, Id } from "@/lib/types";

/**
 * Eingabe-Typen der Batch-1-Module (Neuigkeiten, Notizen, Übungen). Ausgelagert
 * aus lib/data/types.ts, damit die Datei < 400 Zeilen bleibt. Re-exportiert
 * über lib/data/index.ts.
 */

/* ---------- Module: Neuigkeiten ---------- */

/** Neuigkeit anlegen (is_club_trainer). Ohne publishedAt = sofort veröffentlicht (api: server-default). */
export interface CreateNewsInput {
  title: string;
  body: string;
  isPinned?: boolean;
  /** ISO-Zeitstempel; weglassen = jetzt/Server-Default */
  publishedAt?: string;
}

/** Neuigkeit ändern (is_club_trainer). null bei publishedAt = zurück auf Entwurf. */
export interface UpdateNewsInput {
  title?: string;
  body?: string;
  isPinned?: boolean;
  publishedAt?: string | null;
}

/* ---------- Module: Notizen (privat) ---------- */

/** Private Notiz anlegen (owner = auth.uid()). clubId optional/lose. */
export interface CreateNoteInput {
  title: string;
  body: string;
  clubId?: Id;
}

/** Private Notiz ändern. null bei clubId löst die Vereinszuordnung. */
export interface UpdateNoteInput {
  title?: string;
  body?: string;
  clubId?: Id | null;
}

/* ---------- Module: Übungen ---------- */

/** Übung anlegen (is_club_trainer). difficulty 1..5 Pflicht; durationSeconds > 0. */
export interface CreateExerciseInput {
  name: string;
  category: ExerciseCategory;
  difficulty: number;
  description?: string;
  videoUrl?: string;
  instructions?: string;
  durationSeconds?: number;
}

/** Übung ändern (is_club_trainer). null leert das jeweilige Feld. */
export interface UpdateExerciseInput {
  name?: string;
  category?: ExerciseCategory;
  difficulty?: number;
  description?: string | null;
  videoUrl?: string | null;
  instructions?: string | null;
  durationSeconds?: number | null;
}
