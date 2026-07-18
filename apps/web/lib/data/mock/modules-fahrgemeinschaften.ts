import { club, guardianships, memberById } from "@/lib/mock";
import type { Member } from "@/lib/types";
import { ApiError } from "../errors";
import type {
  FahrgemeinschaftenRepository,
  Ride,
  RideRider,
  RideRiderStatus,
} from "../inputs-fahrgemeinschaften";
import { mockViewer } from "./viewer";

/**
 * Mock-Implementierung der Fahrgemeinschaften (Migration 0066).
 *
 * ### WARUM DIESER MOCK RECHTE NACHBAUT ###
 * Die meisten Mock-Module verzichten darauf („die Wahrheit ist der Server").
 * Hier wäre das falsch: die EINZIGE Fachaussage dieses Features ist, WER die
 * Rückrufnummer sieht. Ein Mock, der sie jedem zeigt, würde genau die Regel
 * unsichtbar machen, die geprüft werden soll — und die UI könnte im mock-Modus
 * nie beweisen, dass sie den gesperrten Fall richtig darstellt.
 *
 * Nachgebaut sind deshalb (analog app.may_see_ride_contact):
 *   Fahrer:in · aktive Mitfahrende · deren Erziehungsberechtigte · Verwaltung.
 * Ebenso der Alters-Riegel (Minderjährige bieten keine Fahrt an, unbekanntes
 * Geburtsdatum = erlaubt — fail-open wie der Trigger), die Vormund-Logik beim
 * Zusagen und die Überbuchungs-Sperre.
 *
 * Es bleibt eine Attrappe: Betrachter:in ist mockViewer() (localStorage
 * `rsm.mock.viewer`), nicht ein Token. Im api-Modus entscheidet allein die DB.
 */

const CLUB = club.id;
const MANAGEMENT = new Set(["owner", "admin", "moderator", "treasurer"]);

function problem(status: number, title: string, detail: string): ApiError {
  return new ApiError(status, { type: "about:blank", title, status, detail }, detail);
}

const nowIso = (): string => new Date().toISOString();

/** Volljährig? Unbekanntes Geburtsdatum = ja (fail-open, wie der DB-Trigger). */
function isAdult(member: Member): boolean {
  if (!member.birthDate) return true;
  const birth = new Date(member.birthDate);
  const eighteenth = new Date(
    birth.getFullYear() + 18,
    birth.getMonth(),
    birth.getDate(),
  );
  return eighteenth.getTime() <= Date.now();
}

/** app.can_act_for_member: man selbst oder das eigene Kind. */
function canActFor(viewer: Member, memberId: string): boolean {
  if (viewer.id === memberId) return true;
  return guardianships.some((g) => g.guardianId === viewer.id && g.childId === memberId);
}

/* --------------------------------------------------------------------------
 * Store. Die Rückrufnummer liegt BEWUSST getrennt von der Fahrt — genau wie in
 * der Datenbank (app.event_ride_contacts). So kann der Lesepfad sie gar nicht
 * versehentlich mitliefern: sie muss aktiv dazugeholt werden.
 * -------------------------------------------------------------------------- */

type StoredRider = Omit<RideRider, "memberFirstName" | "memberLastName">;

interface StoredRide {
  id: string;
  eventId: string;
  driverMemberId: string;
  departurePlace: string;
  departureAt: string;
  seatsTotal: number;
  note: string | null;
  cancelled: boolean;
  riders: StoredRider[];
  createdAt: string;
  updatedAt: string;
}

/** ride-id → Rückrufnummer (die „zweite Tabelle"). */
const contactStore = new Map<string, string>();

/** Telefonbuch der Demo — sonst hätte im Mock niemand eine Nummer zum Zeigen. */
const PHONE_BOOK: Record<string, string> = {
  "m-01": "+49 7132 123456",
  "m-02": "+49 7132 998877",
  "m-09": "+49 160 3344551",
  "m-12": "+49 171 2233445",
  "m-14": "+49 172 6677889",
};

