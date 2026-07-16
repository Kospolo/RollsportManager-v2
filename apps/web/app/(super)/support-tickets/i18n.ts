import type { Dict } from "@/lib/i18n";
import type { BadgeTone } from "@/components/ui/Badge";
import type { SupportTicketPriority, SupportTicketStatus } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary der Support-Sicht des BETREIBERS (alle Vereine).
 * Die Vereins-Seite ((portal)/support) hat ihr eigenes Dictionary — sie spricht
 * mit dem Verein, diese hier mit Marcel. Gemeinsame Beschriftungen wären eine
 * falsche Sparsamkeit: „Dein Anliegen“ und „Ticket von RSV Mannheim“ sind nicht
 * dasselbe.
 */
export const supportOpsDict = {
  de: {
    title: "Support",
    sub: "Alle Anliegen aller Vereine — antworten, Status und Dringlichkeit setzen",
    demoNote: "Demo-Daten — in der echten Instanz stammt alles aus GET /platform/support/tickets.",

    // Kennzahlen
    kpiOpen: "Offen",
    kpiInProgress: "In Arbeit",
    kpiWaiting: "Wartet auf Verein",
    kpiUrgent: "Dringend",

    // Liste
    listEyebrow: "Über alle Vereine",
    listTitle: "Tickets",
    listCaption: "Alle Support-Tickets aller Vereine",
    colSubject: "Betreff",
    colClub: "Verein",
    colStatus: "Status",
    colPriority: "Dringlichkeit",
    colMessages: "Nachrichten",
    colLastReply: "Letzte Regung",
    ticketsCount: "{n} Tickets",
    empty: "Keine Tickets vorhanden.",
    emptyBody: "Wenn ein Verein ein Anliegen meldet, erscheint es hier.",
    noMatch: "Kein Ticket passt zum Filter.",
    noMatchBody: "Anderen Filter wählen oder zurücksetzen.",
    clearFilter: "Filter leeren",
    filterLabel: "Tickets filtern",
    clubLabel: "Verein",
    clubAll: "Alle Vereine",
    statusLabel: "Status",
    statusAll: "Alle",
    openTicket: "Öffnen",

    // Status/Dringlichkeit
    statusOpen: "Offen",
    statusInProgress: "In Arbeit",
    statusWaiting: "Wartet auf Verein",
    statusClosed: "Geschlossen",
    prioLow: "Niedrig",
    prioNormal: "Normal",
    prioHigh: "Hoch",
    prioUrgent: "Dringend",

    // Verlauf
    threadEyebrow: "Ticket",
    byClub: "Verein",
    byPlatform: "Support-Team",
    supportTeam: "Support-Team",
    close: "Schließen",
    backToList: "Zurück zur Liste",
    replyLabel: "Antwort an den Verein",
    replyPlaceholder: "Antwort schreiben …",
    send: "Antworten",
    sending: "Wird gesendet …",
    replySent: "Antwort gesendet.",
    setStatus: "Status setzen",
    setPriority: "Dringlichkeit setzen",
    statusSaved: "Status auf „{status}“ gesetzt.",
    prioSaved: "Dringlichkeit auf „{prio}“ gesetzt.",
    closedNote:
      "Dieses Ticket ist geschlossen. Ein geschlossenes Ticket nimmt keine Antworten mehr an — der Verein macht bei Bedarf ein neues auf.",
    appendOnlyNote:
      "Der Verlauf ist anhängend: Nachrichten lassen sich nicht ändern und nicht löschen — auch von dir nicht. Ein Verlauf, den eine Seite nachträglich umschreiben kann, wäre als Nachweis wertlos.",
    noMailNote:
      "Es wird KEINE E-Mail verschickt. Der Verein sieht deine Antwort, wenn er die Support-Seite öffnet.",

    loadErrorTitle: "Tickets konnten nicht geladen werden",
    retry: "Erneut versuchen",
  },
  en: {
    title: "Support",
    sub: "Every request from every club — reply, set status and priority",
    demoNote: "Demo data — the real instance sources everything from GET /platform/support/tickets.",

    kpiOpen: "Open",
    kpiInProgress: "In progress",
    kpiWaiting: "Waiting on club",
    kpiUrgent: "Urgent",

    listEyebrow: "Across all clubs",
    listTitle: "Tickets",
    listCaption: "All support tickets of all clubs",
    colSubject: "Subject",
    colClub: "Club",
    colStatus: "Status",
    colPriority: "Priority",
    colMessages: "Messages",
    colLastReply: "Last activity",
    ticketsCount: "{n} tickets",
    empty: "No tickets yet.",
    emptyBody: "When a club reports an issue, it shows up here.",
    noMatch: "No ticket matches the filter.",
    noMatchBody: "Pick a different filter or reset it.",
    clearFilter: "Clear filter",
    filterLabel: "Filter tickets",
    clubLabel: "Club",
    clubAll: "All clubs",
    statusLabel: "Status",
    statusAll: "All",
    openTicket: "Open",

    statusOpen: "Open",
    statusInProgress: "In progress",
    statusWaiting: "Waiting on club",
    statusClosed: "Closed",
    prioLow: "Low",
    prioNormal: "Normal",
    prioHigh: "High",
    prioUrgent: "Urgent",

    threadEyebrow: "Ticket",
    byClub: "Club",
    byPlatform: "Support team",
    supportTeam: "Support team",
    close: "Close",
    backToList: "Back to list",
    replyLabel: "Reply to the club",
    replyPlaceholder: "Write a reply …",
    send: "Reply",
    sending: "Sending …",
    replySent: "Reply sent.",
    setStatus: "Set status",
    setPriority: "Set priority",
    statusSaved: "Status set to “{status}”.",
    prioSaved: "Priority set to “{prio}”.",
    closedNote:
      "This ticket is closed. A closed ticket accepts no further replies — the club opens a new one if needed.",
    appendOnlyNote:
      "The thread is append-only: messages cannot be edited or deleted — not even by you. A thread one side could rewrite afterwards would be worthless as evidence.",
    noMailNote:
      "NO email is sent. The club sees your reply when it opens the support page.",

    loadErrorTitle: "Tickets could not be loaded",
    retry: "Try again",
  },
} satisfies Dict;

export type SupportOpsKey = keyof (typeof supportOpsDict)["de"];

/* Status/Priorität → Beschriftung + Farbton. „honey“ fehlt bewusst: der Ton
   gehört laut Badge.tsx ausschließlich dem Musik-/Küren-Kontext. */

export const STATUS_KEY: Record<SupportTicketStatus, SupportOpsKey> = {
  open: "statusOpen",
  in_progress: "statusInProgress",
  waiting_on_club: "statusWaiting",
  closed: "statusClosed",
};

export const STATUS_TONE: Record<SupportTicketStatus, BadgeTone> = {
  open: "info",
  in_progress: "brand",
  waiting_on_club: "warn",
  closed: "neutral",
};

export const PRIORITY_KEY: Record<SupportTicketPriority, SupportOpsKey> = {
  low: "prioLow",
  normal: "prioNormal",
  high: "prioHigh",
  urgent: "prioUrgent",
};

export const PRIORITY_TONE: Record<SupportTicketPriority, BadgeTone> = {
  low: "neutral",
  normal: "neutral",
  high: "warn",
  urgent: "danger",
};

export const STATUS_OPTIONS: readonly SupportTicketStatus[] = [
  "open",
  "in_progress",
  "waiting_on_club",
  "closed",
];

export const PRIORITY_OPTIONS: readonly SupportTicketPriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
];
