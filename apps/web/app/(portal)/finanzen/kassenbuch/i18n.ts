import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Wörterbuch des Kassenbuch-Screens (/finanzen/kassenbuch,
 * Seriositätszone). DE und EN werden IMMER gemeinsam gepflegt — deutsche
 * Strings mit echten ä/ö/ü/ß. Ein Dict für den ganzen Bereich (Client +
 * Buchungs-Sheet + Kategorien-/Storno-Dialog), analog financeDict.
 *
 * GoBD-Ton: Buchungen sind append-only, Korrektur nur per Storno
 * (Gegenbuchung) — nie Löschen/Bearbeiten. Sichtbar nur für can_manage_finance.
 */
export const kassenbuchDict = {
  de: {
    // Seitenkopf
    pageEyebrow: "Kassenbuch",
    pageTitle: "Kassenbuch",
    pageSub: "Kassenstand {balance} · {n} Buchungen",
    back: "Zurück zu Finanzen",
    balanceLabel: "Kassenstand",
    addEntry: "Buchung erfassen",
    manageCategories: "Kategorien",
    export: "Exportieren",
    exportToast: "Kassenbuch exportiert — GoBD-konformes CSV mit {n} Buchungen.",

    // Laden / Fehler / Rechte
    retry: "Erneut versuchen",
    loadErrorTitle: "Kassenbuch konnte nicht geladen werden",
    noAccessTitle: "Kein Zugriff auf das Kassenbuch",
    noAccessBody:
      "Das Kassenbuch sehen nur Kassenwart:in und Vorstand. Wende dich an die Vereinsleitung, wenn du Einsicht brauchst.",

    // Filter-Leiste
    filterCategory: "Kategorie",
    allCategories: "Alle Kategorien",
    noCategory: "Ohne Kategorie",
    filterPeriod: "Zeitraum",
    periodAll: "Gesamter Zeitraum",
    period30: "Letzte 30 Tage",
    periodMonth: "Dieser Monat",
    periodYear: "Dieses Jahr",

    // Tabelle
    tableCaption: "Kassenbuch des Vereins — alle Buchungen mit laufendem Saldo",
    colDate: "Datum",
    colEntry: "Buchung",
    colCategory: "Kategorie",
    colAmount: "Betrag",
    colBalance: "Saldo",
    colAction: "Aktion",
    income: "Einnahme",
    expense: "Ausgabe",
    linkedInvoice: "Rechnung {number} · automatisch zugeordnet",
    reversalOf: "Storno der Buchung",
    badgeReversed: "storniert",
    badgeReversal: "Storno",
    reverseAction: "Stornieren",
    correctAction: "Korrigieren",

    // Summenzeile
    footCount: "{n} Buchungen",
    footIncome: "Einnahmen {sum}",
    footExpense: "Ausgaben {sum}",
    footNet: "Netto",
    footHint: "GoBD: Buchungen sind unveränderlich — Korrektur nur per Storno.",

    // Leere Zustände
    emptyTitle: "Noch keine Buchungen",
    emptyBody:
      "Sobald du die erste Einnahme oder Ausgabe erfasst, erscheint sie hier mit laufendem Saldo.",
    emptyCta: "Erste Buchung erfassen",
    emptyFilterTitle: "Keine Buchungen im Filter",
    emptyFilterBody:
      "Für diese Kategorie und diesen Zeitraum gibt es keine Buchungen.",
    emptyFilterCta: "Filter zurücksetzen",

    // Toasts
    entryCreatedToast: "Buchung erfasst — {desc} über {amount}.",
    correctedToast:
      "Buchung korrigiert — {desc} über {amount}. Die ursprüngliche Buchung wurde storniert.",
    reverseToast: "Buchung storniert — Gegenbuchung über {amount} erzeugt.",
    categoryCreatedToast: "Kategorie „{name}“ angelegt.",
    forbidden: "Dafür fehlt dir die Berechtigung.",
    alreadyReversed: "Diese Buchung ist bereits storniert.",
    cannotReverseReversal: "Eine Storno-Buchung lässt sich nicht erneut stornieren.",

    // Buchungs-Sheet
    sheetEyebrow: "Neue Buchung",
    sheetTitle: "Buchung erfassen",
    fDate: "Datum",
    fCategory: "Kategorie",
    fCategoryPlaceholder: "Kategorie wählen …",
    fDirection: "Art der Buchung",
    fAmount: "Betrag",
    fAmountHint: "In Euro, z. B. 49,00 — das Vorzeichen setzt die Art oben.",
    fPurpose: "Zweck",
    fPurposePlaceholder: "z. B. Mitgliedsbeitrag Q3, Hallenmiete Juli …",
    fCounterparty: "Gegenpartei",
    cpPerson: "Mitglied",
    cpOrg: "Organisation",
    fMember: "Mitglied",
    fMemberPlaceholder: "Mitglied wählen …",
    fOrgName: "Name der Organisation",
    fOrgNamePlaceholder: "z. B. Stadt Neckarsulm, Sportbedarf Müller …",
    errDate: "Bitte ein gültiges Datum wählen (nicht in der Zukunft).",
    errAmount: "Bitte einen Betrag größer als 0 eingeben.",
    errCategory: "Bitte eine Kategorie wählen.",
    errPurpose: "Bitte einen Zweck angeben.",
    errMember: "Bitte ein Mitglied wählen.",
    errOrg: "Bitte den Namen der Organisation eingeben.",
    sheetGobd: "Buchungen werden append-only gespeichert — korrigieren nur per Storno.",
    cancel: "Abbrechen",
    create: "Buchung speichern",

    // Korrektur (GoBD-konform = Storno + neue Buchung, kein Überschreiben)
    correctEyebrow: "Korrektur",
    correctTitle: "Buchung korrigieren",
    correctHint:
      "Die ursprüngliche Buchung wird storniert und durch diese ersetzt (GoBD). Die alte Buchung bleibt als storniert sichtbar.",
    correctSave: "Korrektur speichern",

    // Kategorien-Dialog
    catsEyebrow: "Kassenbuch",
    catsTitle: "Kategorien verwalten",
    catsIntro:
      "Kategorien strukturieren das Kassenbuch. Bestehende Buchungen behalten ihre Kategorie — Kategorien werden nie gelöscht.",
    catKindIncome: "Einnahme",
    catKindExpense: "Ausgabe",
    catNameLabel: "Name der Kategorie",
    catNamePlaceholder: "z. B. Trikots, Zuschüsse …",
    catKindLabel: "Art",
    catAdd: "Kategorie anlegen",
    catEmpty: "Noch keine Kategorien angelegt.",
    catNameError: "Bitte einen Namen eingeben.",
    close: "Schließen",

    // Storno-Dialog
    reverseEyebrow: "Storno",
    reverseTitle: "Buchung stornieren",
    reverseIntro:
      "Buchungen im Kassenbuch werden nicht gelöscht. Ein Storno erzeugt eine Gegenbuchung mit umgekehrtem Vorzeichen — die Originalbuchung bleibt sichtbar (GoBD).",
    reverseOriginal: "Originalbuchung",
    reverseDescLabel: "Beschreibung des Stornos",
    reverseDescPlaceholder: "Grund des Stornos (optional)",
    reverseDescHint: "Leer lassen für „Storno: <Originaltext>“.",
    reverseConfirm: "Storno buchen",
  },
  en: {
    // Page head
    pageEyebrow: "Cash book",
    pageTitle: "Cash book",
    pageSub: "Balance {balance} · {n} entries",
    back: "Back to finances",
    balanceLabel: "Balance",
    addEntry: "Add entry",
    manageCategories: "Categories",
    export: "Export",
    exportToast: "Cash book exported — GoBD-compliant CSV with {n} entries.",

    // Loading / errors / permissions
    retry: "Try again",
    loadErrorTitle: "Cash book could not be loaded",
    noAccessTitle: "No access to the cash book",
    noAccessBody:
      "Only the treasurer and the board can see the cash book. Talk to the club leadership if you need access.",

    // Filter bar
    filterCategory: "Category",
    allCategories: "All categories",
    noCategory: "Without category",
    filterPeriod: "Period",
    periodAll: "All time",
    period30: "Last 30 days",
    periodMonth: "This month",
    periodYear: "This year",

    // Table
    tableCaption: "Cash book of the club — all entries with running balance",
    colDate: "Date",
    colEntry: "Entry",
    colCategory: "Category",
    colAmount: "Amount",
    colBalance: "Balance",
    colAction: "Action",
    income: "Income",
    expense: "Expense",
    linkedInvoice: "Invoice {number} · matched automatically",
    reversalOf: "Reversal of entry",
    badgeReversed: "reversed",
    badgeReversal: "Reversal",
    reverseAction: "Reverse",
    correctAction: "Correct",

    // Sum row
    footCount: "{n} entries",
    footIncome: "Income {sum}",
    footExpense: "Expenses {sum}",
    footNet: "Net",
    footHint: "GoBD: entries are immutable — corrections only via reversal.",

    // Empty states
    emptyTitle: "No entries yet",
    emptyBody:
      "As soon as you record the first income or expense, it appears here with a running balance.",
    emptyCta: "Add first entry",
    emptyFilterTitle: "No entries in this filter",
    emptyFilterBody: "There are no entries for this category and period.",
    emptyFilterCta: "Reset filters",

    // Toasts
    entryCreatedToast: "Entry recorded — {desc} for {amount}.",
    correctedToast:
      "Entry corrected — {desc} for {amount}. The original entry was reversed.",
    reverseToast: "Entry reversed — counter-entry for {amount} created.",
    categoryCreatedToast: "Category “{name}” created.",
    forbidden: "You do not have permission for this.",
    alreadyReversed: "This entry has already been reversed.",
    cannotReverseReversal: "A reversal entry cannot be reversed again.",

    // Booking sheet
    sheetEyebrow: "New entry",
    sheetTitle: "Add entry",
    fDate: "Date",
    fCategory: "Category",
    fCategoryPlaceholder: "Choose category …",
    fDirection: "Type of entry",
    fAmount: "Amount",
    fAmountHint: "In euros, e.g. 49.00 — the sign is set by the type above.",
    fPurpose: "Purpose",
    fPurposePlaceholder: "e.g. membership fee Q3, hall rent July …",
    fCounterparty: "Counterparty",
    cpPerson: "Member",
    cpOrg: "Organisation",
    fMember: "Member",
    fMemberPlaceholder: "Choose member …",
    fOrgName: "Organisation name",
    fOrgNamePlaceholder: "e.g. City of Neckarsulm, Müller Sports …",
    errDate: "Please choose a valid date (not in the future).",
    errAmount: "Please enter an amount greater than 0.",
    errCategory: "Please choose a category.",
    errPurpose: "Please enter a purpose.",
    errMember: "Please choose a member.",
    errOrg: "Please enter the organisation name.",
    sheetGobd: "Entries are stored append-only — correct only via reversal.",
    cancel: "Cancel",
    create: "Save entry",

    // Correction (GoBD-compliant = reversal + new entry, never overwrite)
    correctEyebrow: "Correction",
    correctTitle: "Correct entry",
    correctHint:
      "The original entry will be reversed and replaced by this one (GoBD). The old entry stays visible as reversed.",
    correctSave: "Save correction",

    // Categories dialog
    catsEyebrow: "Cash book",
    catsTitle: "Manage categories",
    catsIntro:
      "Categories structure the cash book. Existing entries keep their category — categories are never deleted.",
    catKindIncome: "Income",
    catKindExpense: "Expense",
    catNameLabel: "Category name",
    catNamePlaceholder: "e.g. Jerseys, Grants …",
    catKindLabel: "Type",
    catAdd: "Create category",
    catEmpty: "No categories yet.",
    catNameError: "Please enter a name.",
    close: "Close",

    // Reversal dialog
    reverseEyebrow: "Reversal",
    reverseTitle: "Reverse entry",
    reverseIntro:
      "Cash book entries are never deleted. A reversal creates a counter-entry with the opposite sign — the original entry stays visible (GoBD).",
    reverseOriginal: "Original entry",
    reverseDescLabel: "Reversal description",
    reverseDescPlaceholder: "Reason for the reversal (optional)",
    reverseDescHint: "Leave empty for “Reversal: <original text>”.",
    reverseConfirm: "Book reversal",
  },
} satisfies Dict;
