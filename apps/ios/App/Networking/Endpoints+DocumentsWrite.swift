import Foundation

// ============================================================================
// SCHREIB-AKTIONEN fuer die Dokumente-Ablage (PRO), Web-Referenz:
// apps/web/app/(portal)/dokumente + lib/data/api/modules-batch5.ts.
//
// Der Upload ist — wie im Web — ZWEISTUFIG:
//   1. POST /media/upload  multipart/form-data, Felder `club_id` + `file`
//                          → liefert `storage_key`, `content_type`, `size_bytes`.
//                          (plain Hono, NICHT im OpenAPI-Contract — deshalb ein
//                          eigenes schmales Antwort-Struct, wie bei MyPhoto.)
//   2. POST /documents     JSON `DocumentCreate` mit dem storage_key aus (1).
//
//   DELETE /documents/{documentId}  entfernt die Zeile (Antwort: `Deleted`).
//
// RECHTE: Anlegen/Loeschen ist Trainer+PRO; das Gate im UI sitzt auf
// `permissions.isClubAdmin`, die Durchsetzung bleibt serverseitig (403/402).
// Der Multipart-Sender `sendMultipart` liegt in Endpoints+MyPhoto.swift —
// dieselbe Byte-Strecke, dieselbe RFC-7807-Fehlerbehandlung, EINE Stelle.
// ============================================================================

/// Antwort von `POST /media/upload` (Stufe 1). Nicht im Contract — schmal
/// nachgebildet (`kind` liefert der Server mit, hier fuer Dokumente egal).
struct MediaUploaded: Decodable {
    let storageKey: String
    let contentType: String
    let sizeBytes: Int

    enum CodingKeys: String, CodingKey {
        case storageKey = "storage_key"
        case contentType = "content_type"
        case sizeBytes = "size_bytes"
    }
}

extension APIClient {

    /// Stufe 1: rohe Datei-Bytes per multipart an POST /media/upload. `data`
    /// sind die Bytes der gewaehlten Datei, `mimeType` z. B. „application/pdf".
    /// Server-Limits: > 25 MB → 413, unerlaubter Typ → 415, ohne PRO → 402.
    func uploadMedia(
        clubId: String,
        data: Data,
        mimeType: String,
        fileName: String
    ) async throws -> MediaUploaded {
        let boundary = "rsm-\(UUID().uuidString)"
        var body = Data()
        func append(_ text: String) { body.append(Data(text.utf8)) }

        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"club_id\"\r\n\r\n")
        append(clubId)
        append("\r\n--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n")
        append("Content-Type: \(mimeType)\r\n\r\n")
        body.append(data)
        append("\r\n--\(boundary)--\r\n")

        var request = URLRequest(url: baseURL.appending(path: "/media/upload"))
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

        return try await sendMultipart(request)
    }

    /// Stufe 2: POST /documents — legt die Dokument-Zeile mit dem `storage_key`
    /// aus Stufe 1 an. Antwort ist das fertige `Document` (neueste zuerst).
    func createDocument(_ create: DocumentCreate) async throws -> Document {
        try await post("/documents", body: create)
    }

    /// DELETE /documents/{documentId} — Dokument entfernen (Trainer+PRO; sonst
    /// 403). Antwort: `Deleted` (`id` der geloeschten Zeile).
    @discardableResult
    func deleteDocument(documentId: String) async throws -> Deleted {
        try await delete("/documents/\(documentId)")
    }
}
