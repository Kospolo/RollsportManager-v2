import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Plattform-Konsole (Betreiber-Ebene).
 * Reine Lesesicht über alle Vereine/Nutzer. Beide Sprachen, echte Umlaute.
 */
export const plattformDict = {
  de: {
    title: "Plattform-Übersicht",
    sub: "Betreiber-Sicht über alle Vereine und Nutzer dieser Instanz",
    demoNote: "Demo-Daten — in der echten Instanz stammt alles aus GET /platform/*.",

    // Kennzahlen
    statsEyebrow: "Kennzahlen",
    kpiClubs: "Vereine",
    kpiUsers: "Nutzer",
    kpiMembers: "Mitgliedschaften",
    kpiActive: "Aktiv",
    kpiTeams: "Teams",
    kpiEvents: "Termine",
    kpiOpenInvoices: "Offene Rechnungen",
    activeSub: "aktive Mitgliedschaften",

    // Vereine-Tabelle
    clubsEyebrow: "Verzeichnis",
    clubsTitle: "Alle Vereine",
    clubsCaption: "Liste aller Vereine der Plattform",
    colClub: "Verein",
    colCity: "Ort",
    colDiscipline: "Disziplin",
    colMembers: "Mitglieder",
    colCreated: "Angelegt",
    clubsCount: "{n} Vereine",
    membersTotal: "{n} gesamt",
    clubsEmpty: "Keine Vereine vorhanden.",

    // Nutzer-Tabelle
    usersEyebrow: "Verzeichnis",
    usersTitle: "Alle Nutzer",
    usersCaption: "Liste aller Nutzerprofile der Plattform",
    colUser: "Nutzer",
    colLocale: "Sprache",
    colClubs: "Vereine",
    usersCount: "{n} Nutzer",
    usersEmpty: "Keine Nutzer vorhanden.",

    // Zustände
    loadErrorTitle: "Plattform-Daten konnten nicht geladen werden",
    retry: "Erneut versuchen",
    noAccessTitle: "Kein Zugriff auf die Betreiber-Ebene",
    noAccessBody:
      "Diese Ansicht ist Plattform-Administrator:innen vorbehalten. Melde dich mit einem Konto an, dessen Token app_metadata.is_platform_admin trägt.",
    backToPortal: "Zum Vereinsportal",
  },
  en: {
    title: "Platform overview",
    sub: "Operator view across all clubs and users of this instance",
    demoNote: "Demo data — the real instance sources everything from GET /platform/*.",

    statsEyebrow: "Key figures",
    kpiClubs: "Clubs",
    kpiUsers: "Users",
    kpiMembers: "Memberships",
    kpiActive: "Active",
    kpiTeams: "Teams",
    kpiEvents: "Events",
    kpiOpenInvoices: "Open invoices",
    activeSub: "active memberships",

    clubsEyebrow: "Directory",
    clubsTitle: "All clubs",
    clubsCaption: "List of all clubs on the platform",
    colClub: "Club",
    colCity: "City",
    colDiscipline: "Discipline",
    colMembers: "Members",
    colCreated: "Created",
    clubsCount: "{n} clubs",
    membersTotal: "{n} total",
    clubsEmpty: "No clubs yet.",

    usersEyebrow: "Directory",
    usersTitle: "All users",
    usersCaption: "List of all user profiles on the platform",
    colUser: "User",
    colLocale: "Language",
    colClubs: "Clubs",
    usersCount: "{n} users",
    usersEmpty: "No users yet.",

    loadErrorTitle: "Platform data could not be loaded",
    retry: "Try again",
    noAccessTitle: "No access to the operator plane",
    noAccessBody:
      "This view is reserved for platform administrators. Sign in with an account whose token carries app_metadata.is_platform_admin.",
    backToPortal: "To club portal",
  },
} satisfies Dict;

export type PlattformKey = keyof (typeof plattformDict)["de"];
