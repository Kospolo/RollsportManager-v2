import type { Dict } from "@/lib/i18n";
import type { MemberRole, MemberStatus } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary für die Mitglieder-Verwaltung (Tabelle +
 * Bearbeiten-Sheet + Rolle ändern). Regel: JEDER String in beiden Sprachen,
 * deutsche Strings mit echten Umlauten (ä/ö/ü/ß). Die Rechte-Sichtbarkeit
 * spiegelt ORIGINAL-APP-REFERENZ 1.3 — durchgesetzt wird serverseitig.
 */
export const mitgliederVerwaltungDict = {
  de: {
    eyebrow: "Vereins-Administration",
    title: "Mitglieder-Verwaltung",
    sub: "Stammdaten pflegen, Status setzen und Rollen vergeben — im Rahmen deiner Rechte.",
    breadcrumb: "Brotkrumen-Navigation",
    hubCrumb: "Verwaltung",

    invite: "Mitglied einladen",

    searchLabel: "Nach Name oder E-Mail suchen",
    searchPlaceholder: "z. B. Grünewald oder name@…",
    filterRoleLabel: "Mitglieder nach Rolle filtern",
    filterStatusLabel: "Mitglieder nach Status filtern",

    fAll: "Alle",
    fBoard: "Vorstand",
    fModerator: "Moderation",
    fTreasurer: "Kassenwart",
    fCoach: "Trainer",
    fMember: "Mitglieder",
    fGuest: "Gasttrainer",

    stAll: "Jeder Status",
    stActive: "Aktiv",
    stInactive: "Inaktiv",
    stPending: "Ausstehend",
    stRejected: "Abgelehnt",

    listEyebrow: "Übersicht",
    listTitle: "Alle im Verein",
    tableCaption: "Verwaltbare Mitgliederliste mit Rolle und Status",
    colMember: "Mitglied",
    colTeams: "Team(s)",
    colRole: "Rolle",
    colStatus: "Status",
    colJoined: "Beitritt",
    colEdit: "Bearbeiten",
    bornYear: "Jahrgang {year}",
    noTeam: "kein Team",
    noEmailShort: "keine E-Mail",
    shownOf: "{shown} von {total} Mitgliedern angezeigt",
    edit: "Bearbeiten",
    editAria: "{name} bearbeiten",

    roleOwner: "Vorstand",
    roleAdmin: "Verwaltung",
    roleModerator: "Moderator:in",
    roleTreasurer: "Kassenwart",
    roleCoach: "Trainer:in",
    roleMember: "Mitglied",
    roleGuest: "Gasttrainer",
    guestUntil: "befristet bis {date}",

    statusActive: "Aktiv",
    statusInactive: "Inaktiv",
    statusPending: "Ausstehend",
    statusRejected: "Abgelehnt",

    readOnlyNote:
      "Nur-Lese-Ansicht: Zum Bearbeiten von Stammdaten und Rollen brauchst du Mitglieder-Verwaltungsrechte (Kassenwart, Moderation, Verwaltung oder Vorstand).",

    retry: "Erneut versuchen",
    loadErrorTitle: "Daten konnten nicht geladen werden",
    emptyTitle: "Niemand gefunden",
    emptyBody:
      "Suche und Filter liefern gerade keine Treffer — probiere einen anderen Namen oder setze die Filter zurück.",
    emptyReset: "Filter zurücksetzen",
    teamsNiHint: "Teams sind in dieser Datenquelle noch nicht angebunden — die Team-Spalte bleibt leer.",

    /* ---------- Bearbeiten-Sheet ---------- */
    sheetEyebrow: "Mitglied bearbeiten",
    secMaster: "Stammdaten",
    secRole: "Rolle im Verein",

    fldFirstName: "Vorname",
    fldLastName: "Nachname",
    fldEmail: "E-Mail",
    fldEmailPlaceholder: "name@beispiel.de",
    emailHint: "Leer lassen entfernt die hinterlegte Adresse.",
    fldBirth: "Geburtsdatum",
    birthHint: "Relevant für Altersklassen — optional.",
    fldStatus: "Status",
    fldValidUntil: "Zugang befristet bis",
    validUntilHint: "Nur Gasttrainer: Datum, an dem der Zugang endet.",

    roleSelectLabel: "Rolle ändern",
    roleHintImmediate: "Die Rolle wird sofort gespeichert (eigener Speicherpfad).",
    roleHintLocked: "Für diese Person darfst du die Rolle nicht ändern.",
    roleHintSelf: "Die eigene Rolle lässt sich hier nicht ändern.",
    roleHintOwner: "Die Vorstandsrolle (Owner) ist geschützt und hier nicht änderbar.",

    save: "Speichern",
    cancel: "Abbrechen",

    valFirstName: "Bitte einen Vornamen angeben.",
    valLastName: "Bitte einen Nachnamen angeben.",
    valEmail: "Bitte eine gültige E-Mail-Adresse angeben.",

    savedToast: "{name} gespeichert",
    roleToast: "Rolle geändert zu „{role}“",
    forbidden: "Keine Berechtigung — die Änderung wurde nicht gespeichert.",
    roleForbidden: "Keine Berechtigung — die Rolle wurde nicht geändert.",
  },
  en: {
    eyebrow: "Club administration",
    title: "Member management",
    sub: "Maintain records, set status and assign roles — within your permissions.",
    breadcrumb: "Breadcrumb navigation",
    hubCrumb: "Management",

    invite: "Invite member",

    searchLabel: "Search by name or email",
    searchPlaceholder: "e.g. Grünewald or name@…",
    filterRoleLabel: "Filter members by role",
    filterStatusLabel: "Filter members by status",

    fAll: "All",
    fBoard: "Board",
    fModerator: "Moderation",
    fTreasurer: "Treasurer",
    fCoach: "Coaches",
    fMember: "Members",
    fGuest: "Guest coaches",

    stAll: "Any status",
    stActive: "Active",
    stInactive: "Inactive",
    stPending: "Pending",
    stRejected: "Rejected",

    listEyebrow: "Overview",
    listTitle: "Everyone in the club",
    tableCaption: "Manageable member list with role and status",
    colMember: "Member",
    colTeams: "Team(s)",
    colRole: "Role",
    colStatus: "Status",
    colJoined: "Joined",
    colEdit: "Edit",
    bornYear: "Born {year}",
    noTeam: "no team",
    noEmailShort: "no email",
    shownOf: "{shown} of {total} members shown",
    edit: "Edit",
    editAria: "Edit {name}",

    roleOwner: "Board",
    roleAdmin: "Admin",
    roleModerator: "Moderator",
    roleTreasurer: "Treasurer",
    roleCoach: "Coach",
    roleMember: "Member",
    roleGuest: "Guest coach",
    guestUntil: "limited until {date}",

    statusActive: "Active",
    statusInactive: "Inactive",
    statusPending: "Pending",
    statusRejected: "Rejected",

    readOnlyNote:
      "Read-only view: editing records and roles needs member-management rights (treasurer, moderation, admin or board).",

    retry: "Try again",
    loadErrorTitle: "Data could not be loaded",
    emptyTitle: "Nobody found",
    emptyBody:
      "Search and filters return no matches right now — try another name or reset the filters.",
    emptyReset: "Reset filters",
    teamsNiHint: "Teams are not connected in this data source yet — the team column stays empty.",

    /* ---------- Edit sheet ---------- */
    sheetEyebrow: "Edit member",
    secMaster: "Master data",
    secRole: "Role in the club",

    fldFirstName: "First name",
    fldLastName: "Last name",
    fldEmail: "Email",
    fldEmailPlaceholder: "name@example.com",
    emailHint: "Leaving this empty removes the stored address.",
    fldBirth: "Date of birth",
    birthHint: "Relevant for age groups — optional.",
    fldStatus: "Status",
    fldValidUntil: "Access limited until",
    validUntilHint: "Guest coaches only: the date the access ends.",

    roleSelectLabel: "Change role",
    roleHintImmediate: "The role is saved immediately (its own save path).",
    roleHintLocked: "You may not change this person's role.",
    roleHintSelf: "You cannot change your own role here.",
    roleHintOwner: "The board role (owner) is protected and cannot be changed here.",

    save: "Save",
    cancel: "Cancel",

    valFirstName: "Please enter a first name.",
    valLastName: "Please enter a last name.",
    valEmail: "Please enter a valid email address.",

    savedToast: "{name} saved",
    roleToast: "Role changed to “{role}”",
    forbidden: "No permission — the change was not saved.",
    roleForbidden: "No permission — the role was not changed.",
  },
} satisfies Dict;

export type MitgliederVerwaltungKey = keyof (typeof mitgliederVerwaltungDict)["de"];

/** Rolle → Dictionary-Key der Rollen-Beschriftung (inkl. moderator). */
export function roleKey(role: MemberRole): MitgliederVerwaltungKey {
  switch (role) {
    case "owner":
      return "roleOwner";
    case "admin":
      return "roleAdmin";
    case "moderator":
      return "roleModerator";
    case "treasurer":
      return "roleTreasurer";
    case "coach":
      return "roleCoach";
    case "guest_coach":
      return "roleGuest";
    default:
      return "roleMember";
  }
}

/** Status → Dictionary-Key der Status-Beschriftung. */
export function statusKey(status: MemberStatus): MitgliederVerwaltungKey {
  switch (status) {
    case "active":
      return "statusActive";
    case "inactive":
      return "statusInactive";
    case "rejected":
      // Eigener Fall, KEIN default. Hier war der Fehler am teuersten: das
      // `default` haette "rejected" als "Ausstehend" beschriftet — ein
      // abgelehnter Antrag saehe fuer den Vorstand aus wie ein offener.
      return "statusRejected";
    default:
      return "statusPending";
  }
}
