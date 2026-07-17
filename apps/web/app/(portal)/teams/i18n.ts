import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Teams-Mitgliederansicht (rein lesend). Zeigt
 * „Meine Teams" (Gruppen des eingeloggten Mitglieds) und darunter „Alle Teams
 * im Verein". Die Verwaltung (Anlegen/Kader) läuft über /verwaltung/teams.
 *
 * Regel: JEDER String in beiden Sprachen, deutsche Strings mit echten Umlauten.
 */
export const teamsViewDict = {
  de: {
    eyebrow: "Verein",
    title: "Teams",
    sub: "Deine Trainingsgruppen — und alle Teams im Verein.",
    readonlyNote:
      "Nur-Lese-Ansicht — Teams anlegen und Kader zuordnen macht die Vereinsleitung unter „Verwaltung“.",

    // Abschnitte
    myTitle: "Meine Teams",
    mySub: "Die Gruppen, in denen du aktiv bist.",
    allTitle: "Alle Teams im Verein",
    teamsCount: "{n} Teams",
    oneTeam: "1 Team",

    // „Meine Teams" leer
    myEmptyTitle: "Noch keinem Team zugeordnet",
    myEmptyBody:
      "Sobald dich ein:e Trainer:in einem Team zuordnet, erscheint es hier.",

    // Lade- & Fehlerzustände
    retry: "Erneut versuchen",
    loadErrorTitle: "Teams konnten nicht geladen werden",
    loadErrorBody:
      "Die Team-Liste ließ sich gerade nicht laden — bitte erneut versuchen.",

    // „Alle Teams" leer
    allEmptyTitle: "Noch keine Teams",
    allEmptyBody: "Für diesen Verein sind noch keine Teams hinterlegt.",

    // Team-Karte
    badgeMine: "Mein Team",
    noAgeGroup: "Altersklasse offen",
    coachesLabel: "Trainerstab",
    noCoaches: "Noch keine Trainer:innen",
    membersLabel: "Mitglieder",
    membersCountOne: "1 Mitglied",
    membersCountMany: "{n} Mitglieder",
    emptyRoster: "Kader noch leer",
    moreNames: "+{n} weitere",
    teamRoster: "Kader von {team}",
    openTeam: "Team öffnen",
    openTeamAria: "Team {team} öffnen — Kader und Trainerstab ansehen",

    // Detailseite — Kopf & Navigation
    breadcrumb: "Brotkrumen",
    backCrumb: "Teams",
    backToTeams: "Zu allen Teams",
    notFoundTitle: "Team nicht gefunden",
    notFoundBody:
      "Dieses Team gibt es nicht (mehr) — vielleicht wurde es umbenannt oder entfernt.",

    // Detailseite — Kader
    rosterTitle: "Kader",
    rosterEmptyTitle: "Kader noch leer",
    rosterEmptyBody:
      "Sobald die Vereinsleitung Sportler:innen zuordnet, erscheinen sie hier als Karten.",
    openProfileAria: "Profil von {name} öffnen",
    bornYear: "Jg. {year}",

    // Detailseite — Rollen (Trainerstab-Karten)
    roleOwner: "Vereinsleitung",
    roleAdmin: "Verwaltung",
    roleModerator: "Moderation",
    roleTreasurer: "Kassenwart:in",
    roleCoach: "Trainer:in",
    roleGuest: "Gasttrainer:in",
    roleMember: "Mitglied",

    // Detailseite — Küren
    kuerenTitle: "Küren des Teams",
    kuerenAllLink: "Alle Küren",
    kuerCountOne: "1 Kür",
    kuerCountMany: "{n} Küren",
    openRoutineAria: "Kür „{title}“ öffnen",

    // Detailseite — Termine
    eventsTitle: "Nächste Termine",
    eventsAllLink: "Alle Termine",
    openEventAria: "Termin „{title}“ öffnen",
  },
  en: {
    eyebrow: "Club",
    title: "Teams",
    sub: "Your training groups — and every team in the club.",
    readonlyNote:
      "Read-only view — creating teams and assigning rosters is done by club management under “Management”.",

    myTitle: "My teams",
    mySub: "The groups you are active in.",
    allTitle: "All teams in the club",
    teamsCount: "{n} teams",
    oneTeam: "1 team",

    myEmptyTitle: "Not on a team yet",
    myEmptyBody: "As soon as a coach adds you to a team, it will show up here.",

    retry: "Try again",
    loadErrorTitle: "Teams could not be loaded",
    loadErrorBody:
      "The team list could not be loaded right now — please try again.",

    allEmptyTitle: "No teams yet",
    allEmptyBody: "There are no teams on file for this club yet.",

    badgeMine: "My team",
    noAgeGroup: "No age group",
    coachesLabel: "Coaches",
    noCoaches: "No coaches yet",
    membersLabel: "Members",
    membersCountOne: "1 member",
    membersCountMany: "{n} members",
    emptyRoster: "Roster still empty",
    moreNames: "+{n} more",
    teamRoster: "Roster of {team}",
    openTeam: "Open team",
    openTeamAria: "Open team {team} — view roster and coaches",

    // Detail page — header & navigation
    breadcrumb: "Breadcrumb",
    backCrumb: "Teams",
    backToTeams: "Back to all teams",
    notFoundTitle: "Team not found",
    notFoundBody:
      "This team does not exist (any more) — it may have been renamed or removed.",

    // Detail page — roster
    rosterTitle: "Roster",
    rosterEmptyTitle: "Roster still empty",
    rosterEmptyBody:
      "As soon as club management assigns skaters, they show up here as cards.",
    openProfileAria: "Open {name}'s profile",
    bornYear: "Born {year}",

    // Detail page — roles (coach cards)
    roleOwner: "Club owner",
    roleAdmin: "Administration",
    roleModerator: "Moderation",
    roleTreasurer: "Treasurer",
    roleCoach: "Coach",
    roleGuest: "Guest coach",
    roleMember: "Member",

    // Detail page — routines
    kuerenTitle: "Team routines",
    kuerenAllLink: "All routines",
    kuerCountOne: "1 routine",
    kuerCountMany: "{n} routines",
    openRoutineAria: "Open routine “{title}”",

    // Detail page — dates
    eventsTitle: "Upcoming dates",
    eventsAllLink: "All dates",
    openEventAria: "Open event “{title}”",
  },
} satisfies Dict;

export type TeamsViewKey = keyof (typeof teamsViewDict)["de"];
