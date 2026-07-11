import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Betreiber-Ansicht „Zahlungen" ((super)-Ebene).
 * Reine Lesesicht auf Webhook-/Zahlungs-Ereignisse (Stripe/RevenueCat) plus die
 * aggregierten Abo-Zustände. Beide Sprachen, echte Umlaute.
 */
export const zahlungenDict = {
  de: {
    title: "Zahlungen & Abos",
    sub: "Betreiber-Sicht auf alle Webhook-Ereignisse und Abo-Zustände dieser Instanz",
    demoNote: "Demo-Daten — in der echten Instanz stammt alles aus GET /platform/payments.",

    // Abo-Zusammenfassung
    summaryEyebrow: "Abo-Zustände",
    summaryTitle: "Aktive Lizenzen über alle Vereine",
    kpiActive: "Aktiv",
    kpiActiveSub: "laufende Abos",
    kpiTrial: "Testphase",
    kpiTrialSub: "in der Testphase",
    kpiPastDue: "Überfällig",
    kpiPastDueSub: "Zahlung ausstehend",
    kpiCanceled: "Gekündigt",
    kpiCanceledSub: "beendete Abos",
    kpiLicensed: "Lizenzierte Vereine",
    kpiLicensedSub: "mit gültiger Lizenz",

    // Filter
    providerFilterLabel: "Nach Anbieter filtern",
    statusFilterLabel: "Nach Status filtern",
    filterAll: "Alle",

    // Ereignis-Tabelle
    eventsEyebrow: "Verlauf",
    eventsTitle: "Zahlungs-Ereignisse",
    eventsCaption: "Liste aller Webhook-/Zahlungs-Ereignisse der Plattform",
    colProvider: "Anbieter",
    colEvent: "Ereignis",
    colStatus: "Status",
    colReceived: "Eingang",
    colProcessed: "Verarbeitet",
    colDetail: "Detail",
    detailAction: "Details",
    notProcessed: "—",
    eventsEmpty: "Keine Ereignisse",
    eventsEmptyBody: "Für die gewählten Filter liegen keine Zahlungs-Ereignisse vor.",

    // Paging
    pageInfo: "{from}–{to} von {total}",
    pagePrev: "Zurück",
    pageNext: "Weiter",

    // Detail
    detailEyebrow: "Zahlungs-Ereignis",
    dProvider: "Anbieter",
    dEventType: "Ereignis-Typ",
    dEventId: "Ereignis-ID",
    dStatus: "Status",
    dError: "Fehler",
    dNoError: "kein Fehler",
    dReceived: "Eingegangen",
    dProcessed: "Verarbeitet",
    dNotProcessed: "noch nicht verarbeitet",

    // Anbieter-Bezeichnungen
    pStripe: "Stripe",
    pRevenuecat: "RevenueCat",

    // Status-Bezeichnungen
    stReceived: "Eingegangen",
    stProcessed: "Verarbeitet",
    stFailed: "Fehlgeschlagen",
    stSkipped: "Übersprungen",

    // Zustände
    loadErrorTitle: "Zahlungs-Daten konnten nicht geladen werden",
    retry: "Erneut versuchen",
    noAccessTitle: "Kein Zugriff auf die Betreiber-Ebene",
    noAccessBody:
      "Diese Ansicht ist Plattform-Administrator:innen vorbehalten. Melde dich mit einem Konto an, dessen Token app_metadata.is_platform_admin trägt.",
    backToPortal: "Zum Vereinsportal",
  },
  en: {
    title: "Payments & subscriptions",
    sub: "Operator view of every webhook event and subscription state on this instance",
    demoNote: "Demo data — the real instance sources everything from GET /platform/payments.",

    summaryEyebrow: "Subscription states",
    summaryTitle: "Active licences across all clubs",
    kpiActive: "Active",
    kpiActiveSub: "running subscriptions",
    kpiTrial: "Trial",
    kpiTrialSub: "in trial phase",
    kpiPastDue: "Past due",
    kpiPastDueSub: "payment outstanding",
    kpiCanceled: "Cancelled",
    kpiCanceledSub: "ended subscriptions",
    kpiLicensed: "Licensed clubs",
    kpiLicensedSub: "with a valid licence",

    providerFilterLabel: "Filter by provider",
    statusFilterLabel: "Filter by status",
    filterAll: "All",

    eventsEyebrow: "History",
    eventsTitle: "Payment events",
    eventsCaption: "List of all webhook/payment events on the platform",
    colProvider: "Provider",
    colEvent: "Event",
    colStatus: "Status",
    colReceived: "Received",
    colProcessed: "Processed",
    colDetail: "Detail",
    detailAction: "Details",
    notProcessed: "—",
    eventsEmpty: "No events",
    eventsEmptyBody: "There are no payment events for the selected filters.",

    pageInfo: "{from}–{to} of {total}",
    pagePrev: "Previous",
    pageNext: "Next",

    detailEyebrow: "Payment event",
    dProvider: "Provider",
    dEventType: "Event type",
    dEventId: "Event ID",
    dStatus: "Status",
    dError: "Error",
    dNoError: "no error",
    dReceived: "Received",
    dProcessed: "Processed",
    dNotProcessed: "not processed yet",

    pStripe: "Stripe",
    pRevenuecat: "RevenueCat",

    stReceived: "Received",
    stProcessed: "Processed",
    stFailed: "Failed",
    stSkipped: "Skipped",

    loadErrorTitle: "Payment data could not be loaded",
    retry: "Try again",
    noAccessTitle: "No access to the operator plane",
    noAccessBody:
      "This view is reserved for platform administrators. Sign in with an account whose token carries app_metadata.is_platform_admin.",
    backToPortal: "To club portal",
  },
} satisfies Dict;

export type ZahlungenKey = keyof (typeof zahlungenDict)["de"];
