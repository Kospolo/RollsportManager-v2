import type { Dict } from "@/lib/i18n";

/**
 * Wörterbuch der Rechnungs-Einstellungen (Briefkopf/Fusszeile/Bank je Verein).
 * DE und EN werden IMMER gemeinsam gepflegt — deutsche Strings mit ä/ö/ü/ß.
 */
export const invoiceSettingsDict = {
  de: {
    pageTitle: "Rechnungs-Einstellungen",
    pageSub: "Briefkopf, Fußzeile und Bankverbindung für die Rechnungen des RSV Neckarsulm",
    backToFinance: "Finanzübersicht",

    retry: "Erneut versuchen",
    loadErrorTitle: "Einstellungen konnten nicht geladen werden",
    niTitle: "Noch nicht angebunden",
    niBody: "Die Rechnungs-Einstellungen haben im api-Modus noch keinen Endpoint.",
    forbidden: "Dafür fehlt dir die Berechtigung.",
    forbiddenBody:
      "Die Rechnungs-Einstellungen darf nur die Vereinsverwaltung (Vorstand/Admin/Moderation) ändern.",

    unconfiguredHint: "Noch kein Briefkopf hinterlegt — die Felder sind leer.",

    // Briefkopf
    secLetterhead: "Briefkopf",
    senderBlockLabel: "Absenderblock / Briefkopf",
    senderBlockHint: "Erscheint oben auf der Rechnung — Vereinsname, Anschrift, Kontakt (mehrzeilig).",
    logoUrlLabel: "Logo (URL oder Data-URL)",
    logoUrlHint: "Optional. Wird oben rechts auf der Rechnung angezeigt.",

    // Steuer
    secTax: "Steuer",
    taxNumberLabel: "Steuernummer",
    vatIdLabel: "USt-IdNr.",
    defaultVatLabel: "MwSt-Vorschlag für neue Positionen (%)",
    defaultVatHint: "Nur ein Vorschlag — der Satz bleibt je Position frei wählbar.",

    // Bank
    secBank: "Bankverbindung",
    bankNameLabel: "Bank",
    ibanLabel: "IBAN",
    bicLabel: "BIC",
    accountHolderLabel: "Kontoinhaber",

    // Fußzeile & Nummernkreis
    secFooter: "Fußzeile & Nummernkreis",
    boardMembersLabel: "Vorstand / Vertretungsberechtigung",
    footerLabel: "Fußzeile",
    footerHint: "Vereinsregister, Gemeinnützigkeit, Kontakt — erscheint unten auf der Rechnung.",
    numberPrefixLabel: "Nummernkreis-Präfix",
    numberPrefixHint: "Rein informativ. Die fortlaufende Rechnungsnummer vergibt das System.",

    save: "Speichern",
    saving: "Speichern …",
    savedToast: "Rechnungs-Einstellungen gespeichert.",
  },
  en: {
    pageTitle: "Invoice settings",
    pageSub: "Letterhead, footer and bank details for the invoices of RSV Neckarsulm",
    backToFinance: "Finance overview",

    retry: "Try again",
    loadErrorTitle: "Settings could not be loaded",
    niTitle: "Not connected yet",
    niBody: "The invoice settings have no endpoint in api mode yet.",
    forbidden: "You do not have permission for this.",
    forbiddenBody:
      "Only club administrators (board/admin/moderator) may change the invoice settings.",

    unconfiguredHint: "No letterhead saved yet — the fields are empty.",

    // Letterhead
    secLetterhead: "Letterhead",
    senderBlockLabel: "Sender block / letterhead",
    senderBlockHint: "Appears at the top of the invoice — club name, address, contact (multi-line).",
    logoUrlLabel: "Logo (URL or data URL)",
    logoUrlHint: "Optional. Shown top-right on the invoice.",

    // Tax
    secTax: "Tax",
    taxNumberLabel: "Tax number",
    vatIdLabel: "VAT ID",
    defaultVatLabel: "Default VAT for new line items (%)",
    defaultVatHint: "Only a suggestion — the rate stays freely selectable per line item.",

    // Bank
    secBank: "Bank details",
    bankNameLabel: "Bank",
    ibanLabel: "IBAN",
    bicLabel: "BIC",
    accountHolderLabel: "Account holder",

    // Footer & numbering
    secFooter: "Footer & numbering",
    boardMembersLabel: "Board / authorised representatives",
    footerLabel: "Footer",
    footerHint: "Register, charitable status, contact — appears at the bottom of the invoice.",
    numberPrefixLabel: "Number prefix",
    numberPrefixHint: "Informational only. The running invoice number is issued by the system.",

    save: "Save",
    saving: "Saving …",
    savedToast: "Invoice settings saved.",
  },
} satisfies Dict;
