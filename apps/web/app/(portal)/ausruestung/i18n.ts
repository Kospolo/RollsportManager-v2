import type { Dict } from "@/lib/i18n";
import type { BadgeTone } from "@/components/ui/Badge";
import type { EquipmentCondition, ReservationStatus } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary der Ausrüstung (Inventar-Grid + Reservieren-Sheet +
 * „Meine Reservierungen" + Trainer-Verwaltung). IMMER beide Sprachen vollständig,
 * deutsche Strings mit echten Umlauten. Schmales Leerzeichen ( ) vor Einheiten
 * gemäß DESIGN-SYSTEM §2.4.
 *
 * Rechte sind serverseitig (RLS + Rollencheck): Inventar pflegen = is_club_trainer,
 * reservieren = jedes Mitglied für sich (Trainer:innen auch für andere). Ein 403
 * kommt hier stets als Klartext-Toast + Rollback (Liste neu laden) zurück.
 */
export const ausruestungDict = {
  de: {
    /* Kopf */
    pageTitle: "Ausrüstung",
    pageSub: "Geräte & Material deines Vereins — reservieren und verwalten",
    newEquipment: "Gegenstand anlegen",

    /* Kategorie-Filter */
    filterLabel: "Ausrüstung nach Kategorie filtern",
    filterAll: "Alle",
    filterUncategorized: "Ohne Kategorie",

    /* Zustand */
    condGood: "Gut",
    condFair: "Brauchbar",
    condDefect: "Defekt",

    /* Verfügbarkeit */
    availValue: "{available} von {total} verfügbar",
    availUnknown: "Bestand nicht erfasst",
    outOfStock: "Zurzeit nicht verfügbar",
    unit: "Stück",

    /* Karte */
    reserveCta: "Reservieren",
    editAction: "Bearbeiten",
    deleteAction: "Löschen",

    /* Leerzustände & Fehler (Facade) */
    listEmptyTitle: "Noch keine Ausrüstung",
    listEmptyBody: "Lege den ersten Gegenstand für den Vereinsbestand an.",
    listEmptyCta: "Ersten Gegenstand anlegen",
    listEmptyMember: "Sobald Trainer:innen Material anlegen, kannst du es hier reservieren.",
    filterEmptyTitle: "Nichts in dieser Kategorie",
    filterEmptyBody: "Wähle eine andere Kategorie oder zeige alles an.",
    filterEmptyCta: "Alle anzeigen",
    retry: "Wiederholen",
    loadErrorTitle: "Ausrüstung konnte nicht geladen werden",
    loadErrorBody: "Bitte versuche es später erneut.",
    notConnectedTitle: "Noch nicht angebunden",
    notConnectedBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",

    /* Reservieren-Sheet */
    reserveEyebrow: "Reservierung",
    reserveTitle: "„{name}“ reservieren",
    fMember: "Für Mitglied",
    fMemberHint: "Als Trainer:in kannst du für ein Mitglied reservieren.",
    forMemberFixed: "Reservierung läuft auf dich ({name}).",
    fQuantity: "Menge",
    fQuantityUnknownHint: "Bestand nicht erfasst — bitte mit dem Trainerstab abstimmen.",
    fQuantityHint: "Verfügbar: {n} Stück",
    errQuantityMin: "Bitte eine Menge von mindestens 1 angeben.",
    errQuantityMax: "Es sind nur {n} Stück verfügbar.",
    fFrom: "Von",
    fTo: "Bis",
    errRange: "Das Ende muss nach dem Beginn liegen.",
    reserveSubmit: "Reservieren",
    reservedToast: "„{name}“ reserviert.",
    reserveForbidden: "Dafür fehlt dir die Berechtigung.",

    /* Meine Reservierungen */
    myResTitle: "Meine Reservierungen",
    myResSub: "Deine aktiven und vergangenen Ausleihen",
    myResEmptyTitle: "Keine Reservierungen",
    myResEmptyBody: "Reserviere oben einen Gegenstand — er erscheint dann hier.",
    resQuantity: "{n} Stück",
    resPeriod: "{from} – {to}",
    resReturn: "Zurückgeben",
    resCancel: "Stornieren",
    returnedToast: "„{name}“ als zurückgegeben markiert.",
    cancelledToast: "Reservierung storniert.",
    unknownEquipment: "Unbekannter Gegenstand",

    /* Reservierungs-Status */
    resActive: "Aktiv",
    resReturned: "Zurückgegeben",
    resCancelled: "Storniert",

    /* Formular (Anlegen/Bearbeiten) */
    createEyebrow: "Neuer Gegenstand",
    createTitle: "Gegenstand anlegen",
    editEyebrow: "Gegenstand bearbeiten",
    editTitle: "Gegenstand bearbeiten",
    fName: "Name",
    fNamePlaceholder: "z. B. Pylonen (Set)",
    fNameError: "Bitte gib einen Namen ein.",
    fCategory: "Kategorie",
    fCategoryPlaceholder: "z. B. Training, Technik, Sicherheit",
    fCondition: "Zustand",
    fTotal: "Gesamtbestand",
    fTotalHint: "Optional, ganze Zahl ab 0.",
    fTotalError: "Bitte eine ganze Zahl ab 0 angeben.",
    fAvailable: "Davon verfügbar",
    fAvailableHint: "Leer lassen = alles verfügbar.",
    fAvailableError: "Darf den Gesamtbestand nicht übersteigen.",
    fNotes: "Notiz",
    fNotesPlaceholder: "Aufbewahrungsort, Zubehör … (optional)",
    cancel: "Abbrechen",
    create: "Anlegen",
    save: "Speichern",
    createdToast: "„{name}“ wurde angelegt.",
    updatedToast: "„{name}“ wurde gespeichert.",
    forbidden: "Dafür fehlt dir die Berechtigung. Ausrüstung dürfen nur Trainer:innen pflegen.",

    /* Löschen */
    deleteEyebrow: "Gegenstand löschen",
    deleteTitle: "„{name}“ löschen?",
    deleteBody: "Der Gegenstand wird aus dem Bestand entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Gegenstand löschen",
    deletedToast: "„{name}“ wurde gelöscht.",
  },
  en: {
    /* Kopf */
    pageTitle: "Equipment",
    pageSub: "Your club's gear & material — reserve and manage",
    newEquipment: "Add item",

    /* Kategorie-Filter */
    filterLabel: "Filter equipment by category",
    filterAll: "All",
    filterUncategorized: "Uncategorised",

    /* Zustand */
    condGood: "Good",
    condFair: "Usable",
    condDefect: "Defective",

    /* Verfügbarkeit */
    availValue: "{available} of {total} available",
    availUnknown: "Stock not tracked",
    outOfStock: "Currently unavailable",
    unit: "pcs",

    /* Karte */
    reserveCta: "Reserve",
    editAction: "Edit",
    deleteAction: "Delete",

    /* Leerzustände & Fehler (Facade) */
    listEmptyTitle: "No equipment yet",
    listEmptyBody: "Add the first item to the club inventory.",
    listEmptyCta: "Add first item",
    listEmptyMember: "Once coaches add gear, you can reserve it here.",
    filterEmptyTitle: "Nothing in this category",
    filterEmptyBody: "Pick a different category or show everything.",
    filterEmptyCta: "Show all",
    retry: "Retry",
    loadErrorTitle: "Equipment could not be loaded",
    loadErrorBody: "Please try again later.",
    notConnectedTitle: "Not connected yet",
    notConnectedBody: "This area has no endpoint in api mode yet.",

    /* Reservieren-Sheet */
    reserveEyebrow: "Reservation",
    reserveTitle: "Reserve “{name}”",
    fMember: "For member",
    fMemberHint: "As a coach you can reserve on behalf of a member.",
    forMemberFixed: "Reserved in your name ({name}).",
    fQuantity: "Quantity",
    fQuantityUnknownHint: "Stock not tracked — please check with the coaching staff.",
    fQuantityHint: "Available: {n} pcs",
    errQuantityMin: "Please enter a quantity of at least 1.",
    errQuantityMax: "Only {n} pcs are available.",
    fFrom: "From",
    fTo: "To",
    errRange: "The end must be after the start.",
    reserveSubmit: "Reserve",
    reservedToast: "“{name}” reserved.",
    reserveForbidden: "You don't have permission for this.",

    /* Meine Reservierungen */
    myResTitle: "My reservations",
    myResSub: "Your active and past loans",
    myResEmptyTitle: "No reservations",
    myResEmptyBody: "Reserve an item above — it will show up here.",
    resQuantity: "{n} pcs",
    resPeriod: "{from} – {to}",
    resReturn: "Return",
    resCancel: "Cancel",
    returnedToast: "“{name}” marked as returned.",
    cancelledToast: "Reservation cancelled.",
    unknownEquipment: "Unknown item",

    /* Reservierungs-Status */
    resActive: "Active",
    resReturned: "Returned",
    resCancelled: "Cancelled",

    /* Formular (Anlegen/Bearbeiten) */
    createEyebrow: "New item",
    createTitle: "Add item",
    editEyebrow: "Edit item",
    editTitle: "Edit item",
    fName: "Name",
    fNamePlaceholder: "e.g. Cones (set)",
    fNameError: "Please enter a name.",
    fCategory: "Category",
    fCategoryPlaceholder: "e.g. Training, Tech, Safety",
    fCondition: "Condition",
    fTotal: "Total stock",
    fTotalHint: "Optional, whole number from 0.",
    fTotalError: "Please enter a whole number from 0.",
    fAvailable: "Of which available",
    fAvailableHint: "Leave empty = all available.",
    fAvailableError: "Must not exceed the total stock.",
    fNotes: "Note",
    fNotesPlaceholder: "Storage location, accessories … (optional)",
    cancel: "Cancel",
    create: "Add",
    save: "Save",
    createdToast: "“{name}” was added.",
    updatedToast: "“{name}” was saved.",
    forbidden: "You don't have permission for this. Only coaches may manage equipment.",

    /* Löschen */
    deleteEyebrow: "Delete item",
    deleteTitle: "Delete “{name}”?",
    deleteBody: "The item will be removed from the inventory. This cannot be undone.",
    deleteConfirm: "Delete item",
    deletedToast: "“{name}” was deleted.",
  },
} satisfies Dict;

type DictKey = keyof (typeof ausruestungDict)["de"];

/** Anzeige-Reihenfolge der Zustände (gut → brauchbar → defekt). */
export const CONDITION_ORDER: readonly EquipmentCondition[] = ["good", "fair", "defect"];

/** EquipmentCondition → i18n-Schlüssel des Labels. */
export const CONDITION_KEY: Record<EquipmentCondition, DictKey> = {
  good: "condGood",
  fair: "condFair",
  defect: "condDefect",
};

/** EquipmentCondition → Badge-Ton (Farbe + Wort, nie nur Farbe). */
export const CONDITION_TONE: Record<EquipmentCondition, BadgeTone> = {
  good: "success",
  fair: "warn",
  defect: "danger",
};

/** ReservationStatus → i18n-Schlüssel des Labels. */
export const RES_STATUS_KEY: Record<ReservationStatus, DictKey> = {
  active: "resActive",
  returned: "resReturned",
  cancelled: "resCancelled",
};

/** ReservationStatus → Badge-Ton. */
export const RES_STATUS_TONE: Record<ReservationStatus, BadgeTone> = {
  active: "success",
  returned: "neutral",
  cancelled: "warn",
};

/** Sortier-Gewicht der Reservierungen: aktiv zuerst, danach zurückgegeben/storniert. */
export const RES_STATUS_WEIGHT: Record<ReservationStatus, number> = {
  active: 0,
  returned: 1,
  cancelled: 2,
};

/**
 * Verfügbare Menge eines Gegenstands (Obergrenze fürs Reservieren): explizit
 * verfügbar, sonst Gesamtbestand, sonst undefiniert (Bestand nicht erfasst).
 */
export function availableCap(equipment: {
  availableQuantity?: number;
  totalQuantity?: number;
}): number | undefined {
  return equipment.availableQuantity ?? equipment.totalQuantity;
}

/** Date → `YYYY-MM-DDTHH:mm` in LOKALER Zeit (Wert für <input type="datetime-local">). */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Vorbelegung für das Reservieren-Sheet: nächste volle Stunde bis +2 h. */
export function defaultReserveRange(now: Date = new Date()): { from: string; to: string } {
  const from = new Date(now);
  from.setMinutes(0, 0, 0);
  from.setHours(from.getHours() + 1);
  const to = new Date(from);
  to.setHours(to.getHours() + 2);
  return { from: toDateTimeLocal(from), to: toDateTimeLocal(to) };
}
