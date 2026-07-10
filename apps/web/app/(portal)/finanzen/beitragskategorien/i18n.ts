import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Wörterbuch des Beitragskategorien-Screens
 * (/finanzen/beitragskategorien, Seriositätszone). DE und EN werden IMMER
 * gemeinsam gepflegt — deutsche Strings mit echten ä/ö/ü/ß. Ein Dict für den
 * ganzen Bereich (Client + Summary + Kategorien-/Rabatt-Karten + Formulare +
 * Lösch-Dialoge), analog kassenbuchDict.
 *
 * Rechte SERVERSEITIG (RLS): Kategorien/Familienrabatte schreiben =
 * can_manage_finance; die Summary ist strikt can_manage_finance (Mitglied →
 * 403). Beträge sind Integer-Cent — im UI Mono/tabular. Sichtbar nur für
 * Kassenwart:in/Vorstand.
 */
export const beitragskategorienDict = {
  de: {
    // Seitenkopf
    back: "Zurück zu Finanzen",
    pageEyebrow: "Beiträge",
    pageTitle: "Beitragskategorien",
    pageSub: "Beitragsstammdaten und Familienrabatte deines Vereins",

    // Laden / Fehler / Rechte
    retry: "Erneut versuchen",
    loadErrorTitle: "Beitragsdaten konnten nicht geladen werden",
    noAccessTitle: "Kein Zugriff auf die Beitragskategorien",
    noAccessBody:
      "Beitragskategorien und Familienrabatte verwalten nur Kassenwart:in und Vorstand. Wende dich an die Vereinsleitung, wenn du Einsicht brauchst.",
    forbidden: "Dazu fehlt dir die Berechtigung (Kassenwart:in oder Vorstand).",

    // Erwartete-Jahreseinnahmen-Kachel (memberFeesSummary)
    summaryEyebrow: "Prognose",
    summaryTitle: "Erwartete Jahreseinnahmen",
    summaryTotalLabel: "Beiträge pro Jahr",
    summaryTotalSub: "{n} laufende Zuordnungen · Einmalbeiträge ausgenommen",
    summaryEmptyTitle: "Noch keine Beitragszuordnungen",
    summaryEmptyBody:
      "Lege Beitragskategorien an und weise sie den Mitgliedern zu — dann erscheint hier die Jahresprognose.",
    summaryBucketCol: "Periode",
    summaryCountCol: "Zuordnungen",
    summarySumCol: "Summe je Periode",
    summaryAnnualCol: "Pro Jahr",
    summaryOnceHint: "Einmalbeiträge zählen nicht zur Jahressumme.",

    // Beitragskategorien-Karte
    catsEyebrow: "Stammdaten",
    catsTitle: "Beitragskategorien",
    addCategory: "Kategorie anlegen",
    catColName: "Name",
    catColAmount: "Betrag",
    catColPeriod: "Periode",
    catColStatus: "Status",
    catColActions: "Aktion",
    catStatusActive: "Aktiv",
    catStatusInactive: "Inaktiv",
    catCountFoot: "{n} Kategorien",
    catsEmptyTitle: "Noch keine Beitragskategorien",
    catsEmptyBody:
      "Lege die erste Beitragskategorie an — z. B. „Aktiv Erwachsene“ mit 93,00 € pro Monat.",

    // Perioden
    periodMonthly: "monatlich",
    periodQuarterly: "vierteljährlich",
    periodYearly: "jährlich",
    periodOnce: "einmalig",

    // Zeilen-Aktionen
    edit: "Bearbeiten",
    delete: "Löschen",
    cancel: "Abbrechen",
    save: "Speichern",

    // Kategorie-Formular
    catFormEyebrow: "Beitragskategorie",
    catCreateTitle: "Kategorie anlegen",
    catEditTitle: "Kategorie bearbeiten",
    catNameLabel: "Name",
    catNamePlaceholder: "z. B. Aktiv Erwachsene",
    catNameError: "Bitte einen Namen angeben.",
    catAmountLabel: "Betrag (€)",
    catAmountHint: "Betrag je Periode, z. B. 93,00",
    catAmountError: "Bitte einen gültigen Betrag angeben.",
    catPeriodLabel: "Periode",
    catActiveLabel: "Kategorie ist aktiv",
    catCreatedToast: "Kategorie „{name}“ angelegt.",
    catUpdatedToast: "Kategorie „{name}“ gespeichert.",

    // Kategorie löschen
    catDeleteTitle: "Kategorie löschen?",
    catDeleteBody:
      "„{name}“ wird aus der Auswahl entfernt. Bestehende Beitragszuordnungen behalten ihren Betrag.",
    catDeletedToast: "Kategorie „{name}“ gelöscht.",

    // Familienrabatte-Karte
    discEyebrow: "Familienrabatte",
    discTitle: "Familien- und Geschwisterrabatte",
    discIntro:
      "Regeln für Familien mit mehreren Kindern. Die automatische Anwendung auf Rechnungen folgt später.",
    addDiscount: "Rabatt anlegen",
    discColLabel: "Bezeichnung",
    discColKind: "Art",
    discColValue: "Nachlass",
    discColFrom: "Greift",
    discColActions: "Aktion",
    discKindPercent: "Prozent",
    discKindFixed: "Festbetrag",
    discFromChild: "ab dem {n}. Kind",
    discStatusInactive: "Inaktiv",
    discCountFoot: "{n} Rabatte",
    discEmptyTitle: "Noch keine Familienrabatte",
    discEmptyBody:
      "Lege eine Regel an — z. B. „Geschwisterrabatt“ mit 25 % ab dem 2. Kind.",

    // Rabatt-Formular
    discFormEyebrow: "Familienrabatt",
    discCreateTitle: "Rabatt anlegen",
    discEditTitle: "Rabatt bearbeiten",
    discLabelLabel: "Bezeichnung",
    discLabelPlaceholder: "z. B. Geschwisterrabatt",
    discLabelError: "Bitte eine Bezeichnung angeben.",
    discKindLabel: "Art des Rabatts",
    discValuePercentLabel: "Rabatt (%)",
    discValuePercentHint: "Prozentwert zwischen 0 und 100",
    discValueFixedLabel: "Rabatt (€)",
    discValueFixedHint: "Fester Nachlass, z. B. 30,00",
    discValueError: "Bitte einen gültigen Wert angeben.",
    discValueRangeError: "Der Prozentwert muss zwischen 0 und 100 liegen.",
    discFromChildLabel: "Ab dem wievielten Kind?",
    discFromChildHint: "z. B. 2 = ab dem zweiten Kind",
    discFromChildError: "Bitte eine Zahl ab 1 angeben.",
    discActiveLabel: "Rabatt ist aktiv",
    discCreatedToast: "Rabatt „{name}“ angelegt.",
    discUpdatedToast: "Rabatt „{name}“ gespeichert.",

    // Rabatt löschen
    discDeleteTitle: "Rabatt löschen?",
    discDeleteBody: "„{name}“ wird entfernt. Die Regel gilt danach nicht mehr.",
    discDeletedToast: "Rabatt „{name}“ gelöscht.",
  },
  en: {
    // Page head
    back: "Back to finance",
    pageEyebrow: "Fees",
    pageTitle: "Fee categories",
    pageSub: "Fee master data and family discounts for your club",

    // Loading / error / rights
    retry: "Try again",
    loadErrorTitle: "Could not load the fee data",
    noAccessTitle: "No access to the fee categories",
    noAccessBody:
      "Only the treasurer and the board manage fee categories and family discounts. Contact your club leadership if you need access.",
    forbidden: "You don’t have permission for this (treasurer or board).",

    // Expected annual income tile (memberFeesSummary)
    summaryEyebrow: "Forecast",
    summaryTitle: "Expected annual income",
    summaryTotalLabel: "Fees per year",
    summaryTotalSub: "{n} recurring assignments · one-off fees excluded",
    summaryEmptyTitle: "No fee assignments yet",
    summaryEmptyBody:
      "Create fee categories and assign them to members — the annual forecast will appear here.",
    summaryBucketCol: "Period",
    summaryCountCol: "Assignments",
    summarySumCol: "Sum per period",
    summaryAnnualCol: "Per year",
    summaryOnceHint: "One-off fees don’t count toward the annual total.",

    // Fee categories card
    catsEyebrow: "Master data",
    catsTitle: "Fee categories",
    addCategory: "Add category",
    catColName: "Name",
    catColAmount: "Amount",
    catColPeriod: "Period",
    catColStatus: "Status",
    catColActions: "Action",
    catStatusActive: "Active",
    catStatusInactive: "Inactive",
    catCountFoot: "{n} categories",
    catsEmptyTitle: "No fee categories yet",
    catsEmptyBody:
      "Create the first fee category — e.g. “Active adults” at €93.00 per month.",

    // Periods
    periodMonthly: "monthly",
    periodQuarterly: "quarterly",
    periodYearly: "yearly",
    periodOnce: "one-off",

    // Row actions
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",

    // Category form
    catFormEyebrow: "Fee category",
    catCreateTitle: "Add category",
    catEditTitle: "Edit category",
    catNameLabel: "Name",
    catNamePlaceholder: "e.g. Active adults",
    catNameError: "Please enter a name.",
    catAmountLabel: "Amount (€)",
    catAmountHint: "Amount per period, e.g. 93.00",
    catAmountError: "Please enter a valid amount.",
    catPeriodLabel: "Period",
    catActiveLabel: "Category is active",
    catCreatedToast: "Category “{name}” created.",
    catUpdatedToast: "Category “{name}” saved.",

    // Delete category
    catDeleteTitle: "Delete category?",
    catDeleteBody:
      "“{name}” will be removed from the picker. Existing fee assignments keep their amount.",
    catDeletedToast: "Category “{name}” deleted.",

    // Family discounts card
    discEyebrow: "Family discounts",
    discTitle: "Family and sibling discounts",
    discIntro:
      "Rules for families with several children. Automatic application to invoices will follow later.",
    addDiscount: "Add discount",
    discColLabel: "Label",
    discColKind: "Type",
    discColValue: "Reduction",
    discColFrom: "Applies",
    discColActions: "Action",
    discKindPercent: "Percent",
    discKindFixed: "Fixed",
    discFromChild: "from child {n} on",
    discStatusInactive: "Inactive",
    discCountFoot: "{n} discounts",
    discEmptyTitle: "No family discounts yet",
    discEmptyBody:
      "Create a rule — e.g. “Sibling discount” at 25% from the 2nd child.",

    // Discount form
    discFormEyebrow: "Family discount",
    discCreateTitle: "Add discount",
    discEditTitle: "Edit discount",
    discLabelLabel: "Label",
    discLabelPlaceholder: "e.g. Sibling discount",
    discLabelError: "Please enter a label.",
    discKindLabel: "Discount type",
    discValuePercentLabel: "Discount (%)",
    discValuePercentHint: "Percentage between 0 and 100",
    discValueFixedLabel: "Discount (€)",
    discValueFixedHint: "Fixed reduction, e.g. 30.00",
    discValueError: "Please enter a valid value.",
    discValueRangeError: "The percentage must be between 0 and 100.",
    discFromChildLabel: "From which child?",
    discFromChildHint: "e.g. 2 = from the second child",
    discFromChildError: "Please enter a number of 1 or more.",
    discActiveLabel: "Discount is active",
    discCreatedToast: "Discount “{name}” created.",
    discUpdatedToast: "Discount “{name}” saved.",

    // Delete discount
    discDeleteTitle: "Delete discount?",
    discDeleteBody: "“{name}” will be removed. The rule no longer applies afterwards.",
    discDeletedToast: "Discount “{name}” deleted.",
  },
} satisfies Dict;

export type BeitragskategorienKey = keyof (typeof beitragskategorienDict)["de"];
