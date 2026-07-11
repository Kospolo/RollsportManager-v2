import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Wörterbuch der Budgetplanung (/finanzen/budget). DE und EN
 * werden IMMER gemeinsam gepflegt — deutsche Strings mit echten ä/ö/ü/ß.
 */
export const budgetDict = {
  de: {
    // Brotkrume + Kopf
    back: "Finanzen",
    pageEyebrow: "Budgetplanung",
    pageTitle: "Budget",
    pageSub: "Plan gegen Ist je Kategorie — Jahr {year}",

    // Jahr-Auswahl
    yearLabel: "Jahr",

    // KPI-Leiste
    kpiPlannedIncome: "Geplante Einnahmen",
    kpiPlannedExpense: "Geplante Ausgaben",
    kpiPlannedResult: "Geplantes Ergebnis",
    kpiResultDelta: "Abweichung Ergebnis",
    kpiActualPrefix: "Ist",
    kpiResultSub: "Plan vs. Ist",
    kpiDeltaAhead: "besser als geplant",
    kpiDeltaBehind: "schlechter als geplant",
    kpiDeltaEven: "wie geplant",

    // Sektionen (Tabellen)
    incomeEyebrow: "Einnahmen",
    incomeTitle: "Geplante Einnahmen",
    expenseEyebrow: "Ausgaben",
    expenseTitle: "Geplante Ausgaben",
    colCategory: "Kategorie",
    colPlanned: "Plan",
    colActual: "Ist",
    colVariance: "Abweichung",
    colActions: "Aktionen",
    noPlan: "kein Plan",
    subtotalLabel: "Summe",
    varianceHint: "Abweichung = Plan − Ist · grün = im Plan, rot = darüber",

    // Zeilen-Aktionen
    setPlan: "Plan setzen",
    edit: "Bearbeiten",
    remove: "Entfernen",

    // Plan-Modal (Upsert)
    planEyebrow: "Budgetplanung",
    planCreateTitle: "Plan setzen",
    planEditTitle: "Plan bearbeiten",
    planCategoryLabel: "Kategorie",
    planAmountLabel: "Geplant (€)",
    planAmountHint: "Jahresbetrag für {year} — leer lassen ist nicht möglich, zum Löschen „Entfernen“.",
    planAmountError: "Bitte einen gültigen Betrag eingeben (z. B. 1.800,00).",
    planNoteLabel: "Notiz (optional)",
    planNotePlaceholder: "z. B. Annahme, Grundlage der Schätzung",
    cancel: "Abbrechen",
    save: "Speichern",
    planCreatedToast: "Plan für „{name}“ gesetzt.",
    planUpdatedToast: "Plan für „{name}“ aktualisiert.",

    // Entfernen (Soft-Delete der Planzeile)
    removeTitle: "Plan entfernen",
    removeBody: "Den geplanten Betrag für „{name}“ entfernen? Das Ist bleibt unberührt.",
    removedToast: "Plan für „{name}“ entfernt.",

    // Laden / Fehler / Rechte
    retry: "Erneut versuchen",
    loadErrorTitle: "Budget konnte nicht geladen werden",
    forbidden: "Dafür fehlt dir die Berechtigung.",
    noAccessTitle: "Kein Zugriff",
    noAccessBody: "Die Budgetplanung ist der Kassenführung vorbehalten (Kassenwart, Moderator, Admin).",
    emptyTitle: "Keine Kategorien",
    emptyBody: "Für dieses Jahr sind noch keine Finanzkategorien angelegt — lege sie in den Beitragskategorien an.",
  },
  en: {
    // Breadcrumb + head
    back: "Finances",
    pageEyebrow: "Budget planning",
    pageTitle: "Budget",
    pageSub: "Plan vs. actual per category — year {year}",

    // Year picker
    yearLabel: "Year",

    // KPI row
    kpiPlannedIncome: "Planned income",
    kpiPlannedExpense: "Planned expenses",
    kpiPlannedResult: "Planned result",
    kpiResultDelta: "Result variance",
    kpiActualPrefix: "Actual",
    kpiResultSub: "Plan vs. actual",
    kpiDeltaAhead: "ahead of plan",
    kpiDeltaBehind: "behind plan",
    kpiDeltaEven: "on plan",

    // Sections (tables)
    incomeEyebrow: "Income",
    incomeTitle: "Planned income",
    expenseEyebrow: "Expenses",
    expenseTitle: "Planned expenses",
    colCategory: "Category",
    colPlanned: "Plan",
    colActual: "Actual",
    colVariance: "Variance",
    colActions: "Actions",
    noPlan: "no plan",
    subtotalLabel: "Total",
    varianceHint: "Variance = plan − actual · green = within plan, red = over",

    // Row actions
    setPlan: "Set plan",
    edit: "Edit",
    remove: "Remove",

    // Plan modal (upsert)
    planEyebrow: "Budget planning",
    planCreateTitle: "Set plan",
    planEditTitle: "Edit plan",
    planCategoryLabel: "Category",
    planAmountLabel: "Planned (€)",
    planAmountHint: "Annual amount for {year} — cannot be empty, use “Remove” to clear.",
    planAmountError: "Please enter a valid amount (e.g. 1,800.00).",
    planNoteLabel: "Note (optional)",
    planNotePlaceholder: "e.g. assumption, basis of the estimate",
    cancel: "Cancel",
    save: "Save",
    planCreatedToast: "Plan set for “{name}”.",
    planUpdatedToast: "Plan updated for “{name}”.",

    // Remove (soft-delete of the plan row)
    removeTitle: "Remove plan",
    removeBody: "Remove the planned amount for “{name}”? The actual figures stay untouched.",
    removedToast: "Plan removed for “{name}”.",

    // Loading / errors / permissions
    retry: "Try again",
    loadErrorTitle: "Budget could not be loaded",
    forbidden: "You do not have permission for this.",
    noAccessTitle: "No access",
    noAccessBody: "Budget planning is reserved for finance managers (treasurer, moderator, admin).",
    emptyTitle: "No categories",
    emptyBody: "No finance categories exist for this year yet — create them under fee categories.",
  },
} satisfies Dict;

export type BudgetKey = keyof (typeof budgetDict)["de"];
