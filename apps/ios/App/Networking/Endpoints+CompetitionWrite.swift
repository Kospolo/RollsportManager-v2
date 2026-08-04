import Foundation

// ============================================================================
// Schreib-Endpunkte des Wettkampf-Features (Bearbeiten/Löschen) — die
// iOS-Ergänzung zu createCompetition/listCompetitions in Endpoints.swift.
// Web-Referenz: apps/web/app/(portal)/wettkampf (NewCompetitionSheet im
// Edit-Modus + OverviewTab-Löschen). Request-/Response-Typen ausschließlich
// aus den generierten Contracts (Competition/CompetitionUpdate).
//
// RECHTE (Server ist die Grenze — hier nur die Aufrufe): Anlegen/Bearbeiten/
// Löschen darf der Vereins-Trainerstab; ein 403 kommt als `APIError.problem`
// und wird im UI als Klartext behandelt.
// ============================================================================

extension APIClient {

    /// PATCH /competitions/{competitionId} — Stammdaten ändern (Name/Ort/Zeiten/
    /// Meldeschluss/Status; nur gesetzte Felder im `CompetitionUpdate`). Antwort
    /// ist der aktualisierte `Competition` für den optimistischen Ersatz.
    func updateCompetition(
        competitionId: String,
        _ input: CompetitionUpdate
    ) async throws -> Competition {
        try await patch("/competitions/\(competitionId)", body: input)
    }

    /// DELETE /competitions/{competitionId} — Wettkampf löschen. Antwort ist
    /// `Deleted` (`status` + `id`) für das optimistische Entfernen aus der Liste.
    @discardableResult
    func deleteCompetition(competitionId: String) async throws -> Deleted {
        try await delete("/competitions/\(competitionId)")
    }
}
