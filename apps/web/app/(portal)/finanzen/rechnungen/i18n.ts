import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Wörterbuch des Rechnungs-Screens (Seriositätszone).
 * DE und EN werden IMMER gemeinsam gepflegt — deutsche Strings mit ä/ö/ü/ß.
 */
export const invoicesDict = {
  de: {
    // Seitenkopf
    pageTitle: "Rechnungen",
    pageSub: "Beiträge, Meldegebühren und Anzahlungen des RSV Neckarsulm",
    backToFinance: "Finanzübersicht",
    createInvoice: "Rechnung erstellen",

    // Laden & Fehler (Facade)
    retry: "Erneut versuchen",
    loadErrorTitle: "Rechnungen konnten nicht geladen werden",
    niTitle: "Noch nicht angebunden",
    niBody: "Der Rechnungsbereich hat im api-Modus noch keinen Endpoint.",
    forbidden: "Dafür fehlt dir die Berechtigung.",
    forbiddenBody:
      "Rechnungen darf nur die Finanzverwaltung (Kassenwart, Moderation, Admin, Vorstand) einsehen.",

    // Suche & Filter
    searchLabel: "Nach Mitglied suchen",
    searchPlaceholder: "Mitglied suchen …",
    filterLabel: "Rechnungen nach Status filtern",
    fAll: "Alle",
    statusDraft: "Entwurf",
    statusOpen: "Offen",
    statusPaid: "Bezahlt",
    statusPartiallyPaid: "Teilbezahlt",
    statusCancelled: "Storniert",

    // Tabelle
    colNumber: "Nr.",
    colMember: "Mitglied",
    colAmount: "Betrag",
    colDue: "Fällig",
    colStatus: "Status",
    colDunning: "Mahnstufe",
    colOpen: "Rechnung öffnen",
    openInvoice: "Rechnung {number} öffnen",
    tableCaption: "Rechnungen des RSV Neckarsulm",
    noDunning: "—",
    unknownMember: "Unbekanntes Mitglied",
    footShown: "Angezeigt: {shown} von {total}",
    footSumLabel: "Summe angezeigt:",
    emptyTitle: "Keine Rechnungen gefunden",
    emptyBody: "In dieser Auswahl gibt es gerade keine Rechnung.",
    emptyReset: "Filter zurücksetzen",

    // Detail-Sheet
    detEyebrow: "Rechnung",
    detRecipient: "Empfänger",
    detIssued: "Ausgestellt",
    detDue: "Fällig",
    detPaidAt: "Bezahlt am",
    detPaidVia: "Zahlweg",
    posTitle: "Positionen",
    posColDesc: "Beschreibung",
    posColAmount: "Betrag",
    posTotal: "Gesamtbetrag",
    histTitle: "Verlauf",
    histIssued: "Rechnung ausgestellt",
    histOpened: "Offen gestellt — versandbereit",
    histReminder: "Zahlungserinnerung (Stufe {stage})",
    histDunning: "Mahnung (Stufe {stage})",
    histHandover: "Übergabe an den Vorstand (Stufe {stage})",
    histPaid: "Bezahlt{via}",
    histPaidVia: " · {via}",
    histCancelled: "Storniert",
    histLoading: "Verlauf wird geladen …",
    histEmpty: "Noch keine Mahn-Einträge.",

    // EPC-QR-Hinweis
    epcTitle: "Bezahlen per EPC-QR",
    epcBody:
      "Die Zahlungserinnerung an das Mitglied enthält einen EPC-QR-Code (Giro-Code). Einmal mit der Banking-App scannen — Empfänger, IBAN, Betrag und Verwendungszweck sind vorausgefüllt.",

    // Aktionen
    actionMarkPaid: "Als bezahlt markieren",
    actionCancel: "Stornieren",
    terminalPaid: "Diese Rechnung ist bezahlt und abgeschlossen (GoBD — kein Re-Open).",
    terminalCancelled: "Diese Rechnung ist storniert (GoBD — kein Re-Open).",

    // Bezahlt-markieren (Settle)
    settleTitle: "Rechnung als bezahlt markieren",
    settleVia: "Zahlweg",
    viaSepa: "SEPA-Lastschrift",
    viaTransfer: "Überweisung",
    viaCash: "Bar",
    viaPaypal: "PayPal",
    viaOther: "Sonstiges",
    settlePostLabel: "Als Einnahme ins Kassenbuch buchen",
    settleCategory: "Kassenbuch-Kategorie",
    categoryNone: "Ohne Kategorie",
    settleConfirm: "Bezahlt buchen",
    settleBack: "Abbrechen",
    settleToast: "{number} als bezahlt markiert.",
    settleNotOpen: "Nur offene Rechnungen können als bezahlt markiert werden.",

    // Stornieren (Cancel)
    cancelTitle: "Rechnung stornieren?",
    cancelWarning:
      "Stornieren ist endgültig (GoBD) — die Rechnung lässt sich danach nicht wieder öffnen. Es wird nichts gelöscht, der Vorgang bleibt im Verlauf.",
    cancelConfirm: "Endgültig stornieren",
    cancelBack: "Zurück",
    cancelToast: "{number} storniert.",
    cancelNotAllowed: "Nur Entwürfe und offene Rechnungen können storniert werden.",

    // Rechnung erstellen (Create)
    createEyebrow: "Neue Rechnung",
    createTitle: "Rechnung erstellen",
    cMember: "Mitglied",
    cMemberPlaceholder: "Mitglied wählen …",
    cMemberError: "Bitte ein Mitglied wählen.",
    cTitle: "Zweck",
    cTitlePlaceholder: "z. B. Vereinsbeitrag Q3",
    cTitleError: "Bitte einen Zweck angeben.",
    cAmount: "Betrag",
    cAmountPlaceholder: "0,00",
    cAmountHint: "Bruttobetrag in Euro.",
    cAmountError: "Bitte einen Betrag größer als 0 angeben.",
    cDue: "Fälligkeit",
    cDueHint: "Optional — leer = sofort fällig.",
    cIssueLabel: "Sofort offen stellen",
    cIssueHint: "An = versandbereit (Status „Offen“). Aus = als Entwurf ablegen.",
    cIssueOn: "Offen",
    cIssueOff: "Entwurf",
    cSubmit: "Rechnung anlegen",
    cCancel: "Abbrechen",
    createToastOpen: "Rechnung {number} angelegt und offen gestellt.",
    createToastDraft: "Entwurf {number} angelegt — noch nichts versendet.",
  },
  en: {
    // Page head
    pageTitle: "Invoices",
    pageSub: "Fees, entry charges and deposits of RSV Neckarsulm",
    backToFinance: "Finance overview",
    createInvoice: "Create invoice",

    // Loading & errors (facade)
    retry: "Try again",
    loadErrorTitle: "Invoices could not be loaded",
    niTitle: "Not connected yet",
    niBody: "The invoice area has no endpoint in api mode yet.",
    forbidden: "You do not have permission for this.",
    forbiddenBody:
      "Invoices are visible only to finance managers (treasurer, moderator, admin, owner).",

    // Search & filter
    searchLabel: "Search by member",
    searchPlaceholder: "Search member …",
    filterLabel: "Filter invoices by status",
    fAll: "All",
    statusDraft: "Draft",
    statusOpen: "Open",
    statusPaid: "Paid",
    statusPartiallyPaid: "Partially paid",
    statusCancelled: "Cancelled",

    // Table
    colNumber: "No.",
    colMember: "Member",
    colAmount: "Amount",
    colDue: "Due",
    colStatus: "Status",
    colDunning: "Dunning",
    colOpen: "Open invoice",
    openInvoice: "Open invoice {number}",
    tableCaption: "Invoices of RSV Neckarsulm",
    noDunning: "—",
    unknownMember: "Unknown member",
    footShown: "Shown: {shown} of {total}",
    footSumLabel: "Total shown:",
    emptyTitle: "No invoices found",
    emptyBody: "There is no invoice in this selection right now.",
    emptyReset: "Reset filters",

    // Detail sheet
    detEyebrow: "Invoice",
    detRecipient: "Recipient",
    detIssued: "Issued",
    detDue: "Due",
    detPaidAt: "Paid on",
    detPaidVia: "Paid via",
    posTitle: "Positions",
    posColDesc: "Description",
    posColAmount: "Amount",
    posTotal: "Total",
    histTitle: "History",
    histIssued: "Invoice issued",
    histOpened: "Issued as open — ready to send",
    histReminder: "Payment reminder (stage {stage})",
    histDunning: "Dunning notice (stage {stage})",
    histHandover: "Handover to the board (stage {stage})",
    histPaid: "Paid{via}",
    histPaidVia: " · {via}",
    histCancelled: "Cancelled",
    histLoading: "Loading history …",
    histEmpty: "No dunning entries yet.",

    // EPC-QR hint
    epcTitle: "Pay via EPC QR",
    epcBody:
      "The payment reminder to the member contains an EPC QR code (Giro-Code). Scan it once with a banking app — payee, IBAN, amount and reference are prefilled.",

    // Actions
    actionMarkPaid: "Mark as paid",
    actionCancel: "Cancel invoice",
    terminalPaid: "This invoice is paid and closed (GoBD — no re-open).",
    terminalCancelled: "This invoice is cancelled (GoBD — no re-open).",

    // Mark as paid (settle)
    settleTitle: "Mark invoice as paid",
    settleVia: "Payment method",
    viaSepa: "SEPA direct debit",
    viaTransfer: "Bank transfer",
    viaCash: "Cash",
    viaPaypal: "PayPal",
    viaOther: "Other",
    settlePostLabel: "Post as income to the cash book",
    settleCategory: "Cash book category",
    categoryNone: "No category",
    settleConfirm: "Book as paid",
    settleBack: "Cancel",
    settleToast: "{number} marked as paid.",
    settleNotOpen: "Only open invoices can be marked as paid.",

    // Cancel invoice
    cancelTitle: "Cancel this invoice?",
    cancelWarning:
      "Cancelling is final (GoBD) — the invoice cannot be reopened afterwards. Nothing is deleted; the action stays in the history.",
    cancelConfirm: "Cancel for good",
    cancelBack: "Back",
    cancelToast: "{number} cancelled.",
    cancelNotAllowed: "Only drafts and open invoices can be cancelled.",

    // Create invoice
    createEyebrow: "New invoice",
    createTitle: "Create invoice",
    cMember: "Member",
    cMemberPlaceholder: "Choose member …",
    cMemberError: "Please choose a member.",
    cTitle: "Purpose",
    cTitlePlaceholder: "e.g. membership fee Q3",
    cTitleError: "Please enter a purpose.",
    cAmount: "Amount",
    cAmountPlaceholder: "0.00",
    cAmountHint: "Gross amount in euros.",
    cAmountError: "Please enter an amount greater than 0.",
    cDue: "Due date",
    cDueHint: "Optional — empty = due immediately.",
    cIssueLabel: "Issue as open right away",
    cIssueHint: "On = ready to send (status “Open”). Off = keep as draft.",
    cIssueOn: "Open",
    cIssueOff: "Draft",
    cSubmit: "Create invoice",
    cCancel: "Cancel",
    createToastOpen: "Invoice {number} created and issued as open.",
    createToastDraft: "Draft {number} created — nothing sent yet.",
  },
} satisfies Dict;
