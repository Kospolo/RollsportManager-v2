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

    // KENNTNISNAHME, KEINE EINWILLIGUNG. Beide Haken sind Pflicht — und genau
    // deshalb duerfen sie nicht wie eine Einwilligung aussehen: die
    // Nutzungsbedingungen anzunehmen IST der Vertragsschluss (Art. 6 Abs. 1
    // lit. b DSGVO), die Datenschutzerklaerung ist eine Informationspflicht
    // (Art. 13). In eine Datenschutzerklaerung willigt man nicht ein, man nimmt
    // sie zur Kenntnis. Stuenden diese Pflicht-Haken neben freiwilligen
    // Einwilligungen, wirkten auch die freiwilligen wie Pflicht — das
    // Kopplungsverbot (Art. 7 Abs. 4) waere verletzt und die echte
    // Einwilligung unwirksam.
    ackTitle: "Bedingungen und Datenschutz",
    ackTerms: "Ich nehme die Nutzungsbedingungen an.",
    ackPrivacy: "Ich habe die Datenschutzerklärung zur Kenntnis genommen.",
    ackHint:
      "Beides ist für den Beitritt nötig und ist keine Einwilligung: die Bedingungen sind der Vertrag, die Datenschutzerklärung ist eine Information an dich.",

    // Die ECHTEN Einwilligungen (Fotos, Rundschreiben) werden hier bewusst
    // NICHT abgefragt. Zwei Gruende, beide inhaltlich:
    //   1. Wer beitritt, ist noch nicht aufgenommen (status='pending'). Eine
    //      Einwilligung von jemandem abzufragen, waehrend man ueber seine
    //      Aufnahme entscheidet, ist nicht "freiwillig" im Sinne von
    //      Art. 4 Nr. 11 — es entsteht der Eindruck, das Ja helfe dem Antrag.
    //   2. Bei Kindern erklaert die erziehungsberechtigte Person (Art. 8), und
    //      wer wessen Kind ist, weiss das System erst NACH der Aufnahme.
    // Deshalb: erst aufnehmen, dann fragen — im Mitgliederbereich.
    consentLaterNote:
      "Über Fotos und Rundschreiben entscheidest du später im Mitgliederbereich — freiwillig und jederzeit widerrufbar.",

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

    ackTitle: "Terms and privacy",
    ackTerms: "I accept the terms of use.",
    ackPrivacy: "I have read and noted the privacy policy.",
    ackHint:
      "Both are required to join and neither is a consent: the terms are the contract, the privacy policy is information for you.",

    consentLaterNote:
      "You decide about photos and newsletters later in the member area — freely, and you can withdraw at any time.",

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
