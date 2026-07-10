import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary für die privaten Notizen (Liste, Anlegen,
 * Bearbeiten, Löschen). Notizen sind STRIKT privat pro Nutzer — es gibt
 * kein Trainer-Gate und keinen Vereins-Lesepfad. Regel: JEDER String in
 * beiden Sprachen, deutsche Strings mit echten Umlauten (ä/ö/ü/ß).
 */
export const notesDict = {
  de: {
    title: "Notizen",
    sub: "Deine persönlichen Notizen — nur für dich sichtbar",
    newNote: "Neue Notiz",
    privateBadge: "Nur für dich sichtbar",
    privateBanner:
      "Diese Notizen sind privat und ausschließlich für dich sichtbar — niemand sonst im Verein kann sie lesen.",
    oneNote: "1 Notiz",
    notesCount: "{n} Notizen",

    // Lade- & Fehlerzustände
    retry: "Erneut versuchen",
    loadErrorTitle: "Notizen konnten nicht geladen werden",
    loadErrorBody: "Deine Notizen ließen sich gerade nicht laden — bitte erneut versuchen.",
    genericError: "Etwas ist schiefgelaufen — bitte erneut versuchen.",

    // Leerzustand
    emptyTitle: "Noch keine Notizen",
    emptyBody:
      "Halte Ideen, Gedanken und Erinnerungen fest — deine Notizen sind privat und nur für dich sichtbar.",
    emptyCta: "Erste Notiz anlegen",

    // Notiz-Karte
    noBody: "Kein Text",
    updatedAt: "Aktualisiert {when}",
    cardActions: "Aktionen für „{title}“",
    actEdit: "Bearbeiten",
    actDelete: "Löschen",

    // Anlegen / Bearbeiten (Dialog)
    createEyebrow: "Neue Notiz",
    createTitle: "Notiz anlegen",
    editEyebrow: "Notiz bearbeiten",
    editTitle: "Notiz bearbeiten",
    fTitle: "Titel",
    fTitlePlaceholder: "z. B. Ideen für die Choreografie",
    fTitleError: "Bitte einen Titel angeben.",
    fBody: "Text",
    fBodyPlaceholder: "Deine Notiz …",
    fBodyHint: "Nur für dich sichtbar — niemand sonst kann diese Notiz sehen.",
    cancel: "Abbrechen",
    create: "Notiz anlegen",
    save: "Speichern",
    createdToast: "Notiz „{title}“ angelegt",
    updatedToast: "Notiz „{title}“ gespeichert",

    // Löschen (Bestätigung)
    deleteEyebrow: "Notiz löschen",
    deleteTitle: "„{title}“ löschen?",
    deleteBody: "Die Notiz wird endgültig entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Notiz löschen",
    deletedToast: "Notiz „{title}“ gelöscht",
  },
  en: {
    title: "Notes",
    sub: "Your personal notes — visible only to you",
    newNote: "New note",
    privateBadge: "Only visible to you",
    privateBanner:
      "These notes are private and visible only to you — no one else in the club can read them.",
    oneNote: "1 note",
    notesCount: "{n} notes",

    retry: "Try again",
    loadErrorTitle: "Notes could not be loaded",
    loadErrorBody: "Your notes could not be loaded right now — please try again.",
    genericError: "Something went wrong — please try again.",

    emptyTitle: "No notes yet",
    emptyBody:
      "Capture ideas, thoughts and reminders — your notes are private and visible only to you.",
    emptyCta: "Create your first note",

    noBody: "No text",
    updatedAt: "Updated {when}",
    cardActions: "Actions for “{title}”",
    actEdit: "Edit",
    actDelete: "Delete",

    createEyebrow: "New note",
    createTitle: "Create note",
    editEyebrow: "Edit note",
    editTitle: "Edit note",
    fTitle: "Title",
    fTitlePlaceholder: "e.g. Choreography ideas",
    fTitleError: "Please enter a title.",
    fBody: "Text",
    fBodyPlaceholder: "Your note …",
    fBodyHint: "Visible only to you — no one else can see this note.",
    cancel: "Cancel",
    create: "Create note",
    save: "Save",
    createdToast: "Note “{title}” created",
    updatedToast: "Note “{title}” saved",

    deleteEyebrow: "Delete note",
    deleteTitle: "Delete “{title}”?",
    deleteBody: "The note will be removed permanently. This cannot be undone.",
    deleteConfirm: "Delete note",
    deletedToast: "Note “{title}” deleted",
  },
} satisfies Dict;

export type NotesKey = keyof (typeof notesDict)["de"];
