import type { Dict } from "@/lib/i18n";

/** Kolokalisiertes Dictionary des Beitritts — DE und EN, echte Umlaute. */
export const beitretenDict = {
  de: {
    title: "Einem Verein beitreten",
    sub: "Gib den Code ein, den du von deinem Verein bekommen hast.",

    codeLabel: "Vereinscode",
    codePlaceholder: "ABCD-1234",
    codeHint: "Groß- und Kleinschreibung egal. 0 und O sind dasselbe Zeichen, ebenso 1 und I.",

    firstNameLabel: "Vorname",
    lastNameLabel: "Nachname",

    consentTerms: "Ich akzeptiere die Nutzungsbedingungen.",
    consentPrivacy: "Ich habe die Datenschutzerklärung gelesen.",

    submit: "Beitritt beantragen",
    submitting: "Wird gesendet …",

    // Die Kernaussage schon VOR dem Absenden — niemand soll glauben, der Code
    // sei der Schluessel.
    requestNote:
      "Der Code öffnet die Warteschlange, nicht die Tür: Dein Antrag geht an den Vorstand.",

    successTitle: "Antrag gestellt.",
    successSub: "Dein Antrag bei {club} liegt beim Vorstand. Sobald er freigegeben ist, kommst du hinein.",
    successStatus: "Status: wartet auf Freigabe",
    successHint:
      "Du musst dich dafür nicht neu anmelden — die Freigabe wirkt sofort.",
    backToLogin: "Zurück zur Anmeldung",

    // Bei falschem Code sagen wir NICHT, ob es ihn gibt (Server: immer 404).
    errorInvalid: "Dieser Vereinscode ist nicht gültig. Bitte prüfe deine Eingabe.",
    errorAlready: "Du bist bei diesem Verein schon eingetragen.",
    errorRateLimited: "Zu viele Versuche. Bitte in {seconds} Sekunden erneut versuchen.",
    errorGeneric: "Das hat nicht geklappt: {message}",

    noCode: "Kein Code? Du kannst deinen Verein selbst anlegen.",
    registerInstead: "Verein anlegen",
    needLogin: "Bitte melde dich zuerst an — dein Antrag braucht ein Konto.",
    toLogin: "Zur Anmeldung",
  },
  en: {
    title: "Join a club",
    sub: "Enter the code your club gave you.",

    codeLabel: "Club code",
    codePlaceholder: "ABCD-1234",
    codeHint: "Case does not matter. 0 and O are the same character, as are 1 and I.",

    firstNameLabel: "First name",
    lastNameLabel: "Last name",

    consentTerms: "I accept the terms of use.",
    consentPrivacy: "I have read the privacy policy.",

    submit: "Request to join",
    submitting: "Sending …",

    requestNote:
      "The code opens the queue, not the door: your request goes to the club's board.",

    successTitle: "Request sent.",
    successSub: "Your request to {club} is with the board. Once approved, you are in.",
    successStatus: "Status: waiting for approval",
    successHint: "You will not need to sign in again — approval takes effect immediately.",
    backToLogin: "Back to sign-in",

    errorInvalid: "This club code is not valid. Please check your input.",
    errorAlready: "You are already registered with this club.",
    errorRateLimited: "Too many attempts. Please retry in {seconds} seconds.",
    errorGeneric: "That did not work: {message}",

    noCode: "No code? You can register your own club.",
    registerInstead: "Register a club",
    needLogin: "Please sign in first — your request needs an account.",
    toLogin: "Go to sign-in",
  },
} satisfies Dict;
