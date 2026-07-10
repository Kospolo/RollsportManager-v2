import { club } from "@/lib/mock";
import type { DutyEntry, DutyRequirement, TrainingSlot } from "@/lib/types";

/**
 * Start-Seed der Batch-3-Modul-Stores (Trainingsplan, Pflichtstunden-Soll,
 * Pflichtstunden-Ist) für den Mock-Modus. Echte Umlaute, DE-Inhalte, plausible
 * Mitglieder-/Team-/Hallen-IDs aus lib/mock bzw. seed-batch2. weekday 0 = Montag!
 */

const clubId = club.id;

/** ISO-Datum (YYYY-MM-DD) vor n Tagen. */
const dateDaysAgo = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

export const trainingSlotSeed: TrainingSlot[] = [
  {
    id: "slot-01",
    clubId,
    teamId: "t-02",
    weekday: 1, // Dienstag
    startsTime: "17:00:00",
    endsTime: "18:30:00",
    facilityId: "fac-01",
    location: "Haupthalle",
    coachMemberId: "m-01",
    note: "Pflichtlauf-Training",
    createdAt: dateDaysAgo(120),
    updatedAt: dateDaysAgo(20),
  },
  {
    id: "slot-02",
    clubId,
    teamId: "t-03",
    weekday: 3, // Donnerstag
    startsTime: "18:00:00",
    endsTime: "20:00:00",
    facilityId: "fac-01",
    location: "Haupthalle",
    coachMemberId: "m-06",
    note: "Kür & Leistungsgruppe",
    createdAt: dateDaysAgo(120),
    updatedAt: dateDaysAgo(20),
  },
  {
    id: "slot-03",
    clubId,
    teamId: "t-01",
    weekday: 5, // Samstag
    startsTime: "10:00:00",
    endsTime: "11:00:00",
    facilityId: "fac-02",
    coachMemberId: "m-05",
    note: "Minis & Anfänger",
    createdAt: dateDaysAgo(90),
    updatedAt: dateDaysAgo(10),
  },
];

export const dutyRequirementSeed: DutyRequirement[] = [
  {
    id: "duty-req-01",
    clubId,
    // Vereinsregel: team + member leer → gilt für alle.
    seasonLabel: "Saison 2025/26",
    requiredHours: 12,
    periodStart: "2025-09-01",
    periodEnd: "2026-06-30",
    createdAt: dateDaysAgo(200),
    updatedAt: dateDaysAgo(60),
  },
  {
    id: "duty-req-02",
    clubId,
    teamId: "t-03",
    seasonLabel: "Saison 2025/26",
    requiredHours: 20,
    periodStart: "2025-09-01",
    periodEnd: "2026-06-30",
    createdAt: dateDaysAgo(200),
    updatedAt: dateDaysAgo(60),
  },
];

export const dutyEntrySeed: DutyEntry[] = [
  {
    id: "duty-entry-01",
    clubId,
    memberId: "m-09", // Katrin Grünewald
    hours: 4,
    activityDate: dateDaysAgo(30),
    kind: "helper",
    note: "Kuchenverkauf Vereinsfest",
    approved: true,
    createdAt: dateDaysAgo(30),
    updatedAt: dateDaysAgo(25),
  },
  {
    id: "duty-entry-02",
    clubId,
    memberId: "m-12", // Stefanie Müller
    hours: 2.5,
    activityDate: dateDaysAgo(14),
    kind: "competition",
    note: "Kampfrichter-Assistenz Regionalwettkampf",
    approved: false,
    createdAt: dateDaysAgo(14),
    updatedAt: dateDaysAgo(14),
  },
  {
    id: "duty-entry-03",
    clubId,
    memberId: "m-14", // Petra Köhler
    hours: 3,
    activityDate: dateDaysAgo(7),
    kind: "other",
    note: "Hallendienst",
    approved: false,
    createdAt: dateDaysAgo(7),
    updatedAt: dateDaysAgo(7),
  },
];
