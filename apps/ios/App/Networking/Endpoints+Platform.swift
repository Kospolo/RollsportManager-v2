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
// ### LESEND + EIN GEZIELTER SCHREIB-EINGRIFF ###
// Die Konsole ist überwiegend eine LESE-Konsole. EINE folgenschwere Schreib-
// Aktion ist bewusst freigeschaltet — die Lizenz eines Vereins umstellen
// (`patchPlatformEntitlement`) — weil sie mit klarer Begründungsführung auch
// unterwegs sicher ist: Das `reason`-Feld ist NICHT dekorativ, es landet im
// operator_audit_log, deshalb gibt die UI (`EditEntitlementSheet`) das Speichern
// erst frei, wenn es gefüllt ist. Produktpreise und Plattform-Einstellungen/SMTP
// (`PATCH /platform/settings`) bleiben dagegen im Web: breiter Blick nötig.
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

    /// PATCH /platform/entitlements/{clubId} — Lizenz eines Vereins setzen/ändern
    /// (Stufe, Status, Laufzeit/Testtage). Jede Änderung setzt die Quelle auf
    /// „manuell" und wird mit `reason` im operator_audit_log protokolliert. Web-
    /// Referenz: apps/web/lib/data/modules-platform.ts (platformSetEntitlement).
    /// 409 = illegaler Übergang, 422 = unbekanntes Produkt, 403 = keine Berechtigung.
    func patchPlatformEntitlement(
        clubId: String,
        _ patch: PlatformEntitlementPatch
    ) async throws -> PlatformEntitlementRow {
        // valid_until MUSS explizit gesendet werden — auch als null (= unbefristet).
        // Der generierte PlatformEntitlementPatch lässt nil-Optionals weg
        // (JSONEncoder), dann behielte der Server (platform-licenses.ts) die ALTE
        // Frist statt sie zu leeren. Nur bei Trial-Tagen wird valid_until
        // weggelassen (der Server rechnet den Term aus den Tagen). Spiegel
        // EditEntitlementModal.submit() im Web.
        struct Wire: Encodable {
            let tier: PlatformTier
            let status: PlatformEntitlementStatus
            let validUntil: String?
            let trialDays: Int?
            let reason: String?
            let sendValidUntil: Bool
            enum CodingKeys: String, CodingKey {
                case tier, status, reason
                case validUntil = "valid_until"
                case trialDays = "trial_days"
            }
            func encode(to encoder: Encoder) throws {
                var c = encoder.container(keyedBy: CodingKeys.self)
                try c.encode(tier, forKey: .tier)
                try c.encode(status, forKey: .status)
                try c.encodeIfPresent(reason, forKey: .reason)
                try c.encodeIfPresent(trialDays, forKey: .trialDays)
                if sendValidUntil {
                    if let validUntil { try c.encode(validUntil, forKey: .validUntil) }
                    else { try c.encodeNil(forKey: .validUntil) }
                }
            }
        }
        let wire = Wire(
            tier: patch.tier, status: patch.status, validUntil: patch.validUntil,
            trialDays: patch.trialDays, reason: patch.reason,
            sendValidUntil: patch.trialDays == nil
        )
        return try await self.patch("/platform/entitlements/\(clubId)", body: wire)
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