function stamp(daysFromToday: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/**
 * Seed: der Wettkampf in 9 Tagen (e-12, Bezirksmeisterschaft) ist der
 * Hauptfall — Auswärtstermin, frühe Abfahrt, zwei Angebote. Eines davon ist
 * ausgebucht, damit „ausgebucht statt totem Knopf" überhaupt sichtbar wird.
 */
const rideStore: StoredRide[] = [
  {
    id: "ride-01",
    eventId: "e-12",
    driverMemberId: "m-09", // Katrin Grünewald (Elternteil)
    departurePlace: "Ballei-Sporthalle, Parkplatz",
    departureAt: stamp(9, 6, 30),
    seatsTotal: 3,
    note: "Kombi mit großem Kofferraum — Schlittschuhtaschen passen rein.",
    cancelled: false,
    riders: [
      {
        id: "rider-01",
        rideId: "ride-01",
        memberId: "m-13", // Finn Köhler
        registeredByProfileId: "m-14", // von Petra Köhler eingetragen
        status: "confirmed",
        createdAt: stamp(-2, 19, 10),
        updatedAt: stamp(-2, 19, 10),
      },
    ],
    createdAt: stamp(-3, 20, 0),
    updatedAt: stamp(-3, 20, 0),
  },
  {
    id: "ride-02",
    eventId: "e-12",
    driverMemberId: "m-12", // Stefanie Müller
    departurePlace: "Neckarsulm, Bahnhofsvorplatz",
    departureAt: stamp(9, 7, 0),
    seatsTotal: 2,
    note: null,
    cancelled: false,
    riders: [
      {
        id: "rider-02",
        rideId: "ride-02",
        memberId: "m-15",
        registeredByProfileId: "m-15",
        status: "confirmed",
        createdAt: stamp(-1, 8, 0),
        updatedAt: stamp(-1, 8, 0),
      },
      {
        id: "rider-03",
        rideId: "ride-02",
        memberId: "m-19",
        registeredByProfileId: "m-19",
        status: "confirmed",
        createdAt: stamp(-1, 9, 30),
        updatedAt: stamp(-1, 9, 30),
      },
    ],
    createdAt: stamp(-2, 18, 0),
    updatedAt: stamp(-2, 18, 0),
  },
];

contactStore.set("ride-01", PHONE_BOOK["m-09"]!);
contactStore.set("ride-02", PHONE_BOOK["m-12"]!);

let rideSeq = rideStore.length;
let riderSeq = 3;

/* ---------- Projektion (das Gegenstück zu RIDE_SELECT in der API) ---------- */

function activeRiders(ride: StoredRide): StoredRider[] {
  return ride.riders.filter((r) => r.status === "confirmed");
}

/**
 * app.may_see_ride_contact, nachgebaut. Beteiligt heißt: Fahrer:in, aktiv
 * zugesagt, Erziehungsberechtigte:r einer zugesagten Person — oder Verwaltung.
 */
function maySeeContact(ride: StoredRide, viewer: Member): boolean {
  if (MANAGEMENT.has(viewer.role)) return true;
  if (ride.driverMemberId === viewer.id) return true;
  return activeRiders(ride).some((r) => canActFor(viewer, r.memberId));
}

function project(ride: StoredRide, viewer: Member): Ride {
  const driver = memberById(ride.driverMemberId);
  const active = activeRiders(ride);
  const seatsFree = Math.max(ride.seatsTotal - active.length, 0);
  const visible = maySeeContact(ride, viewer);
  const number = contactStore.get(ride.id) ?? null;

  return {
    id: ride.id,
    clubId: CLUB,
    eventId: ride.eventId,
    driverMemberId: ride.driverMemberId,
    driverFirstName: driver?.firstName ?? "?",
    driverLastName: driver?.lastName ?? "",
    departurePlace: ride.departurePlace,
    departureAt: ride.departureAt,
    seatsTotal: ride.seatsTotal,
    seatsFree,
    note: ride.note,
    status: ride.cancelled ? "cancelled" : seatsFree === 0 ? "full" : "open",
    // Die eine Zeile, um die es geht: ohne Berechtigung wird die Nummer NICHT
    // ausgeliefert — nicht maskiert, nicht gekürzt, sondern gar nicht erst
    // gelesen. Genau das tut die RLS-Policy im Ernstfall.
    callbackNumber: visible ? number : null,
    contactVisible: visible,
    riders: active.map((r) => {
      const person = memberById(r.memberId);
      return {
        ...r,
        memberFirstName: person?.firstName ?? "?",
        memberLastName: person?.lastName ?? "",
      };
    }),
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
  };
}

function findRide(rideId: string): StoredRide {
  const ride = rideStore.find((r) => r.id === rideId);
  if (!ride) throw problem(404, "Not Found", "Fahrt nicht gefunden");
  return ride;
}

export const moduleRepositoryFahrgemeinschaften: FahrgemeinschaftenRepository = {
  async getEventRides(eventId) {
    const viewer = mockViewer();
    return rideStore
      .filter((r) => r.eventId === eventId)
      .sort((a, b) => a.departureAt.localeCompare(b.departureAt))
      .map((r) => project(r, viewer));
  },

  async offerRide(eventId, input) {
    const viewer = mockViewer();
    if (!isAdult(viewer)) {
      throw problem(403, "Forbidden", "Minderjährige können keine Fahrt anbieten");
    }
    const now = nowIso();
    const created: StoredRide = {
      id: `ride-local-${++rideSeq}`,
      eventId,
      driverMemberId: viewer.id,
      departurePlace: input.departurePlace,
      departureAt: input.departureAt,
      seatsTotal: input.seatsTotal,
      note: input.note ?? null,
      cancelled: false,
      riders: [],
      createdAt: now,
      updatedAt: now,
    };
    rideStore.push(created);

    // Weggelassen = hinterlegte Telefonnummer (der Server liest sie aus dem
    // Profil; der Mock aus seinem Telefonbuch).
    const number =
      input.callbackNumber === undefined ? (PHONE_BOOK[viewer.id] ?? null) : input.callbackNumber;
    if (number !== null && number.trim() !== "") contactStore.set(created.id, number.trim());

    return project(created, viewer);
  },

  async updateRide(rideId, patch) {
    const viewer = mockViewer();
    const ride = findRide(rideId);
    if (ride.driverMemberId !== viewer.id && !MANAGEMENT.has(viewer.role)) {
      throw problem(403, "Forbidden", "Diese Fahrt darfst du nicht bearbeiten");
    }
    if (patch.departurePlace !== undefined) ride.departurePlace = patch.departurePlace;
    if (patch.departureAt !== undefined) ride.departureAt = patch.departureAt;
    if (patch.seatsTotal !== undefined) ride.seatsTotal = patch.seatsTotal;
    if (patch.note !== undefined) ride.note = patch.note;
    if (patch.status !== undefined) ride.cancelled = patch.status === "cancelled";
    if (patch.callbackNumber !== undefined) {
      if (patch.callbackNumber === null) contactStore.delete(rideId);
      else contactStore.set(rideId, patch.callbackNumber);
    }
    ride.updatedAt = nowIso();
    return project(ride, viewer);
  },

  async joinRide(rideId, memberId) {
    const viewer = mockViewer();
    const ride = findRide(rideId);
    if (!canActFor(viewer, memberId)) {
      throw problem(403, "Forbidden", "Für diese Person darfst du nicht zusagen");
    }
    if (ride.cancelled) throw problem(422, "Unprocessable", "Diese Fahrt wurde abgesagt");

    const existing = ride.riders.find((r) => r.memberId === memberId);
    if (existing?.status === "confirmed") return project(ride, viewer);

    if (activeRiders(ride).length >= ride.seatsTotal) {
      // Wortlaut wie der Trigger app.enforce_ride_capacity (0066).
      throw problem(422, "Unprocessable", "Diese Fahrt ist voll");
    }

    const now = nowIso();
    if (existing) {
      existing.status = "confirmed";
      existing.registeredByProfileId = viewer.id;
      existing.updatedAt = now;
    } else {
      ride.riders.push({
        id: `rider-local-${++riderSeq}`,
        rideId,
        memberId,
        registeredByProfileId: viewer.id,
        status: "confirmed",
        createdAt: now,
        updatedAt: now,
      });
    }
    ride.updatedAt = now;
    return project(ride, viewer);
  },

  async setRideRiderStatus(rideId, riderId, status: RideRiderStatus) {
    const viewer = mockViewer();
    const ride = findRide(rideId);
    const rider = ride.riders.find((r) => r.id === riderId);
    if (!rider) throw problem(404, "Not Found", "Zusage nicht gefunden");

    const allowed =
      canActFor(viewer, rider.memberId) ||
      ride.driverMemberId === viewer.id ||
      MANAGEMENT.has(viewer.role);
    if (!allowed) throw problem(403, "Forbidden", "Diese Zusage darfst du nicht ändern");

    rider.status = status;
    rider.updatedAt = nowIso();
    ride.updatedAt = rider.updatedAt;
    return project(ride, viewer);
  },
};
