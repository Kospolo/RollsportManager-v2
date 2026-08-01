import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary des „Kein Verein“-Onboardings — DE und EN
 * vollstaendig, deutsche Strings mit echten Umlauten.
 *
 * Wer angemeldet ist, aber (noch) keinen Verein hat, landet hier statt im
 * Portal. Zwei Wege, ueber ein Segment umschaltbar: einen Verein GRUENDEN
 * (wird sofort Inhaber) oder einem beitreten (ANTRAG, wartet auf Freigabe).
 */
export const onboardingDict = {
  de: {
    greeting: "Fast geschafft",
    intro: "Dein Konto steht. Jetzt fehlt nur noch ein Verein.",

    segCreate: "Verein gründen",
    segJoin: "Verein beitreten",

    signedInAs: "Angemeldet als {email}",
    signOut: "Abmelden",

    // --- Gründen ---
    createTitle: "Verein gründen",
    createSub: "Zwei Angaben genügen. Alles andere kommt später.",
    nameLabel: "Name des Vereins",
    namePlaceholder: "RSV Neckarsulm",
    cityLabel: "Ort",
    cityPlaceholder: "Neckarsulm",
    shortLabel: "Kürzel (optional)",
    shortPlaceholder: "RSV",
    disciplineLabel: "Sportart (optional)",
    disciplinePlaceholder: "Rollkunstlauf",
    createSubmit: "Verein gründen",
    createSubmitting: "Wird angelegt …",
    trialNote:
      "30 Tage kostenlos testen. Keine Zahlungsdaten, keine Registernummer — die brauchen wir erst beim Upgrade.",
    createDoneTitle: "{club} ist angelegt.",
    createDoneSub: "Du bist Inhaber:in. Das hier ist der Code, mit dem deine Mitglieder beitreten:",
    codeHint:
      "Der Code ist ein ANTRAG, kein Zutritt: Wer ihn eingibt, landet in deiner Freigabe-Liste. Du entscheidest, wer hereinkommt.",
    copyCode: "Code kopieren",
    codeCopied: "Kopiert",
    toPortal: "Zum Portal",

    // --- Beitreten ---
    joinTitle: "Verein beitreten",
    joinSub: "Gib den Code ein, den du von deinem Verein bekommen hast.",
    codeLabel: "Vereinscode",
    codePlaceholder: "XXXX-XXXX",
    codeInputHint: "Öffnet die Warteschlange, nicht die Tür — der Vorstand gibt dich frei.",
    firstNameLabel: "Vorname",
    lastNameLabel: "Nachname",
    joinSubmit: "Beitritt beantragen",
    joinSubmitting: "Antrag wird gestellt …",
    joinDoneTitle: "Antrag gestellt",
    joinDoneSub: "Dein Antrag bei {club} liegt jetzt beim Vorstand zur Freigabe.",
    joinDoneStatus: "Status: wartet auf Freigabe. Du bekommst Zugang, sobald jemand dich bestätigt.",
    joinDoneHint: "Bis dahin ist hier noch nichts zu sehen. Das ist normal.",
    joinDoneBack: "Verstanden",

    // --- Zustimmung (beide Wege) ---
    ackTitle: "Bedingungen und Datenschutz",
    ackTerms: "Ich nehme die Nutzungsbedingungen an.",
    ackPrivacy: "Ich habe die Datenschutzerklärung zur Kenntnis genommen.",
    ackHint:
      "Beides ist nötig und ist keine Einwilligung: die Bedingungen sind der Vertrag, die Datenschutzerklärung ist eine Information an dich.",

    errGeneric: "Das hat nicht geklappt: {message}",
    errRateLimited: "Zu viele Versuche. Bitte in {seconds} Sekunden erneut versuchen.",
    errInvalidCode: "Mit diesem Code hat es nicht geklappt. Prüfe ihn und versuche es erneut.",
    errAlready: "Für diesen Verein liegt bereits ein Antrag oder eine Mitgliedschaft von dir vor.",
  },
  en: {
    greeting: "Almost there",
    intro: "Your account is ready. All that is missing is a club.",

    segCreate: "Start a club",
    segJoin: "Join a club",

    signedInAs: "Signed in as {email}",
    signOut: "Sign out",

    // --- Create ---
    createTitle: "Start a club",
    createSub: "Two details are enough. Everything else can wait.",
    nameLabel: "Club name",
    namePlaceholder: "RSV Neckarsulm",
    cityLabel: "Town",
    cityPlaceholder: "Neckarsulm",
    shortLabel: "Short name (optional)",
    shortPlaceholder: "RSV",
    disciplineLabel: "Discipline (optional)",
    disciplinePlaceholder: "Artistic roller skating",
    createSubmit: "Start club",
    createSubmitting: "Creating …",
    trialNote:
      "30-day free trial. No payment details, no registry number — those come with the upgrade.",
    createDoneTitle: "{club} is ready.",
    createDoneSub: "You are the owner. This is the code your members join with:",
    codeHint:
      "The code is a REQUEST, not entry: whoever enters it lands in your approval list. You decide who gets in.",
    copyCode: "Copy code",
    codeCopied: "Copied",
    toPortal: "Go to portal",

    // --- Join ---
    joinTitle: "Join a club",
    joinSub: "Enter the code you received from your club.",
    codeLabel: "Club code",
    codePlaceholder: "XXXX-XXXX",
    codeInputHint: "Opens the queue, not the door — the board approves you.",
    firstNameLabel: "First name",
    lastNameLabel: "Last name",
    joinSubmit: "Request to join",
    joinSubmitting: "Requesting …",
    joinDoneTitle: "Request sent",
    joinDoneSub: "Your request to join {club} is now with the board for approval.",
    joinDoneStatus: "Status: waiting for approval. You get access as soon as someone confirms you.",
    joinDoneHint: "Until then there is nothing to see here yet. That is normal.",
    joinDoneBack: "Understood",

    // --- Consent (both paths) ---
    ackTitle: "Terms and privacy",
    ackTerms: "I accept the terms of use.",
    ackPrivacy: "I have read and noted the privacy policy.",
    ackHint:
      "Both are required and neither is a consent: the terms are the contract, the privacy policy is information for you.",

    errGeneric: "That did not work: {message}",
    errRateLimited: "Too many attempts. Please retry in {seconds} seconds.",
    errInvalidCode: "That code did not work. Check it and try again.",
    errAlready: "You already have a request or membership for this club.",
  },
} satisfies Dict;
