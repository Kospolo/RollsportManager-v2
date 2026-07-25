import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary für die Meldungen-Verwaltung (Verstösse im Chat,
 * Migration 0082). Sichtbar nur für Vereinsvorstand + Betreiber; die Wahrheit
 * ist serverseitig (RLS). Regel: JEDER String in beiden Sprachen, deutsche
 * Strings mit echten Umlauten (ä/ö/ü/ß).
 */
export const meldungenDict = {
  de: {
    eyebrow: "Verwaltung",
    title: "Meldungen",
    sub: "Gemeldete Verstösse im Chat",
    refresh: "Aktualisieren",
    retry: "Erneut versuchen",

    listHeading: "Gemeldete Verstösse",
    cardTitle: "Verstoss im Chat gemeldet",
    reportedBy: "Gemeldet von {name}",
    against: "Betrifft {name}",
    unknownMember: "Unbekannt",
    openDetail: "Meldung öffnen",

    emptyTitle: "Keine Meldungen",
    emptyBody: "Aktuell liegen keine gemeldeten Verstösse vor.",
    loadErrorTitle: "Meldungen konnten nicht geladen werden",
    loadErrorBody: "Die Meldungen ließen sich gerade nicht laden — bitte erneut versuchen.",
    noAccessTitle: "Kein Zugriff",
    noAccessBody: "Meldungen sehen nur der Vereinsvorstand und der Betreiber.",
    noAccessCta: "Zum Dashboard",

    // Detail
    detailEyebrow: "Meldung",
    statusLabel: "Status",
    reasonLabel: "Grund der Meldung",
    reporterLabel: "Melder",
    reportedLabel: "Gemeldete Person",
    ipLabel: "IP-Adresse",
    ipUnknown: "nicht erfasst",
    reportedAtLabel: "Gemeldet am",
    capturedAtLabel: "Aufgenommen am",
    handledLabel: "Bearbeitet von {name} am {date}",
    contactLabel: "Kontakt",
    noContact: "Keine Kontaktdaten hinterlegt",

    snapshotHeading: "Nachrichtenverlauf (Snapshot)",
    snapshotNote:
      "Serverseitig zum Meldezeitpunkt aufgenommen — bleibt erhalten, auch wenn die Nachricht später gelöscht wird.",
    reportedMessageBadge: "Gemeldet",
    noBody: "(kein Text)",
    imageAttached: "Bild angehängt",

    print: "Drucken",
    statusUpdatedToast: "Status aktualisiert",
    statusUpdateError: "Status konnte nicht geändert werden — bitte erneut versuchen.",

    // Nachricht an Melder / Gemeldete Person
    messageReporter: "Nachricht an Melder",
    messageReported: "Nachricht an gemeldete Person",
    sendEyebrow: "Direktnachricht",
    sendTitle: "Nachricht an {name}",
    sendLabel: "Nachricht",
    sendPlaceholder: "Nachricht schreiben …",
    sendSubmit: "Senden",
    sendRequired: "Bitte schreibe eine Nachricht.",
    sentToast: "Nachricht gesendet",
    sendError: "Nachricht konnte nicht gesendet werden — bitte erneut versuchen.",

    cancel: "Abbrechen",
    close: "Schließen",
    genericError: "Etwas ist schiefgelaufen — bitte erneut versuchen.",

    // Druckansicht
    printEyebrow: "Vereinsinterne Meldung",
    printTitle: "Meldung eines Chat-Verstosses",
    printBack: "Zurück zu den Meldungen",
    printNotFound: "Meldung nicht gefunden",
    printReportId: "Meldungs-Nr.",
    printBoardNote:
      "Diese Meldung ist zur Bearbeitung durch den Vereinsvorstand bestimmt und enthält personenbezogene Daten — bitte vertraulich behandeln.",
  },
  en: {
    eyebrow: "Administration",
    title: "Reports",
    sub: "Reported chat violations",
    refresh: "Refresh",
    retry: "Try again",

    listHeading: "Reported violations",
    cardTitle: "Chat violation reported",
    reportedBy: "Reported by {name}",
    against: "Concerns {name}",
    unknownMember: "Unknown",
    openDetail: "Open report",

    emptyTitle: "No reports",
    emptyBody: "There are currently no reported violations.",
    loadErrorTitle: "Reports could not be loaded",
    loadErrorBody: "The reports could not be loaded right now — please try again.",
    noAccessTitle: "No access",
    noAccessBody: "Only the club board and the platform operator can see reports.",
    noAccessCta: "To the dashboard",

    detailEyebrow: "Report",
    statusLabel: "Status",
    reasonLabel: "Reason for the report",
    reporterLabel: "Reporter",
    reportedLabel: "Reported person",
    ipLabel: "IP address",
    ipUnknown: "not captured",
    reportedAtLabel: "Reported on",
    capturedAtLabel: "Captured on",
    handledLabel: "Handled by {name} on {date}",
    contactLabel: "Contact",
    noContact: "No contact details on file",

    snapshotHeading: "Message history (snapshot)",
    snapshotNote:
      "Captured server-side at report time — it stays on file even if the message is deleted later.",
    reportedMessageBadge: "Reported",
    noBody: "(no text)",
    imageAttached: "Image attached",

    print: "Print",
    statusUpdatedToast: "Status updated",
    statusUpdateError: "The status could not be changed — please try again.",

    messageReporter: "Message the reporter",
    messageReported: "Message the reported person",
    sendEyebrow: "Direct message",
    sendTitle: "Message to {name}",
    sendLabel: "Message",
    sendPlaceholder: "Write a message …",
    sendSubmit: "Send",
    sendRequired: "Please write a message.",
    sentToast: "Message sent",
    sendError: "The message could not be sent — please try again.",

    cancel: "Cancel",
    close: "Close",
    genericError: "Something went wrong — please try again.",

    printEyebrow: "Internal club report",
    printTitle: "Report of a chat violation",
    printBack: "Back to reports",
    printNotFound: "Report not found",
    printReportId: "Report no.",
    printBoardNote:
      "This report is intended for handling by the club board and contains personal data — please treat it as confidential.",
  },
} satisfies Dict;

export type MeldungenKey = keyof (typeof meldungenDict)["de"];
