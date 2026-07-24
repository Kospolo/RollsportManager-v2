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
 *
 * Seit 0070 kommt die VERMIETUNG dazu (owner/admin/treasurer). Sie ist eine
 * eigene Achse neben der Belegung, und die Strings halten das auseinander:
 * „zuordnen/freigeben" betrifft den SCHLÜSSEL, „vermieten/Miete beenden" das
 * GELD. Wer beides zu einem Wort zusammenzieht, produziert Fächer, die frei
 * aussehen und weiter abgerechnet werden.
 */
export const schliessfaecherDict = {
  de: {
    /* Kopf */
    pageTitle: "Schließfächer",
    pageSub: "Schließfächer deines Vereins — zuordnen, freigeben und verwalten",
    pageTitleMember: "Dein Schließfach",
    pageSubMember: "Dein zugeordnetes Schließfach im Verein",
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
    emptyMemberTitle: "Dir ist kein Fach zugeordnet",
    emptyMemberBody: "Sobald dir der Verein ein Schließfach zuordnet, erscheint es hier.",
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
    deleteWithRental:
      "Für dieses Fach läuft eine Vermietung. Beende sie zuerst — sonst bleibt eine Zahlungspflicht ohne Fach stehen.",
    deleteConfirm: "Schließfach löschen",
    deletedToast: "„{label}“ wurde gelöscht.",

    /* Größe */
    fSize: "Größe",
    sizeSmall: "Klein",
    sizeMedium: "Mittel",
    sizeLarge: "Groß",

    /* Preis (drei Zustände: nicht festgelegt / kostenlos / Betrag) */
    fPrice: "Listenpreis je Monat",
    fPricePlaceholder: "z. B. 5,00",
    fPriceHint:
      "Leer lassen heißt „noch nicht festgelegt“. 0 heißt ausdrücklich kostenlos — das ist etwas anderes.",
    fPriceError: "Bitte gib einen Betrag ein (z. B. 5,00) oder lass das Feld leer.",
    priceUnset: "Kein Preis festgelegt",
    priceFree: "Kostenlos",
    priceListLabel: "Listenpreis",
    pricePerMonth: "/ Monat",

    /* Vermietung — Karte */
    rentalEyebrow: "Vermietung",
    rentalActiveTo: "Vermietet an",
    rentalSince: "seit {date}",
    rentalAgreed: "Vereinbart",
    rentalStatusActive: "Läuft",
    rentalStatusEnded: "Beendet",
    rentalStatusCancelled: "Gekündigt",
    rentalNone: "Nicht vermietet",
    rentalActiveHidden: "Vermietet — die Vertragsdaten siehst du nicht.",
    rentCta: "Vermieten",
    endRentalCta: "Miete beenden",
    editRentalCta: "Miete bearbeiten",
    rentalHistoryTitle: "Frühere Vermietungen",
    rentalUntil: "bis {date}",
    rentalOpenEnd: "ohne Enddatum",

    /* Vermieten-Sheet */
    rentEyebrow: "Fach vermieten",
    rentTitle: "„{label}“ vermieten",
    rentIntro:
      "Der Vorschlag kommt aus dem Listenpreis des Fachs — überschreibe ihn, wenn ihr etwas anderes vereinbart habt.",
    rentPriceLabel: "Vereinbarter Preis je Monat",
    rentPriceHint:
      "Leer lassen heißt „nicht festgelegt“, 0 heißt kostenlos. Der Listenpreis des Fachs bleibt davon unberührt.",
    rentPriceFromList: "Aus dem Listenpreis übernommen: {price}",
    rentPriceNoList: "Für dieses Fach ist kein Listenpreis hinterlegt.",
    rentStartLabel: "Mietbeginn",
    rentEndLabel: "Mietende (optional)",
    rentEndHint: "Leer lassen, solange die Miete unbefristet läuft.",
    rentNoteLabel: "Notiz zum Vertrag",
    rentNotePlaceholder: "z. B. Schlüsselpfand, Sondervereinbarung … (optional)",
    rentMemberLabel: "Mitglied",
    rentStartError: "Bitte gib einen Mietbeginn an.",
    rentEndBeforeStart: "Das Mietende darf nicht vor dem Beginn liegen.",
    rentSubmit: "Vermieten",
    rentSaveSubmit: "Speichern",
    rentedToast: "„{label}“ ist jetzt an {name} vermietet.",
    rentalUpdatedToast: "Die Vermietung von „{label}“ wurde gespeichert.",
    rentalBusy: "Dieses Fach ist bereits vermietet — beende die laufende Vermietung zuerst.",
    forbiddenRental:
      "Dafür fehlt dir die Berechtigung. Vermieten dürfen nur Vorstand, Verwaltung und Kassenwart.",
    editRentalEyebrow: "Vermietung bearbeiten",
    editRentalTitle: "Vermietung von „{label}“",

    /* Miete beenden */
    endEyebrow: "Vermietung beenden",
    endTitle: "Miete für „{label}“ beenden?",
    endBody:
      "Der Vertrag bleibt in der Historie stehen — beendet, nicht gelöscht. Nur so bleibt nachvollziehbar, wofür bezahlt wurde.",
    endKeepsLocker:
      "Das Fach bleibt zugeordnet. „Freigeben“ ist eine Schlüssel-Frage, „Miete beenden“ eine Geld-Frage — beides wird getrennt entschieden.",
    endHowLabel: "Wie endet die Miete?",
    endHowEnded: "Regulär beendet",
    endHowCancelled: "Gekündigt",
    endDateLabel: "Mietende",
    endDateError: "Bitte gib ein Enddatum an.",
    endConfirm: "Miete beenden",
    endedToast: "Die Miete für „{label}“ wurde beendet.",

    /* Kopfzeile Verwaltung */
    kpiRentedTitle: "Laufende Mieten",
    kpiRentedSum: "{sum} je Monat",
    kpiRentedCount: "{count} laufende Verträge",
    kpiRentedNoPrice: "{count} davon ohne festgelegten Preis",

    /* Mitglieds-Ansicht */
    myLockerEyebrow: "Dein Fach",
    myRentalTitle: "Deine Miete",
    myRentalPrice: "Du zahlst",
    myRentalSince: "Vermietet seit {date}",
    myRentalNone: "Für dein Fach ist keine Miete hinterlegt.",
  },
  en: {
    /* Kopf */
    pageTitle: "Lockers",
    pageSub: "Your club's lockers — assign, release and manage",
    pageTitleMember: "Your locker",
    pageSubMember: "Your assigned locker at the club",
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
    emptyMemberTitle: "No locker assigned to you",
    emptyMemberBody: "As soon as the club assigns you a locker, it will appear here.",
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
    deleteWithRental:
      "This locker has an active rental. End it first — otherwise a payment obligation is left without a locker.",
    deleteConfirm: "Delete locker",
    deletedToast: "“{label}” was deleted.",

    /* Größe */
    fSize: "Size",
    sizeSmall: "Small",
    sizeMedium: "Medium",
    sizeLarge: "Large",

    /* Preis (drei Zustände: nicht festgelegt / kostenlos / Betrag) */
    fPrice: "List price per month",
    fPricePlaceholder: "e.g. 5.00",
    fPriceHint:
      "Leaving it empty means “not set yet”. 0 means explicitly free — that is something else.",
    fPriceError: "Please enter an amount (e.g. 5.00) or leave the field empty.",
    priceUnset: "No price set",
    priceFree: "Free of charge",
    priceListLabel: "List price",
    pricePerMonth: "/ month",

    /* Vermietung — Karte */
    rentalEyebrow: "Rental",
    rentalActiveTo: "Rented to",
    rentalSince: "since {date}",
    rentalAgreed: "Agreed",
    rentalStatusActive: "Running",
    rentalStatusEnded: "Ended",
    rentalStatusCancelled: "Cancelled",
    rentalNone: "Not rented out",
    rentalActiveHidden: "Rented out — you cannot see the contract details.",
    rentCta: "Rent out",
    endRentalCta: "End rental",
    editRentalCta: "Edit rental",
    rentalHistoryTitle: "Past rentals",
    rentalUntil: "until {date}",
    rentalOpenEnd: "no end date",

    /* Vermieten-Sheet */
    rentEyebrow: "Rent out locker",
    rentTitle: "Rent out “{label}”",
    rentIntro:
      "The suggestion comes from the locker's list price — override it if you agreed on something else.",
    rentPriceLabel: "Agreed price per month",
    rentPriceHint:
      "Empty means “not set”, 0 means free of charge. The locker's list price stays untouched.",
    rentPriceFromList: "Taken from the list price: {price}",
    rentPriceNoList: "No list price is stored for this locker.",
    rentStartLabel: "Rental start",
    rentEndLabel: "Rental end (optional)",
    rentEndHint: "Leave empty while the rental runs open-ended.",
    rentNoteLabel: "Contract note",
    rentNotePlaceholder: "e.g. key deposit, special arrangement … (optional)",
    rentMemberLabel: "Member",
    rentStartError: "Please enter a rental start date.",
    rentEndBeforeStart: "The rental end must not be before the start.",
    rentSubmit: "Rent out",
    rentSaveSubmit: "Save",
    rentedToast: "“{label}” is now rented to {name}.",
    rentalUpdatedToast: "The rental of “{label}” was saved.",
    rentalBusy: "This locker is already rented out — end the running rental first.",
    forbiddenRental:
      "You don't have permission for this. Only the board, admins and the treasurer may rent out lockers.",
    editRentalEyebrow: "Edit rental",
    editRentalTitle: "Rental of “{label}”",

    /* Miete beenden */
    endEyebrow: "End rental",
    endTitle: "End the rental of “{label}”?",
    endBody:
      "The contract stays in the history — ended, not deleted. That is what keeps payments traceable.",
    endKeepsLocker:
      "The locker stays assigned. “Release” is a key question, “End rental” a money question — they are decided separately.",
    endHowLabel: "How does the rental end?",
    endHowEnded: "Ended regularly",
    endHowCancelled: "Cancelled",
    endDateLabel: "Rental end",
    endDateError: "Please enter an end date.",
    endConfirm: "End rental",
    endedToast: "The rental of “{label}” was ended.",

    /* Kopfzeile Verwaltung */
    kpiRentedTitle: "Running rentals",
    kpiRentedSum: "{sum} per month",
    kpiRentedCount: "{count} running contracts",
    kpiRentedNoPrice: "{count} of them without a set price",

    /* Mitglieds-Ansicht */
    myLockerEyebrow: "Your locker",
    myRentalTitle: "Your rental",
    myRentalPrice: "You pay",
    myRentalSince: "Rented since {date}",
    myRentalNone: "No rental is stored for your locker.",
  },
} satisfies Dict;

type DictKey = keyof (typeof schliessfaecherDict)["de"];

/** Öffentlicher Alias — derive.ts typisiert seine i18n-Schlüssel damit. */
export type SchliessfaecherKey = DictKey;

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
