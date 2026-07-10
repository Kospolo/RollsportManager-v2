import type { Dict } from "@/lib/i18n";
import type { ExerciseCategory } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary der Übungsbibliothek (Grid + Filter + Detail +
 * Formular). IMMER beide Sprachen vollständig, deutsche Strings mit echten
 * Umlauten. Schmales Leerzeichen ( ) vor Einheiten gemäß DESIGN-SYSTEM §2.4.
 *
 * Kategorie-Labels sind hier zu Hause (der Client kennt nur den
 * ExerciseCategory-Union; ExerciseCategoryValues gibt es nur im generierten
 * M-Namespace der Facade). Referenz §4: aufwärmen/dehnung/kraft/sprung/
 * pirouette/schritt/kombination.
 */
export const uebungenDict = {
  de: {
    /* Kopf */
    pageTitle: "Übungsbibliothek",
    pageSub: "Trainingskatalog deines Vereins — nach Kategorie gefiltert",
    newExercise: "Übung anlegen",

    /* Filter-Chips */
    filterLabel: "Übungen nach Kategorie filtern",
    filterAll: "Alle",
    catWarmup: "Aufwärmen",
    catStretching: "Dehnung",
    catStrength: "Kraft",
    catJump: "Sprung",
    catSpin: "Pirouette",
    catSteps: "Schritte",
    catCombination: "Kombination",

    /* Schwierigkeit & Dauer */
    difficultyLabel: "Schwierigkeit",
    difficultyValue: "Schwierigkeit {n} von 5",
    difficultyNone: "Ohne Angabe",
    durationLabel: "Dauer",
    durationValue: "Dauer {time} Minuten",
    durationUnit: "Min.",

    /* Karte */
    videoBadge: "Video",
    createdByShort: "von {name}",
    unknownAuthor: "Unbekannt",

    /* Leerzustände */
    listEmptyTitle: "Noch keine Übungen",
    listEmptyBody: "Lege die erste Übung für den Trainingskatalog an.",
    listEmptyCta: "Erste Übung anlegen",
    filterEmptyTitle: "Keine Übungen in dieser Kategorie",
    filterEmptyBody: "Wähle eine andere Kategorie oder zeige alle Übungen an.",
    filterEmptyCta: "Alle anzeigen",

    /* Laden & Fehler (Facade) */
    retry: "Wiederholen",
    loadErrorTitle: "Übungen konnten nicht geladen werden",
    loadErrorBody: "Bitte versuche es später erneut.",
    notConnectedTitle: "Noch nicht angebunden",
    notConnectedBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",

    /* Detail-Dialog */
    detailEyebrow: "Übung",
    detailAuthor: "Angelegt von {name}",
    metaCategory: "Kategorie",
    descriptionHeading: "Beschreibung",
    instructionsHeading: "Anleitung",
    videoOpen: "Video ansehen",
    videoHint: "Öffnet in einem neuen Tab",
    editAction: "Bearbeiten",
    deleteAction: "Löschen",
    close: "Schließen",

    /* Formular (Anlegen/Bearbeiten) */
    createEyebrow: "Neue Übung",
    createTitle: "Übung anlegen",
    editEyebrow: "Übung bearbeiten",
    editTitle: "Übung bearbeiten",
    fName: "Name",
    fNamePlaceholder: "z. B. Einfache Standpirouette",
    fNameError: "Bitte gib einen Namen ein.",
    fCategory: "Kategorie",
    fDifficulty: "Schwierigkeit",
    fDifficultyHint: "1 = leicht, 5 = sehr schwer",
    fDescription: "Beschreibung",
    fDescriptionPlaceholder: "Kurze Beschreibung der Übung (optional)",
    fVideoUrl: "Video-Link",
    fVideoPlaceholder: "https://…",
    fVideoError: "Bitte gib eine gültige http(s)-Adresse ein.",
    fInstructions: "Anleitung",
    fInstructionsPlaceholder: "Schritt-für-Schritt-Anleitung (optional)",
    fDuration: "Dauer (Sekunden)",
    fDurationHint: "Optional, muss größer als 0 sein.",
    fDurationError: "Die Dauer muss größer als 0 sein.",
    cancel: "Abbrechen",
    create: "Anlegen",
    save: "Speichern",
    createdToast: "„{name}“ wurde angelegt.",
    updatedToast: "„{name}“ wurde gespeichert.",
    forbidden: "Dafür fehlt dir die Berechtigung. Übungen dürfen nur Trainer:innen pflegen.",

    /* Löschen */
    deleteEyebrow: "Übung löschen",
    deleteTitle: "„{name}“ löschen?",
    deleteBody: "Die Übung wird aus dem Trainingskatalog entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Übung löschen",
    deletedToast: "„{name}“ wurde gelöscht.",
  },
  en: {
    /* Kopf */
    pageTitle: "Exercise library",
    pageSub: "Your club's training catalogue — filtered by category",
    newExercise: "Add exercise",

    /* Filter-Chips */
    filterLabel: "Filter exercises by category",
    filterAll: "All",
    catWarmup: "Warm-up",
    catStretching: "Stretching",
    catStrength: "Strength",
    catJump: "Jump",
    catSpin: "Spin",
    catSteps: "Steps",
    catCombination: "Combination",

    /* Schwierigkeit & Dauer */
    difficultyLabel: "Difficulty",
    difficultyValue: "Difficulty {n} of 5",
    difficultyNone: "Not set",
    durationLabel: "Duration",
    durationValue: "Duration {time} minutes",
    durationUnit: "min",

    /* Karte */
    videoBadge: "Video",
    createdByShort: "by {name}",
    unknownAuthor: "Unknown",

    /* Leerzustände */
    listEmptyTitle: "No exercises yet",
    listEmptyBody: "Add the first exercise to the training catalogue.",
    listEmptyCta: "Add first exercise",
    filterEmptyTitle: "No exercises in this category",
    filterEmptyBody: "Pick a different category or show all exercises.",
    filterEmptyCta: "Show all",

    /* Laden & Fehler (Facade) */
    retry: "Retry",
    loadErrorTitle: "Exercises could not be loaded",
    loadErrorBody: "Please try again later.",
    notConnectedTitle: "Not connected yet",
    notConnectedBody: "This area has no endpoint in api mode yet.",

    /* Detail-Dialog */
    detailEyebrow: "Exercise",
    detailAuthor: "Created by {name}",
    metaCategory: "Category",
    descriptionHeading: "Description",
    instructionsHeading: "Instructions",
    videoOpen: "Watch video",
    videoHint: "Opens in a new tab",
    editAction: "Edit",
    deleteAction: "Delete",
    close: "Close",

    /* Formular (Anlegen/Bearbeiten) */
    createEyebrow: "New exercise",
    createTitle: "Add exercise",
    editEyebrow: "Edit exercise",
    editTitle: "Edit exercise",
    fName: "Name",
    fNamePlaceholder: "e.g. Simple upright spin",
    fNameError: "Please enter a name.",
    fCategory: "Category",
    fDifficulty: "Difficulty",
    fDifficultyHint: "1 = easy, 5 = very hard",
    fDescription: "Description",
    fDescriptionPlaceholder: "Short description of the exercise (optional)",
    fVideoUrl: "Video link",
    fVideoPlaceholder: "https://…",
    fVideoError: "Please enter a valid http(s) address.",
    fInstructions: "Instructions",
    fInstructionsPlaceholder: "Step-by-step instructions (optional)",
    fDuration: "Duration (seconds)",
    fDurationHint: "Optional, must be greater than 0.",
    fDurationError: "Duration must be greater than 0.",
    cancel: "Cancel",
    create: "Add",
    save: "Save",
    createdToast: "“{name}” was added.",
    updatedToast: "“{name}” was saved.",
    forbidden: "You don't have permission for this. Only coaches may manage exercises.",

    /* Löschen */
    deleteEyebrow: "Delete exercise",
    deleteTitle: "Delete “{name}”?",
    deleteBody: "The exercise will be removed from the training catalogue. This cannot be undone.",
    deleteConfirm: "Delete exercise",
    deletedToast: "“{name}” was deleted.",
  },
} satisfies Dict;

/** Anzeige-Reihenfolge der Kategorien (Referenz §4). */
export const CATEGORY_ORDER: readonly ExerciseCategory[] = [
  "warmup",
  "stretching",
  "strength",
  "jump",
  "spin",
  "steps",
  "combination",
];

/** ExerciseCategory → i18n-Schlüssel des Labels. */
export const CATEGORY_KEY: Record<ExerciseCategory, keyof (typeof uebungenDict)["de"]> = {
  warmup: "catWarmup",
  stretching: "catStretching",
  strength: "catStrength",
  jump: "catJump",
  spin: "catSpin",
  steps: "catSteps",
  combination: "catCombination",
};

/** Auswählbare Schwierigkeitsstufen 1..5. */
export const DIFFICULTY_VALUES: readonly number[] = [1, 2, 3, 4, 5];

/** Sekunden → "m:ss" (z. B. 90 → "1:30", 300 → "5:00"). */
export function formatDurationSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
