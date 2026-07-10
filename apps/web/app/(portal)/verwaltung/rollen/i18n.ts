import type { Dict } from "@/lib/i18n";
import type { MemberRole } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary für „Rollen & Rechte" (Verwaltung). Regel:
 * JEDER String in beiden Sprachen, deutsche Strings mit echten Umlauten
 * (ä/ö/ü/ß). Die Rechte-Matrix spiegelt ORIGINAL-APP-REFERENZ 1.3 —
 * reine Anzeige; durchgesetzt wird serverseitig (RLS + API-Rollencheck).
 */
export const rollenDict = {
  de: {
    title: "Rollen & Rechte",
    sub: "Wer darf was im Verein — und wer Rollen vergibt",

    /* Rollen-Labels */
    roleOwner: "Vorstand",
    roleAdmin: "Verwaltung",
    roleModerator: "Moderator:in",
    roleTreasurer: "Kassenwart",
    roleCoach: "Trainer:in",
    roleGuest: "Gasttrainer",
    roleMember: "Mitglied",

    /* Rollen-Kurzbeschreibung (Matrix, erste Spalte) */
    descOwner: "Vereinsinhaber:in — volle Rechte",
    descAdmin: "Verwaltet Verein, Mitglieder & Finanzen",
    descModerator: "Verwaltung, aber nur rangtiefere Rollen",
    descTreasurer: "Mitglieder & Finanzen, keine Rollen",
    descCoach: "Trainingsbetrieb & Anwesenheit",
    descGuest: "Teambezogen & befristet",
    descMember: "Sieht eigene Termine, Beiträge & Küren",

    /* Matrix */
    matrixEyebrow: "Rechte-Modell",
    matrixTitle: "Was jede Rolle darf",
    matrixCaption: "Rechte-Matrix: Rollen und ihre Fähigkeiten",
    colRole: "Rolle",
    capTrainer: "Trainer",
    capClubAdmin: "Verwaltung",
    capMembers: "Mitglieder",
    capFinance: "Finanzen",
    capChangeRole: "Rollen ändern",
    aYes: "ja",
    aNo: "nein",
    aPartial: "eingeschränkt",

    /* Fußnoten */
    fnModerator: "Moderation darf nur Rollen ändern, die nicht Vorstand, Verwaltung oder Moderation sind.",
    fnGuest: "Gasttrainer haben Trainer-Rechte nur teambezogen und befristet (bis zum hinterlegten Datum).",
    platformNote: "Die Plattform-Administration (Super-Admin) ist keine Vereinsrolle, sondern ein Konto-Merkmal (app_metadata.is_platform_admin) und steht außerhalb dieser Matrix.",

    /* Zuweisung */
    assignEyebrow: "Zuweisung",
    assignTitle: "Rollen zuweisen",
    assignSub: "Wähle für jedes Mitglied die passende Rolle. Der Vorstand bleibt geschützt.",
    colMember: "Mitglied",
    colCurrentRole: "Aktuelle Rolle",
    colAssign: "Rolle zuweisen",
    selectAria: "Rolle von {name} ändern",
    guestUntil: "befristet bis {date}",
    youTag: "Du",
    reasonSelf: "eigene Rolle",
    reasonProtected: "höher gestellt",
    tableCaption: "Mitglieder und ihre Rollen",

    lockedTitle: "Zuweisen ist für deine Rolle gesperrt",
    lockedBody: "Nur Vorstand, Verwaltung und Moderation dürfen Rollen vergeben. Als {role} siehst du die Rollen nur zur Übersicht.",

    toastSaved: "Rolle von {name} zu „{role}“ geändert",
    toastDemo: "Rolle von {name} zu „{role}“ geändert — Demo",
    toastForbidden: "Keine Berechtigung — die Rolle wurde nicht geändert.",

    /* Zustände */
    retry: "Erneut versuchen",
    loadErrorTitle: "Mitglieder konnten nicht geladen werden",
    niTitle: "Noch nicht angebunden",
    niBody: "Die Mitgliederliste hat im api-Modus noch keinen Endpoint.",
    emptyTitle: "Noch keine Mitglieder",
    emptyBody: "Sobald Menschen im Verein sind, kannst du hier ihre Rollen vergeben.",

    /* Server-Hinweis */
    serverEyebrow: "Sicherheit",
    serverTitle: "Rechte gelten serverseitig",
    serverBody: "Diese Ansicht blendet nur ein und aus. Verbindlich prüft der Server jede Aktion (Row-Level-Security + API-Rollencheck gegen die Datenbank). Fehlt die Berechtigung, antwortet er mit einem Fehler — die Änderung wird dann zurückgenommen.",
  },
  en: {
    title: "Roles & permissions",
    sub: "Who can do what in the club — and who assigns roles",

    roleOwner: "Board",
    roleAdmin: "Admin",
    roleModerator: "Moderator",
    roleTreasurer: "Treasurer",
    roleCoach: "Coach",
    roleGuest: "Guest coach",
    roleMember: "Member",

    descOwner: "Club owner — full rights",
    descAdmin: "Manages club, members & finances",
    descModerator: "Admin, but lower ranks only",
    descTreasurer: "Members & finances, no roles",
    descCoach: "Training operations & attendance",
    descGuest: "Team-bound & time-limited",
    descMember: "Sees own events, fees & routines",

    matrixEyebrow: "Permission model",
    matrixTitle: "What each role can do",
    matrixCaption: "Permission matrix: roles and their capabilities",
    colRole: "Role",
    capTrainer: "Coach",
    capClubAdmin: "Admin",
    capMembers: "Members",
    capFinance: "Finance",
    capChangeRole: "Change roles",
    aYes: "yes",
    aNo: "no",
    aPartial: "limited",

    fnModerator: "Moderation may only change roles that are not board, admin or moderation.",
    fnGuest: "Guest coaches have coach rights only per team and time-limited (until the stored date).",
    platformNote: "Platform administration (super admin) is not a club role but an account trait (app_metadata.is_platform_admin) and sits outside this matrix.",

    assignEyebrow: "Assignment",
    assignTitle: "Assign roles",
    assignSub: "Pick the right role for each member. The board stays protected.",
    colMember: "Member",
    colCurrentRole: "Current role",
    colAssign: "Assign role",
    selectAria: "Change role of {name}",
    guestUntil: "limited until {date}",
    youTag: "You",
    reasonSelf: "your role",
    reasonProtected: "ranked higher",
    tableCaption: "Members and their roles",

    lockedTitle: "Assigning is locked for your role",
    lockedBody: "Only board, admin and moderation may assign roles. As {role} you can view the roles for reference only.",

    toastSaved: "Changed {name}'s role to “{role}”",
    toastDemo: "Changed {name}'s role to “{role}” — demo",
    toastForbidden: "No permission — the role was not changed.",

    retry: "Try again",
    loadErrorTitle: "Members could not be loaded",
    niTitle: "Not connected yet",
    niBody: "The member list has no endpoint in api mode yet.",
    emptyTitle: "No members yet",
    emptyBody: "Once people join the club you can assign their roles here.",

    serverEyebrow: "Security",
    serverTitle: "Permissions are enforced on the server",
    serverBody: "This view only shows and hides. The server authoritatively checks every action (row-level security + API role check against the database). Without permission it responds with an error — the change is then rolled back.",
  },
} satisfies Dict;

export type RollenKey = keyof (typeof rollenDict)["de"];

/** Rolle → Dictionary-Key des Labels. */
export function roleLabelKey(role: MemberRole): RollenKey {
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

/** Rolle → Dictionary-Key der Kurzbeschreibung. */
export function roleDescKey(role: MemberRole): RollenKey {
  switch (role) {
    case "owner":
      return "descOwner";
    case "admin":
      return "descAdmin";
    case "moderator":
      return "descModerator";
    case "treasurer":
      return "descTreasurer";
    case "coach":
      return "descCoach";
    case "guest_coach":
      return "descGuest";
    default:
      return "descMember";
  }
}
