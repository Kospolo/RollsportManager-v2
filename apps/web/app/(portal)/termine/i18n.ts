import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary des Termine-Screens.
 * Regel: JEDE Ergänzung in beiden Sprachen, deutsche Strings mit ä/ö/ü/ß.
 */
export const termineDict = {
  de: {
    pageEyebrow: "Vereinskalender",
    pageTitle: "Termine",
    pageSub: "Training, Wettkämpfe und alles dazwischen",
    newEvent: "Neuer Termin",

    filterLabel: "Termine nach Art filtern",
    filterAll: "Alle",
    typeTraining: "Training",
    typeCompetition: "Wettkampf",
    typeOther: "Sonstiges",

    invited: "{n} eingeladen",
    detailsAria: "Details öffnen: {title}",
    timeRange: "{start}–{end} Uhr",

    pastTitle: "Vergangene Termine",
    pastShow: "Anzeigen",
    pastHide: "Ausblenden",
    attendanceOf: "{present} von {total} anwesend",
    noAttendance: "Keine Anwesenheit erfasst",

    emptyTitle: "Keine kommenden Termine in dieser Ansicht",
    emptyBody:
      "Mit einem anderen Filter wirst du fündig — oder lege direkt den nächsten Termin an.",
    emptyCta: "Alle Termine zeigen",

    loadErrorTitle: "Termine konnten nicht geladen werden",
    loadErrorRetry: "Erneut versuchen",
    niTitle: "Noch nicht angebunden",
    niBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",
    noPermission: "Keine Berechtigung für diese Aktion",
    retry: "Wiederholen",
    attendanceUnavailable: "Anwesenheit noch nicht angebunden",
    attendanceReadHint:
      "Bereits erfasste Anwesenheit kann noch nicht geladen werden — neue Änderungen werden trotzdem gespeichert.",
    teamsUnavailableHint:
      "Teams sind noch nicht angebunden — der Termin wird ohne Teamzuordnung angelegt.",

    tabsLabel: "Termin-Bereiche",
    tabResponses: "Antworten",
    tabAttendance: "Anwesenheit",
    noteTitle: "Notiz",

    yourResponse: "Deine Antwort",
    yourResponseHint: "Wird sofort gespeichert — du kannst jederzeit wechseln.",
    rsvpGoing: "Zusage",
    rsvpMaybe: "Vielleicht",
    rsvpDeclined: "Absage",
    rsvpSick: "Krank",
    rsvpOpen: "Offen",
    savedToast: "Antwort gespeichert: {status}",
    commentLabel: "Kurzer Grund (optional)",
    commentPh: "z. B. Erkältung, morgen wieder dabei",

    participantsTitle: "Teilnehmerliste",
    quoteDeclined: "hat abgesagt:",
    quoteSick: "hat sich krankgemeldet:",
    noResponses: "Noch keine Antworten",

    attendanceHint: "Schalter antippen — Änderungen gelten sofort.",
    attendanceFuture:
      "Dieser Termin liegt noch vor euch — Anwesenheit wird am Termin-Tag erfasst.",
    attOn: "Anwesend",
    attOff: "Fehlt",
    attSwitchLabel: "Anwesenheit von {name}",
    lateBadge: "Verspätet",
    excusedBadge: "Entschuldigt",
    checkedInAt: "Check-in um {time} Uhr",

    qrButton: "QR-Check-in anzeigen",
    qrTitle: "QR-Check-in",
    qrBody:
      "Mitglieder scannen den Code beim Betreten der Halle und werden sofort als anwesend erfasst — ganz ohne Liste.",
    qrMicro:
      "Der Code gilt nur für diesen Termin. Kein Scanner zur Hand? Die Anwesenheit lässt sich weiter per Schalter pflegen.",
    qrCodeLabel: "Check-in-Code für {title}",
    qrDone: "Fertig",

    formTitle: "Neuer Termin",
    formEyebrow: "Terminplanung",
    fTitle: "Titel",
    fTitlePh: "z. B. Training Nachwuchs Pflicht",
    fType: "Art",
    fDate: "Datum",
    fStart: "Beginn",
    fEnd: "Ende",
    fLocation: "Ort",
    fLocationPh: "z. B. Ballei-Sporthalle, Neckarsulm",
    fTeams: "Teams",
    fTeamsHint: "Alle Mitglieder der gewählten Teams werden eingeladen.",
    fAudience: "Vereinsveranstaltung",
    fAudienceHint:
      "Jedes Vereinsmitglied sieht diesen Termin — unabhängig vom Team. Für Jahreshauptversammlung, Sommerfest und Ähnliches.",
    audienceBadge: "Verein",
    audienceBadgeAria: "Vereinsveranstaltung — für alle Mitglieder sichtbar",
    fNote: "Notiz (optional)",
    fNotePh: "z. B. Schwerpunkt, Treffpunkt, Mitbringliste …",
    errTitle: "Bitte gib einen Titel an.",
    errLocation: "Bitte gib einen Ort an.",
    errDate: "Bitte wähle ein Datum.",
    errEnd: "Das Ende muss nach dem Beginn liegen.",
    errTeams: "Bitte wähle mindestens ein Team.",
    submit: "Termin anlegen",
    cancel: "Abbrechen",
    createdToast: "Termin „{title}“ ist angelegt",
  },
  en: {
    pageEyebrow: "Club calendar",
    pageTitle: "Events",
    pageSub: "Training, competitions and everything in between",
    newEvent: "New event",

    filterLabel: "Filter events by type",
    filterAll: "All",
    typeTraining: "Training",
    typeCompetition: "Competition",
    typeOther: "Other",

    invited: "{n} invited",
    detailsAria: "Open details: {title}",
    timeRange: "{start}–{end}",

    pastTitle: "Past events",
    pastShow: "Show",
    pastHide: "Hide",
    attendanceOf: "{present} of {total} present",
    noAttendance: "No attendance recorded",

    emptyTitle: "No upcoming events in this view",
    emptyBody: "Try another filter — or go ahead and create the next event right away.",
    emptyCta: "Show all events",

    loadErrorTitle: "Events could not be loaded",
    loadErrorRetry: "Try again",
    niTitle: "Not connected yet",
    niBody: "This area has no endpoint in api mode yet.",
    noPermission: "No permission for this action",
    retry: "Retry",
    attendanceUnavailable: "Attendance not connected yet",
    attendanceReadHint:
      "Previously recorded attendance can't be loaded yet — new changes are still saved.",
    teamsUnavailableHint:
      "Teams are not connected yet — the event will be created without team assignment.",

    tabsLabel: "Event sections",
    tabResponses: "Responses",
    tabAttendance: "Attendance",
    noteTitle: "Note",

    yourResponse: "Your response",
    yourResponseHint: "Saved instantly — you can change it anytime.",
    rsvpGoing: "Going",
    rsvpMaybe: "Maybe",
    rsvpDeclined: "Declined",
    rsvpSick: "Sick",
    rsvpOpen: "Open",
    savedToast: "Response saved: {status}",
    commentLabel: "Short reason (optional)",
    commentPh: "e.g. caught a cold, back tomorrow",

    participantsTitle: "Participants",
    quoteDeclined: "declined:",
    quoteSick: "reported sick:",
    noResponses: "No responses yet",

    attendanceHint: "Tap a switch — changes apply immediately.",
    attendanceFuture: "This event is still ahead — attendance is taken on the day.",
    attOn: "Present",
    attOff: "Absent",
    attSwitchLabel: "Attendance for {name}",
    lateBadge: "Late",
    excusedBadge: "Excused",
    checkedInAt: "Checked in at {time}",

    qrButton: "Show QR check-in",
    qrTitle: "QR check-in",
    qrBody:
      "Members scan the code when entering the hall and are marked present right away — no paper list needed.",
    qrMicro:
      "The code is only valid for this event. No scanner at hand? Attendance can still be managed with the switches.",
    qrCodeLabel: "Check-in code for {title}",
    qrDone: "Done",

    formTitle: "New event",
    formEyebrow: "Scheduling",
    fTitle: "Title",
    fTitlePh: "e.g. Training juniors compulsory",
    fType: "Type",
    fDate: "Date",
    fStart: "Start",
    fEnd: "End",
    fLocation: "Location",
    fLocationPh: "e.g. Ballei sports hall, Neckarsulm",
    fTeams: "Teams",
    fTeamsHint: "All members of the selected teams will be invited.",
    fAudience: "Club-wide event",
    fAudienceHint:
      "Every club member sees this event, regardless of team. For the annual general meeting, summer party and the like.",
    audienceBadge: "Club",
    audienceBadgeAria: "Club-wide event — visible to all members",
    fNote: "Note (optional)",
    fNotePh: "e.g. focus, meeting point, what to bring …",
    errTitle: "Please enter a title.",
    errLocation: "Please enter a location.",
    errDate: "Please pick a date.",
    errEnd: "The end must be after the start.",
    errTeams: "Please select at least one team.",
    submit: "Create event",
    cancel: "Cancel",
    createdToast: "Event “{title}” created",
  },
} satisfies Dict;
