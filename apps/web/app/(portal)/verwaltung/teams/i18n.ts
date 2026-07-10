import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary für die Team-Verwaltung (Liste, Anlegen,
 * Umbenennen, Löschen, Kader). Regel: JEDER String in beiden Sprachen,
 * deutsche Strings mit echten Umlauten (ä/ö/ü/ß).
 */
export const teamsDict = {
  de: {
    title: "Teams",
    sub: "Trainingsgruppen anlegen, benennen und Kader zuordnen",
    newTeam: "Team anlegen",

    listEyebrow: "Übersicht",
    listTitle: "Alle Teams",
    teamsCount: "{n} Teams",
    oneTeam: "1 Team",

    // Lade- & Fehlerzustände
    retry: "Erneut versuchen",
    loadErrorTitle: "Teams konnten nicht geladen werden",
    loadErrorBody: "Die Team-Liste ließ sich gerade nicht laden — bitte erneut versuchen.",

    // Leerzustand
    emptyTitle: "Noch keine Teams",
    emptyBody: "Lege die erste Trainingsgruppe an — danach lassen sich Trainer:innen und Sportler:innen zuordnen.",
    emptyCta: "Erstes Team anlegen",
    emptyReadonlyTitle: "Noch keine Teams",
    emptyReadonlyBody: "Für diesen Verein sind noch keine Teams hinterlegt.",

    // Berechtigung
    lockTitle: "Nur für die Vereinsleitung",
    lockBody: "Teams verwalten dürfen nur Vorstand, Admin und Moderator:in. Die Änderungen werden serverseitig geprüft.",
    readonlyBanner: "Nur-Lese-Ansicht — die Teamverwaltung ist Vorstand, Admin und Moderator:in vorbehalten.",
    forbidden: "Keine Berechtigung — nur Vorstand, Admin und Moderator:in dürfen Teams verwalten.",

    // Team-Karte
    noAgeGroup: "Altersklasse offen",
    coachesOne: "{n} Trainer",
    coachesMany: "{n} Trainer",
    skatersOne: "{n} Sportler",
    skatersMany: "{n} Sportler",
    emptyRoster: "Kader noch leer",
    noCoaches: "Noch keine Trainer:innen",
    cardActions: "Aktionen für {team}",
    actEdit: "Umbenennen",
    actRoster: "Kader",
    actDelete: "Löschen",

    // Anlegen / Umbenennen (Dialog)
    createEyebrow: "Neues Team",
    createTitle: "Team anlegen",
    editEyebrow: "Team bearbeiten",
    editTitle: "Team umbenennen",
    fName: "Team-Name",
    fNamePlaceholder: "z. B. Kürgruppe Leistung",
    fNameError: "Bitte einen Team-Namen angeben.",
    fAgeGroup: "Altersklasse (optional)",
    fAgeGroupPlaceholder: "z. B. U12–U15",
    fAgeGroupHint: "Freies Kürzel für die Alterseinteilung — leer lassen ist erlaubt.",
    cancel: "Abbrechen",
    create: "Team anlegen",
    save: "Speichern",
    createdToast: "Team „{name}“ angelegt",
    updatedToast: "Team „{name}“ gespeichert",

    // Löschen (Bestätigung)
    deleteEyebrow: "Team löschen",
    deleteTitle: "„{team}“ löschen?",
    deleteBody: "Das Team wird archiviert. Die Zuordnung der Mitglieder wird aufgehoben — die Personen bleiben im Verein.",
    deleteConfirm: "Team löschen",
    deletedToast: "Team „{name}“ gelöscht",

    // Kader (Sheet)
    rosterEyebrow: "Kader",
    rosterTitle: "Kader: {team}",
    rosterHint: "Wähle für jede Person die Rolle im Team. Nicht gewählte Personen werden aus dem Team entfernt.",
    rosterSearchLabel: "Mitglieder durchsuchen",
    rosterSearchPlaceholder: "Name suchen …",
    roleNone: "Kein",
    roleCoach: "Trainer",
    roleSkater: "Sportler",
    rosterRoleLabel: "Team-Rolle von {name}",
    rosterSummary: "Gewählt: {coaches} · {skaters}",
    rosterEmpty: "Keine Mitglieder gefunden.",
    rosterNoMembers: "Der Verein hat noch keine Mitglieder, die sich zuordnen lassen.",
    rosterSave: "Kader speichern",
    rosterSavedToast: "Kader von „{team}“ aktualisiert",
  },
  en: {
    title: "Teams",
    sub: "Create training groups, name them and assign rosters",
    newTeam: "New team",

    listEyebrow: "Overview",
    listTitle: "All teams",
    teamsCount: "{n} teams",
    oneTeam: "1 team",

    retry: "Try again",
    loadErrorTitle: "Teams could not be loaded",
    loadErrorBody: "The team list could not be loaded right now — please try again.",

    emptyTitle: "No teams yet",
    emptyBody: "Create the first training group — then you can assign coaches and skaters.",
    emptyCta: "Create the first team",
    emptyReadonlyTitle: "No teams yet",
    emptyReadonlyBody: "There are no teams on file for this club yet.",

    lockTitle: "Restricted to club management",
    lockBody: "Only owners, admins and moderators can manage teams. Changes are enforced on the server.",
    readonlyBanner: "Read-only view — team management is reserved for owners, admins and moderators.",
    forbidden: "No permission — only owners, admins and moderators may manage teams.",

    noAgeGroup: "No age group",
    coachesOne: "{n} coach",
    coachesMany: "{n} coaches",
    skatersOne: "{n} skater",
    skatersMany: "{n} skaters",
    emptyRoster: "Roster still empty",
    noCoaches: "No coaches yet",
    cardActions: "Actions for {team}",
    actEdit: "Rename",
    actRoster: "Roster",
    actDelete: "Delete",

    createEyebrow: "New team",
    createTitle: "Create team",
    editEyebrow: "Edit team",
    editTitle: "Rename team",
    fName: "Team name",
    fNamePlaceholder: "e.g. Advanced routines",
    fNameError: "Please enter a team name.",
    fAgeGroup: "Age group (optional)",
    fAgeGroupPlaceholder: "e.g. U12–U15",
    fAgeGroupHint: "Free label for the age bracket — leaving it empty is fine.",
    cancel: "Cancel",
    create: "Create team",
    save: "Save",
    createdToast: "Team “{name}” created",
    updatedToast: "Team “{name}” saved",

    deleteEyebrow: "Delete team",
    deleteTitle: "Delete “{team}”?",
    deleteBody: "The team will be archived. Member assignments are removed — the people stay in the club.",
    deleteConfirm: "Delete team",
    deletedToast: "Team “{name}” deleted",

    rosterEyebrow: "Roster",
    rosterTitle: "Roster: {team}",
    rosterHint: "Pick each person’s role in the team. People left unselected are removed from the team.",
    rosterSearchLabel: "Search members",
    rosterSearchPlaceholder: "Search by name …",
    roleNone: "None",
    roleCoach: "Coach",
    roleSkater: "Skater",
    rosterRoleLabel: "Team role of {name}",
    rosterSummary: "Selected: {coaches} · {skaters}",
    rosterEmpty: "No members found.",
    rosterNoMembers: "The club has no members to assign yet.",
    rosterSave: "Save roster",
    rosterSavedToast: "Roster of “{team}” updated",
  },
} satisfies Dict;

export type TeamsKey = keyof (typeof teamsDict)["de"];
