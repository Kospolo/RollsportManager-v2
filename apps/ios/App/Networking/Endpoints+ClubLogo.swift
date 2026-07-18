import Foundation

// ============================================================================
// Das VEREINSLOGO (Migration 0060, services/api/src/modules/media/club-logo.ts).
//
//   GET    /public/clubs/{clubId}/logo   die Bytes — OHNE Auth (öffentliches
//                                        Marken-Asset; löst NUR clubs.logo_asset_id
//                                        auf, kein anderes Medium ist erreichbar)
//   POST   /clubs/{clubId}/logo          multipart/form-data, Feld `file`
//   DELETE /clubs/{clubId}/logo          Logo entfernen
//
// RECHTE: Anzeigen darf JEDER (auch anonym). Setzen/Entfernen NUR owner/admin
// — moderator bewusst nicht (Vereins-Stammdaten). Ein 403 kommt als
// RFC-7807-`Problem` und wird im UI als Klartext gezeigt.
//
// Upload/Delete sind — wie /media/upload — plain Hono und bewusst NICHT in der
// OpenAPI-Spec; es gibt dafür also keine generierten Request-Typen. Die Antwort
// des POST/DELETE ist der aktualisierte `Club` (Contract-Typ).
// ============================================================================

extension APIClient {

    /// Öffentliche URL des Vereinslogos. Braucht KEIN Bearer-Token, kann also
    /// direkt an `AsyncImage` gehen (anders als `/media/{key}`, siehe
    /// MediaImage.swift). 404, solange der Verein kein Logo hat.
    func clubLogoURL(clubId: String) -> URL {
        baseURL.appending(path: "/public/clubs/\(clubId)/logo")
    }

    /// POST /clubs/{clubId}/logo — Logo setzen/ersetzen (owner/admin; sonst 403).
    /// `data` sind die rohen Bild-Bytes, `mimeType` z. B. „image/jpeg". Der
    /// Server erlaubt nur Bilder (sonst 415) und begrenzt die Größe (413).
    /// Antwort ist der aktualisierte `Club` (mit neuer `logo_asset_id`).
    func uploadClubLogo(
        clubId: String,
        data: Data,
        mimeType: String,
        fileName: String = "logo"
    ) async throws -> Club {
        let boundary = "rsm-\(UUID().uuidString)"
        var body = Data()
        func append(_ text: String) { body.append(Data(text.utf8)) }

        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n")
        append("Content-Type: \(mimeType)\r\n\r\n")
        body.append(data)
        append("\r\n--\(boundary)--\r\n")

        var request = URLRequest(url: baseURL.appending(path: "/clubs/\(clubId)/logo"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(
            "multipart/form-data; boundary=\(boundary)",
            forHTTPHeaderField: "Content-Type"
        )
        if let token = tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body

        return try await send(request)
    }

    /// DELETE /clubs/{clubId}/logo — Logo entfernen (owner/admin; sonst 403).
    /// Antwort ist der aktualisierte `Club` (ohne `logo_asset_id`).
    @discardableResult
    func deleteClubLogo(clubId: String) async throws -> Club {
        try await delete("/clubs/\(clubId)/logo")
    }

    /// Eigener Sende-Weg für den Multipart-Upload: `APIClient.request` kodiert
    /// den Body immer als JSON — hier sind es rohe Bytes. Fehlerbehandlung
    /// (RFC 7807) bleibt identisch.
    private func send<Response: Decodable>(_ request: URLRequest) async throws -> Response {
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
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(underlying: error)
        }
    }
}
