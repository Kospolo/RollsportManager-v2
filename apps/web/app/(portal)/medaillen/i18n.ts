import type { Dict } from "@/lib/i18n";
import type { Medal } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary des Medaillen-Screens („Meine Erfolge“).
 * Regel: JEDE Ergänzung in beiden Sprachen, deutsche Strings mit echten
 * Umlauten (ä/ö/ü/ß) — nie ae/oe/ue/ss.
 */
export const medaillenDict = {
  de: {
    pageEyebrow: "Erfolge",
    pageTitle: "Meine Medaillen",
    pageSub: "Deine Wettkampf-Erfolge und die Höhepunkte des ganzen Vereins",
    award: "Erfolg vergeben",

    mineTitle: "Meine Medaillen",
    mineSub: "Deine persönlichen Wettkampf-Erfolge",
    mineEmptyTitle: "Noch keine eigenen Medaillen",
    mineEmptyBody:
      "Sobald der Trainerstab dir einen Wettkampf-Erfolg zuweist, glänzt er hier in deiner Vitrine.",

    clubTitle: "Alle Erfolge im Verein",
    clubSub: "Was der Verein zusammen erreicht hat",

    countGold: "Gold",
    countSilver: "Silber",
    countBronze: "Bronze",
    medalsSuffix: "Medaillen",

    medalGold: "Gold",
    medalSilver: "Silber",
    medalBronze: "Bronze",
    participation: "Teilnahme",

    filterLabel: "Erfolge nach Medaille filtern",
    filterAll: "Alle",
    filterGold: "Gold",
    filterSilver: "Silber",
    filterBronze: "Bronze",
    filterNone: "Teilnahme",
    filterEmptyTitle: "Keine Treffer",
    filterEmptyBody: "Für diese Medaille ist noch kein Erfolg eingetragen.",
    filterEmptyCta: "Filter zurücksetzen",

    placementBadge: "Platz {n}",
    forMember: "für {name}",
    edit: "Bearbeiten",
    delete: "Löschen",
    editAria: "Erfolg bearbeiten: {title}",
    deleteAria: "Erfolg löschen: {title}",

    emptyTitle: "Noch keine Erfolge",
    emptyBodyTrainer:
      "Trage den ersten Wettkampf-Erfolg ein — er erscheint sofort in der Vitrine des Vereins.",
    emptyBodyMember: "Sobald der Trainerstab Erfolge einträgt, erscheinen sie hier.",
    emptyCta: "Ersten Erfolg vergeben",

    loadErrorTitle: "Erfolge konnten nicht geladen werden",
    retry: "Erneut versuchen",
    niTitle: "Noch nicht angebunden",
    niBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",
    noPermission: "Keine Berechtigung für diese Aktion",

    formEyebrowCreate: "Neuer Erfolg",
    formTitleCreate: "Erfolg vergeben",
    formEyebrowEdit: "Erfolg bearbeiten",
    formTitleEdit: "Erfolg bearbeiten",
    fMember: "Mitglied",
    fMemberPh: "Mitglied wählen …",
    fMemberHint: "Wer hat den Erfolg errungen?",
    fTitle: "Titel des Erfolgs",
    fTitlePh: "z. B. Landesmeisterschaft Kür 2026",
    fCompetition: "Wettkampf",
    fCompetitionPh: "z. B. LM Baden-Württemberg",
    fPlacement: "Platzierung",
    fPlacementPh: "z. B. 2",
    fPlacementHint: "Optional — Rang im Wettkampf.",
    fMedal: "Medaille",
    medalNone: "Teilnahme (ohne Medaille)",
    fDate: "Datum",
    fNote: "Notiz",
    fNotePh: "Optionaler Vermerk zum Erfolg …",
    errMember: "Bitte wähle ein Mitglied.",
    errTitle: "Bitte gib einen Titel an.",
    errDate: "Bitte gib ein gültiges Datum an.",
    errPlacement: "Bitte gib eine Platzierung > 0 an.",
    submitCreate: "Erfolg eintragen",
    submitEdit: "Änderungen speichern",
    cancel: "Abbrechen",
    createdToast: "Erfolg „{title}“ ist eingetragen",
    updatedToast: "Erfolg „{title}“ ist aktualisiert",

    deleteEyebrow: "Löschen bestätigen",
    deleteTitle: "„{title}“ löschen?",
    deleteBody:
      "Der Erfolg wird aus der Vitrine des Vereins entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Endgültig löschen",
    deletedToast: "Erfolg gelöscht",
  },
  en: {
    pageEyebrow: "Achievements",
    pageTitle: "My medals",
    pageSub: "Your competition results and the whole club's highlights",
    award: "Award achievement",

    mineTitle: "My medals",
    mineSub: "Your personal competition results",
    mineEmptyTitle: "No medals yet",
    mineEmptyBody:
      "As soon as a coach awards you a competition result, it will shine here in your cabinet.",

    clubTitle: "All club achievements",
    clubSub: "What the club has achieved together",

    countGold: "Gold",
    countSilver: "Silver",
    countBronze: "Bronze",
    medalsSuffix: "medals",

    medalGold: "Gold",
    medalSilver: "Silver",
    medalBronze: "Bronze",
    participation: "Participation",

    filterLabel: "Filter achievements by medal",
    filterAll: "All",
    filterGold: "Gold",
    filterSilver: "Silver",
    filterBronze: "Bronze",
    filterNone: "Participation",
    filterEmptyTitle: "No matches",
    filterEmptyBody: "No achievement recorded for this medal yet.",
    filterEmptyCta: "Reset filter",

    placementBadge: "Rank {n}",
    forMember: "for {name}",
    edit: "Edit",
    delete: "Delete",
    editAria: "Edit achievement: {title}",
    deleteAria: "Delete achievement: {title}",

    emptyTitle: "No achievements yet",
    emptyBodyTrainer:
      "Record the first competition result — it appears in the club cabinet right away.",
    emptyBodyMember: "As soon as a coach records achievements, they show up here.",
    emptyCta: "Award the first achievement",

    loadErrorTitle: "Achievements could not be loaded",
    retry: "Try again",
    niTitle: "Not connected yet",
    niBody: "This area has no endpoint in api mode yet.",
    noPermission: "No permission for this action",

    formEyebrowCreate: "New achievement",
    formTitleCreate: "Award achievement",
    formEyebrowEdit: "Edit achievement",
    formTitleEdit: "Edit achievement",
    fMember: "Member",
    fMemberPh: "Choose member …",
    fMemberHint: "Who achieved this result?",
    fTitle: "Achievement title",
    fTitlePh: "e.g. State championship freestyle 2026",
    fCompetition: "Competition",
    fCompetitionPh: "e.g. State champ. Baden-Württemberg",
    fPlacement: "Placement",
    fPlacementPh: "e.g. 2",
    fPlacementHint: "Optional — rank in the competition.",
    fMedal: "Medal",
    medalNone: "Participation (no medal)",
    fDate: "Date",
    fNote: "Note",
    fNotePh: "Optional remark about the achievement …",
    errMember: "Please choose a member.",
    errTitle: "Please enter a title.",
    errDate: "Please enter a valid date.",
    errPlacement: "Please enter a placement > 0.",
    submitCreate: "Record achievement",
    submitEdit: "Save changes",
    cancel: "Cancel",
    createdToast: "Achievement “{title}” recorded",
    updatedToast: "Achievement “{title}” updated",

    deleteEyebrow: "Confirm deletion",
    deleteTitle: "Delete “{title}”?",
    deleteBody:
      "The achievement will be removed from the club cabinet. This cannot be undone.",
    deleteConfirm: "Delete permanently",
    deletedToast: "Achievement deleted",
  },
} satisfies Dict;

/** Schlüssel-Typ des Medaillen-Dictionaries (für typsichere Label-Maps). */
export type MedaillenKey = keyof (typeof medaillenDict)["de"];

/** Anzeigereihenfolge der Medaillen (edelste zuerst). */
export const MEDAL_ORDER: readonly Medal[] = ["gold", "silver", "bronze"];

/** Medaille → Dictionary-Label-Schlüssel. */
export const MEDAL_LABEL_KEY: Record<Medal, MedaillenKey> = {
  gold: "medalGold",
  silver: "medalSilver",
  bronze: "medalBronze",
};

/** Filter über den Vereins-Erfolgen: alle, je Medaille oder Teilnahme (ohne). */
export type MedalFilter = "all" | Medal | "none";
