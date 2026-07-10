import type { DataRepository } from "../types";
import { activeClubId, apiClient } from "./client";
import { mapExercise, mapNews, mapNote } from "./mappers";

/**
 * API-Implementierung der Batch-1-Module (Neuigkeiten, Notizen, Übungen).
 * Ausgelagert aus api/index.ts, damit beide Dateien < 400 Zeilen bleiben und
 * die Struktur den Mock-Modulen (mock/modules.ts) spiegelt.
 */

/** Nur die 12 Batch-1-Modul-Methoden — wird in apiRepository gespreizt. */
type ModuleMethods = Pick<
  DataRepository,
  | "listNews"
  | "createNews"
  | "updateNews"
  | "deleteNews"
  | "listNotes"
  | "createNote"
  | "updateNote"
  | "deleteNote"
  | "listExercises"
  | "createExercise"
  | "updateExercise"
  | "deleteExercise"
>;

export const moduleApiRepository: ModuleMethods = {
  /* ---------- Neuigkeiten ---------- */
  async listNews() {
    const rows = await apiClient.getNews({ club_id: activeClubId() });
    return rows.map(mapNews);
  },
  async createNews(input) {
    const created = await apiClient.postNews({
      club_id: activeClubId(),
      title: input.title,
      body: input.body,
      is_pinned: input.isPinned,
      published_at: input.publishedAt,
    });
    return mapNews(created);
  },
  async updateNews(newsId, patch) {
    const updated = await apiClient.patchNewsByNewsId(newsId, {
      title: patch.title,
      body: patch.body,
      is_pinned: patch.isPinned,
      published_at: patch.publishedAt,
    });
    return mapNews(updated);
  },
  async deleteNews(newsId) {
    const deleted = await apiClient.deleteNewsByNewsId(newsId);
    return { id: deleted.id };
  },

  /* ---------- Notizen (privat) ---------- */
  async listNotes() {
    const rows = await apiClient.getNotes();
    return rows.map(mapNote);
  },
  async createNote(input) {
    const created = await apiClient.postNotes({
      title: input.title,
      body: input.body,
      club_id: input.clubId,
    });
    return mapNote(created);
  },
  async updateNote(noteId, patch) {
    const updated = await apiClient.patchNotesByNoteId(noteId, {
      title: patch.title,
      body: patch.body,
      club_id: patch.clubId,
    });
    return mapNote(updated);
  },
  async deleteNote(noteId) {
    const deleted = await apiClient.deleteNotesByNoteId(noteId);
    return { id: deleted.id };
  },

  /* ---------- Übungen ---------- */
  async listExercises(category) {
    const rows = await apiClient.getExercises({ club_id: activeClubId(), category });
    return rows.map(mapExercise);
  },
  async createExercise(input) {
    const created = await apiClient.postExercises({
      club_id: activeClubId(),
      name: input.name,
      category: input.category,
      difficulty: input.difficulty,
      description: input.description,
      video_url: input.videoUrl,
      instructions: input.instructions,
      duration_seconds: input.durationSeconds,
    });
    return mapExercise(created);
  },
  async updateExercise(exerciseId, patch) {
    const updated = await apiClient.patchExercisesByExerciseId(exerciseId, {
      name: patch.name,
      category: patch.category,
      difficulty: patch.difficulty,
      description: patch.description,
      video_url: patch.videoUrl,
      instructions: patch.instructions,
      duration_seconds: patch.durationSeconds,
    });
    return mapExercise(updated);
  },
  async deleteExercise(exerciseId) {
    const deleted = await apiClient.deleteExercisesByExerciseId(exerciseId);
    return { id: deleted.id };
  },
};
