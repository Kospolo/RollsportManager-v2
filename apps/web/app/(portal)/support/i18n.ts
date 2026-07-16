import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary der Vereins-Support-Seite (Migration 0052).
 *
 * Regel des Hauses: JEDER String in beiden Sprachen, deutsche Strings mit
 * echten Umlauten (ä/ö/ü/ß) — nie ae/oe/ue/ss.
 */
export const supportDict = {
  de: {
    title: "Support",
    sub: "Anliegen an das RollsportManager-Team — mit Verlauf",
    newTicket: "Neues Anliegen",

    // Sperr-Zustand (kein Vorstand)
    lockedTitle: "Nur für den Vorstand",
    lockedBody:
      "Support-Anliegen sind dem Vorstand vorbehalten (Inhaber:in, Administrator:in, Moderator:in). Ein Anliegen enthält oft Namen und Daten einzelner Mitglieder — deshalb ist der Zugang bewusst eng. Wende dich an den Vorstand deines Vereins.",

    // Lade- & Fehlerzustände
    retry: "Erneut versuchen",
    loadErrorTitle: "Anliegen konnten nicht geladen werden",
    loadErrorBody: "Die Support-Anliegen ließen sich gerade nicht laden — bitte erneut versuchen.",
    genericError: "Etwas ist schiefgelaufen — bitte erneut versuchen.",

    // Leerzustand
    emptyTitle: "Noch kein Anliegen",
    emptyBody:
      "Klemmt etwas oder fehlt etwas? Mach ein Anliegen auf — das Support-Team antwortet direkt hier im Verlauf.",
    emptyCta: "Erstes Anliegen aufmachen",

    // Liste
    oneTicket: "1 Anliegen",
    ticketsCount: "{n} Anliegen",
    openedBy: "Aufgemacht von {name}",
    openedAt: "Aufgemacht {when}",
    lastReply: "Letzte Antwort {when}",
    noReplyYet: "Noch keine Antwort",
    oneMessage: "1 Nachricht",
    messagesCount: "{n} Nachrichten",
    waitingHint: "Das Support-Team wartet auf eine Rückmeldung von euch.",

    // Status
    statusOpen: "Offen",
    statusInProgress: "In Arbeit",
    statusWaiting: "Wartet auf Rückmeldung",
    statusClosed: "Geschlossen",

    // Priorität
    prioLow: "Niedrig",
    prioNormal: "Normal",
    prioHigh: "Hoch",
    prioUrgent: "Dringend",

    // Anlegen
    createEyebrow: "Neues Anliegen",
    createTitle: "Anliegen aufmachen",
    fSubject: "Betreff",
    fSubjectPlaceholder: "z. B. Beitragsrechnung wird doppelt erzeugt",
    fBody: "Beschreibung",
    fBodyPlaceholder: "Was ist passiert? Was hast du erwartet? Wann tritt es auf?",
    fRequired: "Bitte ausfüllen.",
    cancel: "Abbrechen",
    submit: "Anliegen aufmachen",
    submitting: "Wird gesendet …",
    createdToast: "Anliegen aufgemacht",

    // Hinweis: kein Mailversand
    noMailHint:
      "Hinweis: Es wird keine E-Mail verschickt. Antworten erscheinen hier auf dieser Seite — bitte schau gelegentlich vorbei.",

    // Verlauf
    threadEyebrow: "Anliegen",
    back: "Zurück zur Liste",
    authorPlatform: "Support-Team",
    authorClubFallback: "Verein",
    you: "Ihr",
    fReply: "Antwort",
    fReplyPlaceholder: "Antwort an das Support-Team …",
    reply: "Antworten",
    replying: "Wird gesendet …",
    repliedToast: "Antwort gesendet",
    closedHint:
      "Dieses Anliegen ist geschlossen. Du kannst weiterhin schreiben — das Support-Team macht es bei Bedarf wieder auf.",
    detailErrorTitle: "Anliegen konnte nicht geladen werden",
    detailErrorBody: "Dieses Anliegen ließ sich gerade nicht laden — bitte erneut versuchen.",
  },
  en: {
    title: "Support",
    sub: "Requests to the RollsportManager team — with full history",
    newTicket: "New request",

    lockedTitle: "Board members only",
    lockedBody:
      "Support requests are restricted to the club board (owner, administrator, moderator). A request often contains names and details of individual members — which is why access is deliberately narrow. Please contact your club board.",

    retry: "Try again",
    loadErrorTitle: "Requests could not be loaded",
    loadErrorBody: "The support requests could not be loaded just now — please try again.",
    genericError: "Something went wrong — please try again.",

    emptyTitle: "No requests yet",
    emptyBody:
      "Something broken or missing? Open a request — the support team replies right here in the thread.",
    emptyCta: "Open your first request",

    oneTicket: "1 request",
    ticketsCount: "{n} requests",
    openedBy: "Opened by {name}",
    openedAt: "Opened {when}",
    lastReply: "Last reply {when}",
    noReplyYet: "No reply yet",
    oneMessage: "1 message",
    messagesCount: "{n} messages",
    waitingHint: "The support team is waiting for your reply.",

    statusOpen: "Open",
    statusInProgress: "In progress",
    statusWaiting: "Waiting for your reply",
    statusClosed: "Closed",

    prioLow: "Low",
    prioNormal: "Normal",
    prioHigh: "High",
    prioUrgent: "Urgent",

    createEyebrow: "New request",
    createTitle: "Open a request",
    fSubject: "Subject",
    fSubjectPlaceholder: "e.g. Membership invoice is created twice",
    fBody: "Description",
    fBodyPlaceholder: "What happened? What did you expect? When does it occur?",
    fRequired: "Please fill this in.",
    cancel: "Cancel",
    submit: "Open request",
    submitting: "Sending …",
    createdToast: "Request opened",

    noMailHint:
      "Note: no e-mail is sent. Replies appear here on this page — please check back occasionally.",

    threadEyebrow: "Request",
    back: "Back to the list",
    authorPlatform: "Support team",
    authorClubFallback: "Club",
    you: "You",
    fReply: "Reply",
    fReplyPlaceholder: "Reply to the support team …",
    reply: "Send reply",
    replying: "Sending …",
    repliedToast: "Reply sent",
    closedHint:
      "This request is closed. You can still write — the support team will reopen it if needed.",
    detailErrorTitle: "Request could not be loaded",
    detailErrorBody: "This request could not be loaded just now — please try again.",
  },
} satisfies Dict;
