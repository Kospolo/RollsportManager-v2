import type { Dict } from "@/lib/i18n";

/**
 * Kolokalisiertes Dictionary des Check-in-Moduls (QR-Ersatz im Web): „Mein
 * QR-Code" zum Vorzeigen, Selbst-Einchecken für den heutigen/nächsten Termin,
 * die eigene Check-in-Historie sowie — für den Trainerstab — das manuelle
 * Einchecken eines Mitglieds und die Vereins-Historie. IMMER beide Sprachen
 * vollständig, deutsche Strings mit echten Umlauten.
 *
 * Rechte sind serverseitig (RLS + Rollencheck, Referenz 1.3): eigenen Check-in
 * legt jedes Mitglied an, andere einchecken + Vereins-Historie darf nur der
 * Trainerstab, löschen NUR Trainer:innen. Ein 403 kommt hier stets als
 * Klartext-Toast zurück, die Aktion bleibt ohne Wirkung (Rollback).
 */
export const checkinDict = {
  de: {
    /* Kopf */
    pageTitle: "Check-in",
    pageSub: "Zeig deinen Code, checke dich ein und behalte deine Anwesenheit im Blick",

    /* Leerzustände & Fehler (Facade) */
    retry: "Wiederholen",
    loadErrorTitle: "Check-in konnte nicht geladen werden",
    loadErrorBody: "Bitte versuche es später erneut.",
    notConnectedTitle: "Noch nicht angebunden",
    notConnectedBody: "Dieser Bereich hat im api-Modus noch keinen Endpoint.",
    unknownMember: "Unbekanntes Mitglied",
    unknownEvent: "Unbekannter Termin",

    /* Mein QR-Code */
    qrTitle: "Mein QR-Code",
    qrSub: "Zeig diesen Code beim Training zum Einchecken vor",
    qrCodeLabel: "Check-in-Code von {name}",
    qrHint: "Nur ein Vorzeig-Muster — es wird nichts übertragen oder gescannt.",
    qrIdLabel: "Mitglieds-ID",

    /* Selbst einchecken */
    selfTitle: "Selbst einchecken",
    selfSub: "Melde dich für dein heutiges Training an",
    selfCta: "Jetzt einchecken",
    selfDoneToast: "Eingecheckt.",
    selfTodayNote: "Du bist heute bereits eingecheckt.",
    forbidden: "Dafür fehlt dir die Berechtigung.",

    /* Termin-Auswahl (geteilt) */
    eventLabel: "Termin",
    eventHint: "Wähle den Termin, für den du dich einträgst.",
    noEvent: "Ohne Termin",
    todayGroup: "Heute",
    upcomingGroup: "Kommende Termine",

    /* Meine Check-in-Historie */
    historyTitle: "Meine Check-ins",
    historySub: "Alle deine Anwesenheiten — neueste zuerst",
    historyEmptyTitle: "Noch keine Check-ins",
    historyEmptyBody: "Sobald du eincheckst, erscheint deine Anwesenheit hier.",

    /* Trainer: Mitglied einchecken */
    trainerTitle: "Mitglied einchecken",
    trainerSub: "Checke ein Mitglied manuell für einen Termin ein",
    trainerMemberLabel: "Mitglied",
    trainerMemberPlaceholder: "Mitglied wählen…",
    trainerMemberError: "Bitte ein Mitglied wählen.",
    trainerCta: "Einchecken",
    trainerDoneToast: "{name} eingecheckt.",

    /* Trainer: Vereins-Historie */
    clubTitle: "Vereins-Check-ins",
    clubSub: "Alle Anwesenheiten des Vereins — neueste zuerst",
    clubEmptyTitle: "Noch keine Check-ins",
    clubEmptyBody: "Sobald jemand eincheckt, erscheint die Anwesenheit hier.",
    kpiTotal: "Gesamt",
    kpiWeek: "Diese Woche",
    kpiMonth: "Diesen Monat",

    /* Löschen (nur Trainer) */
    deleteAction: "Löschen",
    deleteEyebrow: "Check-in löschen",
    deleteTitle: "Check-in wirklich löschen?",
    deleteBody: "Der Check-in wird entfernt. Das lässt sich nicht rückgängig machen.",
    deleteConfirm: "Löschen",
    deletedToast: "Check-in gelöscht.",
    deleteForbidden: "Check-ins darf nur der Trainerstab löschen.",
    cancel: "Abbrechen",
  },
  en: {
    /* Kopf */
    pageTitle: "Check-in",
    pageSub: "Show your code, check yourself in and keep track of your attendance",

    /* Leerzustände & Fehler (Facade) */
    retry: "Retry",
    loadErrorTitle: "Check-in could not be loaded",
    loadErrorBody: "Please try again later.",
    notConnectedTitle: "Not connected yet",
    notConnectedBody: "This area has no endpoint in api mode yet.",
    unknownMember: "Unknown member",
    unknownEvent: "Unknown event",

    /* Mein QR-Code */
    qrTitle: "My QR code",
    qrSub: "Show this code at training to check in",
    qrCodeLabel: "Check-in code for {name}",
    qrHint: "Just a display pattern — nothing is transmitted or scanned.",
    qrIdLabel: "Member ID",

    /* Selbst einchecken */
    selfTitle: "Check yourself in",
    selfSub: "Register for your training today",
    selfCta: "Check in now",
    selfDoneToast: "Checked in.",
    selfTodayNote: "You are already checked in today.",
    forbidden: "You do not have permission for that.",

    /* Termin-Auswahl (geteilt) */
    eventLabel: "Event",
    eventHint: "Pick the event you are checking in for.",
    noEvent: "No event",
    todayGroup: "Today",
    upcomingGroup: "Upcoming events",

    /* Meine Check-in-Historie */
    historyTitle: "My check-ins",
    historySub: "All your attendances — newest first",
    historyEmptyTitle: "No check-ins yet",
    historyEmptyBody: "As soon as you check in, your attendance shows up here.",

    /* Trainer: Mitglied einchecken */
    trainerTitle: "Check a member in",
    trainerSub: "Check a member in manually for an event",
    trainerMemberLabel: "Member",
    trainerMemberPlaceholder: "Choose a member…",
    trainerMemberError: "Please choose a member.",
    trainerCta: "Check in",
    trainerDoneToast: "{name} checked in.",

    /* Trainer: Vereins-Historie */
    clubTitle: "Club check-ins",
    clubSub: "All attendances in the club — newest first",
    clubEmptyTitle: "No check-ins yet",
    clubEmptyBody: "As soon as someone checks in, the attendance shows up here.",
    kpiTotal: "Total",
    kpiWeek: "This week",
    kpiMonth: "This month",

    /* Löschen (nur Trainer) */
    deleteAction: "Delete",
    deleteEyebrow: "Delete check-in",
    deleteTitle: "Really delete this check-in?",
    deleteBody: "The check-in will be removed. This cannot be undone.",
    deleteConfirm: "Delete",
    deletedToast: "Check-in deleted.",
    deleteForbidden: "Only the coaching staff may delete check-ins.",
    cancel: "Cancel",
  },
} satisfies Dict;

export type CheckinKey = keyof (typeof checkinDict)["de"];
