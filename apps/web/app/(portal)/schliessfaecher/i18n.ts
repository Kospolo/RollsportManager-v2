import type { Dict } from "@/lib/i18n";
import type { BadgeTone } from "@/components/ui/Badge";
import type { IconName } from "@/components/shell/icons";
import type { LockerStatus } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary der Schließfächer (Grid/Liste mit Status-Badge,
 * Zuordnen/Freigeben-Sheet, Stammdaten-Verwaltung, Defekt-Meldung). IMMER beide
 * Sprachen vollständig, deutsche Strings mit echten Umlauten.
 *
 * Rechte sind SERVERSEITIG (RLS + Rollencheck + Trigger app.protect_locker):
 * Anlegen/Bearbeiten/Löschen + Defekt-Meldung = is_club_admin; Zuordnen/Freigeben
 * = is_club_trainer; Lesen = is_club_member. Ein 403 kommt hier stets als
 * Klartext-Toast + Rollback (Liste neu laden) zurück.
 */
export const schliessfaecherDict = {
  de: {
    /* Kopf */
    pageTitle: "Schließfächer",
    pageSub: "Schließfächer deines Vereins — zuordnen, freigeben und verwalten",
    newLocker: "Schließfach anlegen",

    /* Status-Filter */
    filterLabel: "Schließfächer nach Status filtern",
    filterAll: "Alle",
    statusFree: "Frei",
    statusAssigned: "Belegt",
    statusBroken: "Defekt",

    /* Karte */
    noLocation: "Ohne Standort",
    assignedTo: "Belegt von",
    unknownMember: "Unbekanntes Mitglied",
    assignCta: "Zuordnen",
    reassignCta: "Umbuchen",
    releaseCta: "Freigeben",
    markBrokenCta: "Als defekt melden",
    markRepairedCta: "Als repariert melden",
    editAction: "Bearbeiten",
    deleteAction: "Löschen",

    /* Schnell-Aktion Toasts */
    releasedToast: "„{label}“ freigegeben.",
    assignedToast: "„{label}“ wurde {name} zugeordnet.",
    markedBrokenToast: "„{label}“ als defekt gemeldet.",
    markedRepairedToast: "„{label}“ als repariert gemeldet.",
    forbiddenAssign: "Dafür fehlt dir die Berechtigung. Schließfächer zuordnen dürfen nur Trainer:innen.",
    forbiddenManage: "Dafür fehlt dir die Berechtigung. Schließfächer verwalten dürfen nur Vereins-Admins.",

    /* Leerzustände & Fehler (Facade) */
    listEmptyTitle: "Noch keine Schließfächer",
    listEmptyBody: "Lege das erste Schließfach für deinen Verein an.",
    listEmptyMember: "Sobald Schließfächer angelegt sind, siehst du hier ihren Status.",
    listEmptyCta: "Erstes Schließfach anlegen",
    filterEmptyTitle: "Nichts mit diesem Status",
    filterEmptyBody: "Wähle einen anderen Status oder zeige alle an.",
    filterEmptyCta: "Alle anzeigen",
    retry: "Wiederholen",
    loadErrorTitle: "Schließfächer konnten nicht geladen werden",
    loadErrorBody: "Bitte versuche es später erneut.",
    notConnectedTitle: "Noch nicht angebunden",
    notConnectedBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",

    /* Zuordnen-Sheet */
    assignEyebrow: "Belegung",
    assignTitle: "„{label}“ zuordnen",
    reassignTitle: "„{label}“ umbuchen",
    currentlyAssigned: "Aktuell belegt von {name}.",
    searchLabel: "Mitglied suchen",
    searchPlaceholder: "Name eingeben …",
    noActiveMembers: "Keine aktiven Mitglieder gefunden.",
    searchNoMatch: "Kein Mitglied passt zur Suche.",
    pickMemberFirst: "Bitte wähle zuerst ein Mitglied.",
    assignSubmit: "Zuordnen",

    /* Formular (Anlegen/Bearbeiten Stammdaten) */
    createEyebrow: "Neues Schließfach",
    createTitle: "Schließfach anlegen",
    editEyebrow: "Schließfach bearbeiten",
    editTitle: "Schließfach bearbeiten",
    fLabel: "Nummer / Kennung",
    fLabelPlaceholder: "z. B. A-01",
    fLabelError: "Bitte gib eine Nummer oder Kennung ein.",
    fLocation: "Standort",
    fLocationPlaceholder: "z. B. Umkleide Nord",
    fNote: "Notiz",
    fNotePlaceholder: "Schlüssel-Nr., Besonderheiten … (optional)",
    cancel: "Abbrechen",
    create: "Anlegen",
    save: "Speichern",
    createdToast: "„{label}“ wurde angelegt.",
    updatedToast: "„{label}“ wurde gespeichert.",

    /* Löschen */
    deleteEyebrow: "Schließfach löschen",
    deleteTitle: "„{label}“ löschen?",
    deleteBody: "Das Schließfach wird entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Schließfach löschen",
    deletedToast: "„{label}“ wurde gelöscht.",
  },
  en: {
    /* Kopf */
    pageTitle: "Lockers",
    pageSub: "Your club's lockers — assign, release and manage",
    newLocker: "Add locker",

    /* Status-Filter */
    filterLabel: "Filter lockers by status",
    filterAll: "All",
    statusFree: "Free",
    statusAssigned: "Assigned",
    statusBroken: "Broken",

    /* Karte */
    noLocation: "No location",
    assignedTo: "Assigned to",
    unknownMember: "Unknown member",
    assignCta: "Assign",
    reassignCta: "Reassign",
    releaseCta: "Release",
    markBrokenCta: "Report broken",
    markRepairedCta: "Mark repaired",
    editAction: "Edit",
    deleteAction: "Delete",

    /* Schnell-Aktion Toasts */
    releasedToast: "“{label}” released.",
    assignedToast: "“{label}” was assigned to {name}.",
    markedBrokenToast: "“{label}” reported as broken.",
    markedRepairedToast: "“{label}” marked as repaired.",
    forbiddenAssign: "You don't have permission for this. Only coaches may assign lockers.",
    forbiddenManage: "You don't have permission for this. Only club admins may manage lockers.",

    /* Leerzustände & Fehler (Facade) */
    listEmptyTitle: "No lockers yet",
    listEmptyBody: "Add the first locker for your club.",
    listEmptyMember: "Once lockers are added, you'll see their status here.",
    listEmptyCta: "Add first locker",
    filterEmptyTitle: "Nothing with this status",
    filterEmptyBody: "Pick a different status or show everything.",
    filterEmptyCta: "Show all",
    retry: "Retry",
    loadErrorTitle: "Lockers could not be loaded",
    loadErrorBody: "Please try again later.",
    notConnectedTitle: "Not connected yet",
    notConnectedBody: "This area has no endpoint in api mode yet.",

    /* Zuordnen-Sheet */
    assignEyebrow: "Assignment",
    assignTitle: "Assign “{label}”",
    reassignTitle: "Reassign “{label}”",
    currentlyAssigned: "Currently assigned to {name}.",
    searchLabel: "Search member",
    searchPlaceholder: "Type a name …",
    noActiveMembers: "No active members found.",
    searchNoMatch: "No member matches your search.",
    pickMemberFirst: "Please pick a member first.",
    assignSubmit: "Assign",

    /* Formular (Anlegen/Bearbeiten Stammdaten) */
    createEyebrow: "New locker",
    createTitle: "Add locker",
    editEyebrow: "Edit locker",
    editTitle: "Edit locker",
    fLabel: "Number / label",
    fLabelPlaceholder: "e.g. A-01",
    fLabelError: "Please enter a number or label.",
    fLocation: "Location",
    fLocationPlaceholder: "e.g. North changing room",
    fNote: "Note",
    fNotePlaceholder: "Key no., specifics … (optional)",
    cancel: "Cancel",
    create: "Add",
    save: "Save",
    createdToast: "“{label}” was added.",
    updatedToast: "“{label}” was saved.",

    /* Löschen */
    deleteEyebrow: "Delete locker",
    deleteTitle: "Delete “{label}”?",
    deleteBody: "The locker will be removed. This cannot be undone.",
    deleteConfirm: "Delete locker",
    deletedToast: "“{label}” was deleted.",
  },
} satisfies Dict;

type DictKey = keyof (typeof schliessfaecherDict)["de"];

/** Anzeige-Reihenfolge der Status (frei → belegt → defekt). */
export const STATUS_ORDER: readonly LockerStatus[] = ["free", "assigned", "broken"];

/** LockerStatus → i18n-Schlüssel des Labels. */
export const STATUS_KEY: Record<LockerStatus, DictKey> = {
  free: "statusFree",
  assigned: "statusAssigned",
  broken: "statusBroken",
};

/** LockerStatus → Badge-Ton (Farbe + Wort, nie nur Farbe). */
export const STATUS_TONE: Record<LockerStatus, BadgeTone> = {
  free: "success",
  assigned: "info",
  broken: "danger",
};

/** LockerStatus → Badge-Icon. */
export const STATUS_ICON: Record<LockerStatus, IconName> = {
  free: "check",
  assigned: "lock",
  broken: "zap",
};
