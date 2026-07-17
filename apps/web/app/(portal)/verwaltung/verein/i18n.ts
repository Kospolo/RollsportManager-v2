import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Vereins-Einstellungen (Verwaltung → Verein).
 * Regel: JEDER String in beiden Sprachen, deutsche Strings mit echten
 * Umlauten (ä/ö/ü/ß).
 */
export const vereinDict = {
  de: {
    title: "Vereins-Einstellungen",
    sub: "Stammdaten, Kontakt, Bankverbindung und Benachrichtigungen deines Vereins",

    // Kern-Stammdaten
    coreEyebrow: "Stammdaten",
    coreTitle: "Verein",
    fName: "Vereinsname",
    fNameHint: "Erscheint in Kopfzeilen, Rechnungen und Einladungen.",
    fShortName: "Kürzel",
    fShortNameHint: "Kurzform, z. B. „RSV NSU“.",
    fCity: "Ort",
    fDiscipline: "Disziplin",
    fDisciplinePlaceholder: "z. B. Rollkunstlauf",

    // Kontakt
    contactEyebrow: "Kontakt",
    contactTitle: "Erreichbarkeit",
    fEmail: "Kontakt-E-Mail",
    fEmailPlaceholder: "vorstand@verein.de",
    fPhone: "Telefon",
    fPhonePlaceholder: "+49 …",
    fAddress: "Anschrift",
    fAddressPlaceholder: "Straße, PLZ, Ort",

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
    saveHintMock: "Demo: Kern-Stammdaten bleiben lokal, bis die Seite neu geladen wird.",
    settingsNote:
      "Kontakt, Bank und Benachrichtigungen gehen als Vereins-Einstellungen an den Server; in der Demo werden nur Name, Kürzel, Ort und Disziplin gespiegelt.",

    // Validierung
    errNameRequired: "Bitte einen Vereinsnamen angeben.",
    errEmailInvalid: "Bitte eine gültige E-Mail-Adresse angeben.",
    errIbanInvalid: "Bitte eine gültige IBAN angeben (oder Feld leer lassen).",

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
    sub: "Master data, contact, bank details and notifications for your club",

    coreEyebrow: "Master data",
    coreTitle: "Club",
    fName: "Club name",
    fNameHint: "Shown in headers, invoices and invitations.",
    fShortName: "Short name",
    fShortNameHint: "Short form, e.g. “RSV NSU”.",
    fCity: "City",
    fDiscipline: "Discipline",
    fDisciplinePlaceholder: "e.g. artistic roller skating",

    contactEyebrow: "Contact",
    contactTitle: "How to reach you",
    fEmail: "Contact email",
    fEmailPlaceholder: "board@club.org",
    fPhone: "Phone",
    fPhonePlaceholder: "+49 …",
    fAddress: "Address",
    fAddressPlaceholder: "Street, postcode, city",

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
    saveHintMock: "Demo: master data stays local until the page is reloaded.",
    settingsNote:
      "Contact, bank and notifications are sent to the server as club settings; the demo only mirrors name, short name, city and discipline.",

    errNameRequired: "Please enter a club name.",
    errEmailInvalid: "Please enter a valid email address.",
    errIbanInvalid: "Please enter a valid IBAN (or leave the field empty).",

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
