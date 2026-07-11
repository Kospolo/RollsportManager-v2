import type { Dict } from "@/lib/i18n";
import type { MemberRole, MemberStatus } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary des eigenen Profils (App-Shell-Selbstsicht).
 * Verlinkt aus dem Topbar-Benutzermenü. Jede Rolle darf das EIGENE Profil
 * bearbeiten — die Durchsetzung (member_id = self) bleibt serverseitig.
 * Regel: JEDER String in beiden Sprachen, deutsche Strings mit echten
 * Umlauten (ä/ö/ü/ß) — nie ae/oe/ue/ss.
 */
export const profilDict = {
  de: {
    pageEyebrow: "Mein Konto",
    pageTitle: "Profil",
    pageSub: "Deine persönlichen Angaben und Kontoeinstellungen",

    /* Kopf */
    platformBadge: "Plattform-Konto",
    joinedMeta: "dabei seit {date}",
    guestUntil: "befristet bis {date}",

    /* Rollen */
    roleOwner: "Vorstand",
    roleAdmin: "Verwaltung",
    roleModerator: "Moderator:in",
    roleTreasurer: "Kassenwart:in",
    roleCoach: "Trainer:in",
    roleMember: "Mitglied",
    roleGuest: "Gasttrainer:in",

    /* Status */
    statusActive: "Aktiv",
    statusPending: "Ausstehend",
    statusInactive: "Inaktiv",

    /* Bearbeiten-Formular */
    editEyebrow: "Bearbeiten",
    editTitle: "Persönliche Daten",
    editHint:
      "Diese Angaben sieht deine Vereinsleitung. Rolle und Status legt der Verein fest — sie lassen sich hier nicht ändern.",
    fFirstName: "Vorname",
    fFirstNamePh: "z. B. Sandra",
    fLastName: "Nachname",
    fLastNamePh: "z. B. Vogel",
    fEmail: "E-Mail",
    fEmailPh: "name@beispiel.de",
    fEmailHint: "Für Benachrichtigungen und Rechnungen des Vereins.",
    fBirth: "Geburtsdatum",
    fBirthHint: "Optional — relevant für Altersklassen.",
    ageYears: "{age} Jahre",
    errFirstName: "Bitte gib deinen Vornamen an.",
    errLastName: "Bitte gib deinen Nachnamen an.",
    errEmail: "Bitte gib eine gültige E-Mail-Adresse an.",
    reset: "Zurücksetzen",
    save: "Änderungen speichern",
    savedToast: "Dein Profil ist aktualisiert",
    noChanges: "Es gibt nichts zu speichern.",
    noPermission: "Keine Berechtigung — dein Profil wurde nicht geändert.",

    /* Ohne Vereinsmitgliedschaft (Plattform-Persona) */
    noMembershipTitle: "Keine Vereinsmitgliedschaft",
    noMembershipBody:
      "Dieses Konto ist keinem Verein zugeordnet — es gibt daher keine persönlichen Vereinsdaten zum Bearbeiten.",

    /* Konto */
    accountEyebrow: "Konto",
    accountTitle: "Anmeldung & Sicherheit",
    accountEmailLabel: "Anmelde-E-Mail",
    accountNoEmail: "keine hinterlegt",
    passwordLabel: "Passwort",
    passwordNote: "Wird über die Anmeldung geändert",
    passwordHint:
      "Aus Sicherheitsgründen ändern wir Passwörter nicht im Portal — nutze dafür die Anmeldung.",

    /* Weitere Mitgliedschaften */
    otherEyebrow: "Weitere Vereine",
    otherTitle: "Weitere Mitgliedschaften",

    /* Laden / Fehler */
    loadErrorTitle: "Profil konnte nicht geladen werden",
    loadErrorRetry: "Erneut versuchen",
    niTitle: "Noch nicht angebunden",
    niBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",
  },
  en: {
    pageEyebrow: "My account",
    pageTitle: "Profile",
    pageSub: "Your personal details and account settings",

    /* Header */
    platformBadge: "Platform account",
    joinedMeta: "member since {date}",
    guestUntil: "limited until {date}",

    /* Roles */
    roleOwner: "Board",
    roleAdmin: "Admin",
    roleModerator: "Moderator",
    roleTreasurer: "Treasurer",
    roleCoach: "Coach",
    roleMember: "Member",
    roleGuest: "Guest coach",

    /* Status */
    statusActive: "Active",
    statusPending: "Pending",
    statusInactive: "Inactive",

    /* Edit form */
    editEyebrow: "Edit",
    editTitle: "Personal details",
    editHint:
      "Your club's administration can see these details. Role and status are set by the club — they cannot be changed here.",
    fFirstName: "First name",
    fFirstNamePh: "e.g. Sandra",
    fLastName: "Last name",
    fLastNamePh: "e.g. Vogel",
    fEmail: "Email",
    fEmailPh: "name@example.com",
    fEmailHint: "Used for the club's notifications and invoices.",
    fBirth: "Date of birth",
    fBirthHint: "Optional — relevant for age groups.",
    ageYears: "{age} years",
    errFirstName: "Please enter your first name.",
    errLastName: "Please enter your last name.",
    errEmail: "Please enter a valid email address.",
    reset: "Reset",
    save: "Save changes",
    savedToast: "Your profile has been updated",
    noChanges: "There is nothing to save.",
    noPermission: "No permission — your profile was not changed.",

    /* Without club membership (platform persona) */
    noMembershipTitle: "No club membership",
    noMembershipBody:
      "This account is not tied to a club — so there are no personal club details to edit.",

    /* Account */
    accountEyebrow: "Account",
    accountTitle: "Login & security",
    accountEmailLabel: "Login email",
    accountNoEmail: "none on file",
    passwordLabel: "Password",
    passwordNote: "Changed via the login",
    passwordHint:
      "For security we don't change passwords inside the portal — use the login for that.",

    /* Other memberships */
    otherEyebrow: "Other clubs",
    otherTitle: "Other memberships",

    /* Loading / error */
    loadErrorTitle: "Profile could not be loaded",
    loadErrorRetry: "Try again",
    niTitle: "Not connected yet",
    niBody: "This area has no endpoint in api mode yet.",
  },
} satisfies Dict;

export type ProfilKey = keyof (typeof profilDict)["de"];

/** Rolle → Dictionary-Key der Rollen-Beschriftung (alle sieben Rollen). */
export function roleKey(role: MemberRole): ProfilKey {
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
export function statusKey(status: MemberStatus): ProfilKey {
  switch (status) {
    case "active":
      return "statusActive";
    case "pending":
      return "statusPending";
    default:
      return "statusInactive";
  }
}
