import Foundation

// ============================================================================
// Schreib-Aufrufe des Belegungsplan-Features (Anlage bearbeiten/loeschen,
// Buchung loeschen). Web-Referenz-UX: apps/web/app/(portal)/belegungsplan
// (FacilityFormDialog / DeleteFacilityDialog / DeleteBookingDialog).
//
// Muster wie Endpoints.swift: duenne Schicht ueber APIClient, Request-/
// Response-Typen ausschliesslich aus den generierten Contracts
// (FacilityUpdate / Facility / Deleted). Das Anlegen (createFacility) und das
// Buchen (createBooking) liegen weiterhin in Endpoints.swift.
//
// RECHTE (Server ist die Grenze — hier nur die Aufrufe): Bearbeiten/Loeschen
// einer Anlage sowie das Loeschen einer Buchung sind Vereins-Admin-Sache; ein
// 403 kommt als `APIError.problem` und wird im UI als Klartext behandelt.
// ============================================================================

extension APIClient {

    /// PATCH /facilities/{facilityId} — Anlage bearbeiten (nur gesetzte Felder im
    /// `FacilityUpdate`). Antwort ist die aktualisierte `Facility` (fuer den
    /// optimistischen Ersatz in der Liste).
    func updateFacility(facilityId: String, _ update: FacilityUpdate) async throws -> Facility {
        try await patch("/facilities/\(facilityId)", body: update)
    }

    /// DELETE /facilities/{facilityId} — Anlage loeschen. Antwort ist `Deleted`
    /// (`status` + `id`) fuer das Entfernen aus der Liste.
    @discardableResult
    func deleteFacility(facilityId: String) async throws -> Deleted {
        try await delete("/facilities/\(facilityId)")
    }

    /// DELETE /facility-bookings/{bookingId} — Buchung loeschen. Antwort ist
    /// `Deleted` (`status` + `id`) fuer das Entfernen aus der Buchungsliste.
    @discardableResult
    func deleteFacilityBooking(bookingId: String) async throws -> Deleted {
        try await delete("/facility-bookings/\(bookingId)")
    }
}
