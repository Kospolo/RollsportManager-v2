import { club } from "@/lib/mock";
import type { Department, Locker } from "@/lib/types";

/**
 * Start-Seed der Organisations-Modul-Stores (Abteilungen, Schließfächer) für
 * den Mock-Modus. Echte Umlaute, DE-Inhalte, plausible Mitglieder-IDs aus
 * lib/mock. Jubiläen werden NICHT geseedet — sie werden in modules-org zur
 * Laufzeit aus den Mock-Mitgliedern berechnet.
 */

const clubId = club.id;

/** ISO-Datum (YYYY-MM-DD) vor n Tagen. */
const dateDaysAgo = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

const createdIso = (days: number): string => `${dateDaysAgo(days)}T09:00:00.000Z`;

export const departmentSeed: Department[] = [
  {
    id: "dep-01",
    clubId,
    name: "Rollkunstlauf",
    description: "Pflicht, Kür und Formationslauf",
    leadMemberId: "m-01",
    sortOrder: 0,
    memberIds: ["m-15", "m-16", "m-17", "m-18", "m-19"],
    createdAt: createdIso(400),
    updatedAt: createdIso(30),
  },
  {
    id: "dep-02",
    clubId,
    name: "Nachwuchsförderung",
    description: "Minis und Anfängergruppen",
    leadMemberId: "m-05",
    sortOrder: 1,
    memberIds: ["m-07", "m-08", "m-11", "m-20"],
    createdAt: createdIso(360),
    updatedAt: createdIso(60),
  },
  {
    id: "dep-03",
    clubId,
    name: "Vorstand & Verwaltung",
    description: undefined,
    leadMemberId: "m-02",
    sortOrder: 2,
    memberIds: ["m-02", "m-03", "m-04"],
    createdAt: createdIso(500),
    updatedAt: createdIso(90),
  },
];

export const lockerSeed: Locker[] = [
  {
    id: "loc-01",
    clubId,
    label: "A-01",
    location: "Umkleide Nord",
    status: "assigned",
    assignedMemberId: "m-16",
    note: undefined,
    createdAt: createdIso(300),
    updatedAt: createdIso(20),
  },
  {
    id: "loc-02",
    clubId,
    label: "A-02",
    location: "Umkleide Nord",
    status: "free",
    assignedMemberId: undefined,
    note: undefined,
    createdAt: createdIso(300),
    updatedAt: createdIso(300),
  },
  {
    id: "loc-03",
    clubId,
    label: "B-05",
    location: "Umkleide Süd",
    status: "assigned",
    assignedMemberId: "m-17",
    note: "Schlüssel Nr. 5",
    createdAt: createdIso(300),
    updatedAt: createdIso(10),
  },
  {
    id: "loc-04",
    clubId,
    label: "B-06",
    location: "Umkleide Süd",
    status: "broken",
    assignedMemberId: undefined,
    note: "Schloss defekt — Reparatur beauftragt",
    createdAt: createdIso(300),
    updatedAt: createdIso(5),
  },
];
