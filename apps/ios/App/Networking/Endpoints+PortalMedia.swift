import Foundation

// ============================================================================
// Typisierte API-Calls für die PRO-Module Galerie & Dokumente, das
// Vereins-Entitlement und das Kür-Teilen — plus der auth-tragende Medien-
// Transfer (GET /media/{key} mit Bearer).
//
// Muster wie Endpoints.swift: dünne Schicht über APIClient, Request-/Response-
// Typen ausschließlich aus den generierten Contracts (GalleryItem, Document,
// Entitlement, RoutineShareCreate/Created/Revoked). Club-gebundene Listen
// nehmen die `clubId` aus `SessionStore.session?.profile.clubId`.
//
// PRO-Gate: `listGallery`/`listDocuments` liefern 402 `club_pro_required`,
// wenn der Verein keine aktive PRO/Premium-Lizenz hat — die Screens gaten
// vorab über `getEntitlement` und fangen ein 402 zusätzlich ab (s.
// APIError.isClubProRequired).
// ============================================================================

extension APIClient {

    // MARK: - Galerie (PRO)

    /// GET /gallery?club_id= — Foto-/Video-Einträge des Vereins (neueste zuerst).
    /// PRO-gated: ohne aktive Lizenz `Problem` mit `status == 402`.
    func listGallery(clubId: String) async throws -> [GalleryItem] {
        try await get("/gallery", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    // MARK: - Dokumente (PRO)

    /// GET /documents?club_id= — Dokumente des Vereins (neueste zuerst).
    /// PRO-gated wie die Galerie (402 ohne Lizenz).
    func listDocuments(clubId: String) async throws -> [Document] {
        try await get("/documents", query: [URLQueryItem(name: "club_id", value: clubId)])
    }

    // MARK: - Entitlement (read-only)

    /// GET /entitlements/{clubId} — Roh-Zeilen der Vereins-Lizenz (read-only;
    /// geschrieben nur vom Webhook-Service). Für das UI-Gate lieber
    /// `getEntitlement(clubId:)` nutzen (abgeleitetes `pro`-Flag).
    func entitlements(clubId: String) async throws -> [Entitlement] {
        try await get("/entitlements/\(clubId)")
    }

    /// Abgeleitete PRO-Sicht fürs UI-Gate — spiegelt `app.is_club_pro`
    /// (Web: `deriveEntitlement`): aktiv = nicht abgelaufen UND Status
    /// active/trial (fehlender Status = aktiv); `pro` = eine aktive Zeile mit
    /// Tier `pro` oder `premium`. Das verbindliche Gate bleibt serverseitig.
    func getEntitlement(clubId: String) async throws -> ClubProStatus {
        let rows = try await entitlements(clubId: clubId)
        return ClubProStatus(clubId: clubId, rows: rows)
    }

    // MARK: - Kür teilen (Trainerstab)

    /// POST /routines/{routineId}/share — öffentlichen Token-Link erzeugen
    /// (Trainerstab; `member`/`guest` erhalten `Problem` mit `status == 403`).
    /// `expiresAt` als voller ISO-8601-`date-time`-String oder `nil` (läuft nie
    /// ab). Antwort: `RoutineShareCreated` (token, relativer `url`, expiresAt).
    func createRoutineShare(
        routineId: String,
        expiresAt: String? = nil
    ) async throws -> RoutineShareCreated {
        try await post(
            "/routines/\(routineId)/share",
            body: RoutineShareCreate(expiresAt: expiresAt)
        )
    }

    /// DELETE /routines/{routineId}/share/{token} — Link widerrufen
    /// (Trainerstab; sonst 403). Antwort: `RoutineShareRevoked` (`revoked`).
    @discardableResult
    func revokeRoutineShare(routineId: String, token: String) async throws -> RoutineShareRevoked {
        try await delete("/routines/\(routineId)/share/\(token)")
    }

    // KEIN listRoutineShares: der Server hat bewusst KEINEN Listen-Endpoint für
    // Kür-Shares (nur POST create + DELETE revoke). Der Web-Client hält die in
    // der Session erzeugten Links selbst (ShareRoutineDialog). Native macht es
    // genauso: `ShareRoutineViewModel` sammelt die Links dieser Session. Sobald
    // die Spec einen GET /routines/{id}/shares bekommt, hier ergänzen.

    // MARK: - Medien-Transfer (auth-pflichtig)

    /// GET /media/{key} MIT Bearer — rohe Bytes des Assets. Verwendet vom
    /// `MediaImageStore` (Bilder) und `downloadMedia` (Dateien). Nutzt einen
    /// eigenen URLRequest (statt `get`), weil die Antwort kein JSON ist.
    func mediaBytes(key: String) async throws -> Data {
        let (data, _) = try await rawMediaResponse(key: key)
        return data
    }

    /// Lädt /media/{key} in eine temporäre Datei (für QuickLook / Teilen).
    /// Dateiname aus `suggestedName` (fällt auf `key` + inferierte Endung
    /// zurück). Rückgabe ist die lokale `file://`-URL im temporären Verzeichnis.
    func downloadMedia(key: String, suggestedName: String? = nil) async throws -> URL {
        let (data, response) = try await rawMediaResponse(key: key)
        let name = Self.temporaryFileName(
            suggestedName: suggestedName,
            key: key,
            contentType: response.value(forHTTPHeaderField: "Content-Type")
        )
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        try data.write(to: url, options: .atomic)
        return url
    }

    // MARK: - Intern

    private func rawMediaResponse(key: String) async throws -> (Data, HTTPURLResponse) {
        let url = baseURL.appending(path: "/media/\(key)")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.transport(underlying: error)
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError.unexpectedStatus(code: -1)
        }
        guard (200..<300).contains(http.statusCode) else {
            if let problem = try? JSONDecoder().decode(Problem.self, from: data) {
                throw APIError.problem(problem)
            }
            throw APIError.unexpectedStatus(code: http.statusCode)
        }
        return (data, http)
    }

    /// Sicherer Dateiname (Pfad-Trenner entfernen) + passende Endung.
    private static func temporaryFileName(
        suggestedName: String?,
        key: String,
        contentType: String?
    ) -> String {
        if let suggestedName, !suggestedName.isEmpty {
            let safe = suggestedName.replacingOccurrences(of: "/", with: "-")
            if (safe as NSString).pathExtension.isEmpty,
               let ext = fileExtension(forContentType: contentType) {
                return "\(safe).\(ext)"
            }
            return safe
        }
        let base = (key as NSString).lastPathComponent
        if (base as NSString).pathExtension.isEmpty,
           let ext = fileExtension(forContentType: contentType) {
            return "\(base).\(ext)"
        }
        return base
    }

    private static func fileExtension(forContentType contentType: String?) -> String? {
        guard let raw = contentType?.split(separator: ";").first.map(String.init) else { return nil }
        switch raw.trimmingCharacters(in: .whitespaces).lowercased() {
        case "application/pdf": return "pdf"
        case "image/jpeg": return "jpg"
        case "image/png": return "png"
        case "image/heic": return "heic"
        case "video/mp4": return "mp4"
        case "text/plain": return "txt"
        default: return nil
        }
    }
}

// ============================================================================
// App-seitige Ableitung (kein Contract): das PRO-Flag fürs UI-Gate.
// ============================================================================

/// Abgeleitete Vereins-Lizenz-Sicht fürs UI (aus `[Entitlement]`).
/// Spiegelt `deriveEntitlement` der Web-Facade / `app.is_club_pro`.
struct ClubProStatus: Equatable {
    let clubId: String
    let pro: Bool
    /// „premium" | „pro" | „free".
    let tier: String
    let validUntil: String?

