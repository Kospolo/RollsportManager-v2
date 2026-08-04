import Foundation

// ============================================================================
// Schreibende API-Calls des Familie-Features (Selfservice; Web-Referenz:
// (portal)/familie/_components — CreateChildDialog / LinkChildSheet /
// RemoveGuardianshipDialog).
//
// Es gibt KEIN Client-Rechte-Gate: „eigene Kinder pflegen" ist Selfservice,
// die genaue Regel (nur unverwaltete, kontolose Kinder verknüpfbar) erzwingt
// der SERVER. Ein fehlendes Recht kommt als RFC-7807-403 zurück und wird zum
// ruhigen Klartext-Fehler (`APIError.errorDescription`).
// ============================================================================

extension APIClient {

    /// POST /clubs/{clubId}/children — legt ein Mitglied ohne eigenen Zugang an
    /// und verknüpft es direkt mit der eingeloggten Person (guardianMemberId
    /// bleibt bewusst leer, der Server setzt die:den Guardian).
    func createChild(clubId: String, _ body: ChildCreate) async throws -> ChildCreated {
        try await post("/clubs/\(clubId)/children", body: body)
    }

    /// POST /clubs/{clubId}/guardianships — verknüpft ein bestehendes,
    /// vereinsverwaltetes Mitglied als eigenes Kind (guardianMemberId leer ⇒
    /// die eingeloggte Person wird zur Bezugsperson).
    func createGuardianship(clubId: String, _ body: GuardianshipCreate) async throws -> Guardianship {
        try await post("/clubs/\(clubId)/guardianships", body: body)
    }

    /// DELETE /clubs/{clubId}/guardianships/{guardianshipId} — hebt eine
    /// Familien-Verknüpfung auf (das Mitglied selbst bleibt bestehen). Die API
    /// antwortet mit `Deleted`.
    @discardableResult
    func deleteGuardianship(clubId: String, guardianshipId: String) async throws -> Deleted {
        try await delete("/clubs/\(clubId)/guardianships/\(guardianshipId)")
    }
}
