import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary des Trainer-Dashboards.
 * Regel: JEDE Ergänzung in beiden Sprachen, deutsche Strings
 * immer mit echten Umlauten (ä/ö/ü/ß).
 */
export const dashboardDict = {
  de: {
    /* Kopf */
    greetingMorning: "Guten Morgen, {name}!",
    greetingDay: "Hallo, {name}!",
    greetingEvening: "Guten Abend, {name}!",
    subSessionsNone: "keine Einheit heute",
    subSessionsOne: "1 Einheit heute",
    subSessionsMany: "{n} Einheiten heute",
    actionWeek: "Woche ansehen",

    /* KPI-Zeile */
    kpiMembers: "Aktive Mitglieder",
    kpiMembersPendingOne: "1 Aufnahme ausstehend",
    kpiMembersPendingMany: "{n} Aufnahmen ausstehend",
    kpiMembersAllIn: "alle aufgenommen",
    kpiOpen: "Offene Beiträge",
    kpiOpenSubOne: "1 offene Rechnung",
    kpiOpenSubMany: "{n} offene Rechnungen",
    kpiNext: "Nächster Termin",
    kpiNextNone: "keine Termine geplant",

    /* Countdown-Hero */
    heroEyebrow: "Nächster Wettkampf",
    heroDayWord: "Tag",
    heroDaysWord: "Tage",
    heroTodayBig: "Heute!",
    heroDate: "{date} · Beginn {time} Uhr",
    heroRegistered: "{n} Aktive gemeldet",
    heroDeadline: "Meldeschluss {rel}",
    heroCta: "Wettkampf-Plan öffnen",
    heroEmptyTitle: "Kein Wettkampf geplant",
    heroEmptyBody: "Sobald ein Wettkampf angelegt ist, zählt hier der Countdown.",
    heroEmptyCta: "Zum Wettkampf-Bereich",

    /* Heute-Karte */
    todayEyebrow: "Heute & demnächst",
    todayTitle: "Deine Einheiten",
    todayAll: "Alle Termine",
    typeTraining: "Training",
    typeCompetition: "Wettkampf",
    typeOther: "Termin",
    untilTime: "bis {time} Uhr",
    invited: "{n} eingeladen",
    noteDeclined: "hat abgesagt: „{comment}“",
    noteSick: "hat sich krankgemeldet: „{comment}“",
    noteMaybe: "ist noch unsicher: „{comment}“",
    ctaAttendance: "Anwesenheit erfassen",
    ctaDetails: "Details",
    emptyEventsTitle: "Keine Termine anstehend",
    emptyEventsBody: "Plane dein nächstes Training im Kalender — deine Gruppen sehen es sofort.",
    emptyEventsCta: "Zum Kalender",

    /* Anwesenheits-Sheet */
    sheetEyebrow: "Anwesenheit",
    sheetHint: "Zusagen sind bereits angehakt — tippe auf einen Namen zum Ändern.",
    rsvpGoing: "Zusage",
    rsvpDeclined: "Absage",
    rsvpSick: "Krank",
    rsvpMaybe: "Vielleicht",
    rsvpNone: "Offen",
    presentAria: "Anwesend: {name}",
    presentCount: "{x} von {y} anwesend",
    markAll: "Alle anwesend",
    clearAll: "Alle abwählen",
    sheetSave: "Anwesenheit speichern",
    savedToast: "Anwesenheit gespeichert — {x} von {y} anwesend.",

    /* Küren-Schnellzugriff */
    routinesEyebrow: "Küren griffbereit",
    routinesTitle: "Zuletzt geübt",
    routinesAll: "Alle Küren",
    statusCompetition: "Wettkampf",
    statusReady: "Bereit",
    statusDraft: "Entwurf",
    bpm: "{n} BPM",
    lastScore: "zuletzt {score} Punkte",
    markersCount: "{n} Zeitmarken",
    trendAria: "Punkteverlauf von {title}",

    /* Aufgaben */
    tasksEyebrow: "Offene Aufgaben",
    tasksTitle: "Das steht an",
    tasksOpenOne: "1 offen",
    tasksOpenMany: "{n} offen",
    taskToggleAria: "„{title}“ abhaken",
    overdue: "überfällig",
    taskDoneToast: "Aufgabe erledigt.",
    undo: "Rückgängig",
    tasksFooter: "{done} von {total} erledigt",
    tasksCompetitionLink: "Wettkampf öffnen",
  },
  en: {
    /* Header */
    greetingMorning: "Good morning, {name}!",
    greetingDay: "Hello, {name}!",
    greetingEvening: "Good evening, {name}!",
    subSessionsNone: "no session today",
    subSessionsOne: "1 session today",
    subSessionsMany: "{n} sessions today",
    actionWeek: "View week",

    /* KPI row */
    kpiMembers: "Active members",
    kpiMembersPendingOne: "1 application pending",
    kpiMembersPendingMany: "{n} applications pending",
    kpiMembersAllIn: "everyone on board",
    kpiOpen: "Outstanding fees",
    kpiOpenSubOne: "1 open invoice",
    kpiOpenSubMany: "{n} open invoices",
    kpiNext: "Next event",
    kpiNextNone: "nothing scheduled",

    /* Countdown hero */
    heroEyebrow: "Next competition",
    heroDayWord: "day",
    heroDaysWord: "days",
    heroTodayBig: "Today!",
    heroDate: "{date} · starts {time}",
    heroRegistered: "{n} skaters registered",
    heroDeadline: "Entry deadline {rel}",
    heroCta: "Open competition plan",
    heroEmptyTitle: "No competition scheduled",
    heroEmptyBody: "Once a competition is set up, the countdown starts here.",
    heroEmptyCta: "Go to competitions",

    /* Today card */
    todayEyebrow: "Today & up next",
    todayTitle: "Your sessions",
    todayAll: "All events",
    typeTraining: "Training",
    typeCompetition: "Competition",
    typeOther: "Event",
    untilTime: "until {time}",
    invited: "{n} invited",
    noteDeclined: "declined: “{comment}”",
    noteSick: "reported sick: “{comment}”",
    noteMaybe: "is not sure yet: “{comment}”",
    ctaAttendance: "Record attendance",
    ctaDetails: "Details",
    emptyEventsTitle: "No upcoming events",
    emptyEventsBody: "Plan your next training session in the calendar — your groups will see it right away.",
    emptyEventsCta: "Open calendar",

    /* Attendance sheet */
    sheetEyebrow: "Attendance",
    sheetHint: "Confirmed replies are pre-checked — tap a name to change.",
    rsvpGoing: "Going",
    rsvpDeclined: "Declined",
    rsvpSick: "Sick",
    rsvpMaybe: "Maybe",
    rsvpNone: "No reply",
    presentAria: "Present: {name}",
    presentCount: "{x} of {y} present",
    markAll: "Mark all present",
    clearAll: "Clear all",
    sheetSave: "Save attendance",
    savedToast: "Attendance saved — {x} of {y} present.",

    /* Routines quick access */
    routinesEyebrow: "Routines at hand",
    routinesTitle: "Recently practised",
    routinesAll: "All routines",
    statusCompetition: "Competition",
    statusReady: "Ready",
    statusDraft: "Draft",
    bpm: "{n} BPM",
    lastScore: "last score {score} points",
    markersCount: "{n} time markers",
    trendAria: "Score trend for {title}",

    /* Tasks */
    tasksEyebrow: "Open tasks",
    tasksTitle: "What’s next",
    tasksOpenOne: "1 open",
    tasksOpenMany: "{n} open",
    taskToggleAria: "Mark “{title}” as done",
    overdue: "overdue",
    taskDoneToast: "Task completed.",
    undo: "Undo",
    tasksFooter: "{done} of {total} done",
    tasksCompetitionLink: "Open competition",
  },
} satisfies Dict;

export type DashboardKey = keyof (typeof dashboardDict)["de"];
