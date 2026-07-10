import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der überregionalen Events („Events überregional“).
 * Regel: JEDE Ergänzung in beiden Sprachen, deutsche Strings mit echten
 * Umlauten (ä/ö/ü/ß) — nie ae/oe/ue/ss.
 *
 * Rechte sind SERVERSEITIG (RLS, Referenz 1.3): lesen = jedes Vereinsmitglied,
 * anlegen/ändern/löschen = Trainerstab+ (is_club_trainer). Die UI blendet die
 * Schreib-Aktionen nur kosmetisch aus — ein 403 bleibt möglich und wird als
 * Klartext-Toast behandelt.
 */
export const eventsDict = {
  de: {
    pageEyebrow: "Überregional",
    pageTitle: "Überregionale Events",
    pageSub: "Wettkämpfe, Lehrgänge und Veranstaltungen rund um deinen Verein",
    create: "Event anlegen",

    upcomingTitle: "Kommende Events",
    upcomingSub: "Die nächsten Termine, frühester zuerst",
    upcomingEmptyTitle: "Keine kommenden Events",
    upcomingEmptyBody: "Aktuell steht kein überregionaler Termin an. Vergangene findest du weiter unten.",
    pastTitle: "Vergangene Events",
    pastSub: "Was bereits stattgefunden hat",

    pastBadge: "Vergangen",
    hostBy: "Ausrichter",
    register: "Zur Anmeldung",
    open: "Details ansehen",
    openAria: "Event öffnen: {title}",
    edit: "Bearbeiten",
    delete: "Löschen",
    editAria: "Event bearbeiten: {title}",
    deleteAria: "Event löschen: {title}",

    detailEyebrow: "Überregionales Event",
    noDescription: "Für dieses Event ist keine Beschreibung hinterlegt.",

    emptyTitle: "Noch keine Events",
    emptyBodyTrainer:
      "Lege das erste überregionale Event an — es erscheint sofort für alle Vereinsmitglieder.",
    emptyBodyMember: "Sobald der Trainerstab Events einträgt, erscheinen sie hier.",
    emptyCta: "Erstes Event anlegen",

    loadErrorTitle: "Events konnten nicht geladen werden",
    retry: "Erneut versuchen",
    niTitle: "Noch nicht angebunden",
    niBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",
    noPermission: "Keine Berechtigung für diese Aktion",

    formEyebrowCreate: "Neues Event",
    formTitleCreate: "Event anlegen",
    formEyebrowEdit: "Event bearbeiten",
    formTitleEdit: "Event bearbeiten",
    fTitle: "Titel des Events",
    fTitlePh: "z. B. Süddeutsche Meisterschaft Rollkunstlauf",
    fHost: "Ausrichter",
    fHostPh: "z. B. Landesverband Baden-Württemberg",
    fDiscipline: "Disziplin",
    fDisciplinePh: "z. B. Rollkunstlauf",
    fLocation: "Ort",
    fLocationPh: "z. B. Stuttgart, Scharrena",
    fStart: "Beginn",
    fEnd: "Ende",
    fEndHint: "Optional — nur bei mehrtägigen Events.",
    fRegUrl: "Anmelde-Link",
    fRegUrlPh: "https://…",
    fRegUrlHint: "Optional — vollständige URL zur Anmeldung.",
    fDescription: "Beschreibung",
    fDescriptionPh: "Ablauf, Meldeschluss, Hinweise …",
    errTitle: "Bitte gib einen Titel an.",
    errStart: "Bitte gib ein gültiges Startdatum an.",
    errEnd: "Das Ende darf nicht vor dem Beginn liegen.",
    errUrl: "Bitte gib eine gültige URL an (http:// oder https://).",
    submitCreate: "Event anlegen",
    submitEdit: "Änderungen speichern",
    cancel: "Abbrechen",
    createdToast: "Event „{title}“ ist angelegt",
    updatedToast: "Event „{title}“ ist aktualisiert",

    deleteEyebrow: "Löschen bestätigen",
    deleteTitle: "„{title}“ löschen?",
    deleteBody:
      "Das Event wird für alle Vereinsmitglieder entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Endgültig löschen",
    deletedToast: "Event gelöscht",
  },
  en: {
    pageEyebrow: "Regional",
    pageTitle: "Regional events",
    pageSub: "Competitions, courses and events around your club",
    create: "Add event",

    upcomingTitle: "Upcoming events",
    upcomingSub: "The next dates, earliest first",
    upcomingEmptyTitle: "No upcoming events",
    upcomingEmptyBody: "No regional date is coming up right now. Past ones are listed below.",
    pastTitle: "Past events",
    pastSub: "What has already taken place",

    pastBadge: "Past",
    hostBy: "Host",
    register: "Go to registration",
    open: "View details",
    openAria: "Open event: {title}",
    edit: "Edit",
    delete: "Delete",
    editAria: "Edit event: {title}",
    deleteAria: "Delete event: {title}",

    detailEyebrow: "Regional event",
    noDescription: "No description has been provided for this event.",

    emptyTitle: "No events yet",
    emptyBodyTrainer:
      "Add the first regional event — it appears for all club members right away.",
    emptyBodyMember: "As soon as a coach adds events, they show up here.",
    emptyCta: "Add the first event",

    loadErrorTitle: "Events could not be loaded",
    retry: "Try again",
    niTitle: "Not connected yet",
    niBody: "This area has no endpoint in api mode yet.",
    noPermission: "No permission for this action",

    formEyebrowCreate: "New event",
    formTitleCreate: "Add event",
    formEyebrowEdit: "Edit event",
    formTitleEdit: "Edit event",
    fTitle: "Event title",
    fTitlePh: "e.g. South German freestyle championship",
    fHost: "Host",
    fHostPh: "e.g. State association Baden-Württemberg",
    fDiscipline: "Discipline",
    fDisciplinePh: "e.g. Artistic roller skating",
    fLocation: "Location",
    fLocationPh: "e.g. Stuttgart, Scharrena",
    fStart: "Start",
    fEnd: "End",
    fEndHint: "Optional — only for multi-day events.",
    fRegUrl: "Registration link",
    fRegUrlPh: "https://…",
    fRegUrlHint: "Optional — full URL to the registration.",
    fDescription: "Description",
    fDescriptionPh: "Schedule, entry deadline, notes …",
    errTitle: "Please enter a title.",
    errStart: "Please enter a valid start date.",
    errEnd: "The end must not be before the start.",
    errUrl: "Please enter a valid URL (http:// or https://).",
    submitCreate: "Add event",
    submitEdit: "Save changes",
    cancel: "Cancel",
    createdToast: "Event “{title}” added",
    updatedToast: "Event “{title}” updated",

    deleteEyebrow: "Confirm deletion",
    deleteTitle: "Delete “{title}”?",
    deleteBody:
      "The event will be removed for all club members. This cannot be undone.",
    deleteConfirm: "Delete permanently",
    deletedToast: "Event deleted",
  },
} satisfies Dict;

/** Schlüssel-Typ des Events-Dictionaries (für typsichere Label-Maps). */
export type EventsKey = keyof (typeof eventsDict)["de"];
