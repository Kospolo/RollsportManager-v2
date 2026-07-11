import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Wörterbuch des Spenden-Screens /finanzen/spenden
 * (Seriositätszone). DE und EN werden IMMER gemeinsam gepflegt — deutsche
 * Strings mit echten Umlauten ä/ö/ü/ß. Zuwendungsbescheinigung = donation
 * receipt (§10b EStG).
 */
export const spendenDict = {
  de: {
    // Brotkrumen & Kopf
    back: "Zurück zu Finanzen",
    pageEyebrow: "Zuwendungen",
    pageTitle: "Spenden",
    pageSub: "{count} Spenden erfasst · {drafts} noch als Entwurf",
    newDonation: "Spende erfassen",

    // Laden & Fehler (Facade)
    retry: "Erneut versuchen",
    loadErrorTitle: "Spenden konnten nicht geladen werden",
    loadErrorBody: "Bitte versuche es gleich noch einmal.",

    // Rechte-Gate (nur can_manage_finance)
    noAccessTitle: "Kein Zugriff auf die Spendenverwaltung",
    noAccessBody:
      "Spenden und Zuwendungsbescheinigungen dürfen nur Finanzverantwortliche (Kassenwart, Vorstand) einsehen.",

    // KPI-Zeile
    kpiTotal: "Spendensumme",
    kpiTotalSub: "über alle {n} Spenden",
    kpiIssued: "Ausgestellt",
    kpiIssuedSub: "{n} Bescheinigungen",
    kpiDrafts: "Entwürfe",
    kpiDraftsSub: "noch nicht ausgestellt",
    kpiDraftsNone: "alles ausgestellt",

    // Tabelle
    tableCaption: "Spenden des RSV Neckarsulm",
    colDonor: "Spender",
    colDate: "Datum",
    colReceipt: "Beleg-Nr.",
    colAmount: "Betrag",
    colStatus: "Status",
    colAction: "Aktion",
    anonymous: "Anonyme Spende",
    linkedMember: "Verknüpftes Mitglied",
    badgeIssued: "Ausgestellt",
    badgeDraft: "Entwurf",
    viewReceipt: "Bescheinigung",
    footCount: "{n} Spenden",
    footTotal: "Summe {sum}",

    // Leere Zustände
    emptyTitle: "Noch keine Spenden erfasst",
    emptyBody:
      "Erfasse die erste Zuwendung — die Bescheinigungsnummer wird automatisch race-frei vergeben.",
    emptyCta: "Spende erfassen",

    // Erfassen-Sheet
    sheetEyebrow: "Neue Zuwendung",
    sheetTitle: "Spende erfassen",
    fMember: "Mitglied verknüpfen",
    fMemberHint: "Optional — leer lassen für eine anonyme Spende.",
    fMemberAnon: "Keine Verknüpfung (anonym)",
    fDonor: "Spendername",
    fDonorPlaceholder: "Vor- und Nachname oder Organisation",
    fAddress: "Anschrift",
    fAddressPlaceholder: "Straße, PLZ Ort",
    fAddressHint: "Erscheint auf der Zuwendungsbescheinigung.",
    fAmount: "Betrag",
    fAmountHint: "In Euro, z. B. 50,00",
    fDate: "Spendendatum",
    fPurpose: "Zweck",
    fPurposePlaceholder: "z. B. Nachwuchsförderung",
    fPurposeHint: "Optional.",
    errDonor: "Bitte gib den Namen der spendenden Person oder Organisation an.",
    errAmount: "Bitte gib einen Betrag größer als 0 an.",
    errDate: "Bitte wähle ein gültiges Datum (nicht in der Zukunft).",
    cancel: "Abbrechen",
    create: "Spende erfassen",
    createdToast: "Spende erfasst — Beleg-Nr. {number} vergeben.",
    forbidden: "Dafür fehlt dir die Berechtigung.",
    sheetGobd:
      "Erst das Ausstellen macht die Bescheinigung gültig — danach ist die Spende eingefroren (GoBD).",

    // Bescheinigungs-Modal
    receiptEyebrow: "Zuwendungsbescheinigung",
    receiptTitle: "Bescheinigung {number}",
    receiptLoadError: "Die Bescheinigung konnte nicht geladen werden.",
    receiptIssuer: "Aussteller",
    receiptDonor: "Zuwendender",
    receiptAmount: "Betrag der Zuwendung",
    receiptDate: "Tag der Zuwendung",
    receiptPurpose: "Zweck",
    receiptStatusIssued: "Ausgestellt",
    receiptStatusDraft: "Entwurf — noch nicht ausgestellt",
    receiptDraftNotice:
      "Entwurf: Diese Bescheinigung ist noch nicht ausgestellt. Erst das Ausstellen macht sie gültig und friert die Spende ein.",
    receiptSignatureCity: "Ort, Datum",
    receiptSignatureLabel: "Unterschrift / Vereinsstempel",
    receiptPrint: "Drucken",
    receiptIssue: "Als ausgestellt markieren",
    receiptClose: "Schließen",
    issuedToast: "Bescheinigung {number} ausgestellt — jetzt eingefroren (GoBD).",
    alreadyIssued: "Diese Bescheinigung wurde bereits ausgestellt.",
  },
  en: {
    // Breadcrumb & head
    back: "Back to finances",
    pageEyebrow: "Donations",
    pageTitle: "Donations",
    pageSub: "{count} donations recorded · {drafts} still draft",
    newDonation: "Record donation",

    // Loading & errors (facade)
    retry: "Try again",
    loadErrorTitle: "Donations could not be loaded",
    loadErrorBody: "Please try again in a moment.",

    // Permission gate (can_manage_finance only)
    noAccessTitle: "No access to donation management",
    noAccessBody:
      "Only finance officers (treasurer, board) may view donations and donation receipts.",

    // KPI row
    kpiTotal: "Total donated",
    kpiTotalSub: "across all {n} donations",
    kpiIssued: "Issued",
    kpiIssuedSub: "{n} receipts",
    kpiDrafts: "Drafts",
    kpiDraftsSub: "not yet issued",
    kpiDraftsNone: "all issued",

    // Table
    tableCaption: "Donations of RSV Neckarsulm",
    colDonor: "Donor",
    colDate: "Date",
    colReceipt: "Receipt no.",
    colAmount: "Amount",
    colStatus: "Status",
    colAction: "Action",
    anonymous: "Anonymous donation",
    linkedMember: "Linked member",
    badgeIssued: "Issued",
    badgeDraft: "Draft",
    viewReceipt: "Receipt",
    footCount: "{n} donations",
    footTotal: "Total {sum}",

    // Empty states
    emptyTitle: "No donations recorded yet",
    emptyBody:
      "Record the first donation — the receipt number is assigned automatically and race-free.",
    emptyCta: "Record donation",

    // Record sheet
    sheetEyebrow: "New donation",
    sheetTitle: "Record donation",
    fMember: "Link member",
    fMemberHint: "Optional — leave empty for an anonymous donation.",
    fMemberAnon: "No link (anonymous)",
    fDonor: "Donor name",
    fDonorPlaceholder: "First and last name or organisation",
    fAddress: "Address",
    fAddressPlaceholder: "Street, postcode city",
    fAddressHint: "Appears on the donation receipt.",
    fAmount: "Amount",
    fAmountHint: "In euros, e.g. 50.00",
    fDate: "Donation date",
    fPurpose: "Purpose",
    fPurposePlaceholder: "e.g. youth development",
    fPurposeHint: "Optional.",
    errDonor: "Please enter the name of the donating person or organisation.",
    errAmount: "Please enter an amount greater than 0.",
    errDate: "Please choose a valid date (not in the future).",
    cancel: "Cancel",
    create: "Record donation",
    createdToast: "Donation recorded — receipt no. {number} assigned.",
    forbidden: "You do not have permission for this.",
    sheetGobd:
      "Issuing makes the receipt valid — after that the donation is frozen (GoBD compliance).",

    // Receipt modal
    receiptEyebrow: "Donation receipt",
    receiptTitle: "Receipt {number}",
    receiptLoadError: "The receipt could not be loaded.",
    receiptIssuer: "Issuer",
    receiptDonor: "Donor",
    receiptAmount: "Donation amount",
    receiptDate: "Date of donation",
    receiptPurpose: "Purpose",
    receiptStatusIssued: "Issued",
    receiptStatusDraft: "Draft — not yet issued",
    receiptDraftNotice:
      "Draft: this receipt has not been issued yet. Issuing makes it valid and freezes the donation.",
    receiptSignatureCity: "Place, date",
    receiptSignatureLabel: "Signature / club stamp",
    receiptPrint: "Print",
    receiptIssue: "Mark as issued",
    receiptClose: "Close",
    issuedToast: "Receipt {number} issued — now frozen (GoBD).",
    alreadyIssued: "This receipt has already been issued.",
  },
} satisfies Dict;

export type SpendenKey = keyof (typeof spendenDict)["de"];
