import type { ClubModuleState } from "../inputs-clubmodules";

/**
 * Der Modul-Katalog als Mock-Seed — ABGESCHRIEBEN aus Migration 0044
 * (app.modules), nicht geraten. Schlüssel, Texte, `core`, `requiresPro` und
 * `enforcement` sind wortgleich mit der Datenbank; die Texte selbst stammen
 * wiederum aus dem „Mehr"-Raster (mehr/i18n.ts). Eine dritte Wahrheit soll
 * hier nicht entstehen: driftet das hier, driftet nur die Attrappe — der
 * Server bleibt die Wahrheit.
 *
 * ### PRO im Mock ###
 * `proOk` bildet den Demo-Verein aus dem Seed ab: RSV Neckarsulm HAT ein
 * aktives PRO-Entitlement (seed.sql: tier=pro, status=active). Deshalb ist
 * proOk hier überall true. Der interessante Gegenfall (PRO-Modul AN, aber kein
 * Entitlement -> trotzdem zu) ist im Mock nicht darstellbar, weil der Mock
 * keine Entitlements kennt — er ist in 99e_club_modules.sql gegen die echte
 * Datenbank gemessen, nicht hier behauptet.
 */
export const MODULE_CATALOG: readonly Omit<ClubModuleState, "enabled" | "available">[] = [
  { moduleKey: "news", labelDe: "News", labelEn: "News", descDe: "Vereins-Neuigkeiten und Ankündigungen.", descEn: "Club news and announcements.", sort: 10, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "notes", labelDe: "Notizen", labelEn: "Notes", descDe: "Deine privaten Notizen.", descEn: "Your private notes.", sort: 20, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "exercises", labelDe: "Übungen", labelEn: "Exercises", descDe: "Übungs-Bibliothek mit Videos und Anleitungen.", descEn: "Exercise library with videos and instructions.", sort: 30, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "family", labelDe: "Familie", labelEn: "Family", descDe: "Deine Kinder im Verein im Blick.", descEn: "Keep track of your children in the club.", sort: 40, core: false, requiresPro: false, enforcement: "partial", proOk: true },
  { moduleKey: "facility", labelDe: "Belegungsplan", labelEn: "Facility plan", descDe: "Hallen und Räume belegen.", descEn: "Book halls and rooms.", sort: 50, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "equipment", labelDe: "Ausrüstung", labelEn: "Equipment", descDe: "Ausrüstung und Reservierungen.", descEn: "Equipment and reservations.", sort: 60, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "medal", labelDe: "Medaillen", labelEn: "Medals", descDe: "Medaillen und Erfolge.", descEn: "Medals and achievements.", sort: 70, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "trainingplan", labelDe: "Trainingsplan", labelEn: "Training plan", descDe: "Trainingspläne und Einheiten.", descEn: "Training plans and sessions.", sort: 80, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "hours", labelDe: "Pflichtstunden", labelEn: "Duty hours", descDe: "Geleistete Pflichtstunden im Blick.", descEn: "Keep track of duty hours.", sort: 90, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "chart", labelDe: "Auswertung", labelEn: "Reports", descDe: "Auswertungen, Berichte und Listen.", descEn: "Reports, statistics and lists.", sort: 100, core: false, requiresPro: false, enforcement: "menu_only", proOk: true },
  { moduleKey: "chat", labelDe: "Chat", labelEn: "Chat", descDe: "Team-Chat und Direktnachrichten.", descEn: "Team chat and direct messages.", sort: 110, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "checkin", labelDe: "Check-in", labelEn: "Check-in", descDe: "Anwesenheit per QR-Code.", descEn: "Attendance via QR code.", sort: 120, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "regevents", labelDe: "Überregionale Events", labelEn: "Regional events", descDe: "Wettkämpfe und Veranstaltungen der Region.", descEn: "Competitions and events in the region.", sort: 130, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "gallery", labelDe: "Galerie", labelEn: "Gallery", descDe: "Fotos und Momente des Vereins.", descEn: "Photos and moments of the club.", sort: 140, core: false, requiresPro: true, enforcement: "enforced", proOk: true },
  { moduleKey: "document", labelDe: "Dokumente", labelEn: "Documents", descDe: "Dokumente und Downloads.", descEn: "Documents and downloads.", sort: 150, core: false, requiresPro: true, enforcement: "enforced", proOk: true },
  { moduleKey: "teams", labelDe: "Teams", labelEn: "Teams", descDe: "Deine Trainingsgruppen und alle Teams im Verein.", descEn: "Your training groups and all teams in the club.", sort: 170, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "departments", labelDe: "Abteilungen", labelEn: "Departments", descDe: "Sparten und Abteilungen des Vereins.", descEn: "Divisions and departments of the club.", sort: 180, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "lockers", labelDe: "Schließfächer", labelEn: "Lockers", descDe: "Schließfächer verwalten und Mitgliedern zuweisen.", descEn: "Manage lockers and assign them to members.", sort: 190, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "anniversaries", labelDe: "Jubiläen", labelEn: "Anniversaries", descDe: "Anstehende Jubiläen und runde Geburtstage.", descEn: "Upcoming anniversaries and milestone birthdays.", sort: 200, core: false, requiresPro: false, enforcement: "menu_only", proOk: true },
  { moduleKey: "waitlists", labelDe: "Wartelisten", labelEn: "Waiting lists", descDe: "Plätze für Hallen, Ausrüstung, Teams und Termine.", descEn: "Slots for halls, equipment, teams and events.", sort: 210, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "events", labelDe: "Termine", labelEn: "Events", descDe: "Training, Wettkämpfe und alles dazwischen.", descEn: "Training, competitions and everything between.", sort: 220, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "members", labelDe: "Mitglieder", labelEn: "Members", descDe: "Alle Menschen im Verein.", descEn: "Everyone in the club.", sort: 230, core: true, requiresPro: false, enforcement: null, proOk: true },
  { moduleKey: "routines", labelDe: "Küren", labelEn: "Routines", descDe: "Musik, Marker und Wertungen.", descEn: "Music, markers and scores.", sort: 240, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "competition", labelDe: "Wettkampf", labelEn: "Competition", descDe: "Vorbereitung, Meldung und Ergebnisse.", descEn: "Preparation, entries and results.", sort: 250, core: false, requiresPro: false, enforcement: "enforced", proOk: true },
  { moduleKey: "finance", labelDe: "Finanzen", labelEn: "Finance", descDe: "Beiträge, offene Posten und Kasse.", descEn: "Fees, open items and cash.", sort: 260, core: true, requiresPro: false, enforcement: null, proOk: true },
  { moduleKey: "manage", labelDe: "Verwaltung", labelEn: "Administration", descDe: "Verein, Rollen und Teams.", descEn: "Club, roles and teams.", sort: 270, core: true, requiresPro: false, enforcement: null, proOk: true },
];
