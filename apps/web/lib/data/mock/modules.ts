import * as mock from "@/lib/mock";
import type { Exercise, News, Note } from "@/lib/types";
import type { DataRepository } from "../types";
import { MOCK_SELF_PROFILE, exerciseSeed, newsSeed, noteSeed } from "./seed";

/**
 * Mock-Implementierung der Batch-1-Module (Neuigkeiten, Notizen, Übungen).
 * Ausgelagert aus mock/index.ts, damit beide Dateien < 400 Zeilen bleiben.
 *
 * Eigene In-Memory-Stores (Session-Lebensdauer). clubId/Autor sind im Mock
 * stabil (der eine Demo-Verein, Sandra Vogel als eingeloggte Persona), daher
 * genügt der direkte Zugriff auf die Seed-Konstanten.
 */

const clubId = mock.club.id;
const selfMemberId = mock.members[0].id; // Sandra Vogel — Trainerin

const newsStore: News[] = newsSeed.map((n) => ({ ...n }));
const noteStore: Note[] = noteSeed.map((n) => ({ ...n }));
const exerciseStore: Exercise[] = exerciseSeed.map((e) => ({ ...e }));

let newsSeq = newsStore.length;
let noteSeq = noteStore.length;
let exerciseSeq = exerciseStore.length;

const nowIso = (): string => new Date().toISOString();

/** Nur die 12 Modul-Methoden der Facade — wird in mockRepository gespreizt. */
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

export const moduleRepository: ModuleMethods = {
  /* ---------- Neuigkeiten ---------- */
  async listNews(): Promise<News[]> {
    // Gepinnt zuerst, danach neueste (published, sonst created) zuerst.
    return [...newsStore].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt);
    });
  },
  async createNews(input): Promise<News> {
    const now = nowIso();
    const created: News = {
      id: `news-local-${++newsSeq}`,
      clubId,
      authorMemberId: selfMemberId,
      title: input.title,
      body: input.body,
      isPinned: input.isPinned ?? false,
      publishedAt: input.publishedAt ?? now,
      createdAt: now,
      updatedAt: now,
    };
    newsStore.unshift(created);
    return created;
  },
  async updateNews(newsId, patch): Promise<News> {
    const item = newsStore.find((n) => n.id === newsId);
    if (!item) throw new Error(`Neuigkeit ${newsId} nicht gefunden (mock)`);
    if (patch.title !== undefined) item.title = patch.title;
    if (patch.body !== undefined) item.body = patch.body;
    if (patch.isPinned !== undefined) item.isPinned = patch.isPinned;
    if (patch.publishedAt !== undefined) item.publishedAt = patch.publishedAt ?? undefined;
    item.updatedAt = nowIso();
    return item;
  },
  async deleteNews(newsId): Promise<{ id: string }> {
    const idx = newsStore.findIndex((n) => n.id === newsId);
    if (idx >= 0) newsStore.splice(idx, 1);
    return { id: newsId };
  },

  /* ---------- Notizen (privat) ---------- */
  async listNotes(): Promise<Note[]> {
    return [...noteStore].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async createNote(input): Promise<Note> {
    const now = nowIso();
    const created: Note = {
      id: `note-local-${++noteSeq}`,
      ownerProfileId: MOCK_SELF_PROFILE,
      clubId: input.clubId,
      title: input.title,
      body: input.body,
      createdAt: now,
      updatedAt: now,
    };
    noteStore.unshift(created);
    return created;
  },
  async updateNote(noteId, patch): Promise<Note> {
    const item = noteStore.find((n) => n.id === noteId);
    if (!item) throw new Error(`Notiz ${noteId} nicht gefunden (mock)`);
    if (patch.title !== undefined) item.title = patch.title;
    if (patch.body !== undefined) item.body = patch.body;
    if (patch.clubId !== undefined) item.clubId = patch.clubId ?? undefined;
    item.updatedAt = nowIso();
    return item;
  },
  async deleteNote(noteId): Promise<{ id: string }> {
    const idx = noteStore.findIndex((n) => n.id === noteId);
    if (idx >= 0) noteStore.splice(idx, 1);
    return { id: noteId };
  },

  /* ---------- Übungen ---------- */
  async listExercises(category): Promise<Exercise[]> {
    const list = category
      ? exerciseStore.filter((e) => e.category === category)
      : exerciseStore;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "de"));
  },
  async createExercise(input): Promise<Exercise> {
    const now = nowIso();
    const created: Exercise = {
      id: `ex-local-${++exerciseSeq}`,
      clubId,
      createdByMemberId: selfMemberId,
      name: input.name,
      description: input.description,
      category: input.category,
      difficulty: input.difficulty,
      videoUrl: input.videoUrl,
      instructions: input.instructions,
      durationSeconds: input.durationSeconds,
      createdAt: now,
      updatedAt: now,
    };
    exerciseStore.push(created);
    return created;
  },
  async updateExercise(exerciseId, patch): Promise<Exercise> {
    const item = exerciseStore.find((e) => e.id === exerciseId);
    if (!item) throw new Error(`Übung ${exerciseId} nicht gefunden (mock)`);
    if (patch.name !== undefined) item.name = patch.name;
    if (patch.category !== undefined) item.category = patch.category;
    if (patch.difficulty !== undefined) item.difficulty = patch.difficulty;
    if (patch.description !== undefined) item.description = patch.description ?? undefined;
    if (patch.videoUrl !== undefined) item.videoUrl = patch.videoUrl ?? undefined;
    if (patch.instructions !== undefined) item.instructions = patch.instructions ?? undefined;
    if (patch.durationSeconds !== undefined) {
      item.durationSeconds = patch.durationSeconds ?? undefined;
    }
    item.updatedAt = nowIso();
    return item;
  },
  async deleteExercise(exerciseId): Promise<{ id: string }> {
    const idx = exerciseStore.findIndex((e) => e.id === exerciseId);
    if (idx >= 0) exerciseStore.splice(idx, 1);
    return { id: exerciseId };
  },
};
