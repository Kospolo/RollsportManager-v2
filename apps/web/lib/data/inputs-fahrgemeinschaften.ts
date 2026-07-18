import type { Id } from "@/lib/types";

/**
 * Fahrgemeinschaften zu Terminen (Migration 0066, services/api/src/routes/
 * event-rides.ts). Jemand bietet zu einem Termin eine Fahrt an (Abfahrtsort,
 * Abfahrtszeit, Plätze, Rückrufnummer, Notiz); andere sagen als Mitfahrer:in
 * zu — für sich selbst ODER für das eigene Kind. Beide Seiten können absagen.
 *
 * ### DIE RÜCKRUFNUMMER IST NICHT UNSERE ENTSCHEIDUNG ###
 * `callbackNumber` kommt aus einer eigenen Tabelle mit einer ENGEREN
 * SELECT-Policy als die Fahrt selbst: sie sieht nur, wer in DIESER
 * Fahrgemeinschaft steckt (Fahrer:in ↔ zugesagte Mitfahrende samt deren
 * Erziehungsberechtigten) plus die Verwaltung. Die Fahrt dagegen sieht jede
 * Person, die den Termin sehen darf. Der Server liefert die Nummer deshalb gar
 * nicht erst aus, wenn sie nicht zusteht — hier wird NICHTS nachredigiert und
 * nichts nachgeprüft. Die UI zeigt schlicht, was ankommt.
 *
 * `contactVisible` unterscheidet die beiden Nullen: false = „nicht für dich"
 * (Hinweis: wird nach der Zusage sichtbar), true + null = „keine Nummer
 * hinterlegt". Ohne dieses Flag müsste die UI raten, und sie würde falsch raten.
 *
 * ### RECHTE ###
 * Alles serverseitig (RLS). Minderjährige bieten keine Fahrt an (Trigger), für
 * ein Kind sagt ein:e Erziehungsberechtigte:r zu (app.can_act_for_member),
 * Überbuchung verhindert ein Trigger (422 mit deutschem Klartext). Die UI gated
 * dieselben Fälle nur als ANZEIGE — ein 403 bleibt jederzeit möglich.
 */

/** „voll" ist ABGELEITET (Trigger), nie von Hand gesetzt. */
export type RideStatus = "open" | "full" | "cancelled";
export type RideRiderStatus = "confirmed" | "cancelled";

export interface RideRider {
  id: Id;
  rideId: Id;
  /** Die MITFAHRENDE Person — bei einem Kind das Kind, nicht das Elternteil. */
  memberId: Id;
  memberFirstName: string;
  memberLastName: string;
  /** Konto, das die Zusage erklärt hat (bei Kindern: das Elternteil). */
  registeredByProfileId: Id | null;
  status: RideRiderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Ride {
  id: Id;
  clubId: Id;
  eventId: Id;
  driverMemberId: Id;
  driverFirstName: string;
  driverLastName: string;
  departurePlace: string;
  /** Voller Zeitstempel, nicht nur Uhrzeit: Auswärtstermine sind mehrtägig. */
  departureAt: string;
  seatsTotal: number;
  /** Noch freie Plätze (seatsTotal minus aktive Zusagen), nie negativ. */
  seatsFree: number;
  note: string | null;
  status: RideStatus;
  /** null = nicht für dich (siehe contactVisible) ODER nicht hinterlegt. */
  callbackNumber: string | null;
  /** true, wenn der Server die Nummer ausliefern durfte. */
  contactVisible: boolean;
  /** Nur die AKTIVEN Zusagen. */
  riders: RideRider[];
  createdAt: string;
  updatedAt: string;
}

/** Fahrt anbieten. Rückrufnummer weglassen = eigene Telefonnummer (Server). */
export interface OfferRideInput {
  departurePlace: string;
  /** ISO-Zeitstempel mit Zeitzone. */
  departureAt: string;
  /** 1–8 (Server-Grenze). */
  seatsTotal: number;
  note?: string | null;
  /**
   * WEGLASSEN heißt „nimm die hinterlegte Telefonnummer des Fahrers" — die
   * liest der SERVER, damit der Client fremde Nummern weder kennen noch
   * vorschlagen muss. null löscht sie beim Ändern.
   */
  callbackNumber?: string | null;
}

/** Fahrt ändern oder absagen. `status` kennt nur "open" und "cancelled". */
export interface UpdateRideInput {
  departurePlace?: string;
  departureAt?: string;
  seatsTotal?: number;
  note?: string | null;
  callbackNumber?: string | null;
  status?: Exclude<RideStatus, "full">;
}

export interface FahrgemeinschaftenRepository {
  /** Fahrten eines Termins. Sichtbarkeit = Termin-Sichtbarkeit (serverseitig). */
  getEventRides(eventId: Id): Promise<Ride[]>;
  /** Fahrt anbieten (aktives Mitglied, nicht minderjährig — Server erzwingt es). */
  offerRide(eventId: Id, input: OfferRideInput): Promise<Ride>;
  /** Fahrt ändern oder absagen (Fahrer:in oder Vorstand). */
  updateRide(rideId: Id, patch: UpdateRideInput): Promise<Ride>;
  /**
   * Als Mitfahrer:in zusagen. `memberId` ist die MITFAHRENDE Person: man selbst
   * oder das eigene Kind (app.can_act_for_member). Eine frühere Absage wird
   * serverseitig wiederbelebt statt verdoppelt. Liefert die ganze Fahrt zurück.
   */
  joinRide(rideId: Id, memberId: Id): Promise<Ride>;
  /** Zusage zurückziehen oder erneuern (eigene/Kind, Fahrer:in, Vorstand). */
  setRideRiderStatus(rideId: Id, riderId: Id, status: RideRiderStatus): Promise<Ride>;
}
