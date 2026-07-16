import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary „Vereine & Nutzer“ (Betreiber-Ebene).
 * Beide Sprachen, echte Umlaute.
 */
export const vereineDict = {
  de: {
    title: "Vereine & Nutzer",
    sub: "Alle Vereine dieser Instanz — hineinsehen, verwalten, Rechte setzen",
    demoNote: "Demo-Daten — in der echten Instanz stammt alles aus GET /platform/*.",

    // Der Hinweis, der die ganze Seite erklärt
    howEyebrow: "So funktioniert das Hineinsehen",
    howTitle: "„Ansehen“ schaltet dich in den Verein — protokolliert",
    howBody:
      "Ein Klick auf „Ansehen“ öffnet das Vereinsportal mit den Daten dieses Vereins: Mitglieder, Küren, Termine, Finanzen, Rollen — alles, was ein Vorstand dort sieht, und mit denselben Schreibrechten. Solange die Einsicht läuft, steht oben ein Band. Jeder einzelne Zugriff wird protokolliert (Migration 0051), und der Verein kann dieses Protokoll einsehen. Das ist kein Nebeneffekt, sondern der Grund, warum der Zugriff zulässig ist: als Auftragsverarbeiter musst du die Frage „wer hat wann unsere Mitgliederdaten angesehen?“ beantworten können.",

    // Vereine
    clubsEyebrow: "Verzeichnis",
    clubsTitle: "Alle Vereine",
    clubsCaption: "Liste aller Vereine der Plattform mit Lizenz und Zugang",
    colClub: "Verein",
    colCity: "Ort",
    colDiscipline: "Disziplin",
    colMembers: "Mitglieder",
    colLicense: "Lizenz",
    colCreated: "Angelegt",
    colAction: "Einsicht",
    clubsCount: "{n} Vereine",
    membersTotal: "{n} gesamt",
    clubsEmpty: "Keine Vereine vorhanden.",
    noLicense: "Ohne Lizenz",
    filterPlaceholder: "Verein oder Ort suchen …",
    filterLabel: "Vereine filtern",
    noMatch: "Kein Verein passt zum Filter.",
    noMatchBody: "Andere Schreibweise versuchen oder den Filter leeren.",
    clearFilter: "Filter leeren",

    // Nutzer
    usersEyebrow: "Verzeichnis",
    usersTitle: "Alle Nutzer",
    usersCaption: "Liste aller Nutzerprofile der Plattform",
    colUser: "Nutzer",
    colLocale: "Sprache",
    colClubs: "Vereine",
    usersCount: "{n} Nutzer",
    usersEmpty: "Keine Nutzer vorhanden.",
    usersNote:
      "Das sind Konten (Profile), keine Mitgliedschaften. Eine Person mit drei Vereinen steht hier einmal. Zum Bearbeiten einer Mitgliedschaft: oben den Verein ansehen — dort greift die Mitglieder-Verwaltung des Vereins.",

    // Rechte/Module — bewusst ein Verweis, kein zweites Bedienfeld
    rightsEyebrow: "Rechte & Module",
    rightsTitle: "Rechte setzt du IM Verein, nicht hier",
    rightsBody:
      "Jeder Verein hat seit Kurzem ein eigenes, konfigurierbares Rechte-System (Rollen und Fähigkeiten) mit einer Oberfläche unter „Verwaltung → Rollen“. Über „Ansehen“ landest du genau dort und benutzt dieselbe Oberfläche wie der Vorstand — mit owner-gleicher Autorität. Ein zweites Bedienfeld hier wäre eine Kopie, die auseinanderläuft.",
    rightsHonest:
      "Ehrlich dazu: von den 32 Fähigkeiten wirken derzeit erst 14 wirklich (3 durchgesetzt, 2 teilweise, 9 nur schreibseitig). Die Rollen-Oberfläche des Vereins beschriftet die übrigen 18 ausdrücklich mit „wirkt noch nicht“ statt sie als Sperre auszugeben. Plattform-weite Modul-Schalter sind etwas anderes und liegen unter Einstellungen → Feature-Flags.",
    toFlags: "Zu den Feature-Flags",

    loadErrorTitle: "Vereins-Daten konnten nicht geladen werden",
    retry: "Erneut versuchen",
  },
  en: {
    title: "Clubs & users",
    sub: "Every club on this instance — look inside, manage, set permissions",
    demoNote: "Demo data — the real instance sources everything from GET /platform/*.",

    howEyebrow: "How looking inside works",
    howTitle: "“View” switches you into the club — and is logged",
    howBody:
      "Clicking “View” opens the club portal with that club’s data: members, routines, events, finances, roles — everything a board member sees, with the same write access. While access is active a banner stays at the top. Every single access is logged (migration 0051), and the club can inspect that log. That is not a side effect but the reason the access is lawful: as a data processor you must be able to answer “who looked at our member data, and when?”.",

    clubsEyebrow: "Directory",
    clubsTitle: "All clubs",
    clubsCaption: "List of all clubs on the platform with licence and access",
    colClub: "Club",
    colCity: "City",
    colDiscipline: "Discipline",
    colMembers: "Members",
    colLicense: "Licence",
    colCreated: "Created",
    colAction: "Access",
    clubsCount: "{n} clubs",
    membersTotal: "{n} total",
    clubsEmpty: "No clubs yet.",
    noLicense: "No licence",
    filterPlaceholder: "Search club or city …",
    filterLabel: "Filter clubs",
    noMatch: "No club matches the filter.",
    noMatchBody: "Try a different spelling or clear the filter.",
    clearFilter: "Clear filter",

    usersEyebrow: "Directory",
    usersTitle: "All users",
    usersCaption: "List of all user profiles on the platform",
    colUser: "User",
    colLocale: "Language",
    colClubs: "Clubs",
    usersCount: "{n} users",
    usersEmpty: "No users yet.",
    usersNote:
      "These are accounts (profiles), not memberships. A person in three clubs appears here once. To edit a membership: view the club above — the club’s own member management applies there.",

    rightsEyebrow: "Permissions & modules",
    rightsTitle: "Permissions are set INSIDE the club, not here",
    rightsBody:
      "Every club now has its own configurable permission system (roles and capabilities) with a UI under “Management → Roles”. “View” takes you straight there and you use the same UI the board uses — with owner-level authority. A second control panel here would be a copy that drifts apart.",
    rightsHonest:
      "To be honest about it: of the 32 capabilities only 14 currently have real effect (3 enforced, 2 partial, 9 write-only). The club’s role UI explicitly labels the other 18 as “no effect yet” rather than presenting them as a lock. Platform-wide module switches are a different thing and live under Settings → feature flags.",
    toFlags: "To the feature flags",

    loadErrorTitle: "Club data could not be loaded",
    retry: "Try again",
  },
} satisfies Dict;

export type VereineKey = keyof (typeof vereineDict)["de"];
