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
  },
} satisfies Dict;

export type TeamsViewKey = keyof (typeof teamsViewDict)["de"];
