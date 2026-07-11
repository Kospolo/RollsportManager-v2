import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Betreiber-Lizenzverwaltung ((super)/lizenzen):
 * Übersicht aller Vereine mit Lizenz (Tier/Status/Gültigkeit/Mitglieder) plus
 * das Setzen von Stufe/Status und das Gewähren einer Testphase. Beide Sprachen,
 * echte Umlaute. Die verbindliche Durchsetzung bleibt serverseitig
 * (requirePlatformAdmin + applyEntitlementChange, Quelle "manuell", Audit-Log).
 */
export const lizenzenDict = {
  de: {
    // Kopf
    eyebrow: "Betreiber",
    title: "Lizenzen",
    sub: "Vereinslizenzen dieser Instanz — Stufe, Status und Testphasen verwalten",
    demoNote: "Demo-Daten — echte Instanz aus GET /platform/entitlements.",

    // Kennzahlen
    kpiClubs: "Vereine",
    kpiLicensed: "Lizenziert",
    kpiActive: "Aktiv",
    kpiTrial: "Testphase",
    kpiPastDue: "Überfällig",
    kpiCanceled: "Gekündigt",
    kpiActiveSub: "aktive Lizenzen",
    kpiLicensedSub: "{n} lizenziert",

    // Tabelle
    dirEyebrow: "Verzeichnis",
    tableTitle: "Alle Vereinslizenzen",
    tableCaption: "Liste aller Vereine mit ihrer aktuellen Lizenz",
    colClub: "Verein",
    colTier: "Stufe",
    colStatus: "Status",
    colValidUntil: "Gültig bis",
    colMembers: "Mitglieder",
    colSource: "Quelle",
    colAction: "Aktion",
    actManage: "Verwalten",
    actCreate: "Lizenz anlegen",
    noLicense: "Keine Lizenz",
    unlimited: "Unbefristet",
    dash: "—",
    clubsCount: "{n} Vereine",
    membersTotal: "{n} gesamt",
    emptyTitle: "Keine Vereine",
    emptyBody: "Es sind noch keine Vereine auf dieser Plattform angelegt.",

    // Stufen
    tierBasic: "Basic",
    tierPro: "Pro",
    tierPremium: "Premium",

    // Status
    statusTrial: "Testphase",
    statusActive: "Aktiv",
    statusPastDue: "Überfällig",
    statusCanceled: "Gekündigt",

    // Quelle
    sourceStripe: "Stripe",
    sourceRevenuecat: "RevenueCat",
    sourceManual: "Manuell",

    // Modal
    modalEyebrow: "Lizenz",
    modalTitleManage: "Lizenz verwalten",
    modalTitleCreate: "Lizenz anlegen",
    fieldTier: "Stufe",
    fieldStatus: "Status",
    fieldValidUntil: "Gültig bis",
    fieldValidUntilHint: "Leer lassen = unbefristet.",
    fieldTrialDays: "Testphase (Tage)",
    fieldTrialDaysHint:
      "Optional — setzt den Status auf Testphase und lässt den Server das Enddatum berechnen (überschreibt „Gültig bis“).",
    fieldTrialDaysError: "Bitte eine ganze Zahl größer als 0 eingeben.",
    fieldReason: "Begründung",
    fieldReasonHint: "Wird ins Audit-Log geschrieben (optional, aber empfohlen).",
    reasonPlaceholder: "z. B. Kulanz nach Ausfall, Vertragswechsel …",

    auditTitle: "Wird protokolliert",
    auditBody:
      "Diese Änderung setzt die Quelle auf „Manuell“ und wird mit deiner Betreiber-Kennung im Audit-Log festgehalten.",
    cancelWarnTitle: "Lizenz wird gekündigt",
    cancelWarnBody:
      "Der Verein verliert nach Ablauf die PRO-Funktionen. Die Änderung ist über eine neue Lizenz umkehrbar.",

    save: "Speichern",
    saving: "Speichern …",
    cancel: "Abbrechen",

    // Rückmeldungen
    savedToast: "Lizenz für „{club}“ gespeichert.",
    forbiddenToast: "Keine Berechtigung — nur Plattform-Administrator:innen dürfen Lizenzen setzen.",
    err403: "Keine Berechtigung für diese Aktion.",
    err409: "Ungültiger Statusübergang — dieser Wechsel ist nicht erlaubt.",
    err422: "Unbekannte Stufe oder unbekanntes Produkt.",

    // Zustände
    loadErrorTitle: "Lizenzen konnten nicht geladen werden",
    retry: "Erneut versuchen",
    noAccessTitle: "Kein Zugriff auf die Betreiber-Ebene",
    noAccessBody:
      "Diese Ansicht ist Plattform-Administrator:innen vorbehalten. Melde dich mit einem Konto an, dessen Token app_metadata.is_platform_admin trägt.",
    backToPortal: "Zum Vereinsportal",
  },
  en: {
    eyebrow: "Operator",
    title: "Licences",
    sub: "Club licences of this instance — manage tier, status and trials",
    demoNote: "Demo data — real instance from GET /platform/entitlements.",

    kpiClubs: "Clubs",
    kpiLicensed: "Licensed",
    kpiActive: "Active",
    kpiTrial: "Trial",
    kpiPastDue: "Past due",
    kpiCanceled: "Canceled",
    kpiActiveSub: "active licences",
    kpiLicensedSub: "{n} licensed",

    dirEyebrow: "Directory",
    tableTitle: "All club licences",
    tableCaption: "List of all clubs with their current licence",
    colClub: "Club",
    colTier: "Tier",
    colStatus: "Status",
    colValidUntil: "Valid until",
    colMembers: "Members",
    colSource: "Source",
    colAction: "Action",
    actManage: "Manage",
    actCreate: "Create licence",
    noLicense: "No licence",
    unlimited: "Unlimited",
    dash: "—",
    clubsCount: "{n} clubs",
    membersTotal: "{n} total",
    emptyTitle: "No clubs",
    emptyBody: "No clubs have been created on this platform yet.",

    tierBasic: "Basic",
    tierPro: "Pro",
    tierPremium: "Premium",

    statusTrial: "Trial",
    statusActive: "Active",
    statusPastDue: "Past due",
    statusCanceled: "Canceled",

    sourceStripe: "Stripe",
    sourceRevenuecat: "RevenueCat",
    sourceManual: "Manual",

    modalEyebrow: "Licence",
    modalTitleManage: "Manage licence",
    modalTitleCreate: "Create licence",
    fieldTier: "Tier",
    fieldStatus: "Status",
    fieldValidUntil: "Valid until",
    fieldValidUntilHint: "Leave empty = unlimited.",
    fieldTrialDays: "Trial (days)",
    fieldTrialDaysHint:
      "Optional — sets the status to trial and lets the server compute the end date (overrides “valid until”).",
    fieldTrialDaysError: "Please enter a whole number greater than 0.",
    fieldReason: "Reason",
    fieldReasonHint: "Written to the audit log (optional, but recommended).",
    reasonPlaceholder: "e.g. goodwill after outage, contract change …",

    auditTitle: "This will be logged",
    auditBody:
      "This change sets the source to “Manual” and is recorded in the audit log with your operator identity.",
    cancelWarnTitle: "Licence will be canceled",
    cancelWarnBody:
      "The club loses PRO features once it expires. The change is reversible via a new licence.",

    save: "Save",
    saving: "Saving …",
    cancel: "Cancel",

    savedToast: "Licence for “{club}” saved.",
    forbiddenToast: "Not allowed — only platform administrators may set licences.",
    err403: "You are not allowed to perform this action.",
    err409: "Invalid status transition — this change is not permitted.",
    err422: "Unknown tier or unknown product.",

    loadErrorTitle: "Licences could not be loaded",
    retry: "Try again",
    noAccessTitle: "No access to the operator plane",
    noAccessBody:
      "This view is reserved for platform administrators. Sign in with an account whose token carries app_metadata.is_platform_admin.",
    backToPortal: "To club portal",
  },
} satisfies Dict;

export type LizenzenKey = keyof (typeof lizenzenDict)["de"];
