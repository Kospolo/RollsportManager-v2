import Foundation

/// Schreib-Endpunkt des Check-in-Moduls (Löschen). Getrennt von den geteilten
/// `Endpoints.swift`, damit parallele Arbeit nicht kollidiert.
extension APIClient {

    /// DELETE /checkins/{checkinId} — einen Check-in entfernen (Soft-Delete). In
    /// der UI nur dem Trainerstab angeboten; die verbindliche Berechtigung
    /// erzwingt der Server (RLS/Rollencheck, 403 → Hinweis). Antwort ist
    /// `Deleted` (die gelöschte ID).
    func deleteCheckin(id: String) async throws -> Deleted {
        try await delete("/checkins/\(id)")
    }
}
