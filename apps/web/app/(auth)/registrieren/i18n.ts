import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Registrierung — DE und EN vollstaendig,
 * deutsche Strings mit echten Umlauten.
 */
export const registrierenDict = {
  de: {
    title: "Verein anlegen",
    sub: "Zwei Angaben genügen. Alles andere kommt später.",

    nameLabel: "Name des Vereins",
    namePlaceholder: "RSV Neckarsulm",
    cityLabel: "Ort",
    cityPlaceholder: "Neckarsulm",
    shortLabel: "Kürzel (optional)",
    shortPlaceholder: "RSV",
    disciplineLabel: "Sportart (optional)",
    disciplinePlaceholder: "Rollkunstlauf",

    consentTerms: "Ich akzeptiere die Nutzungsbedingungen.",
    consentPrivacy: "Ich habe die Datenschutzerklärung gelesen.",
    consentHint:
      "Wir fragen beides einzeln — ein Sammel-Haken wäre keine wirksame Einwilligung.",

    submit: "Verein anlegen",
    submitting: "Wird angelegt …",

    trialNote:
      "30 Tage kostenlos testen. Keine Zahlungsdaten, keine Registernummer — die brauchen wir erst beim Upgrade.",

    successTitle: "{club} ist angelegt.",
    successSub: "Du bist Inhaber:in. Das hier ist der Code, mit dem deine Mitglieder beitreten:",
    successTrial: "Testphase läuft bis {date}.",
    codeHint:
      "Der Code ist ein ANTRAG, kein Zutritt: Wer ihn eingibt, landet in deiner Freigabe-Liste. Du entscheidest, wer hereinkommt.",
    copyCode: "Code kopieren",
    codeCopied: "Kopiert",
    toPortal: "Zum Portal",

    errorGeneric: "Das hat nicht geklappt: {message}",
    errorRateLimited: "Zu viele Versuche. Bitte in {seconds} Sekunden erneut versuchen.",

    haveCode: "Du hast einen Vereinscode?",
    joinInstead: "Einem Verein beitreten",
    backToLogin: "Zurück zur Anmeldung",
    needLogin: "Bitte melde dich zuerst an — dein Verein braucht eine Inhaber:in.",
    toLogin: "Zur Anmeldung",
  },
  en: {
    title: "Register a club",
    sub: "Two details are enough. Everything else can wait.",

    nameLabel: "Club name",
    namePlaceholder: "RSV Neckarsulm",
    cityLabel: "Town",
    cityPlaceholder: "Neckarsulm",
    shortLabel: "Short name (optional)",
    shortPlaceholder: "RSV",
    disciplineLabel: "Discipline (optional)",
    disciplinePlaceholder: "Artistic roller skating",

    consentTerms: "I accept the terms of use.",
    consentPrivacy: "I have read the privacy policy.",
    consentHint: "We ask separately — one blanket tick would not be valid consent.",

    submit: "Register club",
    submitting: "Creating …",

    trialNote:
      "30-day free trial. No payment details, no registry number — those come with the upgrade.",

    successTitle: "{club} is ready.",
    successSub: "You are the owner. This is the code your members join with:",
    successTrial: "Trial runs until {date}.",
    codeHint:
      "The code is a REQUEST, not entry: whoever enters it lands in your approval list. You decide who gets in.",
    copyCode: "Copy code",
    codeCopied: "Copied",
    toPortal: "Go to portal",

    errorGeneric: "That did not work: {message}",
    errorRateLimited: "Too many attempts. Please retry in {seconds} seconds.",

    haveCode: "Got a club code?",
    joinInstead: "Join a club instead",
    backToLogin: "Back to sign-in",
    needLogin: "Please sign in first — your club needs an owner.",
    toLogin: "Go to sign-in",
  },
} satisfies Dict;
