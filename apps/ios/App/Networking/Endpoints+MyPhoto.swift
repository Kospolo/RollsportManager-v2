import Foundation
import ImageIO
import UniformTypeIdentifiers
import CoreGraphics

// ============================================================================
// DAS EIGENE PROFILBILD (services/api/src/modules/media/routes.ts).
//
//   POST   /me/photo   multipart/form-data, Feld `file` — setzt `avatar_key`
//                      auf ALLEN Mitgliedszeilen der aufrufenden Person.
//                      Jedes Mitglied darf das fuer SICH — keine Vereinsrolle
//                      noetig. Nur Bilder (sonst 415), max. 25 MB (sonst 413).
//   DELETE /me/photo   Bild entfernen (idempotent). Der Blob wird best-effort
//                      geloescht, sobald keine Roster-Zeile ihn mehr fuehrt.
//
// „SELF ONLY" IST SERVERSEITIG DOPPELT GENAGELT: das `where profile_id =
// auth.uid()` UND die RLS `club_members_update_self`. Es gibt also gar keinen
// Weg, hierueber ein FREMDES Bild zu setzen — auch nicht fuer den owner. Genau
// deshalb liegt dieser Aufruf im eigenen Profil und nirgends sonst.
//
// Beide Routen bewegen rohe Bytes und sind — wie /media/upload und das
// Vereinslogo — bewusst NICHT in der OpenAPI-Spec. Es gibt dafuer also keine
// generierten Contract-Typen; die beiden schmalen Antwort-Structs stehen hier.
//
// GELESEN wird das Bild ueber `avatar_url` aus `/me` (MeMembership) bzw. dem
// Roster — und angezeigt ueber `MediaImage`, weil `GET /media/{key}` immer ein
// Bearer-Token verlangt (ein nacktes `AsyncImage` bekaeme 404).
// ============================================================================

/// Antwort von `POST /me/photo` (201).
struct MyPhotoUploaded: Decodable {
    let avatarKey: String
    let avatarUrl: String
    let updatedMembers: Int

    enum CodingKeys: String, CodingKey {
        case avatarKey = "avatar_key"
        case avatarUrl = "avatar_url"
        case updatedMembers = "updated_members"
    }
}

/// Antwort von `DELETE /me/photo` (200) — `avatar_key`/`avatar_url` sind `null`.
struct MyPhotoRemoved: Decodable {
    let updatedMembers: Int

    enum CodingKeys: String, CodingKey {
        case updatedMembers = "updated_members"
    }
}

extension APIClient {

    /// POST /me/photo — eigenes Profilbild setzen/ersetzen.
    ///
    /// `data` sind die rohen Bild-Bytes. Der Aufrufer sollte sie vorher durch
    /// `ProfilePhotoEncoder.jpeg(from:)` schicken: ein Foto frisch aus der
    /// iPhone-Kamera ist 4-8 MB gross und HEIC — beides muss der Server dann
    /// tragen, obwohl das Bild am Ende als 72-pt-Kachel erscheint.
    @discardableResult
    func uploadMyPhoto(
        data: Data,
        mimeType: String = "image/jpeg",
        fileName: String = "profil.jpg"
    ) async throws -> MyPhotoUploaded {
        let boundary = "rsm-\(UUID().uuidString)"
        var body = Data()
        func append(_ text: String) { body.append(Data(text.utf8)) }

        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n")
        append("Content-Type: \(mimeType)\r\n\r\n")
        body.append(data)
        append("\r\n--\(boundary)--\r\n")

        var request = URLRequest(url: baseURL.appending(path: "/me/photo"))
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

    /// DELETE /me/photo — eigenes Profilbild entfernen.
    @discardableResult
    func deleteMyPhoto() async throws -> MyPhotoRemoved {
        try await delete("/me/photo")
    }

    /// Eigener Sende-Weg fuer Multipart: `APIClient.request` kodiert den Body
    /// immer als JSON — hier sind es rohe Bytes. Fehlerbehandlung (RFC 7807)
    /// bleibt identisch. Wird auch vom Vereinslogo benutzt.
    func sendMultipart<Response: Decodable>(_ request: URLRequest) async throws -> Response {
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

// ============================================================================
// Bild → handliches JPEG.
//
// Bewusst ueber ImageIO statt UIImage/NSImage: dieselbe Quelldatei laeuft auf
// iOS UND macOS (zwei Ziele, EINE Quellbasis), und ImageIO liest HEIC direkt.
// `kCGImageSourceCreateThumbnailWithTransform` dreht das Bild anhand seiner
// EXIF-Orientierung — ohne das steht ein Hochkant-Selfie beim Empfaenger quer.
// ============================================================================
enum ProfilePhotoEncoder {

    /// Verkleinert auf `maxPixel` (laengste Kante) und kodiert als JPEG.
    /// `nil`, wenn die Daten kein lesbares Bild sind.
    static func jpeg(from data: Data, maxPixel: CGFloat = 1024, quality: CGFloat = 0.85) -> Data? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
        else { return nil }

        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(
            output,
            UTType.jpeg.identifier as CFString,
            1,
            nil
        ) else { return nil }
        CGImageDestinationAddImage(
            destination,
            image,
            [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary
        )
        guard CGImageDestinationFinalize(destination) else { return nil }
        return output as Data
    }
}
