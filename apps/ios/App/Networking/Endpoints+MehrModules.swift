import Foundation

// ============================================================================
// Typisierte API-Calls für die vier neuen „Mehr“-Module —
// Notizen · Events (regional) · Abteilungen · Jubiläen.
//
// Muster wie in Endpoints.swift: dünne Schicht über APIClient, Request-/
// Response-Typen ausschließlich aus den generierten Contracts
// (packages/contracts/generated/swift/RSMContracts.swift). Club-gebundene
// Listen nehmen die `clubId` aus `SessionStore.session?.profile.clubId`.
// ============================================================================

extension APIClient {

    // MARK: - Notizen (privat, eigener Nutzer)
    //
    // Web-Referenz: /(portal)/notizen. Rein persönliche Notizen — der Server
    // scoped auf den eingeloggten Nutzer (RLS), deshalb hat GET /notes bewusst
    // KEINEN Filter-Parameter. `clubId` im `NoteCreate`/`NoteUpdate` ist
    // optional (Notiz einem Verein zuordnen), Default = rein privat.

    /// GET /notes — die eigenen Notizen des angemeldeten Nutzers.
    func listNotes() async throws -> [Note] {
        try await get("/notes")
    }

    /// POST /notes — Notiz anlegen. `title`/`body` und optional `clubId`
    /// stecken im `NoteCreate`. Antwort ist die erzeugte `Note` inkl. ID.
    func createNote(_ create: NoteCreate) async throws -> Note {
        try await post("/notes", body: create)
    }

    /// PATCH /notes/{noteId} — Notiz teilweise ändern (nur gesetzte Felder im
    /// `NoteUpdate`). Fremde Notiz ⇒ `Problem` mit 403/404 (RLS). Antwort ist
    /// die aktualisierte `Note`.
    func updateNote(noteId: String, _ update: NoteUpdate) async throws -> Note {
        try await patch("/notes/\(noteId)", body: update)
    }

    /// DELETE /notes/{noteId} — Notiz löschen. Antwort ist `Deleted`
    /// (`status` + `id`) für den optimistischen Entfernen-aus-der-Liste.
    @discardableResult
    func deleteNote(noteId: String) async throws -> Deleted {
        try await delete("/notes/\(noteId)")
    }

    // MARK: - Events (regionale Termine)
    //
    // Web-Referenz: /(portal)/events. Überregionale Wettkämpfe/Veranstaltungen
    // des Vereins (RegionalEvent), server-sortiert nach `starts_on`. Schreiben
    // nur Trainerstab — hier vorerst die Leseliste (POST/PATCH/DELETE liegen im
    // Contract bereit, siehe RegionalEventCreate/Update).

    /// GET /regional-events — regionale Termine des Vereins.
    func listRegionalEvents(clubId: String) async throws -> [RegionalEvent] {
        try await get("/regional-events", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    // MARK: - Abteilungen (Departments)
    //
    // Web-Referenz: /(portal)/abteilungen. Abteilungen/Sparten des Vereins
    // (Department), server-sortiert nach `sort_order`. Jede Abteilung trägt
    // ihre Mitglieder als `memberIds` — die Stammdaten dazu liefert der schon
    // bestehende `listMembers(clubId:)` (Endpoints.swift), deshalb hier KEIN
    // Duplikat: das Abteilungen-Team ruft `listDepartments` + `listMembers`.

    /// GET /departments — Abteilungen des Vereins inkl. `member_ids`.
    func listDepartments(clubId: String) async throws -> [Department] {
        try await get("/departments", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    // MARK: - Jubiläen (Anniversaries)
    //
    // Web-Referenz: /(portal)/jubilaeen. Serverseitig aggregierte Liste
    // (Anniversary: Geburtstag/Vereins-Jubiläum, `years` + `days_until`),
    // sortiert nach Nähe. Reine Leseansicht.

    /// GET /reports/anniversaries — anstehende Jubiläen des Vereins.
    func getAnniversaries(clubId: String) async throws -> [Anniversary] {
        try await get("/reports/anniversaries", query: [URLQueryItem(name: "club_id", value: clubId)])
    }
}
