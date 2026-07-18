import type { Dict } from "@/lib/i18n";

/** Kolokalisiertes Dictionary der Einladungs-Annahme — DE und EN, echte Umlaute. */
export const einladungDict = {
  de: {
    // Vor dem Laden der Vorschau.
    loadingTitle: "Einladung wird geprüft …",

    // Gueltige Einladung: Vereinsname steht fest, die Person nimmt an.
    title: "Einladung annehmen",
    sub: "Du wurdest zu {club} eingeladen.",
    roleNote: "Rolle nach der Annahme: {role}",

    firstNameLabel: "Vorname",
    lastNameLabel: "Nachname",

    // KENNTNISNAHME, KEINE EINWILLIGUNG — dieselbe Trennung wie beim Beitritt
    // (Kopplungsverbot, Art. 7 Abs. 4 DSGVO). Die Nutzungsbedingungen sind der
    // Vertrag (Art. 6 Abs. 1 lit. b), die Datenschutzerklaerung eine
    // Informationspflicht (Art. 13). Beides ist Pflicht und steht ALLEIN.
    ackTitle: "Bedingungen und Datenschutz",
    ackTerms: "Ich nehme die Nutzungsbedingungen an.",
    ackPrivacy: "Ich habe die Datenschutzerklärung zur Kenntnis genommen.",
    ackHint:
      "Beides ist für den Beitritt nötig und ist keine Einwilligung: die Bedingungen sind der Vertrag, die Datenschutzerklärung ist eine Information an dich.",

    // Echte Einwilligungen (Fotos, Rundschreiben) werden hier bewusst NICHT
    // abgefragt — sie kommen freiwillig im Mitgliederbereich. Bei Kindern
    // erklaert die erziehungsberechtigte Person (Art. 8).
    consentLaterNote:
      "Über Fotos und Rundschreiben entscheidest du später im Mitgliederbereich — freiwillig und jederzeit widerrufbar.",

    submit: "Einladung annehmen",
    submitting: "Wird angenommen …",

    acceptNote:
      "Anders als beim Vereinscode wirst du sofort aufgenommen: der Vorstand hat dich gezielt eingeladen.",

    successTitle: "Willkommen!",
    successSub: "Du bist jetzt Mitglied bei {club}.",
    toPortal: "Zum Mitgliederbereich",

    // Ungueltiger/abgelaufener/verbrauchter Token — eine Meldung, kein Orakel.
    invalidTitle: "Einladung nicht gültig",
    invalidSub:
      "Diese Einladung ist nicht mehr gültig — vielleicht ist sie abgelaufen oder wurde bereits genutzt. Bitte den Verein um eine neue.",
    errorGeneric: "Das hat nicht geklappt: {message}",

    // In api-Modus muss man angemeldet sein, um anzunehmen (die Mitgliedschaft
    // haengt am eigenen Konto). Der Vereinsname wird trotzdem schon gezeigt.
    needLogin: "Bitte melde dich zuerst an oder registriere dich — die Mitgliedschaft gehört zu deinem Konto.",
    toLogin: "Zur Anmeldung",
    backToLogin: "Zur Anmeldung",
  },
  en: {
    loadingTitle: "Checking invitation …",

    title: "Accept invitation",
    sub: "You have been invited to {club}.",
    roleNote: "Role after accepting: {role}",

    firstNameLabel: "First name",
    lastNameLabel: "Last name",

    ackTitle: "Terms and privacy",
    ackTerms: "I accept the terms of use.",
    ackPrivacy: "I have read and noted the privacy policy.",
    ackHint:
      "Both are required to join and neither is a consent: the terms are the contract, the privacy policy is information for you.",

    consentLaterNote:
      "You decide about photos and newsletters later in the member area — freely, and you can withdraw at any time.",

    submit: "Accept invitation",
    submitting: "Accepting …",

    acceptNote:
      "Unlike the club code, you are admitted right away: the board invited you specifically.",

    successTitle: "Welcome!",
    successSub: "You are now a member of {club}.",
    toPortal: "Go to the member area",

    invalidTitle: "Invitation not valid",
    invalidSub:
      "This invitation is no longer valid — it may have expired or already been used. Please ask the club for a new one.",
    errorGeneric: "That did not work: {message}",

    needLogin: "Please sign in or register first — the membership belongs to your account.",
    toLogin: "Go to sign-in",
    backToLogin: "Go to sign-in",
  },
} satisfies Dict;
