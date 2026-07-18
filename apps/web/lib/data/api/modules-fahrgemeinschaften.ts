import type { FahrgemeinschaftenRepository } from "../inputs-fahrgemeinschaften";
import { apiClient } from "./client";
import { mapRide, rideStatusToWire, riderStatusToWire } from "./mappers-fahrgemeinschaften";

/**
 * API-Implementierung der Fahrgemeinschaften (Migration 0066) über den
 * GENERIERTEN Contract-Client. Die Routen hängen am Termin bzw. an der Fahrt,
 * nicht am Verein — deshalb kein activeClubId() wie bei den Club-Routen.
 *
 * Rechte, Alters-Riegel, Vormund-Logik und Überbuchung: alles serverseitig.
 * Hier wird nichts vorgeprüft und nichts nachgebessert.
 */
export const moduleApiRepositoryFahrgemeinschaften: FahrgemeinschaftenRepository = {
  async getEventRides(eventId) {
    const rows = await apiClient.getEventsByEventIdRides(eventId);
    return rows.map(mapRide);
  },
  async offerRide(eventId, input) {
    const created = await apiClient.postEventsByEventIdRides(eventId, {
      abfahrtsort: input.departurePlace,
      abfahrtszeit: input.departureAt,
      plaetze_gesamt: input.seatsTotal,
      notiz: input.note,
      // WEGGELASSEN (undefined) heißt „nimm meine hinterlegte Nummer" — das
      // darf nicht versehentlich zu null werden, sonst bliebe die Fahrt ohne
      // Rückruf. Deshalb wird das Feld nur gesetzt, wenn es wirklich gemeint ist.
      ...(input.callbackNumber !== undefined ? { rueckrufnummer: input.callbackNumber } : {}),
    });
    return mapRide(created);
  },
  async updateRide(rideId, patch) {
    const updated = await apiClient.patchRidesByRideId(rideId, {
      abfahrtsort: patch.departurePlace,
      abfahrtszeit: patch.departureAt,
      plaetze_gesamt: patch.seatsTotal,
      notiz: patch.note,
      rueckrufnummer: patch.callbackNumber,
      ...(patch.status !== undefined ? { status: rideStatusToWire(patch.status) } : {}),
    });
    return mapRide(updated);
  },
  async joinRide(rideId, memberId) {
    const updated = await apiClient.postRidesByRideIdRiders(rideId, { member_id: memberId });
    return mapRide(updated);
  },
  async setRideRiderStatus(rideId, riderId, status) {
    const updated = await apiClient.patchRidesByRideIdRidersByRiderId(rideId, riderId, {
      status: riderStatusToWire(status),
    });
    return mapRide(updated);
  },
};