    init(clubId: String, rows: [Entitlement]) {
        let now = ISO8601DateFormatter().string(from: Date())
        let active = rows.filter { row in
            let notExpired = row.validUntil == nil || (row.validUntil ?? "") >= now
            let status = (row.status ?? "active").lowercased()
            return notExpired && (status == "active" || status == "trial")
        }
        let tierOf: (Entitlement) -> String = { ($0.tier ?? "").lowercased() }
        let premiumRow = active.first { tierOf($0) == "premium" }
        let proRow = premiumRow ?? active.first { tierOf($0) == "pro" }
        self.clubId = clubId
        self.pro = proRow != nil
        self.tier = premiumRow != nil ? "premium" : (proRow != nil ? "pro" : "free")
        self.validUntil = proRow?.validUntil
    }
}

// ============================================================================
// 402-Erkennung fürs PRO-Gate — analog `isForbidden` (403) in APIClient.swift.
// ============================================================================

extension APIError {
    /// `true`, wenn der Server HTTP 402 geliefert hat (Payment Required).
    var isPaymentRequired: Bool {
        if case .problem(let problem) = self { return problem.status == 402 }
        return false
    }

    /// `true` bei 402 mit `club_pro_required` im Detail — Galerie/Dokumente
    /// ohne aktive PRO-Lizenz. Screens zeigen dann die Upgrade-Karte.
    var isClubProRequired: Bool {
        guard case .problem(let problem) = self, problem.status == 402 else { return false }
        return (problem.detail ?? "").hasPrefix("club_pro_required")
    }
}

extension Error {
    /// Bequemer 402-`club_pro_required`-Check auch auf `any Error`.
    var isClubProRequiredError: Bool { (self as? APIError)?.isClubProRequired ?? false }
}
