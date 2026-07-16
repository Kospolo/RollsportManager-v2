import type { Attendance, Event } from "@/lib/types";
import { club } from "./club";
import { daysFromNow } from "./util";

const c = club.id;

/**
 * ~15 Termine relativ zu heute: vergangene Trainings (mit Anwesenheit),
 * kommende Trainings (mit RSVPs), der Wettkampf in 9 Tagen und
 * Vereinsleben-Termine.
 */
export const events: Event[] = [
  // --- Vergangene Woche ---
  {
    id: "e-01", clubId: c, type: "training", title: "Training Nachwuchs Pflicht",
    location: "Ballei-Sporthalle, Neckarsulm",
    startsAt: daysFromNow(-7, 17, 0), endsAt: daysFromNow(-7, 18, 30),
    audience: "teams", teamIds: ["t-02"], rsvps: [],
  },
  {
    id: "e-02", clubId: c, type: "training", title: "Training Kürgruppe Leistung",
    location: "Ballei-Sporthalle, Neckarsulm",
    startsAt: daysFromNow(-6, 18, 30), endsAt: daysFromNow(-6, 20, 30),
    audience: "teams", teamIds: ["t-03"], rsvps: [],
  },
  {
    id: "e-03", clubId: c, type: "training", title: "Training Minis & Anfänger",
    location: "Pichterichhalle, Neckarsulm",
    startsAt: daysFromNow(-5, 16, 0), endsAt: daysFromNow(-5, 17, 0),
    audience: "teams", teamIds: ["t-01"], rsvps: [],
  },
  {
    id: "e-04", clubId: c, type: "training", title: "Training Nachwuchs Pflicht",
    location: "Ballei-Sporthalle, Neckarsulm",
    startsAt: daysFromNow(-3, 17, 0), endsAt: daysFromNow(-3, 18, 30),
    audience: "teams", teamIds: ["t-02"], rsvps: [],
  },
  {
    id: "e-05", clubId: c, type: "training", title: "Kür-Feinschliff Leistung",
    location: "Ballei-Sporthalle, Neckarsulm",
    startsAt: daysFromNow(-1, 18, 30), endsAt: daysFromNow(-1, 20, 30),
    audience: "teams", teamIds: ["t-03"], rsvps: [],
    note: "Schwerpunkt: Sprungkombinationen für die Bezirksmeisterschaft",
  },

  // --- Heute & kommende Tage ---
  {
    id: "e-06", clubId: c, type: "training", title: "Training Minis & Anfänger",
    location: "Pichterichhalle, Neckarsulm",
    startsAt: daysFromNow(0, 16, 0), endsAt: daysFromNow(0, 17, 0),
    audience: "teams", teamIds: ["t-01"],
    rsvps: [
      { memberId: "m-08", status: "going", respondedAt: daysFromNow(-1, 9, 12) },
      { memberId: "m-11", status: "going", respondedAt: daysFromNow(-1, 12, 40) },
      { memberId: "m-20", status: "sick", comment: "Erkältung, morgen wieder dabei", respondedAt: daysFromNow(0, 8, 5) },
      { memberId: "m-24", status: "maybe", respondedAt: daysFromNow(0, 7, 55) },
    ],
  },
  {
    id: "e-07", clubId: c, type: "training", title: "Training Nachwuchs Pflicht",
    location: "Ballei-Sporthalle, Neckarsulm",
    startsAt: daysFromNow(1, 17, 0), endsAt: daysFromNow(1, 18, 30),
    audience: "teams", teamIds: ["t-02"],
    rsvps: [
      { memberId: "m-07", status: "going", respondedAt: daysFromNow(-1, 19, 2) },
      { memberId: "m-10", status: "going", respondedAt: daysFromNow(-1, 20, 15) },
      { memberId: "m-13", status: "going", respondedAt: daysFromNow(0, 6, 48) },
      { memberId: "m-15", status: "going", respondedAt: daysFromNow(0, 7, 21) },
      { memberId: "m-19", status: "declined", comment: "Klassenfahrt bis Freitag", respondedAt: daysFromNow(-2, 17, 30) },
    ],
  },
  {
    id: "e-08", clubId: c, type: "training", title: "Training Kürgruppe Leistung",
    location: "Ballei-Sporthalle, Neckarsulm",
    startsAt: daysFromNow(2, 18, 30), endsAt: daysFromNow(2, 20, 30),
    audience: "teams", teamIds: ["t-03"],
    rsvps: [
      { memberId: "m-16", status: "going", respondedAt: daysFromNow(0, 9, 0) },
      { memberId: "m-17", status: "going", respondedAt: daysFromNow(0, 9, 5) },
      { memberId: "m-18", status: "going", respondedAt: daysFromNow(0, 10, 11) },
      { memberId: "m-21", status: "going", respondedAt: daysFromNow(0, 11, 45) },
      { memberId: "m-22", status: "maybe", comment: "Zahnarzttermin, ich beeile mich", respondedAt: daysFromNow(0, 12, 2) },
      { memberId: "m-23", status: "going", respondedAt: daysFromNow(0, 13, 37) },
    ],
  },
  {
    id: "e-09", clubId: c, type: "other", title: "Elternabend: Saisonplanung",
    location: "Vereinsheim RSV Neckarsulm",
    startsAt: daysFromNow(3, 19, 0), endsAt: daysFromNow(3, 20, 30),
    audience: "teams", teamIds: ["t-01", "t-02", "t-03"],
    rsvps: [
      { memberId: "m-09", status: "going", respondedAt: daysFromNow(-1, 21, 0) },
      { memberId: "m-12", status: "going", respondedAt: daysFromNow(-1, 21, 30) },
      { memberId: "m-14", status: "declined", comment: "Spätschicht — Protokoll wäre super", respondedAt: daysFromNow(0, 14, 20) },
    ],
  },
  {
    id: "e-10", clubId: c, type: "training", title: "Training Minis & Anfänger",
    location: "Pichterichhalle, Neckarsulm",
    startsAt: daysFromNow(4, 16, 0), endsAt: daysFromNow(4, 17, 0),
    audience: "teams", teamIds: ["t-01"], rsvps: [],
  },
  {
    id: "e-11", clubId: c, type: "training", title: "Generalprobe Küren",
    location: "Ballei-Sporthalle, Neckarsulm",
    startsAt: daysFromNow(6, 18, 0), endsAt: daysFromNow(6, 20, 30),
    audience: "teams", teamIds: ["t-02", "t-03"],
    rsvps: [
      { memberId: "m-16", status: "going", respondedAt: daysFromNow(0, 15, 0) },
      { memberId: "m-17", status: "going", respondedAt: daysFromNow(0, 15, 3) },
      { memberId: "m-23", status: "going", respondedAt: daysFromNow(0, 16, 40) },
    ],
    note: "Mit Musik und Wettkampfkleidung — Ablauf wie am Wettkampftag",
  },
  {
    id: "e-12", clubId: c, type: "competition", title: "Bezirksmeisterschaft Rollkunstlauf",
    location: "Rundsporthalle Ludwigsburg",
    startsAt: daysFromNow(9, 8, 30), endsAt: daysFromNow(9, 18, 0),
    audience: "teams", teamIds: ["t-02", "t-03"], competitionId: "c-01",
    rsvps: [
      { memberId: "m-16", status: "going", respondedAt: daysFromNow(-4, 18, 0) },
      { memberId: "m-17", status: "going", respondedAt: daysFromNow(-4, 18, 30) },
      { memberId: "m-18", status: "going", respondedAt: daysFromNow(-3, 9, 15) },
      { memberId: "m-21", status: "going", respondedAt: daysFromNow(-3, 10, 40) },
      { memberId: "m-23", status: "going", respondedAt: daysFromNow(-2, 8, 50) },
      { memberId: "m-07", status: "going", respondedAt: daysFromNow(-2, 16, 22) },
      { memberId: "m-10", status: "maybe", comment: "Warten noch auf den Arzttermin", respondedAt: daysFromNow(-1, 11, 5) },
    ],
    note: "Treffpunkt 7:45 Uhr am Vereinsheim, Fahrgemeinschaften bitte eintragen",
  },
  {
    id: "e-13", clubId: c, type: "training", title: "Training Nachwuchs Pflicht",
    location: "Ballei-Sporthalle, Neckarsulm",
    startsAt: daysFromNow(11, 17, 0), endsAt: daysFromNow(11, 18, 30),
    audience: "teams", teamIds: ["t-02"], rsvps: [],
  },
  {
    id: "e-14", clubId: c, type: "other", title: "Sommerfest mit Schnupperlaufen",
    location: "Vereinsgelände RSV Neckarsulm",
    startsAt: daysFromNow(23, 14, 0), endsAt: daysFromNow(23, 20, 0),
    // Vereinsveranstaltung (audience "club") — deshalb OHNE teamIds, exakt wie
    // im Seed (supabase/seed/seed.sql). Eine Vereinsveranstaltung MIT Teams
    // weist die Datenbank mit 23514 zurück (Migration 0050).
    audience: "club", teamIds: [], rsvps: [],
    note: "Kuchen-Slots werden im Vereinsleben-Board verteilt",
  },
  {
    id: "e-15", clubId: c, type: "training", title: "Training Kürgruppe Leistung",
    location: "Ballei-Sporthalle, Neckarsulm",
    startsAt: daysFromNow(13, 18, 30), endsAt: daysFromNow(13, 20, 30),
    audience: "teams", teamIds: ["t-03"], rsvps: [],
  },
  {
    // e-16: die zweite Vereinsveranstaltung — spiegelt supabase/seed/seed.sql.
    // Ohne sie sähe der Mock-Modus (und damit JEDER Production-Build, siehe
    // lib/data/config.ts:16-17) eine andere Welt als die Datenbank.
    id: "e-16", clubId: c, type: "other", title: "Jahreshauptversammlung",
    location: "Vereinsheim RSV Neckarsulm",
    startsAt: daysFromNow(17, 19, 0), endsAt: daysFromNow(17, 21, 30),
    audience: "club", teamIds: [], rsvps: [],
    note: "Mit Vorstandswahl — stimmberechtigt sind alle Mitglieder ab 16 Jahren",
  },
];

