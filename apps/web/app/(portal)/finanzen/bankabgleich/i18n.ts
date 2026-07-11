import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Wörterbuch des Bankabgleich-Screens (/finanzen/bankabgleich,
 * Seriositätszone). DE und EN werden IMMER gemeinsam gepflegt — deutsche
 * Strings mit echten ä/ö/ü/ß. Ein Dict für den ganzen Bereich (Client +
 * Zuordnen-Sheet + Erfassen-Sheet + Import-Sheet + Ignorieren-Dialog).
 *
 * GoBD-Ton: Umsätze werden nicht gelöscht — „ignorieren" setzt sie nur
 * beiseite; die Zuordnung bucht eine offene Rechnung bezahlt + Kassenbuch-
 * Einnahme. Sichtbar nur für can_manage_finance.
 */
export const bankabgleichDict = {
  de: {
    // Seitenkopf
    pageEyebrow: "Bankabgleich",
    pageTitle: "Bankabgleich",
    pageSub: "{done} von {total} Umsätzen zugeordnet · {ignored} ignoriert",
    back: "Zurück zu Finanzen",
    addEntry: "Umsatz erfassen",
    import: "Importieren",

    // Laden / Fehler / Rechte
    retry: "Erneut versuchen",
    loadErrorTitle: "Bankabgleich konnte nicht geladen werden",
    noAccessTitle: "Kein Zugriff auf den Bankabgleich",
    noAccessBody:
      "Den Bankabgleich sehen nur Kassenwart:in und Vorstand. Wende dich an die Vereinsleitung, wenn du Einsicht brauchst.",

    // Fortschritt
    progressEyebrow: "Fortschritt",
    progressHeadline: "{done} von {total}",
    progressCaption: "Umsätze einer offenen Rechnung zugeordnet",
    progressBarLabel: "{done} von {total} Umsätzen zugeordnet",
    progressPending: "{n} offen",
    progressIgnored: "{n} ignoriert",
    progressAllDone: "Alle Umsätze bearbeitet — nichts mehr offen.",
    progressNone: "Noch keine Umsätze zum Abgleichen.",

    // Filter
    filterStatus: "Status",
    statusAll: "Alle",
    statusUnmatched: "Offen",
    statusMatched: "Zugeordnet",
    statusIgnored: "Ignoriert",

    // Tabelle
    tableCaption: "Bankumsätze des Vereins — Datum, Betrag, Zweck, Gegenpartei und Status",
    colDate: "Datum",
    colAmount: "Betrag",
    colPurpose: "Verwendungszweck",
    colCounterparty: "Gegenpartei",
    colStatus: "Status",
    colAction: "Aktion",
    badgeUnmatched: "Offen",
    badgeMatched: "Zugeordnet",
    badgeIgnored: "Ignoriert",
    matchedInvoice: "Rechnung {number}",
    noPurpose: "Ohne Verwendungszweck",
    noCounterparty: "Unbekannt",
    matchAction: "Zuordnen",
    rematchAction: "Ändern",
    ignoreAction: "Ignorieren",
    footCount: "{n} Umsätze",
    footHint: "GoBD: Umsätze werden nicht gelöscht — nur zugeordnet oder ignoriert.",

    // Leere Zustände
    emptyTitle: "Noch keine Bankumsätze",
    emptyBody:
      "Importiere einen Kontoauszug oder erfasse einen Umsatz von Hand — danach ordnest du hier Zahlungen offenen Rechnungen zu.",
    emptyCtaImport: "Umsätze importieren",
    emptyCtaAdd: "Umsatz erfassen",
    emptyFilterTitle: "Keine Umsätze im Filter",
    emptyFilterBody: "Für diesen Status gibt es gerade keine Umsätze.",
    emptyFilterCta: "Filter zurücksetzen",

    // Toasts / Fehler
    matchToast: "Umsatz der Rechnung {number} zugeordnet.",
    matchPaidToast: "Rechnung {number} zugeordnet, bezahlt gebucht und ins Kassenbuch übernommen.",
    ignoreToast: "Umsatz ignoriert — bleibt über den Filter einsehbar.",
    createToast: "Umsatz erfasst — {amount}.",
    importToast: "{n} Umsätze importiert.",
    forbidden: "Dafür fehlt dir die Berechtigung.",
    errIgnored: "Ein ignorierter Umsatz lässt sich nicht zuordnen.",
    errOtherClub: "Diese Rechnung gehört zu einem anderen Verein.",
    errAlreadyMatched: "Ein zugeordneter Umsatz lässt sich nicht ignorieren.",

    // Umsatz erfassen (Sheet)
    meEyebrow: "Neuer Umsatz",
    meTitle: "Umsatz erfassen",
    fDate: "Buchungsdatum",
    fDirection: "Art des Umsatzes",
    dirIn: "Eingang",
    dirOut: "Ausgang",
    fAmount: "Betrag",
    fAmountHint: "In Euro, z. B. 86,00 — das Vorzeichen setzt die Art oben.",
    fPurpose: "Verwendungszweck",
    fPurposePlaceholder: "z. B. Vereinsbeitrag Q2, Hallenmiete Juni …",
    fCounterparty: "Gegenpartei",
    fCounterpartyPlaceholder: "z. B. Familie Grünewald, Stadt Neckarsulm …",
    errDate: "Bitte ein gültiges Datum wählen (nicht in der Zukunft).",
    errAmount: "Bitte einen Betrag größer als 0 eingeben.",
    meGobd: "Bankumsätze werden append-only gespeichert (GoBD).",
    cancel: "Abbrechen",
    createBtn: "Umsatz speichern",

    // Umsatz zuordnen (Sheet)
    matchEyebrow: "Bankabgleich",
    matchTitle: "Umsatz zuordnen",
    matchTxLabel: "Kontoumsatz",
    matchPickLabel: "Offene Rechnung wählen",
    suggestionLabel: "Vorschlag",
    confidenceHigh: "Sichere Übereinstimmung",
    confidenceMedium: "Betrag stimmt",
    confidenceLow: "Namensfund",
    amountDiff: "Betrag weicht ab",
    noOpenInvoices: "Es gibt derzeit keine offenen Rechnungen, denen du diesen Umsatz zuordnen könntest.",
    postToLedgerLabel: "Als bezahlt buchen & Kassenbuch-Einnahme",
    postToLedgerHint:
      "Setzt eine noch offene Rechnung auf bezahlt und bucht eine Einnahme ins Kassenbuch. Ist die Rechnung schon bezahlt, wird nur verknüpft.",
    categoryLabel: "Kategorie der Einnahme (optional)",
    categoryNone: "Ohne Kategorie",
    errPickInvoice: "Bitte eine Rechnung wählen.",
    matchConfirm: "Zuordnen",

    // Umsatz ignorieren (Dialog)
    ignoreEyebrow: "Bankabgleich",
    ignoreTitle: "Umsatz ignorieren",
    ignoreIntro:
      "Ignorierte Umsätze bleiben erhalten (GoBD), erscheinen aber nicht mehr in der offenen Zuordnung. Du kannst sie jederzeit über den Filter „Ignoriert“ wieder einsehen.",
    ignoreNoteLabel: "Notiz (optional)",
    ignoreNotePlaceholder: "z. B. Kontoführungsgebühr — kein Vereinsvorgang.",
    ignoreConfirm: "Ignorieren",

    // Umsätze importieren (Sheet)
    importEyebrow: "Bankabgleich",
    importTitle: "Umsätze importieren",
    importIntro:
      "Füge Zeilen aus deinem Kontoauszug ein oder wähle eine CSV-Datei. Jede Zeile wird als offener Umsatz importiert.",
    importPasteLabel: "CSV einfügen",
    importPastePlaceholder: "2026-06-15;86,00;Vereinsbeitrag Q2;Familie Grünewald\n15.06.2026;-680,00;Hallenmiete Juni;Stadt Neckarsulm",
    importFileLabel: "… oder Datei wählen",
    importFormatHint:
      "Spalten: Datum; Betrag; Zweck; Gegenpartei. Datum TT.MM.JJJJ oder JJJJ-MM-TT, Betrag mit Vorzeichen (Eingang +, Ausgang −). Trennzeichen ; , oder Tab.",
    importPreviewValid: "{n} gültige Zeilen · Summe {sum}",
    importPreviewErrors: "{n} Zeilen übersprungen",
    importErrorLine: "Zeile {line}: {reason}",
    reasonColumns: "zu wenige Spalten",
    reasonDate: "ungültiges Datum",
    reasonAmount: "ungültiger Betrag",
    importEmpty: "Noch nichts eingefügt.",
    importNothing: "Keine gültigen Zeilen zum Importieren.",
    importConfirm: "{n} importieren",
  },
  en: {
    // Page head
    pageEyebrow: "Bank reconciliation",
    pageTitle: "Bank reconciliation",
    pageSub: "{done} of {total} transactions matched · {ignored} ignored",
    back: "Back to finances",
    addEntry: "Add transaction",
    import: "Import",

    // Loading / errors / permissions
    retry: "Try again",
    loadErrorTitle: "Bank reconciliation could not be loaded",
    noAccessTitle: "No access to bank reconciliation",
    noAccessBody:
      "Only the treasurer and the board can see bank reconciliation. Talk to the club leadership if you need access.",

    // Progress
    progressEyebrow: "Progress",
    progressHeadline: "{done} of {total}",
    progressCaption: "transactions matched to an open invoice",
    progressBarLabel: "{done} of {total} transactions matched",
    progressPending: "{n} open",
    progressIgnored: "{n} ignored",
    progressAllDone: "All transactions handled — nothing left open.",
    progressNone: "No transactions to reconcile yet.",

    // Filter
    filterStatus: "Status",
    statusAll: "All",
    statusUnmatched: "Open",
    statusMatched: "Matched",
    statusIgnored: "Ignored",

    // Table
    tableCaption: "Club bank transactions — date, amount, purpose, counterparty and status",
    colDate: "Date",
    colAmount: "Amount",
    colPurpose: "Purpose",
    colCounterparty: "Counterparty",
    colStatus: "Status",
    colAction: "Action",
    badgeUnmatched: "Open",
    badgeMatched: "Matched",
    badgeIgnored: "Ignored",
    matchedInvoice: "Invoice {number}",
    noPurpose: "No purpose",
    noCounterparty: "Unknown",
    matchAction: "Match",
    rematchAction: "Change",
    ignoreAction: "Ignore",
    footCount: "{n} transactions",
    footHint: "GoBD: transactions are never deleted — only matched or ignored.",

    // Empty states
    emptyTitle: "No bank transactions yet",
    emptyBody:
      "Import a bank statement or add a transaction by hand — then match payments to open invoices here.",
    emptyCtaImport: "Import transactions",
    emptyCtaAdd: "Add transaction",
    emptyFilterTitle: "No transactions in this filter",
    emptyFilterBody: "There are no transactions for this status right now.",
    emptyFilterCta: "Reset filter",

    // Toasts / errors
    matchToast: "Transaction matched to invoice {number}.",
    matchPaidToast: "Invoice {number} matched, marked paid and posted to the cash book.",
    ignoreToast: "Transaction ignored — still visible via the filter.",
    createToast: "Transaction recorded — {amount}.",
    importToast: "{n} transactions imported.",
    forbidden: "You do not have permission for this.",
    errIgnored: "An ignored transaction cannot be matched.",
    errOtherClub: "This invoice belongs to a different club.",
    errAlreadyMatched: "A matched transaction cannot be ignored.",

    // Add transaction (sheet)
    meEyebrow: "New transaction",
    meTitle: "Add transaction",
    fDate: "Booking date",
    fDirection: "Type of transaction",
    dirIn: "Incoming",
    dirOut: "Outgoing",
    fAmount: "Amount",
    fAmountHint: "In euros, e.g. 86.00 — the sign is set by the type above.",
    fPurpose: "Purpose",
    fPurposePlaceholder: "e.g. membership fee Q2, hall rent June …",
    fCounterparty: "Counterparty",
    fCounterpartyPlaceholder: "e.g. Grünewald family, City of Neckarsulm …",
    errDate: "Please choose a valid date (not in the future).",
    errAmount: "Please enter an amount greater than 0.",
    meGobd: "Bank transactions are stored append-only (GoBD).",
    cancel: "Cancel",
    createBtn: "Save transaction",

    // Match transaction (sheet)
    matchEyebrow: "Bank reconciliation",
    matchTitle: "Match transaction",
    matchTxLabel: "Bank transaction",
    matchPickLabel: "Choose open invoice",
    suggestionLabel: "Suggestion",
    confidenceHigh: "Strong match",
    confidenceMedium: "Amount matches",
    confidenceLow: "Name match",
    amountDiff: "Amount differs",
    noOpenInvoices: "There are currently no open invoices you could match this transaction to.",
    postToLedgerLabel: "Mark paid & post cash-book income",
    postToLedgerHint:
      "Marks a still-open invoice as paid and posts income to the cash book. If the invoice is already paid, it is only linked.",
    categoryLabel: "Income category (optional)",
    categoryNone: "Without category",
    errPickInvoice: "Please choose an invoice.",
    matchConfirm: "Match",

    // Ignore transaction (dialog)
    ignoreEyebrow: "Bank reconciliation",
    ignoreTitle: "Ignore transaction",
    ignoreIntro:
      "Ignored transactions are kept (GoBD) but no longer appear in open matching. You can review them any time via the “Ignored” filter.",
    ignoreNoteLabel: "Note (optional)",
    ignoreNotePlaceholder: "e.g. account fee — not a club matter.",
    ignoreConfirm: "Ignore",

    // Import transactions (sheet)
    importEyebrow: "Bank reconciliation",
    importTitle: "Import transactions",
    importIntro:
      "Paste rows from your bank statement or choose a CSV file. Each row is imported as an open transaction.",
    importPasteLabel: "Paste CSV",
    importPastePlaceholder: "2026-06-15;86.00;Membership fee Q2;Grünewald family\n15.06.2026;-680.00;Hall rent June;City of Neckarsulm",
    importFileLabel: "… or choose a file",
    importFormatHint:
      "Columns: date; amount; purpose; counterparty. Date DD.MM.YYYY or YYYY-MM-DD, amount with sign (incoming +, outgoing −). Delimiter ; , or tab.",
    importPreviewValid: "{n} valid rows · total {sum}",
    importPreviewErrors: "{n} rows skipped",
    importErrorLine: "Line {line}: {reason}",
    reasonColumns: "too few columns",
    reasonDate: "invalid date",
    reasonAmount: "invalid amount",
    importEmpty: "Nothing pasted yet.",
    importNothing: "No valid rows to import.",
    importConfirm: "Import {n}",
  },
} satisfies Dict;
