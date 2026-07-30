import Foundation

// ============================================================================
// Support-Thread — die drei club-scoped Endpunkte (NICHT `/platform/*`).
//
// Web-Referenz: apps/web/lib/data/modules-support.ts (getSupportTicket,
// replySupportTicket, updateSupportTicket) — genutzt von TicketThread.tsx.
//
// ### WARUM /support statt /platform ###
// Ein Ticket gehört einem Verein. Die Betreiber-Antwort läuft im Web auf
// Konsolen-Ebene (unter /super), OHNE dass der Betreiber den Verein „betreten"
// muss: der Server erlaubt platform-admin dort (Migration 0052) und loggt gegen
// die Ticket-Club. iOS spiegelt das 1:1 — die drei Aufrufe brauchen KEINEN
// operatorClub-Kontext.
//
// `author_kind` schickt der Client NIE mit: der Server leitet die Seite aus dem
// Token ab (`SupportMessageCreate` trägt nur `body`). `SupportTicketUpdate`
// (status/priority) darf serverseitig nur der Betreiber setzen.
// ============================================================================

extension APIClient {

    /// GET /support/tickets/{id} — ein Ticket samt Verlauf (`messages`).
    func getSupportTicket(id: String) async throws -> SupportTicketDetail {
        try await get("/support/tickets/\(id)")
    }

    /// POST /support/tickets/{id}/messages — Antwort in den Verlauf schreiben.
    /// Liefert das aktualisierte Ticket zurück (inkl. neuer Nachricht).
    func replySupportTicket(
        id: String,
        _ message: SupportMessageCreate
    ) async throws -> SupportTicketDetail {
        try await post("/support/tickets/\(id)/messages", body: message)
    }

    /// PATCH /support/tickets/{id} — Status/Dringlichkeit setzen (Betreiber-Vorbehalt).
    func updateSupportTicket(
        id: String,
        _ update: SupportTicketUpdate
    ) async throws -> SupportTicketDetail {
        try await patch("/support/tickets/\(id)", body: update)
    }
}
