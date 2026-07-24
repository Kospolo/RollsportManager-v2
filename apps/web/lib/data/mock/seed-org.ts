import { club } from "@/lib/mock";
import type { Department, Locker, LockerRental } from "@/lib/types";

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

/**
 * Schließfächer inkl. Größe und LISTENPREIS (0070).
 *
 * Der Seed zeigt bewusst alle drei Preis-Zustände nebeneinander, weil genau
 * dort die Ansicht falsch werden kann: A-01 hat einen Preis, B-05 ist
 * AUSDRÜCKLICH KOSTENLOS (0 Cent) und B-06 hat NOCH KEINEN festgelegt (null).
 * Wer 0 und null in der Oberfläche zusammenwirft, sieht es hier sofort.
 */
export const lockerSeed: Locker[] = [
  {
    id: "loc-01",
    clubId,
    label: "A-01",
    location: "Umkleide Nord",
    status: "assigned",
    size: "mittel",
    pricePerMonthCents: 500,
    hasActiveRental: true,
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
    size: "klein",
    pricePerMonthCents: 300,
    hasActiveRental: false,
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
    size: "gross",
    // 0 = ausdrücklich kostenlos (Ehrenmitglied), NICHT „kein Preis".
    pricePerMonthCents: 0,
    hasActiveRental: true,
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
    size: "mittel",
    // null = noch kein Preis festgelegt.
    pricePerMonthCents: null,
    hasActiveRental: false,
    assignedMemberId: undefined,
    note: "Schloss defekt — Reparatur beauftragt",
    createdAt: createdIso(300),
    updatedAt: createdIso(5),
  },
];

/**
 * Laufende und beendete Mietverträge (0070).
 *
 * loc-01 zeigt die zweite Preisebene in Aktion: der Listenpreis steht heute
 * bei 5,00 €, der laufende Vertrag von m-16 wurde aber zu 4,00 € geschlossen.
 * Genau das darf die Ansicht NICHT stillschweigend angleichen — der alte
 * Vertrag bleibt bei seinem Betrag.
 */
export const lockerRentalSeed: LockerRental[] = [
  {
    id: "lrent-01",
    clubId,
    lockerId: "loc-01",
    memberId: "m-16",
    pricePerMonthCents: 400,
    startOn: dateDaysAgo(200),
    endOn: null,
    status: "aktiv",
    note: undefined,
    createdAt: createdIso(200),
    updatedAt: createdIso(200),
  },
  {
    id: "lrent-02",
    clubId,
    lockerId: "loc-03",
    memberId: "m-17",
    pricePerMonthCents: 0,
    startOn: dateDaysAgo(120),
    endOn: null,
    status: "aktiv",
    note: "Ehrenmitglied — beitragsfrei",
    createdAt: createdIso(120),
    updatedAt: createdIso(120),
  },
  {
    id: "lrent-03",
    clubId,
    lockerId: "loc-02",
    memberId: "m-07",
    pricePerMonthCents: 300,
    startOn: dateDaysAgo(400),
    endOn: dateDaysAgo(30),
    status: "gekuendigt",
    note: undefined,
    createdAt: createdIso(400),
    updatedAt: createdIso(30),
  },
];
