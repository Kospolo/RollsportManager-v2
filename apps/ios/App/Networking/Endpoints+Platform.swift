import Foundation

// ============================================================================
// Typisierte API-Calls der BETREIBER-EBENE (`/platform/*`).
//
// Web-Referenz: apps/web/app/(super)/**. Diese Routen gehören NICHT dem
// Verein, sondern dem Betreiber der Plattform: sie sehen über alle Vereine
// hinweg und haben deshalb bewusst KEINEN `club_id`-Pflichtparameter.
//
// ### DIESE DATEI SCHÜTZT NICHTS ###
// Jeder `/platform/*`-Endpoint prüft serverseitig `requirePlatformAdmin`
// (Token-Claim `app_metadata.is_platform_admin`). Wer ohne Claim aufruft,
// bekommt 403 — auch aus dieser App heraus. Das Client-Gate (`PlatformGate`)
// spart nur den sinnlosen Fetch und die hässliche Fehlermeldung.
//
// ### NUR LESEND ###
// Die Konsole ist in iOS bewusst eine LESE-Konsole. Schreibende
// Betreiber-Eingriffe (Lizenz umstellen, Produktpreis ändern,
// Plattform-Einstellungen/SMTP) bleiben im Web: sie sind selten, folgenschwer
// und brauchen eine breite Ansicht. `PATCH /platform/entitlements/{clubId}`
// und `PATCH /platform/settings` sind hier absichtlich NICHT abgebildet — wer
// sie ergänzt, muss zuerst eine Bestätigungs- und Begründungsführung bauen
// (das `reason`-Feld des Contracts ist nicht dekorativ, es landet im
// operator_audit_log).
// ============================================================================

extension APIClient {

    // MARK: - Überblick

    /// GET /platform/stats — Kennzahlen über alle Vereine (Kopfzeile der Konsole).
    func getPlatformStats() async throws -> PlatformStats {
        try await get("/platform/stats")
    }

    // MARK: - Vereine & Nutzer

    /// GET /platform/clubs — alle Vereine der Plattform inkl. Mitgliederzahl.
    func listPlatformClubs() async throws -> [PlatformClub] {
        try await get("/platform/clubs")
    }

    /// GET /platform/users — alle Konten der Plattform (Anzeigename, Sprache,
    /// Anzahl Vereinsmitgliedschaften). BEWUSST OHNE E-Mail/Klarnamen-Suche:
    /// die Betreiber-Sicht braucht Betriebsübersicht, keine Personenakte.
    func listPlatformUsers() async throws -> [PlatformUser] {
        try await get("/platform/users")
    }

    // MARK: - Lizenzen

    /// GET /platform/entitlements — Lizenzzeile je Verein (Stufe, Status,
    /// Quelle, Laufzeit). Vereine ohne Lizenz erscheinen mit leeren Feldern —
    /// das ist der Normalfall „kostenlos“, kein Fehler.
    func listPlatformEntitlements() async throws -> [PlatformEntitlementRow] {
        try await get("/platform/entitlements")
    }

    // MARK: - Support

    /// GET /platform/support/tickets — Support-Anfragen aller Vereine,
    /// optional auf einen Verein eingegrenzt.
    func listPlatformSupportTickets(clubId: String? = nil) async throws -> [SupportTicket] {
        var query: [URLQueryItem] = []
        if let clubId { query.append(URLQueryItem(name: "club_id", value: clubId)) }
        return try await get("/platform/support/tickets", query: query)
    }

    // MARK: - Küren-Moderation

    /// GET /platform/routines — Küren aller Vereine (Moderationssicht:
    /// Titel, Verein, Status, Musik/Datei-Metadaten). Optional gefiltert nach
    /// Verein, Status und Freitext; `limit` deckelt der Server bei 200.
    func listPlatformRoutines(
        clubId: String? = nil,
        status: PlatformRoutineRowStatus? = nil,
        search: String? = nil,
        limit: Int? = nil
    ) async throws -> [PlatformRoutineRow] {
        var query: [URLQueryItem] = []
        if let clubId { query.append(URLQueryItem(name: "club_id", value: clubId)) }
        if let status { query.append(URLQueryItem(name: "status", value: status.rawValue)) }
        if let search, !search.isEmpty { query.append(URLQueryItem(name: "q", value: search)) }
        if let limit { query.append(URLQueryItem(name: "limit", value: String(limit))) }
        return try await get("/platform/routines", query: query)
    }

    // MARK: - System

    /// GET /platform/system — Laufzeit-Auskunft: App-Version, Auth-Modus,
    /// DB-Zählwerke + Größe, Migrationsstand, Health.
    func getPlatformSystem() async throws -> PlatformSystem {
        try await get("/platform/system")
    }
}
