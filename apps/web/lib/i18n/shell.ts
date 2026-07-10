import type { Dict } from "./index";

/**
 * Shell-Strings: Navigation, Topbar, allgemeine Labels.
 * Regel: JEDE Ergänzung immer in beiden Sprachen, deutsche Strings
 * mit echten Umlauten (ä/ö/ü/ß).
 */
export const shellDict = {
  de: {
    appName: "RollsportManager",
    clubName: "RSV Neckarsulm",
    clubMeta: "Rollkunstlauf · Vereinsportal",

    navLabel: "Hauptnavigation",
    navDashboard: "Dashboard",
    navEvents: "Termine",
    navMembers: "Mitglieder",
    navRoutines: "Küren",
    navCompetition: "Wettkampf",
    navFinance: "Finanzen",
    navManage: "Verwaltung",
    navMore: "Mehr",

    searchPlaceholder: "Suchen … (Mitglieder, Termine, Küren)",
    searchLabel: "Suche",
    notifications: "Benachrichtigungen",
    languageLabel: "Sprache wechseln",
    themeLabel: "Erscheinungsbild",
    themeLight: "Hell",
    themeAuto: "Auto",
    themeDark: "Dunkel",

    userName: "Sandra Vogel",
    userRole: "Trainerin",
    userMenuLabel: "Benutzermenü",
    profile: "Profil",
    settings: "Einstellungen",
    signOut: "Abmelden",

    emptyTitle: "Hier entsteht gerade etwas",
    emptyBody: "Dieser Bereich wird als Nächstes ausgebaut — die Navigation steht schon.",
    emptyCta: "Zum Dashboard",

    pageDashboardSub: "Dein Verein auf einen Blick",
    pageEventsSub: "Training, Wettkämpfe und alles dazwischen",
    pageMembersSub: "Alle Menschen im Verein",
    pageRoutinesSub: "Musik, Marker und Wertungen",
    pageCompetitionSub: "Vorbereitung, Meldung, Ergebnisse",
    pageFinanceSub: "Wer noch offen ist — und was schon da ist",
  },
  en: {
    appName: "RollsportManager",
    clubName: "RSV Neckarsulm",
    clubMeta: "Artistic roller skating · Club portal",

    navLabel: "Main navigation",
    navDashboard: "Dashboard",
    navEvents: "Events",
    navMembers: "Members",
    navRoutines: "Routines",
    navCompetition: "Competition",
    navFinance: "Finances",
    navManage: "Management",
    navMore: "More",

    searchPlaceholder: "Search … (members, events, routines)",
    searchLabel: "Search",
    notifications: "Notifications",
    languageLabel: "Switch language",
    themeLabel: "Appearance",
    themeLight: "Light",
    themeAuto: "Auto",
    themeDark: "Dark",

    userName: "Sandra Vogel",
    userRole: "Coach",
    userMenuLabel: "User menu",
    profile: "Profile",
    settings: "Settings",
    signOut: "Sign out",

    emptyTitle: "Something is taking shape here",
    emptyBody: "This area is up next — the navigation is already in place.",
    emptyCta: "Go to dashboard",

    pageDashboardSub: "Your club at a glance",
    pageEventsSub: "Training, competitions and everything in between",
    pageMembersSub: "All the people in your club",
    pageRoutinesSub: "Music, markers and scores",
    pageCompetitionSub: "Preparation, entries, results",
    pageFinanceSub: "Who is still open — and what has already arrived",
  },
} satisfies Dict;

export type ShellKey = keyof (typeof shellDict)["de"];
