import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Vereins-Einstellungen (Verwaltung → Verein).
 * Regel: JEDER String in beiden Sprachen, deutsche Strings mit echten
 * Umlauten (ä/ö/ü/ß).
 */
export const vereinDict = {
  de: {
    title: "Vereins-Einstellungen",
    sub: "Stammdaten, Kontakt, öffentliches Profil, E-Mail-Versand und mehr",

    // Kern-Stammdaten
    coreEyebrow: "Stammdaten",
    coreTitle: "Verein",
    fName: "Vereinsname",
    fNameHint: "Erscheint in Kopfzeilen, Rechnungen und Einladungen.",
    fShortName: "Kürzel",
    fShortNameHint: "Kurzform, z. B. „RSV NSU“.",
    fFoundedYear: "Gründungsjahr",
    fFoundedYearPlaceholder: "z. B. 1968",
    fDiscipline: "Disziplin",
    fDisciplinePlaceholder: "z. B. Rollkunstlauf",
    fWebsite: "Webseite",
    fWebsitePlaceholder: "https://dein-verein.de",

    // Kontakt & Anschrift
    contactEyebrow: "Kontakt & Anschrift",
    contactTitle: "Erreichbarkeit",
    fEmail: "Kontakt-E-Mail",
    fEmailPlaceholder: "vorstand@verein.de",
    fPhone: "Telefon",
    fPhonePlaceholder: "+49 …",
    fStreet: "Straße & Hausnummer",
    fStreetPlaceholder: "z. B. Beethovenstraße 24",
    fPostalCode: "PLZ",
    fPostalCodePlaceholder: "74172",
    fCity: "Ort",
    fCountry: "Land",
    fCountryPlaceholder: "Deutschland",

    // Über den Verein
    aboutEyebrow: "Über den Verein",
    aboutTitle: "Beschreibung",
    fDescription: "Über den Verein",
    fDescriptionHint: "Interner Freitext. Für die Öffentlichkeit gibt es unten ein eigenes Feld.",
    fDescriptionPlaceholder: "Ein paar Sätze über euren Verein, eure Sparten und eure Geschichte …",

    // Öffentliches Profil
    publicEyebrow: "Öffentliches Profil",
    publicTitle: "Auf der Website zeigen",
    publicToggle: "Verein öffentlich auf der Website zeigen",
    publicToggleDesc:
      "Solange ausgeschaltet, erscheint der Verein nirgends öffentlich. Erst mit diesem Schalter gebt ihr die Anzeige frei.",
    fPublicDescription: "Öffentliche Beschreibung",
    fPublicDescriptionHint: "Dieser Text ist für Besucher gedacht — bewusst getrennt von der internen Beschreibung.",
    fPublicDescriptionPlaceholder: "Was sollen Interessierte über euch erfahren?",
    fPublicImage: "Bild-URL (öffentlich)",
    fPublicImagePlaceholder: "https://… (optional)",
    publicNote:
      "Hinweis: Die öffentliche Vereins-Seite (alle freigegebenen Vereine als Kachel-Übersicht) folgt in einem separaten Schritt. Hier legt ihr nur die Inhalte und den Schalter fest.",

    // E-Mail-Versand (SMTP)
    smtpEyebrow: "E-Mail-Versand (SMTP)",
    smtpTitle: "Eigener Absender",
    smtpDesc:
      "Optional: ein eigener SMTP-Absender für Anmeldungs- und Info-Mails eures Vereins. Ohne Angabe läuft der Versand über den Plattform-Standard.",
    fHost: "SMTP-Server",
    fHostPlaceholder: "smtp.strato.de",
    fPort: "Port",
    fPortError: "Port muss zwischen 1 und 65535 liegen.",
    fSmtpUser: "Benutzername",
    fSmtpFrom: "Absender",
    fSmtpFromPlaceholder: "RSV Neckarsulm <noreply@rsv.de>",
    fSmtpPassword: "Passwort",
    smtpPasswordPlaceholder: "unverändert lassen",
    smtpPasswordHint: "Leer lassen behält das gespeicherte Passwort. Ein Eintrag ersetzt es.",
    fSecure: "SSL/TLS",
    secureOn: "an",
    secureOff: "aus",
    secureDesc: "Verschlüsselte Verbindung erzwingen (empfohlen).",
    smtpPasswordSet: "Passwort hinterlegt",
    smtpPasswordUnset: "Kein Passwort hinterlegt",
    smtpSave: "SMTP speichern",
    smtpSaving: "Speichere …",
    smtpLoadError: "SMTP-Einstellungen konnten nicht geladen werden",
    smtpSavedToast: "SMTP-Einstellungen gespeichert",

    // Bank
    bankEyebrow: "Finanzen",
    bankTitle: "Bankverbindung",
    fIban: "IBAN",
    fIbanPlaceholder: "DE00 0000 0000 0000 0000 00",
    fAccountHolder: "Kontoinhaber:in",
    fAccountHolderPlaceholder: "Name laut Bank",
    fBankName: "Bank",
    fBankNamePlaceholder: "z. B. Volksbank Neckarsulm",

    // Benachrichtigungen
    notifyEyebrow: "Benachrichtigungen",
    notifyTitle: "E-Mail-Hinweise",
    notifyInvoices: "Beiträge & Rechnungen",
    notifyInvoicesDesc: "Zahlungserinnerungen und Mahnungen automatisch versenden.",
    notifyEvents: "Termine",
    notifyEventsDesc: "Einladungen und Änderungen an Trainings und Wettkämpfen melden.",
    notifyNews: "Vereins-News",
    notifyNewsDesc: "Neuigkeiten aus dem Verein per E-Mail zusammenfassen.",

    // Aktionen
    save: "Änderungen speichern",
    saving: "Speichere …",
    reset: "Verwerfen",
    saveHintApi: "Änderungen werden direkt im Verein gespeichert.",
    saveHintMock: "Demo: Bank & Benachrichtigungen bleiben lokal, bis die Seite neu geladen wird.",
    settingsNote:
      "Stammdaten, Kontakt, „Über den Verein“ und das öffentliche Profil werden als echte Vereinsdaten gespeichert. Bank und Benachrichtigungen liegen weiterhin im Einstellungs-Objekt; in der Demo werden sie nicht gespiegelt.",

    // Validierung
    errNameRequired: "Bitte einen Vereinsnamen angeben.",
    errEmailInvalid: "Bitte eine gültige E-Mail-Adresse angeben.",
    errIbanInvalid: "Bitte eine gültige IBAN angeben (oder Feld leer lassen).",
    errFoundedYear: "Bitte ein Jahr zwischen 1800 und 2100 angeben (oder Feld leer lassen).",

    // Toasts
    savedToast: "Vereins-Einstellungen gespeichert",
    forbiddenToast: "Keine Berechtigung — nur Vorstand/Verwaltung dürfen Vereinsdaten ändern.",

    // Zustände
    loadErrorTitle: "Einstellungen konnten nicht geladen werden",
    retry: "Erneut versuchen",
    readOnlyTitle: "Nur Ansicht",
    readOnlyBody:
      "Vereinsdaten dürfen nur Vorstand und Verwaltung ändern. Deine aktuellen Stammdaten siehst du unten.",
    roEyebrow: "Stammdaten",
    roTitle: "Verein",
    roName: "Vereinsname",
    roShortName: "Kürzel",
    roCity: "Ort",
    roDiscipline: "Disziplin",
    roEmpty: "—",

    // Vereinslogo (0060)
    logoEyebrow: "Erscheinungsbild",
    logoTitle: "Vereinslogo",
    logoHint:
      "Erscheint in der Seitenleiste und der Betreiber-Vereinsliste. Bild (PNG, JPG, SVG …), ersetzt das bestehende Logo. Ohne Logo zeigen wir die Initialen.",
    logoUpload: "Logo hochladen",
    logoReplace: "Logo ersetzen",
    logoRemove: "Entfernen",
    logoBusy: "Wird übertragen …",
    logoTypeError: "Bitte eine Bilddatei wählen (PNG, JPG, GIF, WebP oder SVG).",
    logoError: "Das Logo konnte nicht gespeichert werden.",
    logoAlt: "Vereinslogo",
  },
  en: {
    title: "Club settings",
    sub: "Master data, contact, public profile, email delivery and more",

    coreEyebrow: "Master data",
    coreTitle: "Club",
    fName: "Club name",
    fNameHint: "Shown in headers, invoices and invitations.",
    fShortName: "Short name",
    fShortNameHint: "Short form, e.g. “RSV NSU”.",
    fFoundedYear: "Founded (year)",
    fFoundedYearPlaceholder: "e.g. 1968",
    fDiscipline: "Discipline",
    fDisciplinePlaceholder: "e.g. artistic roller skating",
    fWebsite: "Website",
    fWebsitePlaceholder: "https://your-club.org",

    contactEyebrow: "Contact & address",
    contactTitle: "How to reach you",
    fEmail: "Contact email",
    fEmailPlaceholder: "board@club.org",
    fPhone: "Phone",
    fPhonePlaceholder: "+49 …",
    fStreet: "Street & number",
    fStreetPlaceholder: "e.g. Beethovenstraße 24",
    fPostalCode: "Postcode",
    fPostalCodePlaceholder: "74172",
    fCity: "City",
    fCountry: "Country",
    fCountryPlaceholder: "Germany",

    aboutEyebrow: "About the club",
    aboutTitle: "Description",
    fDescription: "About the club",
    fDescriptionHint: "Internal free text. There is a separate public field below.",
    fDescriptionPlaceholder: "A few sentences about your club, your sections and your history …",

    publicEyebrow: "Public profile",
    publicTitle: "Show on the website",
    publicToggle: "Show club publicly on the website",
    publicToggleDesc:
      "While off, the club appears nowhere public. This switch is what releases it for display.",
    fPublicDescription: "Public description",
    fPublicDescriptionHint: "This text is meant for visitors — deliberately separate from the internal description.",
    fPublicDescriptionPlaceholder: "What should interested visitors learn about you?",
    fPublicImage: "Image URL (public)",
    fPublicImagePlaceholder: "https://… (optional)",
    publicNote:
      "Note: the public club directory (all released clubs as a tile overview) is a separate follow-up step. Here you only set the content and the switch.",

    smtpEyebrow: "Email delivery (SMTP)",
    smtpTitle: "Own sender",
    smtpDesc:
      "Optional: your own SMTP sender for the club's sign-up and info emails. Without it, delivery uses the platform default.",
    fHost: "SMTP server",
    fHostPlaceholder: "smtp.strato.de",
    fPort: "Port",
    fPortError: "Port must be between 1 and 65535.",
    fSmtpUser: "Username",
    fSmtpFrom: "From",
    fSmtpFromPlaceholder: "RSV Neckarsulm <noreply@rsv.de>",
    fSmtpPassword: "Password",
    smtpPasswordPlaceholder: "leave unchanged",
    smtpPasswordHint: "Leaving it empty keeps the stored password. An entry replaces it.",
    fSecure: "SSL/TLS",
    secureOn: "on",
    secureOff: "off",
    secureDesc: "Enforce an encrypted connection (recommended).",
    smtpPasswordSet: "Password stored",
    smtpPasswordUnset: "No password stored",
    smtpSave: "Save SMTP",
    smtpSaving: "Saving …",
    smtpLoadError: "SMTP settings could not be loaded",
    smtpSavedToast: "SMTP settings saved",

    bankEyebrow: "Finances",
    bankTitle: "Bank details",
    fIban: "IBAN",
    fIbanPlaceholder: "DE00 0000 0000 0000 0000 00",
    fAccountHolder: "Account holder",
    fAccountHolderPlaceholder: "Name as on the account",
    fBankName: "Bank",
    fBankNamePlaceholder: "e.g. Volksbank Neckarsulm",

    notifyEyebrow: "Notifications",
    notifyTitle: "Email alerts",
    notifyInvoices: "Fees & invoices",
    notifyInvoicesDesc: "Send payment reminders and dunning automatically.",
    notifyEvents: "Events",
    notifyEventsDesc: "Notify about invitations and changes to trainings and competitions.",
    notifyNews: "Club news",
    notifyNewsDesc: "Summarise club news by email.",

    save: "Save changes",
    saving: "Saving …",
    reset: "Discard",
    saveHintApi: "Changes are saved directly to the club.",
    saveHintMock: "Demo: bank & notifications stay local until the page is reloaded.",
    settingsNote:
      "Master data, contact, “about the club” and the public profile are stored as real club data. Bank and notifications still live in the settings object; the demo does not mirror them.",

    errNameRequired: "Please enter a club name.",
    errEmailInvalid: "Please enter a valid email address.",
    errIbanInvalid: "Please enter a valid IBAN (or leave the field empty).",
    errFoundedYear: "Please enter a year between 1800 and 2100 (or leave the field empty).",

    savedToast: "Club settings saved",
    forbiddenToast: "No permission — only the board/admin may change club data.",

    loadErrorTitle: "Settings could not be loaded",
    retry: "Try again",
    readOnlyTitle: "View only",
    readOnlyBody:
      "Only the board and admin may change club data. You can see your current master data below.",
    roEyebrow: "Master data",
    roTitle: "Club",
    roName: "Club name",
    roShortName: "Short name",
    roCity: "City",
    roDiscipline: "Discipline",
    roEmpty: "—",

    // Club logo (0060)
    logoEyebrow: "Appearance",
    logoTitle: "Club logo",
    logoHint:
      "Shows in the sidebar and the operator club list. An image (PNG, JPG, SVG …) replaces the current logo. Without a logo we show the initials.",
    logoUpload: "Upload logo",
    logoReplace: "Replace logo",
    logoRemove: "Remove",
    logoBusy: "Uploading …",
    logoTypeError: "Please choose an image file (PNG, JPG, GIF, WebP or SVG).",
    logoError: "The logo could not be saved.",
    logoAlt: "Club logo",
  },
} satisfies Dict;

export type VereinKey = keyof (typeof vereinDict)["de"];
