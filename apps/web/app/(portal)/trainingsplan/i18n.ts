import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary des Trainingsplans (Wochenraster Mo–So +
 * Listen-Ansicht + „Trainingszeit"-Formular + Löschdialog). IMMER beide
 * Sprachen vollständig, deutsche Strings mit echten Umlauten (ä/ö/ü/ß).
 *
 * Die Wochentags-Labels selbst kommen NICHT von hier, sondern aus der Facade
 * (weekdayLabels aus @/lib/types, 0 = Montag … 6 = Sonntag) — so bleibt die
 * Backend-Konvention (migration 0010) die einzige Wahrheit.
 */
export const trainingsplanDict = {
  de: {
    /* Kopf */
    pageTitle: "Trainingsplan",
    pageSub: "Die Trainingszeiten deines Vereins — Woche für Woche",
    newSlot: "Trainingszeit anlegen",

    /* Ansicht-Umschalter (Wochenraster / Liste) */
    viewLabel: "Ansicht wechseln",
    viewGrid: "Wochenraster",
    viewList: "Liste",

    /* Wochentag-Spalten & -Abschnitte */
    today: "Heute",
    emptyDay: "Kein Training",
    slotCountAria: "{n} Trainingszeiten",

    /* Karte (Meta) */
    metaCoach: "Trainer:in",
    metaWholeClub: "Ganzer Verein",

    /* Laden & Fehler (Facade) */
    retry: "Wiederholen",
    loadErrorTitle: "Trainingsplan konnte nicht geladen werden",
    loadErrorBody: "Bitte versuche es später erneut.",
    notConnectedTitle: "Noch nicht angebunden",
    notConnectedBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",

    /* Leerzustände */
    listEmptyTitle: "Noch kein Trainingsplan",
    listEmptyBodyTrainer: "Lege die erste Trainingszeit an.",
    listEmptyBodyMember: "Es sind noch keine Trainingszeiten hinterlegt.",
    listEmptyCta: "Erste Zeit anlegen",

    /* Formular (Anlegen / Bearbeiten) */
    createEyebrow: "Neue Trainingszeit",
    createTitle: "Trainingszeit anlegen",
    editEyebrow: "Trainingszeit bearbeiten",
    editTitle: "Trainingszeit bearbeiten",
    fWeekday: "Wochentag",
    fStart: "Beginn",
    fEnd: "Ende",
    fEndError: "Das Ende muss nach dem Beginn liegen.",
    fTeam: "Team",
    fTeamNone: "Alle Teams",
    fFacility: "Halle",
    fFacilityNone: "Keine Halle",
    fLocation: "Ort",
    fLocationPlaceholder: "z. B. Feld B, Außenbereich (optional)",
    fLocationHint: "Zusätzlicher Ort — z. B. wenn keine Halle hinterlegt ist.",
    fCoach: "Trainer:in",
    fCoachNone: "Kein:e Trainer:in",
    fNote: "Notiz",
    fNotePlaceholder: "z. B. Schwerpunkt Pflicht, Gruppe A (optional)",
    cancel: "Abbrechen",
    create: "Anlegen",
    save: "Speichern",
    createdToast: "Trainingszeit ({slot}) wurde angelegt.",
    updatedToast: "Trainingszeit ({slot}) wurde gespeichert.",
    forbidden:
      "Dafür fehlt dir die Berechtigung. Den Trainingsplan pflegen nur Trainer:innen.",

    /* Karten-Aktionen */
    editAction: "Bearbeiten",
    deleteAction: "Löschen",

    /* Löschen */
    deleteEyebrow: "Trainingszeit löschen",
    deleteTitle: "Trainingszeit ({slot}) löschen?",
    deleteBody:
      "Die Trainingszeit wird aus dem Plan entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Zeit löschen",
    deletedToast: "Trainingszeit ({slot}) wurde gelöscht.",
  },
  en: {
    /* Kopf */
    pageTitle: "Training schedule",
    pageSub: "Your club's training times — week by week",
    newSlot: "Add training time",

    /* View switch */
    viewLabel: "Switch view",
    viewGrid: "Week grid",
    viewList: "List",

    /* Weekday columns & sections */
    today: "Today",
    emptyDay: "No training",
    slotCountAria: "{n} training times",

    /* Card (meta) */
    metaCoach: "Coach",
    metaWholeClub: "Whole club",

    /* Loading & errors */
    retry: "Retry",
    loadErrorTitle: "Schedule could not be loaded",
    loadErrorBody: "Please try again later.",
    notConnectedTitle: "Not connected yet",
    notConnectedBody: "This area has no endpoint in api mode yet.",

    /* Empty states */
    listEmptyTitle: "No schedule yet",
    listEmptyBodyTrainer: "Add the first training time.",
    listEmptyBodyMember: "No training times have been set up yet.",
    listEmptyCta: "Add first time",

    /* Form (create / edit) */
    createEyebrow: "New training time",
    createTitle: "Add training time",
    editEyebrow: "Edit training time",
    editTitle: "Edit training time",
    fWeekday: "Weekday",
    fStart: "Start",
    fEnd: "End",
    fEndError: "The end must be after the start.",
    fTeam: "Team",
    fTeamNone: "All teams",
    fFacility: "Facility",
    fFacilityNone: "No facility",
    fLocation: "Location",
    fLocationPlaceholder: "e.g. Field B, outdoor (optional)",
    fLocationHint: "Extra location — e.g. when no facility is set.",
    fCoach: "Coach",
    fCoachNone: "No coach",
    fNote: "Note",
    fNotePlaceholder: "e.g. focus on figures, group A (optional)",
    cancel: "Cancel",
    create: "Add",
    save: "Save",
    createdToast: "Training time ({slot}) was added.",
    updatedToast: "Training time ({slot}) was saved.",
    forbidden: "You don't have permission for this. Only coaches may manage the schedule.",

    /* Card actions */
    editAction: "Edit",
    deleteAction: "Delete",

    /* Delete */
    deleteEyebrow: "Delete training time",
    deleteTitle: "Delete training time ({slot})?",
    deleteBody:
      "The training time will be removed from the schedule. This cannot be undone.",
    deleteConfirm: "Delete time",
    deletedToast: "Training time ({slot}) was deleted.",
  },
} satisfies Dict;
