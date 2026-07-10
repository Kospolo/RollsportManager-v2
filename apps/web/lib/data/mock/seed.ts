import type { Exercise, News, Note } from "@/lib/types";
import { club } from "@/lib/mock";

/**
 * Start-Seed der Modul-Stores (Neuigkeiten, Notizen, Übungen) für den
 * Mock-Modus. Bewusst klein gehalten — die Flows werden über die
 * Schreibpfade der Facade erfahrbar. Echte Umlaute, DE-Inhalte.
 */

/** Stabiler Pseudo-Profil-Schlüssel der eingeloggten Mock-Persona (Sandra Vogel). */
export const MOCK_SELF_PROFILE = "profile-self";

/** ISO-Zeitstempel vor n Tagen (für plausible published/updated-Zeiten). */
const isoDaysAgo = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString();

export const newsSeed: News[] = [
  {
    id: "news-01",
    clubId: club.id,
    authorMemberId: "m-01",
    title: "Saisonstart 2026 — neue Trainingszeiten",
    body:
      "Willkommen zurück auf dem Parkett! Ab Montag gelten die neuen " +
      "Hallenzeiten. Die Kürgruppe Leistung trainiert künftig zusätzlich " +
      "freitags. Bitte Anwesenheit frühzeitig zusagen.",
    isPinned: true,
    publishedAt: isoDaysAgo(3),
    createdAt: isoDaysAgo(3),
    updatedAt: isoDaysAgo(3),
  },
  {
    id: "news-02",
    clubId: club.id,
    authorMemberId: "m-02",
    title: "Vereinsausflug zur Landesmeisterschaft",
    body:
      "Wir organisieren eine gemeinsame Fahrt nach Stuttgart. Fahrgemein" +
      "schaften bitte in der Notiz-App festhalten. Für Verpflegung ist " +
      "gesorgt — über Kuchenspenden freuen wir uns sehr!",
    isPinned: false,
    publishedAt: isoDaysAgo(9),
    createdAt: isoDaysAgo(9),
    updatedAt: isoDaysAgo(9),
  },
];

export const noteSeed: Note[] = [
  {
    id: "note-01",
    ownerProfileId: MOCK_SELF_PROFILE,
    clubId: club.id,
    title: "Ideen für die Choreografie",
    body:
      "Übergang nach der Pirouette weicher gestalten. Musik bei 1:20 " +
      "betonen. Für Leonie eine leichtere Sprungvariante prüfen.",
    createdAt: isoDaysAgo(5),
    updatedAt: isoDaysAgo(1),
  },
];

export const exerciseSeed: Exercise[] = [
  {
    id: "ex-01",
    clubId: club.id,
    createdByMemberId: "m-01",
    name: "Hüftkreisen & Fußgelenke",
    description: "Sanftes Aufwärmen der Gelenke vor dem Training.",
    category: "warmup",
    difficulty: 1,
    durationSeconds: 300,
    createdAt: isoDaysAgo(20),
    updatedAt: isoDaysAgo(20),
  },
  {
    id: "ex-02",
    clubId: club.id,
    createdByMemberId: "m-05",
    name: "Standwaage halten",
    description: "Gleichgewicht und Körperspannung schulen.",
    category: "strength",
    difficulty: 3,
    instructions: "Beide Seiten je 30 Sekunden, Blick nach vorn.",
    durationSeconds: 120,
    createdAt: isoDaysAgo(15),
    updatedAt: isoDaysAgo(15),
  },
  {
    id: "ex-03",
    clubId: club.id,
    createdByMemberId: "m-01",
    name: "Einfache Standpirouette",
    description: "Grundlage für alle Drehelemente.",
    category: "spin",
    difficulty: 2,
    videoUrl: "https://example.org/videos/standpirouette",
    durationSeconds: 90,
    createdAt: isoDaysAgo(10),
    updatedAt: isoDaysAgo(10),
  },
];
