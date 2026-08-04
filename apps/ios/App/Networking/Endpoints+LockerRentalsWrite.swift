import Foundation

// ============================================================================
// Schließfach-MIETE (Locker-Rentals) — Schreibwege für die iOS-Verwaltung.
//
// Ergänzung zur Fach-Verwaltung (Endpoints+PortalModules.swift). „Zuordnen“ ist
// die Schlüssel-Frage, „Vermieten“ die Geld-Frage — der Server koppelt beides
// bewusst nicht (v1-Regel, services/api/src/routes/locker-rentals.ts). Ein Fach
// hat höchstens EINEN laufenden Vertrag (409 bei Doppelvermietung).
//
// Request-/Response-Typen ausschließlich aus den generierten Contracts
// (LockerRental / LockerRentalCreate / LockerRentalUpdate). Web-Referenz:
// /(portal)/schliessfaecher (RentLockerSheet, EndRentalDialog, derive.ts).
// ============================================================================

extension APIClient {

    /// GET /locker-rentals — Mietverträge des Vereins (RLS: Fach-Verwalter sehen
    /// alle, Mitglieder nur ihre eigenen bzw. die ihrer Kinder).
    func listLockerRentals(clubId: String) async throws -> [LockerRental] {
        try await get("/locker-rentals", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    /// POST /locker-rentals — Fach vermieten (owner/admin/treasurer). Der
    /// vereinbarte Preis darf vom Listenpreis abweichen, `nil` (nicht festgelegt)
    /// oder 0 (ausdrücklich kostenlos) sein.
    @discardableResult
    func createLockerRental(_ input: LockerRentalCreate) async throws -> LockerRental {
        try await post("/locker-rentals", body: input)
    }

    /// PATCH /locker-rentals/{id} — Vertrag ändern oder beenden (Status auf
    /// „beendet“/„gekündigt“ + Enddatum). Berechtigung sitzt serverseitig.
    /// Bewusst omit-wenn-nil (generierter `LockerRentalUpdate`): derselbe Endpoint
    /// dient „bearbeiten" UND „beenden" (nur Status+Enddatum). Würde man nil-
    /// Felder als null erzwingen, löschte „beenden" die historische Gebühr —
    /// Datenverlust. Preis „ausdrücklich kostenlos" = 0 (wird kodiert), „nicht
    /// festgelegt" beim Bearbeiten bleibt daher unveränderbar (bewusster Kompromiss).
    @discardableResult
    func updateLockerRental(rentalId: String, _ input: LockerRentalUpdate) async throws -> LockerRental {
        try await patch("/locker-rentals/\(rentalId)", body: input)
    }

    /// DELETE /locker-rentals/{id} — Vertrag löschen (nur für versehentlich
    /// erfasste Verträge; ein echter Vertrag wird beendet, nicht gelöscht).
    @discardableResult
    func deleteLockerRental(rentalId: String) async throws -> Deleted {
        try await delete("/locker-rentals/\(rentalId)")
    }
}
