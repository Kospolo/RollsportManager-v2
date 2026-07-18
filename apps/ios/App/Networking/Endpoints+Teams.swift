import Foundation

// ============================================================================
// Typisierte API-Calls für den LESENDEN Team-Bereich der Mitglieder
// (Web-Referenz: apps/web/app/(portal)/teams + teams/[id]/TeamDetail.tsx).
//
// Der Bereich braucht KEINE neuen Server-Routen: Teams, Roster-Namen und
// Sparten stehen bereits über bestehende Endpunkte zur Verfügung. Diese Datei
// bündelt sie unter sprechenden Namen, damit das Feature nicht quer durch
// Endpoints.swift greifen muss — Muster wie `listGuardianships` dort.
//
// STAFFELUNG: Was ein Mitglied nicht sehen darf, liefert der Server GAR NICHT
// (Roster-Redigierung in services/api/src/routes/members.ts). Der Client filtert
// deshalb NICHTS nach — er zeigt, was ankommt.
// ============================================================================

extension APIClient {

    /// Alias auf `teams(clubId:)` — Teams des Vereins inkl. `skater_member_ids`
    /// und `coach_member_ids`. Für JEDES Mitglied lesbar (kein Admin-Recht).
    func listTeams(clubId: String) async throws -> [Team] {
        try await teams(clubId: clubId)
    }

    /// GET /clubs/{clubId} — ein Verein (Stammdaten inkl. `logo_asset_id`).
    /// Bisher rief `AdminClubSettingsViewModel` dafür die generische
    /// `get`-Methode; dieser typisierte Weg schließt die dort gemeldete Lücke.
    func getClub(clubId: String) async throws -> Club {
        try await get("/clubs/\(clubId)")
    }
}
