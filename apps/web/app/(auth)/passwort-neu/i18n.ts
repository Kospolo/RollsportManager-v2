import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Passwort-Seite — DE und EN vollstaendig,
 * deutsche Strings mit echten Umlauten.
 *
 * Eine Seite, zwei Zustaende: MIT ?token= im Link (aus der Reset-E-Mail) setzt
 * man ein neues Passwort; OHNE Token fordert man den Link per E-Mail an. Die
 * Anforderung bestaetigt IMMER neutral — der Server verraet nicht, ob es das
 * Konto gibt (keine Konto-Enumeration), und diese Seite tut es ihm gleich.
 */
export const passwortDict = {
  de: {
    // Zustand „Link anfordern“ (kein Token)
    requestTitle: "Passwort zurücksetzen",
    requestSub: "Gib deine E-Mail-Adresse ein. Gibt es ein Konto dazu, schicken wir dir einen Link.",
    emailLabel: "E-Mail-Adresse",
    emailPlaceholder: "name@verein.de",
    requestSubmit: "Link anfordern",
    requestSubmitting: "Wird gesendet …",
    requestDoneTitle: "Prüfe dein Postfach",
    requestDoneBody:
      "Wenn zu dieser E-Mail-Adresse ein Konto besteht, ist ein Link zum Zurücksetzen unterwegs. Der Link gilt nur eine begrenzte Zeit.",

    // Zustand „neues Passwort setzen“ (mit Token)
    setTitle: "Neues Passwort wählen",
    setSub: "Wähle ein Passwort mit mindestens 8 Zeichen.",
    passwordLabel: "Neues Passwort",
    passwordPlaceholder: "••••••••",
    passwordHint: "Mindestens 8 Zeichen.",
    confirmLabel: "Passwort wiederholen",
    setSubmit: "Passwort speichern",
    setSubmitting: "Wird gespeichert …",
    setDoneTitle: "Passwort geändert",
    setDoneBody: "Du kannst dich jetzt mit deinem neuen Passwort anmelden.",

    toLogin: "Zur Anmeldung",
    backHome: "Zur Startseite",

    errShort: "Das Passwort braucht mindestens 8 Zeichen.",
    errMismatch: "Die beiden Passwörter stimmen nicht überein.",
    errToken: "Dieser Link ist ungültig oder abgelaufen. Fordere einen neuen an.",
    errRateLimited: "Zu viele Versuche. Bitte in {seconds} Sekunden erneut versuchen.",
    errGeneric: "Das hat nicht geklappt: {message}",
    requestNew: "Neuen Link anfordern",
  },
  en: {
    // "Request link" state (no token)
    requestTitle: "Reset password",
    requestSub: "Enter your email address. If an account exists, we will send you a link.",
    emailLabel: "Email address",
    emailPlaceholder: "name@club.com",
    requestSubmit: "Request link",
    requestSubmitting: "Sending …",
    requestDoneTitle: "Check your inbox",
    requestDoneBody:
      "If an account exists for this email address, a reset link is on its way. The link is only valid for a limited time.",

    // "Set new password" state (with token)
    setTitle: "Choose a new password",
    setSub: "Pick a password with at least 8 characters.",
    passwordLabel: "New password",
    passwordPlaceholder: "••••••••",
    passwordHint: "At least 8 characters.",
    confirmLabel: "Repeat password",
    setSubmit: "Save password",
    setSubmitting: "Saving …",
    setDoneTitle: "Password changed",
    setDoneBody: "You can now sign in with your new password.",

    toLogin: "Go to sign-in",
    backHome: "Back to homepage",

    errShort: "The password needs at least 8 characters.",
    errMismatch: "The two passwords do not match.",
    errToken: "This link is invalid or has expired. Please request a new one.",
    errRateLimited: "Too many attempts. Please retry in {seconds} seconds.",
    errGeneric: "That did not work: {message}",
    requestNew: "Request a new link",
  },
} satisfies Dict;
