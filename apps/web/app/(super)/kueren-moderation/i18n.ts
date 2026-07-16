import type { Dict } from "@/lib/i18n";
import type { BadgeTone } from "@/components/ui/Badge";
import type { PlatformRoutineStatus } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary der Küren-Moderation (Betreiber-Ebene).
 * Beide Sprachen, echte Umlaute.
 */
export const moderationDict = {
  de: {
    title: "Küren-Moderation",
    sub: "Alle Küren aller Vereine — Titel und Musik sichten",
    demoNote: "Demo-Daten — in der echten Instanz stammt alles aus GET /platform/routines.",

    // Kennzahlen
    kpiTotal: "Küren gesamt",
    kpiClubs: "Vereine mit Küren",
    kpiWithAudio: "Mit Audio-Datei",
    kpiCompetition: "Im Wettkampf",

    // Filter
    filterLabel: "Küren filtern",
    searchLabel: "Titel, Musik oder Interpret",
    searchPlaceholder: "Suchen …",
    clubLabel: "Verein",
    clubAll: "Alle Vereine",
    statusLabel: "Status",
    statusAll: "Alle",
    statusDraft: "Entwurf",
    statusReady: "Fertig",
    statusCompetition: "Wettkampf",
    statusArchived: "Archiv",
    clearFilter: "Filter leeren",

    // Tabelle
    tableEyebrow: "Über alle Vereine",
    tableTitle: "Küren",
    tableCaption: "Alle Küren aller Vereine mit Musik-Angaben",
    colRoutine: "Kür",
    colClub: "Verein",
    colMusic: "Musik",
    colStatus: "Status",
    colSkaters: "Läufer:innen",
    colDuration: "Dauer",
    colUpdated: "Geändert",
    colAction: "Prüfen",
    routinesCount: "{n} Küren",
    noMusic: "Keine Musik hinterlegt",
    noAudio: "Keine Datei",
    hasAudio: "Audio",
    inspect: "Im Verein",
    empty: "Keine Küren vorhanden.",
    noMatch: "Keine Kür passt zum Filter.",
    noMatchBody: "Andere Schreibweise versuchen oder den Filter leeren.",

    // Die unbequeme Wahrheit über das Anhören
    audioEyebrow: "Was diese Seite kann — und was nicht",
    audioTitle: "Anhören geht hier (noch) nicht — und zwar für niemanden",
    audioBody:
      "Du siehst Titel, Interpret, Dauer und ob eine Audio-Datei hinterlegt ist. Abspielen kannst du sie nicht: die Route GET /media/{key} löst ausschließlich Galerie-Bilder, Dokumente, Profilfotos und Chat-Bilder auf — Kür-Audio ist dort nicht angeschlossen. Das ist keine Betreiber-Sperre, sondern eine Lücke im Backend: auch die Trainerin im eigenen Verein kann die Datei über die App nicht abspielen. Solange das so ist, ist eine Moderation der MUSIK selbst nicht möglich; sichten kannst du nur die Angaben dazu.",
    actionTitle: "Melden/Sperren gibt es nicht — das hier ist der echte Weg",
    actionBody:
      "Es gibt keinen Endpunkt, der eine Kür meldet oder sperrt, und diese Seite tut nicht so, als gäbe es einen. Was es wirklich gibt: „Im Verein“ schaltet dich in den betreffenden Verein, dort öffnest du die Kür mit owner-gleicher Autorität und kannst sie ändern oder löschen — protokolliert, wie jeder Betreiber-Zugriff.",

    loadErrorTitle: "Küren konnten nicht geladen werden",
    retry: "Erneut versuchen",
  },
  en: {
    title: "Routine moderation",
    sub: "Every routine of every club — review titles and music",
    demoNote: "Demo data — the real instance sources everything from GET /platform/routines.",

    kpiTotal: "Routines total",
    kpiClubs: "Clubs with routines",
    kpiWithAudio: "With audio file",
    kpiCompetition: "In competition",

    filterLabel: "Filter routines",
    searchLabel: "Title, music or artist",
    searchPlaceholder: "Search …",
    clubLabel: "Club",
    clubAll: "All clubs",
    statusLabel: "Status",
    statusAll: "All",
    statusDraft: "Draft",
    statusReady: "Ready",
    statusCompetition: "Competition",
    statusArchived: "Archived",
    clearFilter: "Clear filter",

    tableEyebrow: "Across all clubs",
    tableTitle: "Routines",
    tableCaption: "All routines of all clubs with music details",
    colRoutine: "Routine",
    colClub: "Club",
    colMusic: "Music",
    colStatus: "Status",
    colSkaters: "Skaters",
    colDuration: "Duration",
    colUpdated: "Updated",
    colAction: "Review",
    routinesCount: "{n} routines",
    noMusic: "No music set",
    noAudio: "No file",
    hasAudio: "Audio",
    inspect: "In club",
    empty: "No routines yet.",
    noMatch: "No routine matches the filter.",
    noMatchBody: "Try a different spelling or clear the filter.",

    audioEyebrow: "What this page can do — and what it cannot",
    audioTitle: "Listening is not possible here (yet) — and not for anyone else either",
    audioBody:
      "You see title, artist, duration and whether an audio file is attached. You cannot play it: the route GET /media/{key} only resolves gallery images, documents, profile photos and chat images — routine audio is not wired up there. This is not an operator restriction but a gap in the backend: even a coach in her own club cannot play the file through the app. Until that changes, moderating the MUSIC itself is not possible; you can only review the metadata about it.",
    actionTitle: "There is no report/block action — this is the real path",
    actionBody:
      "No endpoint reports or blocks a routine, and this page does not pretend otherwise. What does exist: “In club” switches you into that club, where you open the routine with owner-level authority and can edit or delete it — logged, like every operator access.",

    loadErrorTitle: "Routines could not be loaded",
    retry: "Try again",
  },
} satisfies Dict;

export type ModerationKey = keyof (typeof moderationDict)["de"];

/** Farbton je Kür-Status — „honey“ bleibt dem Musik-Kontext vorbehalten. */
export const ROUTINE_STATUS_TONE: Record<PlatformRoutineStatus, BadgeTone> = {
  draft: "neutral",
  ready: "info",
  competition: "success",
  archived: "neutral",
};

export const ROUTINE_STATUS_KEY: Record<PlatformRoutineStatus, ModerationKey> = {
  draft: "statusDraft",
  ready: "statusReady",
  competition: "statusCompetition",
  archived: "statusArchived",
};

export const ROUTINE_STATUS_OPTIONS: readonly PlatformRoutineStatus[] = [
  "draft",
  "ready",
  "competition",
  "archived",
];
