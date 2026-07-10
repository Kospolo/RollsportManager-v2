import type { Dict } from "@/lib/i18n";
import type { EventType, MemberRole } from "@/lib/types";

/**
 * Kolokalisiertes Dictionary der Auswertung (Statistiken & Berichte).
 * Regel: JEDE Ergänzung in beiden Sprachen, deutsche Strings mit echten
 * Umlauten (ä/ö/ü/ß) — nie ae/oe/ue/ss.
 */
export const auswertungDict = {
  de: {
    pageEyebrow: "Auswertung",
    pageTitle: "Statistiken & Berichte",
    pageSub: "Kennzahlen des Vereins auf einen Blick — Mitglieder, Anwesenheit, Finanzen und Erfolge",

    // KPI-Kacheln
    kpiMembers: "Mitglieder gesamt",
    kpiMembersSub: "{n} aktiv",
    kpiAttendance: "Anwesenheitsquote",
    kpiAttendanceSub: "Zusagen erschienen",
    kpiOpen: "Offene Posten",
    kpiOpenSubOne: "1 Rechnung offen",
    kpiOpenSubMany: "{n} Rechnungen offen",
    kpiOpenSubNone: "Alles beglichen",
    kpiEvents: "Kommende Termine",
    kpiEventsSub: "die nächsten {n}",
    kpiEventsSubNone: "keine geplant",

    // Medaillenspiegel
    medalTitle: "Medaillenspiegel",
    medalEyebrow: "Erfolge",
    medalGold: "Gold",
    medalSilver: "Silber",
    medalBronze: "Bronze",
    medalEmpty: "Noch keine Medaillen erfasst.",

    // Verteilungen
    roleTitle: "Mitglieder nach Rolle",
    roleEyebrow: "Verteilung",
    roleUnit: "Mitglieder",
    teamTitle: "Läufer:innen nach Team",
    teamEyebrow: "Verteilung",
    teamUnit: "Läufer:innen",
    distEmpty: "Keine Daten vorhanden.",
    barValueAria: "{label}: {value}",

    // Kommende Termine
    eventsTitle: "Kommende Termine",
    eventsEyebrow: "Kalender",
    eventsMore: "und {n} weitere",
    eventsEmpty: "Aktuell sind keine Termine geplant.",
    eventTraining: "Training",
    eventCompetition: "Wettkampf",
    eventOther: "Termin",

    // Rollen
    roleOwner: "Inhaber:in",
    roleAdmin: "Administration",
    roleModerator: "Moderation",
    roleTreasurer: "Kassenwart:in",
    roleCoach: "Trainer:in",
    roleMember: "Mitglied",
    roleGuest: "Gasttrainer:in",

    // Zustände
    noAccessTitle: "Kein Zugriff auf die Auswertung",
    noAccessBody:
      "Diese Vereins-Kennzahlen sind dem Trainerstab und der Vereinsleitung vorbehalten. Wende dich an dein Team, wenn du Zahlen brauchst.",
    loadErrorTitle: "Auswertung konnte nicht geladen werden",
    retry: "Erneut versuchen",
    niTitle: "Noch nicht angebunden",
    niBody: "Die Auswertung hat im api-Modus noch keinen Endpoint.",
  },
  en: {
    pageEyebrow: "Reports",
    pageTitle: "Statistics & reports",
    pageSub: "The club's key figures at a glance — members, attendance, finances and achievements",

    kpiMembers: "Members total",
    kpiMembersSub: "{n} active",
    kpiAttendance: "Attendance rate",
    kpiAttendanceSub: "confirmed and present",
    kpiOpen: "Open items",
    kpiOpenSubOne: "1 invoice open",
    kpiOpenSubMany: "{n} invoices open",
    kpiOpenSubNone: "All settled",
    kpiEvents: "Upcoming events",
    kpiEventsSub: "the next {n}",
    kpiEventsSubNone: "none scheduled",

    medalTitle: "Medal tally",
    medalEyebrow: "Achievements",
    medalGold: "Gold",
    medalSilver: "Silver",
    medalBronze: "Bronze",
    medalEmpty: "No medals recorded yet.",

    roleTitle: "Members by role",
    roleEyebrow: "Distribution",
    roleUnit: "members",
    teamTitle: "Skaters by team",
    teamEyebrow: "Distribution",
    teamUnit: "skaters",
    distEmpty: "No data available.",
    barValueAria: "{label}: {value}",

    eventsTitle: "Upcoming events",
    eventsEyebrow: "Calendar",
    eventsMore: "and {n} more",
    eventsEmpty: "No events are scheduled right now.",
    eventTraining: "Training",
    eventCompetition: "Competition",
    eventOther: "Event",

    roleOwner: "Owner",
    roleAdmin: "Administration",
    roleModerator: "Moderation",
    roleTreasurer: "Treasurer",
    roleCoach: "Coach",
    roleMember: "Member",
    roleGuest: "Guest coach",

    noAccessTitle: "No access to the reports",
    noAccessBody:
      "These club figures are reserved for the coaching staff and club management. Ask your team if you need the numbers.",
    loadErrorTitle: "Reports could not be loaded",
    retry: "Try again",
    niTitle: "Not connected yet",
    niBody: "Reports have no endpoint in api mode yet.",
  },
} satisfies Dict;

/** Schlüssel-Typ des Auswertungs-Dictionaries (für typsichere Label-Maps). */
export type AuswertungKey = keyof (typeof auswertungDict)["de"];

/** Vereinsrolle → Dictionary-Label-Schlüssel. */
export function roleLabelKey(role: MemberRole): AuswertungKey {
  switch (role) {
    case "owner":
      return "roleOwner";
    case "admin":
      return "roleAdmin";
    case "moderator":
      return "roleModerator";
    case "treasurer":
      return "roleTreasurer";
    case "coach":
      return "roleCoach";
    case "guest_coach":
      return "roleGuest";
    default:
      return "roleMember";
  }
}

/** Termin-Typ → Dictionary-Label-Schlüssel. */
export function eventTypeLabelKey(type: EventType): AuswertungKey {
  switch (type) {
    case "training":
      return "eventTraining";
    case "competition":
      return "eventCompetition";
    default:
      return "eventOther";
  }
}