/** Anwesenheit der jüngsten vergangenen Trainings. */
export const attendance: Attendance[] = [
  { id: "a-01", eventId: "e-04", memberId: "m-07", status: "present", checkedInAt: daysFromNow(-3, 16, 55) },
  { id: "a-02", eventId: "e-04", memberId: "m-10", status: "present", checkedInAt: daysFromNow(-3, 16, 58) },
  { id: "a-03", eventId: "e-04", memberId: "m-13", status: "late", checkedInAt: daysFromNow(-3, 17, 12) },
  { id: "a-04", eventId: "e-04", memberId: "m-15", status: "present", checkedInAt: daysFromNow(-3, 16, 52) },
  { id: "a-05", eventId: "e-04", memberId: "m-19", status: "excused" },
  { id: "a-06", eventId: "e-05", memberId: "m-16", status: "present", checkedInAt: daysFromNow(-1, 18, 25) },
  { id: "a-07", eventId: "e-05", memberId: "m-17", status: "present", checkedInAt: daysFromNow(-1, 18, 26) },
  { id: "a-08", eventId: "e-05", memberId: "m-18", status: "present", checkedInAt: daysFromNow(-1, 18, 24) },
  { id: "a-09", eventId: "e-05", memberId: "m-21", status: "absent" },
  { id: "a-10", eventId: "e-05", memberId: "m-22", status: "present", checkedInAt: daysFromNow(-1, 18, 31) },
  { id: "a-11", eventId: "e-05", memberId: "m-23", status: "present", checkedInAt: daysFromNow(-1, 18, 20) },
];

/** Kommende Termine, sortiert — z. B. für Dashboard und Nav-Badge. */
export function upcomingEvents(withinDays = 7): Event[] {
  const now = Date.now();
  const horizon = now + withinDays * 86_400_000;
  return events
    .filter((e) => {
      const t = new Date(e.startsAt).getTime();
      return t >= now && t <= horizon;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
