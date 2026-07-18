import type * as M from "@/lib/api/generated";
import type {
  Ride,
  RideRider,
  RideRiderStatus,
  RideStatus,
} from "../inputs-fahrgemeinschaften";

/**
 * Mapper der Fahrgemeinschaften (Migration 0066): Wire-Format (snake_case, DE-
 * Feldnamen wie abfahrtsort/plaetze_frei) → View-Typ (camelCase).
 *
 * Die Status-Werte werden ÜBERSETZT statt durchgereicht, damit die View-Schicht
 * einsprachig bleibt (wie RsvpStatus: "going"/"declined"). "voll" ist dabei ein
 * ABGELEITETER Wert des Servers — er kommt herein, geht aber nie hinaus (siehe
 * rideStatusToWire).
 */

const RIDE_STATUS: Record<M.EventRideStatus, RideStatus> = {
  offen: "open",
  voll: "full",
  abgesagt: "cancelled",
};

const RIDER_STATUS: Record<M.EventRideRiderStatus, RideRiderStatus> = {
  zugesagt: "confirmed",
  abgesagt: "cancelled",
};

/** Nur die beiden EINGABE-Werte — "voll" pflegt der Trigger, nicht der Client. */
export function rideStatusToWire(status: "open" | "cancelled"): "offen" | "abgesagt" {
  return status === "open" ? "offen" : "abgesagt";
}

export function riderStatusToWire(status: RideRiderStatus): M.EventRideRiderStatus {
  return status === "confirmed" ? "zugesagt" : "abgesagt";
}

export function mapRideRider(w: M.EventRideRider): RideRider {
  return {
    id: w.id,
    rideId: w.ride_id,
    memberId: w.member_id,
    memberFirstName: w.member_first_name,
    memberLastName: w.member_last_name,
    registeredByProfileId: w.angemeldet_von_profile_id,
    status: RIDER_STATUS[w.status],
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapRide(w: M.EventRide): Ride {
  return {
    id: w.id,
    clubId: w.club_id,
    eventId: w.event_id,
    driverMemberId: w.driver_member_id,
    driverFirstName: w.driver_first_name,
    driverLastName: w.driver_last_name,
    departurePlace: w.abfahrtsort,
    departureAt: w.abfahrtszeit,
    seatsTotal: w.plaetze_gesamt,
    seatsFree: w.plaetze_frei,
    note: w.notiz,
    status: RIDE_STATUS[w.status],
    // UNVERÄNDERT übernommen: was hier ankommt, hat die Datenbank bereits
    // freigegeben. Es gibt bewusst keine zweite Redaktion an dieser Stelle.
    callbackNumber: w.rueckrufnummer,
    contactVisible: w.kontakt_sichtbar,
    riders: w.riders.map(mapRideRider),
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}
