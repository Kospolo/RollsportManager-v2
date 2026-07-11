import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Wörterbuch des Jahresabschluss-Screens
 * (/finanzen/jahresabschluss, Seriositätszone). DE und EN werden IMMER
 * gemeinsam gepflegt — deutsche Strings mit echten ä/ö/ü/ß. Ein Dict für den
 * ganzen Bereich (Client + Summen-Hero/KPIs + Kategorie-Aufschlüsselung +
 * Vorjahresvergleich), analog kassenbuchDict.
 *
 * Der Jahresabschluss ist STRIKT can_manage_finance (Mitglied: kein Zugriff);
 * die verbindliche Durchsetzung bleibt serverseitig (RLS). Beträge werden
 * Mono/tabular gerendert — Netto negativ (Fehlbetrag) rot.
 */
export const jahresabschlussDict = {
  de: {
    // Seitenkopf
    pageEyebrow: "Finanzen",
    pageTitle: "Jahresabschluss",
    pageSub: "Einnahmen, Ausgaben und Netto-Ergebnis für {year}",
    back: "Zurück zu Finanzen",

    // Steuerleiste (Jahr + Export)
    yearLabel: "Geschäftsjahr",
    exportCsv: "CSV-Export",
    exportDatev: "DATEV-Export",
    exporting: "Export läuft …",

    // Laden / Fehler / Rechte
    retry: "Erneut versuchen",
    loadErrorTitle: "Jahresabschluss konnte nicht geladen werden",
    noAccessTitle: "Kein Zugriff auf den Jahresabschluss",
    noAccessBody:
      "Den Jahresabschluss sehen nur Kassenwart:in und Vorstand. Wende dich an die Vereinsleitung, wenn du Einsicht brauchst.",

    // Netto-Ergebnis (Hero)
    netEyebrow: "Netto-Ergebnis {year}",
    netSurplus: "Überschuss",
    netDeficit: "Fehlbetrag",
    netBalanced: "Ausgeglichen",
    netFormula: "Einnahmen {income} − Ausgaben {expense}",
    netDeltaLabel: "Veränderung zum Vorjahr",
    netVsPrev: "gegenüber {year}",

    // KPI-Zeile
    kpiIncome: "Einnahmen",
    kpiIncomeSub: "{n} Kategorien",
    kpiExpense: "Ausgaben",
    kpiExpenseSub: "{n} Kategorien",
    kpiDonations: "Spenden",
    kpiDonationsSub: "{n} Zuwendungen",
    kpiDonationsNone: "keine Spenden erfasst",
    kpiOpen: "Offene Posten",
    kpiOpenSub: "{n} Rechnungen zum Jahresende",
    kpiOpenNone: "keine offenen Posten",

    // Kategorie-Aufschlüsselung
    catEyebrow: "Aufschlüsselung",
    catTitle: "Einnahmen & Ausgaben nach Kategorie",
    catIncomeHead: "Einnahmen",
    catExpenseHead: "Ausgaben",
    catUncategorised: "Ohne Kategorie",
    catBarLabel: "{name}: {amount}",
    catEmptyIncome: "Keine Einnahmen in {year}.",
    catEmptyExpense: "Keine Ausgaben in {year}.",

    // Vorjahresvergleich
    cmpEyebrow: "Vorjahresvergleich",
    cmpTitle: "{year} im Vergleich zu {prev}",
    cmpColMetric: "Kennzahl",
    cmpColDelta: "Δ",
    cmpIncome: "Einnahmen",
    cmpExpense: "Ausgaben",
    cmpNet: "Netto-Ergebnis",
    cmpCaption: "Kennzahlen des Jahresabschlusses im Vergleich zum Vorjahr",

    // Offene Posten / Fußnote
    openItemsNote:
      "Offene Posten: {count} Rechnung(en) über {sum}, ausgestellt bis zum 31.12.{year}.",
    gobdNote:
      "Jahresabschluss auf Basis des GoBD-konformen Kassenbuchs — Beträge in Euro, Stichtag 31.12.{year}.",

    // Leerer Zustand (kein Jahr-Datenbestand)
    emptyTitle: "Noch keine Buchungen für {year}",
    emptyBody:
      "Für dieses Geschäftsjahr gibt es noch keine Einnahmen oder Ausgaben. Erfasse Buchungen im Kassenbuch, dann erscheint hier der Jahresabschluss.",
    emptyCta: "Zum Kassenbuch",

    // Toasts
    exportDoneCsv: "Kassenbuch {year} exportiert — {file}.",
    exportDoneDatev: "DATEV-Export {year} erstellt — {file}.",
    exportForbidden: "Dafür fehlt dir die Berechtigung.",
    exportError: "Export fehlgeschlagen — {reason}",
  },
  en: {
    // Page head
    pageEyebrow: "Finances",
    pageTitle: "Annual report",
    pageSub: "Income, expenses and net result for {year}",
    back: "Back to finances",

    // Control bar (year + export)
    yearLabel: "Financial year",
    exportCsv: "CSV export",
    exportDatev: "DATEV export",
    exporting: "Exporting …",

    // Loading / errors / permissions
    retry: "Try again",
    loadErrorTitle: "Annual report could not be loaded",
    noAccessTitle: "No access to the annual report",
    noAccessBody:
      "Only the treasurer and the board can see the annual report. Talk to the club leadership if you need access.",

    // Net result (hero)
    netEyebrow: "Net result {year}",
    netSurplus: "Surplus",
    netDeficit: "Deficit",
    netBalanced: "Balanced",
    netFormula: "Income {income} − expenses {expense}",
    netDeltaLabel: "Change vs. previous year",
    netVsPrev: "compared to {year}",

    // KPI row
    kpiIncome: "Income",
    kpiIncomeSub: "{n} categories",
    kpiExpense: "Expenses",
    kpiExpenseSub: "{n} categories",
    kpiDonations: "Donations",
    kpiDonationsSub: "{n} donations",
    kpiDonationsNone: "no donations recorded",
    kpiOpen: "Open items",
    kpiOpenSub: "{n} invoices at year end",
    kpiOpenNone: "no open items",

    // Category breakdown
    catEyebrow: "Breakdown",
    catTitle: "Income & expenses by category",
    catIncomeHead: "Income",
    catExpenseHead: "Expenses",
    catUncategorised: "Uncategorised",
    catBarLabel: "{name}: {amount}",
    catEmptyIncome: "No income in {year}.",
    catEmptyExpense: "No expenses in {year}.",

    // Year-on-year comparison
    cmpEyebrow: "Year-on-year",
    cmpTitle: "{year} compared to {prev}",
    cmpColMetric: "Metric",
    cmpColDelta: "Δ",
    cmpIncome: "Income",
    cmpExpense: "Expenses",
    cmpNet: "Net result",
    cmpCaption: "Annual report figures compared to the previous year",

    // Open items / footnote
    openItemsNote:
      "Open items: {count} invoice(s) totalling {sum}, issued up to 31 Dec {year}.",
    gobdNote:
      "Annual report based on the GoBD-compliant cash book — amounts in euros, cut-off 31 Dec {year}.",

    // Empty state (no data for the year)
    emptyTitle: "No entries for {year} yet",
    emptyBody:
      "There is no income or expense for this financial year yet. Record entries in the cash book and the annual report will appear here.",
    emptyCta: "Open cash book",

    // Toasts
    exportDoneCsv: "Cash book {year} exported — {file}.",
    exportDoneDatev: "DATEV export {year} created — {file}.",
    exportForbidden: "You do not have permission for this.",
    exportError: "Export failed — {reason}",
  },
} satisfies Dict;

export type JahresabschlussKey = keyof (typeof jahresabschlussDict)["de"];
