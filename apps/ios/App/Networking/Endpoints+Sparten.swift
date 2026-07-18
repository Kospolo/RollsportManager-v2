import Foundation

// ============================================================================
// Typisierte API-Calls für das Sparten-Feature (Verein → Sparten → Teams →
// Mitglieder). Web-Referenz-UX: apps/web/app/(portal)/sparten.
//
// Muster wie in Endpoints.swift: dünne Schicht über APIClient, Request-/
// Response-Typen ausschließlich aus den generierten Contracts
// (packages/contracts/generated/swift/RSMContracts.swift — Sparte/SparteCreate/
// SparteUpdate/SparteMembersSet/TeamSparteSet). Club-gebundene Listen nehmen die
// `clubId` aus `SessionStore.clubId`.
//
// RECHTE (Server ist die Grenze — hier nur die Aufrufe): Lesen darf jedes
// Mitglied; Anlegen/Ändern/(De-)Aktivieren/Löschen/Zuordnen ist
// can_manage_sparten (Super-Admin/owner/admin/treasurer — NICHT
// moderator/coach/member). Ein 403 kommt als `APIError.problem` und wird im UI
// als Klartext + Rollback behandelt.
// ============================================================================

extension APIClient {

    // MARK: - Sparten (Verwaltung)

    /// GET /clubs/{clubId}/sparten — alle Sparten des Vereins (aktiv + inaktiv)
    /// inkl. `member_ids`, server-sortiert nach `sortierung`.
    func listSparten(clubId: String) async throws -> [Sparte] {
        try await get("/clubs/\(clubId)/sparten")
    }

    /// POST /clubs/{clubId}/sparten — Sparte anlegen (can_manage_sparten; sonst
    /// `Problem` mit `status == 403`). Antwort ist die erzeugte `Sparte` inkl. ID.
    func createSparte(clubId: String, _ create: SparteCreate) async throws -> Sparte {
        try await post("/clubs/\(clubId)/sparten", body: create)
    }

    /// PATCH /clubs/{clubId}/sparten/{sparteId} — Sparte bearbeiten bzw.
    /// (de)aktivieren (nur gesetzte Felder im `SparteUpdate`). Antwort ist die
    /// aktualisierte `Sparte` (für den optimistischen Ersatz in der Liste).
    func updateSparte(
        clubId: String,
        sparteId: String,
        _ update: SparteUpdate
    ) async throws -> Sparte {
        try await patch("/clubs/\(clubId)/sparten/\(sparteId)", body: update)
    }

    /// DELETE /clubs/{clubId}/sparten/{sparteId} — Sparte soft-löschen. Mitglieder
    /// bleiben im Verein; zugeordnete Teams verlieren ihre Sparte. Antwort ist
    /// `Deleted` (`status` + `id`) für das optimistische Entfernen aus der Liste.
    @discardableResult
    func deleteSparte(clubId: String, sparteId: String) async throws -> Deleted {
        try await delete("/clubs/\(clubId)/sparten/\(sparteId)")
    }

    /// PUT /clubs/{clubId}/sparten/{sparteId}/members — Roster als VOLL-Replace
    /// setzen (n:m; ein Mitglied kann in mehreren Sparten sein). Fehlende
    /// Mitglieder werden soft-detached, zuvor entfernte wiederbelebt. Antwort ist
    /// die aktualisierte `Sparte` inkl. neuer `member_ids`.
    func setSparteMembers(
        clubId: String,
        sparteId: String,
        _ set: SparteMembersSet
    ) async throws -> Sparte {
        try await put("/clubs/\(clubId)/sparten/\(sparteId)/members", body: set)
    }

    // MARK: - Team → Sparte

    /// PUT /clubs/{clubId}/teams/{teamId}/sparte — Team einer Sparte zuordnen
    /// (`sparteId`) oder die Zuordnung entfernen (`sparteId == nil`). Ein Team
    /// gehört zu höchstens EINER Sparte. Antwort ist das aktualisierte `Team`.
    func setTeamSparte(
        clubId: String,
        teamId: String,
        _ set: TeamSparteSet
    ) async throws -> Team {
        try await put("/clubs/\(clubId)/teams/\(teamId)/sparte", body: set)
    }
}
