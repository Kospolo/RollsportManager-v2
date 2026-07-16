import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary des BETREIBER-DASHBOARDS (Startseite der Konsole).
 * Beide Sprachen, echte Umlaute.
 *
 * Die Verzeichnis-Tabellen (alle Vereine / alle Nutzer) sind von hier nach
 * /vereine gezogen: sie beantworten „wer ist da?“, das Dashboard beantwortet
 * „was muss ich tun?“. Vorher war beides eine Seite, und die Handlungspunkte
 * gingen zwischen den Tabellenzeilen unter.
 */
export const plattformDict = {
  de: {
    title: "Betreiber-Dashboard",
    sub: "Der Stand deiner Plattform auf einen Blick",
    demoNote: "Demo-Daten — in der echten Instanz stammt alles aus GET /platform/*.",

    // Kennzahlen (GET /platform/stats)
    statsEyebrow: "Kennzahlen",
    kpiClubs: "Vereine",
    kpiUsers: "Nutzer",
    kpiMembers: "Mitgliedschaften",
    kpiTeams: "Teams",
    kpiEvents: "Termine",
    kpiOpenInvoices: "Offene Rechnungen",
    activeSub: "aktive Mitgliedschaften",
    toClubs: "Alle Vereine ansehen",

    // Abo-Zustände (server-gerechnet: subscription_summary aus /platform/payments)
    subsEyebrow: "Abos",
    subsTitle: "Lizenz-Zustände",
    subsActive: "Aktiv",
    subsTrial: "Testphase",
    subsPastDue: "Überfällig",
    subsCanceled: "Gekündigt",
    subsLicensed: "Vereine mit Lizenz",
    toLicenses: "Zu den Lizenzen",

    // Der fehlende Umsatz — ausdrücklich benannt statt geraten
    revenueEyebrow: "Umsatz",
    revenueTitle: "Umsatzzahlen gibt es hier noch nicht",
    revenueBody:
      "Kein Endpunkt liefert Beträge: /platform/payments gibt Webhook-Ereignisse ohne Summen zurück. Aus Tarif × Preisliste einen MRR zu basteln wäre geraten — die Zuordnung Stufe → Produkt ist nirgends hinterlegt, und der Zahl sähe niemand an, dass sie erfunden ist. Was du siehst, ist belegt: Abo-Zustände und offene Rechnungen.",

    // Testphasen
    trialsEyebrow: "Fällig",
    trialsTitle: "Testphasen, die auslaufen",
    trialsCaption: "Vereine in der Testphase mit Enddatum in den nächsten 30 Tagen",
    trialsEmpty: "Keine Testphase läuft in den nächsten 30 Tagen aus.",
    trialsEmptyBody: "Nichts zu tun — das ist die gute Nachricht.",
    colClub: "Verein",
    colTier: "Stufe",
    colEnds: "Endet",
    colDays: "Tage",
    colMembers: "Mitglieder",
    expired: "Abgelaufen",
    today: "Heute",

    // Überfällige
    pastDueEyebrow: "Geld",
    pastDueTitle: "Überfällige Zahlungen",
    pastDueCaption: "Vereine, deren Lizenz auf überfällig steht",
    pastDueEmpty: "Kein Verein ist überfällig.",
    pastDueEmptyBody: "Alle zahlenden Vereine sind im Soll.",

    // Support
    supportEyebrow: "Wartet auf dich",
    supportTitle: "Offene Support-Tickets",
    supportCaption: "Tickets im Zustand offen oder in Arbeit",
    supportEmpty: "Keine offenen Tickets.",
    supportEmptyBody: "Alles beantwortet.",
    supportNote:
      "„Wartet auf Verein“ fehlt hier bewusst: dort hast du geantwortet und wartest selbst.",
    toSupport: "Zum Support",
    colSubject: "Betreff",
    colPriority: "Dringlichkeit",
    colLastReply: "Letzte Regung",

    // Ereignisse
    eventsEyebrow: "Zuletzt",
    eventsTitle: "Letzte Zahlungs-Ereignisse",
    eventsCaption: "Die jüngsten Webhook-Ereignisse der Zahlungsanbieter",
    eventsEmpty: "Noch keine Zahlungs-Ereignisse.",
    eventsEmptyBody: "Sobald Stripe oder RevenueCat etwas meldet, steht es hier.",
    colProvider: "Anbieter",
    colEvent: "Ereignis",
    colStatus: "Status",
    colReceived: "Eingang",
    toPayments: "Zu den Zahlungen",

    // Zustände
    loadErrorTitle: "Plattform-Daten konnten nicht geladen werden",
    retry: "Erneut versuchen",
  },
  en: {
    title: "Operator dashboard",
    sub: "The state of your platform at a glance",
    demoNote: "Demo data — the real instance sources everything from GET /platform/*.",

    statsEyebrow: "Key figures",
    kpiClubs: "Clubs",
    kpiUsers: "Users",
    kpiMembers: "Memberships",
    kpiTeams: "Teams",
    kpiEvents: "Events",
    kpiOpenInvoices: "Open invoices",
    activeSub: "active memberships",
    toClubs: "View all clubs",

    subsEyebrow: "Subscriptions",
    subsTitle: "Licence states",
    subsActive: "Active",
    subsTrial: "Trial",
    subsPastDue: "Past due",
    subsCanceled: "Cancelled",
    subsLicensed: "Clubs with a licence",
    toLicenses: "To the licences",

    revenueEyebrow: "Revenue",
    revenueTitle: "Revenue figures are not available here yet",
    revenueBody:
      "No endpoint returns amounts: /platform/payments returns webhook events without sums. Deriving an MRR from tier × price list would be guesswork — the tier→product mapping is stored nowhere, and nobody would be able to tell the number was invented. What you see is evidenced: subscription states and open invoices.",

    trialsEyebrow: "Due",
    trialsTitle: "Trials about to end",
    trialsCaption: "Clubs on trial whose term ends within the next 30 days",
    trialsEmpty: "No trial ends within the next 30 days.",
    trialsEmptyBody: "Nothing to do — that is the good news.",
    colClub: "Club",
    colTier: "Tier",
    colEnds: "Ends",
    colDays: "Days",
    colMembers: "Members",
    expired: "Expired",
    today: "Today",

    pastDueEyebrow: "Money",
    pastDueTitle: "Past-due payments",
    pastDueCaption: "Clubs whose licence is past due",
    pastDueEmpty: "No club is past due.",
    pastDueEmptyBody: "All paying clubs are up to date.",

    supportEyebrow: "Waiting for you",
    supportTitle: "Open support tickets",
    supportCaption: "Tickets in state open or in progress",
    supportEmpty: "No open tickets.",
    supportEmptyBody: "Everything answered.",
    supportNote:
      "“Waiting on club” is deliberately absent: there you have replied and are waiting yourself.",
    toSupport: "To support",
    colSubject: "Subject",
    colPriority: "Priority",
    colLastReply: "Last activity",

    eventsEyebrow: "Recently",
    eventsTitle: "Latest payment events",
    eventsCaption: "The most recent webhook events from the payment providers",
    eventsEmpty: "No payment events yet.",
    eventsEmptyBody: "As soon as Stripe or RevenueCat reports something it appears here.",
    colProvider: "Provider",
    colEvent: "Event",
    colStatus: "Status",
    colReceived: "Received",
    toPayments: "To the payments",

    loadErrorTitle: "Platform data could not be loaded",
    retry: "Try again",
  },
} satisfies Dict;

export type PlattformKey = keyof (typeof plattformDict)["de"];
