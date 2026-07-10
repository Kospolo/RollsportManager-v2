import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary des Belegungsplans (Hallen-Grid + Detail mit
 * kommenden Buchungen + „Buchen"-Sheet + Hallen-Formular). IMMER beide
 * Sprachen vollständig, deutsche Strings mit echten Umlauten (ä/ö/ü/ß).
 *
 * Enum-Labels (FacilityKind, BookingStatus) wohnen hier; der Client kennt nur
 * die Unions. Ableitungen (Tonzuordnung, Überschneidungen, Tages-Gruppen)
 * liegen in helpers.ts.
 */
export const belegungsplanDict = {
  de: {
    /* Kopf */
    pageTitle: "Belegungsplan",
    pageSub: "Hallen und Räume deines Vereins — belegen und buchen",
    newBooking: "Buchen",
    newFacility: "Halle anlegen",

    /* Filter-Chips (Art der Trainingsstätte) */
    filterLabel: "Hallen nach Art filtern",
    filterAll: "Alle",
    kindHall: "Halle",
    kindRoom: "Raum",
    kindOutdoor: "Außenbereich",
    kindOther: "Sonstiges",

    /* Karte */
    capacityLabel: "Kapazität",
    capacityValue: "{n} Plätze",
    upcomingOne: "1 kommende Buchung",
    upcomingMany: "{n} kommende Buchungen",
    upcomingNone: "Keine kommenden Buchungen",

    /* Status einer Buchung */
    statusConfirmed: "Bestätigt",
    statusPending: "Angefragt",
    statusCancelled: "Storniert",
    conflictBadge: "Überschneidung",

    /* Laden & Fehler (Facade) */
    retry: "Wiederholen",
    loadErrorTitle: "Belegungsplan konnte nicht geladen werden",
    loadErrorBody: "Bitte versuche es später erneut.",
    notConnectedTitle: "Noch nicht angebunden",
    notConnectedBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",

    /* Leerzustände */
    listEmptyTitle: "Noch keine Hallen",
    listEmptyBodyTrainer: "Lege die erste Halle oder den ersten Raum an.",
    listEmptyBodyMember: "Es sind noch keine Trainingsstätten hinterlegt.",
    listEmptyCta: "Erste Halle anlegen",
    filterEmptyTitle: "Keine Hallen dieser Art",
    filterEmptyBody: "Wähle eine andere Art oder zeige alle Hallen an.",
    filterEmptyCta: "Alle anzeigen",

    /* Detail-Sheet */
    detailEyebrow: "Trainingsstätte",
    metaAddress: "Ort",
    metaCapacity: "Kapazität",
    metaCapacityValue: "{n} Plätze",
    metaNotes: "Hinweise",
    upcomingHeading: "Kommende Buchungen",
    bookHere: "Hier buchen",
    editAction: "Bearbeiten",
    deleteAction: "Löschen",
    close: "Schließen",
    bookedBy: "von {name}",
    unknownMember: "Unbekannt",
    detailNoUpcoming: "Für diese Halle sind keine kommenden Buchungen eingetragen.",
    bookingDeleteAction: "Buchung löschen",

    /* Hallen-Formular (Anlegen/Bearbeiten) */
    createEyebrow: "Neue Halle",
    createTitle: "Halle anlegen",
    editEyebrow: "Halle bearbeiten",
    editTitle: "Halle bearbeiten",
    fName: "Name",
    fNamePlaceholder: "z. B. Rollsporthalle Neckarsulm",
    fNameError: "Bitte gib einen Namen ein.",
    fKind: "Art",
    fAddress: "Ort",
    fAddressPlaceholder: "Straße, PLZ Ort (optional)",
    fCapacity: "Kapazität",
    fCapacityHint: "Optional — Anzahl Plätze (größer als 0).",
    fCapacityError: "Die Kapazität muss größer als 0 sein.",
    fNotes: "Hinweise",
    fNotesPlaceholder: "z. B. Wettkampfboden, Zugang, Ausstattung (optional)",
    cancel: "Abbrechen",
    create: "Anlegen",
    save: "Speichern",
    facilityCreatedToast: "„{name}“ wurde angelegt.",
    facilityUpdatedToast: "„{name}“ wurde gespeichert.",
    forbiddenFacility: "Dafür fehlt dir die Berechtigung. Hallen dürfen nur Trainer:innen pflegen.",

    /* Halle löschen */
    facilityDeleteEyebrow: "Halle löschen",
    facilityDeleteTitle: "„{name}“ löschen?",
    facilityDeleteBody:
      "Die Halle wird aus dem Belegungsplan entfernt. Das lässt sich nicht rückgängig machen.",
    facilityDeleteConfirm: "Halle löschen",
    facilityDeletedToast: "„{name}“ wurde gelöscht.",

    /* Buchen-Sheet */
    bookEyebrow: "Neue Buchung",
    bookTitle: "Halle buchen",
    bFacility: "Halle",
    bTitle: "Titel",
    bTitlePlaceholder: "z. B. Kürtraining Leistung",
    bTitleError: "Bitte gib einen Titel ein.",
    bMember: "Gebucht für",
    bMemberSelf: "Für dich",
    bMemberSelfHint: "Für andere buchen dürfen nur Trainer:innen.",
    bTeam: "Team",
    bTeamNone: "Kein Team",
    bDate: "Datum",
    bDateError: "Bitte wähle ein Datum.",
    bStart: "Beginn",
    bEnd: "Ende",
    bEndError: "Das Ende muss nach dem Beginn liegen.",
    bStatus: "Status",
    bStatusMemberHint: "Deine Buchung wird als Anfrage gespeichert und von Trainer:innen bestätigt.",
    bConflictOne: "Achtung: Der Zeitraum überschneidet sich mit einer bestehenden Buchung.",
    bConflictMany: "Achtung: Der Zeitraum überschneidet sich mit {n} bestehenden Buchungen.",
    bConflictHint: "Du kannst trotzdem buchen — Überschneidungen werden nicht automatisch verhindert.",
    bSubmit: "Buchen",
    bookingCreatedToast: "„{title}“ wurde gebucht.",
    forbiddenBooking:
      "Dafür fehlt dir die Berechtigung. Für andere buchen dürfen nur Trainer:innen.",

    /* Buchung löschen */
    bookingDeleteEyebrow: "Buchung löschen",
    bookingDeleteTitle: "„{title}“ löschen?",
    bookingDeleteBody: "Die Buchung wird aus dem Belegungsplan entfernt.",
    bookingDeleteConfirm: "Buchung löschen",
    bookingDeletedToast: "„{title}“ wurde gelöscht.",
    forbiddenBookingDelete:
      "Dafür fehlt dir die Berechtigung. Buchungen löschen dürfen nur Ersteller:in oder Trainer:innen.",
  },
  en: {
    /* Kopf */
    pageTitle: "Facilities",
    pageSub: "Your club's halls and rooms — plan and book them",
    newBooking: "Book",
    newFacility: "Add facility",

    /* Filter-Chips */
    filterLabel: "Filter facilities by kind",
    filterAll: "All",
    kindHall: "Hall",
    kindRoom: "Room",
    kindOutdoor: "Outdoor",
    kindOther: "Other",

    /* Karte */
    capacityLabel: "Capacity",
    capacityValue: "{n} spots",
    upcomingOne: "1 upcoming booking",
    upcomingMany: "{n} upcoming bookings",
    upcomingNone: "No upcoming bookings",

    /* Status */
    statusConfirmed: "Confirmed",
    statusPending: "Requested",
    statusCancelled: "Cancelled",
    conflictBadge: "Overlap",

    /* Laden & Fehler */
    retry: "Retry",
    loadErrorTitle: "Facilities could not be loaded",
    loadErrorBody: "Please try again later.",
    notConnectedTitle: "Not connected yet",
    notConnectedBody: "This area has no endpoint in api mode yet.",

    /* Leerzustände */
    listEmptyTitle: "No facilities yet",
    listEmptyBodyTrainer: "Add the first hall or room.",
    listEmptyBodyMember: "No facilities have been set up yet.",
    listEmptyCta: "Add first facility",
    filterEmptyTitle: "No facilities of this kind",
    filterEmptyBody: "Pick a different kind or show all facilities.",
    filterEmptyCta: "Show all",

    /* Detail-Sheet */
    detailEyebrow: "Facility",
    metaAddress: "Location",
    metaCapacity: "Capacity",
    metaCapacityValue: "{n} spots",
    metaNotes: "Notes",
    upcomingHeading: "Upcoming bookings",
    bookHere: "Book here",
    editAction: "Edit",
    deleteAction: "Delete",
    close: "Close",
    bookedBy: "by {name}",
    unknownMember: "Unknown",
    detailNoUpcoming: "No upcoming bookings for this facility.",
    bookingDeleteAction: "Delete booking",

    /* Hallen-Formular */
    createEyebrow: "New facility",
    createTitle: "Add facility",
    editEyebrow: "Edit facility",
    editTitle: "Edit facility",
    fName: "Name",
    fNamePlaceholder: "e.g. Roller sports hall",
    fNameError: "Please enter a name.",
    fKind: "Kind",
    fAddress: "Location",
    fAddressPlaceholder: "Street, postcode, city (optional)",
    fCapacity: "Capacity",
    fCapacityHint: "Optional — number of spots (greater than 0).",
    fCapacityError: "Capacity must be greater than 0.",
    fNotes: "Notes",
    fNotesPlaceholder: "e.g. competition floor, access, equipment (optional)",
    cancel: "Cancel",
    create: "Add",
    save: "Save",
    facilityCreatedToast: "“{name}” was added.",
    facilityUpdatedToast: "“{name}” was saved.",
    forbiddenFacility: "You don't have permission for this. Only coaches may manage facilities.",

    /* Halle löschen */
    facilityDeleteEyebrow: "Delete facility",
    facilityDeleteTitle: "Delete “{name}”?",
    facilityDeleteBody:
      "The facility will be removed from the plan. This cannot be undone.",
    facilityDeleteConfirm: "Delete facility",
    facilityDeletedToast: "“{name}” was deleted.",

    /* Buchen-Sheet */
    bookEyebrow: "New booking",
    bookTitle: "Book facility",
    bFacility: "Facility",
    bTitle: "Title",
    bTitlePlaceholder: "e.g. Freestyle training",
    bTitleError: "Please enter a title.",
    bMember: "Booked for",
    bMemberSelf: "For you",
    bMemberSelfHint: "Only coaches may book for others.",
    bTeam: "Team",
    bTeamNone: "No team",
    bDate: "Date",
    bDateError: "Please pick a date.",
    bStart: "Start",
    bEnd: "End",
    bEndError: "The end must be after the start.",
    bStatus: "Status",
    bStatusMemberHint: "Your booking is saved as a request and confirmed by a coach.",
    bConflictOne: "Heads up: this slot overlaps with an existing booking.",
    bConflictMany: "Heads up: this slot overlaps with {n} existing bookings.",
    bConflictHint: "You can still book — overlaps aren't blocked automatically.",
    bSubmit: "Book",
    bookingCreatedToast: "“{title}” was booked.",
    forbiddenBooking: "You don't have permission for this. Only coaches may book for others.",

    /* Buchung löschen */
    bookingDeleteEyebrow: "Delete booking",
    bookingDeleteTitle: "Delete “{title}”?",
    bookingDeleteBody: "The booking will be removed from the plan.",
    bookingDeleteConfirm: "Delete booking",
    bookingDeletedToast: "“{title}” was deleted.",
    forbiddenBookingDelete:
      "You don't have permission for this. Only the creator or a coach may delete bookings.",
  },
} satisfies Dict;
