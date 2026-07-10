import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Wörterbuch des Mitgliedsbeiträge-Screens (Seriositätszone).
 * DE und EN werden IMMER gemeinsam gepflegt — deutsche Strings mit ä/ö/ü/ß.
 * Beträge werden im UI monospace/tabular gerendert (Integer-Cent aus der Facade).
 */
export const memberFeesDict = {
  de: {
    // Seitenkopf
    pageTitle: "Mitgliedsbeiträge",
    pageSub: "Wer welchen Beitrag zahlt — Zuordnung, Betrag und SEPA-Status",
    backToFinance: "Finanzübersicht",

    // Laden & Fehler (Facade)
    retry: "Erneut versuchen",
    loadErrorTitle: "Beiträge konnten nicht geladen werden",
    niTitle: "Noch nicht angebunden",
    niBody: "Die Beitragszuordnung hat im api-Modus noch keinen Endpoint.",
    forbidden: "Dafür fehlt dir die Berechtigung.",
    forbiddenBody:
      "Beitragszuordnungen darf nur die Finanzverwaltung (Kassenwart, Moderation, Admin, Vorstand) verwalten.",

    // KPI-Zeile (vereinsweit)
    kpiAssigned: "Zugeordnet",
    kpiAssignedSub: "{n} von {total} Mitgliedern",
    kpiUnassigned: "Ohne Zuordnung",
    kpiUnassignedSub: "noch kein Beitrag hinterlegt",
    kpiUnassignedNone: "alle Mitglieder zugeordnet",
    kpiVolume: "Beitragsvolumen",
    kpiVolumeSub: "pro Jahr · ohne Einmalbeiträge",

    // Suche & Filter
    searchLabel: "Nach Mitglied suchen",
    searchPlaceholder: "Mitglied suchen …",
    filterLabel: "Mitglieder nach Zuordnung filtern",
    fAll: "Alle",
    fAssigned: "Mit Zuordnung",
    fUnassigned: "Ohne Zuordnung",

    // Tabelle
    colMember: "Mitglied",
    colCategory: "Kategorie",
    colAmount: "Effektiver Beitrag",
    colValid: "Gültig",
    colSepa: "SEPA",
    colAction: "Aktion",
    tableCaption: "Mitgliedsbeiträge des RSV Neckarsulm",
    memberSince: "dabei seit {year}",
    noCategory: "Keine Zuordnung",
    customBadge: "Sonderbetrag",
    validOpen: "ab {from} · offen",
    validRange: "{from} – {until}",
    sepaActive: "SEPA aktiv",
    sepaRevoked: "widerrufen",
    sepaNone: "kein Mandat",
    dash: "—",
    footShown: "Angezeigt: {shown} von {total}",
    footVolumeLabel: "Volumen/Jahr (Auswahl):",
    actionAssign: "Zuordnen",
    actionEdit: "Ändern",
    assignAria: "Beitrag für {name} zuordnen",
    editAria: "Beitrag von {name} ändern",
    emptyTitle: "Keine Mitglieder gefunden",
    emptyBody: "In dieser Auswahl gibt es gerade kein Mitglied.",
    emptyReset: "Filter zurücksetzen",

    // Perioden
    periodMonthly: "Monatlich",
    periodQuarterly: "Quartalsweise",
    periodYearly: "Jährlich",
    periodOnce: "Einmalig",
    perMonth: "/Monat",
    perQuarter: "/Quartal",
    perYear: "/Jahr",
    perOnce: "einmalig",

    // Familienrabatte (Stammdaten-Hinweis)
    discountsEyebrow: "Familienrabatte",
    discountsTitle: "Hinterlegte Rabattregeln",
    discountsNote:
      "Rabatte sind als Stammdaten hinterlegt und werden bei der Rechnungserstellung angewendet — der effektive Beitrag oben ist der Basisbeitrag ohne Rabatt.",
    discountFromChild: "ab dem {n}. Kind",
    discountPercent: "{value} % Rabatt",
    discountFixed: "{amount} Rabatt",
    discountInactive: "inaktiv",

    // Zuordnungs-Sheet
    assignEyebrow: "Beitragszuordnung",
    assignTitleNew: "Beitrag zuordnen",
    assignTitleEdit: "Beitrag ändern",
    fCategory: "Beitragskategorie",
    fCategoryPlaceholder: "Kategorie wählen …",
    fCategoryError: "Bitte eine Kategorie wählen.",
    fCategoryEmpty: "Keine aktive Kategorie vorhanden — zuerst im Bereich „Beitragskategorien“ anlegen.",
    fCustom: "Sonderbetrag (optional)",
    fCustomHint: "Leer = Betrag der Kategorie ({amount}).",
    fCustomHintNoCat: "Leer = Betrag der gewählten Kategorie.",
    fCustomError: "Bitte einen gültigen Betrag angeben.",
    fFrom: "Gültig ab",
    fFromError: "Bitte ein Startdatum angeben.",
    fUntil: "Gültig bis",
    fUntilHint: "Optional — leer = offen.",
    fUntilError: "Das Ende darf nicht vor dem Start liegen.",
    effectivePreview: "Effektiver Beitrag",
    cancel: "Abbrechen",
    saveNew: "Zuordnen",
    saveEdit: "Speichern",
    removeAction: "Zuordnung entfernen",
    removeConfirmQ: "Zuordnung wirklich entfernen?",
    removeConfirmYes: "Entfernen",
    removeConfirmNo: "Behalten",
    toastAssigned: "{name}: Beitrag „{category}“ zugeordnet.",
    toastUpdated: "{name}: Beitragszuordnung aktualisiert.",
    toastRemoved: "{name}: Zuordnung entfernt.",
  },
  en: {
    // Page head
    pageTitle: "Membership fees",
    pageSub: "Who pays which fee — assignment, amount and SEPA status",
    backToFinance: "Finance overview",

    // Loading & errors (facade)
    retry: "Try again",
    loadErrorTitle: "Fees could not be loaded",
    niTitle: "Not connected yet",
    niBody: "Fee assignment has no endpoint in api mode yet.",
    forbidden: "You do not have permission for this.",
    forbiddenBody:
      "Fee assignments can only be managed by finance managers (treasurer, moderator, admin, owner).",

    // KPI row (club-wide)
    kpiAssigned: "Assigned",
    kpiAssignedSub: "{n} of {total} members",
    kpiUnassigned: "Unassigned",
    kpiUnassignedSub: "no fee on file yet",
    kpiUnassignedNone: "all members assigned",
    kpiVolume: "Fee volume",
    kpiVolumeSub: "per year · excluding one-off fees",

    // Search & filter
    searchLabel: "Search by member",
    searchPlaceholder: "Search member …",
    filterLabel: "Filter members by assignment",
    fAll: "All",
    fAssigned: "Assigned",
    fUnassigned: "Unassigned",

    // Table
    colMember: "Member",
    colCategory: "Category",
    colAmount: "Effective fee",
    colValid: "Valid",
    colSepa: "SEPA",
    colAction: "Action",
    tableCaption: "Membership fees of RSV Neckarsulm",
    memberSince: "member since {year}",
    noCategory: "No assignment",
    customBadge: "Custom",
    validOpen: "from {from} · open",
    validRange: "{from} – {until}",
    sepaActive: "SEPA active",
    sepaRevoked: "revoked",
    sepaNone: "no mandate",
    dash: "—",
    footShown: "Shown: {shown} of {total}",
    footVolumeLabel: "Volume/year (selection):",
    actionAssign: "Assign",
    actionEdit: "Edit",
    assignAria: "Assign fee for {name}",
    editAria: "Edit fee of {name}",
    emptyTitle: "No members found",
    emptyBody: "There is no member in this selection right now.",
    emptyReset: "Reset filters",

    // Periods
    periodMonthly: "Monthly",
    periodQuarterly: "Quarterly",
    periodYearly: "Yearly",
    periodOnce: "One-off",
    perMonth: "/month",
    perQuarter: "/quarter",
    perYear: "/year",
    perOnce: "one-off",

    // Family discounts (master-data hint)
    discountsEyebrow: "Family discounts",
    discountsTitle: "Configured discount rules",
    discountsNote:
      "Discounts are stored as master data and applied when invoices are created — the effective fee above is the base fee without discount.",
    discountFromChild: "from the {n}. child",
    discountPercent: "{value}% discount",
    discountFixed: "{amount} discount",
    discountInactive: "inactive",

    // Assignment sheet
    assignEyebrow: "Fee assignment",
    assignTitleNew: "Assign fee",
    assignTitleEdit: "Edit fee",
    fCategory: "Fee category",
    fCategoryPlaceholder: "Choose category …",
    fCategoryError: "Please choose a category.",
    fCategoryEmpty: "No active category yet — create one in the “Fee categories” area first.",
    fCustom: "Custom amount (optional)",
    fCustomHint: "Empty = the category amount ({amount}).",
    fCustomHintNoCat: "Empty = the amount of the chosen category.",
    fCustomError: "Please enter a valid amount.",
    fFrom: "Valid from",
    fFromError: "Please enter a start date.",
    fUntil: "Valid until",
    fUntilHint: "Optional — empty = open.",
    fUntilError: "The end must not be before the start.",
    effectivePreview: "Effective fee",
    cancel: "Cancel",
    saveNew: "Assign",
    saveEdit: "Save",
    removeAction: "Remove assignment",
    removeConfirmQ: "Really remove this assignment?",
    removeConfirmYes: "Remove",
    removeConfirmNo: "Keep",
    toastAssigned: "{name}: fee “{category}” assigned.",
    toastUpdated: "{name}: fee assignment updated.",
    toastRemoved: "{name}: assignment removed.",
  },
} satisfies Dict;

export type MemberFeesKey = keyof (typeof memberFeesDict)["de"];
