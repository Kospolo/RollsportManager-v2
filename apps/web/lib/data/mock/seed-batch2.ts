import { club } from "@/lib/mock";
import type {
  Achievement,
  Equipment,
  EquipmentReservation,
  Facility,
  FacilityBooking,
} from "@/lib/types";

/**
 * Start-Seed der Batch-2-Modul-Stores (Hallen, Buchungen, Equipment,
 * Reservierungen, Erfolge) für den Mock-Modus. Echte Umlaute, DE-Inhalte,
 * plausible Mitglieder-/Team-IDs aus lib/mock. Bewusst klein gehalten.
 */

const clubId = club.id;

/** ISO-Zeitstempel in n Tagen, Stunde h (plausible Trainingszeiten). */
const at = (days: number, h: number): string => {
  const d = new Date(Date.now() + days * 86_400_000);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};
/** ISO-Datum (YYYY-MM-DD) vor n Tagen. */
const dateDaysAgo = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

export const facilitySeed: Facility[] = [
  {
    id: "fac-01",
    clubId,
    name: "Rollsporthalle Neckarsulm",
    kind: "hall",
    address: "Beethovenstraße 24, 74172 Neckarsulm",
    capacity: 120,
    notes: "Haupthalle mit Wettkampfboden",
    createdAt: dateDaysAgo(400),
    updatedAt: dateDaysAgo(30),
  },
  {
    id: "fac-02",
    clubId,
    name: "Gymnastikraum",
    kind: "room",
    capacity: 24,
    notes: "Für Aufwärmen und Athletik",
    createdAt: dateDaysAgo(400),
    updatedAt: dateDaysAgo(90),
  },
  {
    id: "fac-03",
    clubId,
    name: "Außenbahn Sportpark",
    kind: "outdoor",
    createdAt: dateDaysAgo(200),
    updatedAt: dateDaysAgo(200),
  },
];

export const bookingSeed: FacilityBooking[] = [
  {
    id: "bok-01",
    facilityId: "fac-01",
    clubId,
    bookedByMemberId: "m-01",
    teamId: "t-03",
    title: "Kürtraining Leistung",
    startsAt: at(1, 17),
    endsAt: at(1, 19),
    status: "confirmed",
    createdAt: dateDaysAgo(5),
    updatedAt: dateDaysAgo(5),
  },
  {
    id: "bok-02",
    facilityId: "fac-01",
    clubId,
    bookedByMemberId: "m-07",
    title: "Zusatztraining Pflicht",
    startsAt: at(2, 16),
    endsAt: at(2, 17),
    status: "pending",
    createdAt: dateDaysAgo(1),
    updatedAt: dateDaysAgo(1),
  },
];

export const equipmentSeed: Equipment[] = [
  {
    id: "equ-01",
    clubId,
    name: "Pylonen (Set)",
    category: "Training",
    totalQuantity: 20,
    availableQuantity: 20,
    condition: "good",
    createdAt: dateDaysAgo(300),
    updatedAt: dateDaysAgo(10),
  },
  {
    id: "equ-02",
    clubId,
    name: "Mobile Musikanlage",
    category: "Technik",
    totalQuantity: 1,
    availableQuantity: 0,
    condition: "good",
    notes: "Bluetooth + Mikro",
    createdAt: dateDaysAgo(300),
    updatedAt: dateDaysAgo(2),
  },
  {
    id: "equ-03",
    clubId,
    name: "Erste-Hilfe-Koffer",
    category: "Sicherheit",
    totalQuantity: 2,
    availableQuantity: 1,
    condition: "fair",
    createdAt: dateDaysAgo(300),
    updatedAt: dateDaysAgo(60),
  },
];

export const reservationSeed: EquipmentReservation[] = [
  {
    id: "res-01",
    equipmentId: "equ-01",
    clubId,
    reservedByMemberId: "m-01",
    quantity: 10,
    fromAt: at(1, 17),
    toAt: at(1, 19),
    status: "active",
    createdAt: dateDaysAgo(3),
    updatedAt: dateDaysAgo(3),
  },
  {
    id: "res-02",
    equipmentId: "equ-02",
    clubId,
    reservedByMemberId: "m-07",
    quantity: 1,
    fromAt: at(2, 16),
    toAt: at(2, 17),
    status: "active",
    createdAt: dateDaysAgo(1),
    updatedAt: dateDaysAgo(1),
  },
];

export const achievementSeed: Achievement[] = [
  {
    id: "ach-01",
    clubId,
    memberId: "m-07",
    title: "Landesmeisterschaft Kür 2026",
    competitionName: "LM Baden-Württemberg",
    placement: 2,
    medal: "silver",
    achievedOn: dateDaysAgo(40),
    createdAt: dateDaysAgo(40),
    updatedAt: dateDaysAgo(40),
  },
  {
    id: "ach-02",
    clubId,
    memberId: "m-15",
    title: "Kreispokal Pflicht",
    competitionName: "Kreispokal Heilbronn",
    placement: 1,
    medal: "gold",
    achievedOn: dateDaysAgo(120),
    createdAt: dateDaysAgo(120),
    updatedAt: dateDaysAgo(120),
  },
  {
    id: "ach-03",
    clubId,
    memberId: "m-10",
    title: "Teilnahme Nachwuchs-Cup",
    competitionName: "Nachwuchs-Cup Stuttgart",
    achievedOn: dateDaysAgo(75),
    note: "Erster Wettkampf — ohne Wertung ins Ziel",
    createdAt: dateDaysAgo(75),
    updatedAt: dateDaysAgo(75),
  },
];
