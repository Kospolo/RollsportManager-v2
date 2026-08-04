import Foundation

/// Schreib-Endpunkt des Pflichtstunden-Moduls (Löschen). Getrennt von den
/// geteilten `Endpoints.swift`, damit parallele Arbeit nicht kollidiert.
extension APIClient {

    /// DELETE /duty-entries/{entryId} — einen erfassten Stundeneintrag entfernen
    /// (Soft-Delete). Angeboten an eigenen Einträgen; die verbindliche
    /// Berechtigung erzwingt der Server (RLS, 403 → Hinweis). Antwort ist
    /// `Deleted` (die gelöschte ID).
    func deleteDutyEntry(id: String) async throws -> Deleted {
        try await delete("/duty-entries/\(id)")
    }
}
