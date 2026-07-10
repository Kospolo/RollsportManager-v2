import Foundation

/// Fehler des API-Clients.
///
/// Die API antwortet bei Fehlern mit RFC 7807 `application/problem+json`
/// (Schema `Problem` aus den generierten Contracts) — inklusive `request_id`
/// für Log-Korrelation.
enum APIError: Error, LocalizedError {
    /// Der Server hat ein RFC-7807-Problem geliefert (4xx/5xx mit Body).
    case problem(Problem)
    /// Nicht-2xx-Status ohne parsebaren Problem-Body.
    case unexpectedStatus(code: Int)
    /// Transport-/Verbindungsfehler (z. B. Dev-Stack läuft nicht).
    case transport(underlying: Error)
    /// Antwort war kein dekodierbares JSON des erwarteten Typs.
    case decoding(underlying: Error)

    var errorDescription: String? {
        switch self {
        case .problem(let problem):
            var text = "\(problem.title) (\(problem.status))"
            if let detail = problem.detail { text += ": \(detail)" }
            return text
        case .unexpectedStatus(let code):
            return "Unerwarteter HTTP-Status \(code)"
        case .transport(let error):
            return error.localizedDescription
        case .decoding(let error):
            return "Antwort nicht lesbar: \(error.localizedDescription)"
        }
    }

    /// `true`, wenn der Server ein RFC-7807-`Problem` mit HTTP 403 geliefert hat
    /// (fehlende Berechtigung, z. B. Rolle `member`/`guest` legt keinen Termin
    /// an). Screens zeigen dann eine verständliche „Keine Berechtigung“-Meldung
    /// statt der technischen Fehlerbeschreibung.
    var isForbidden: Bool {
        if case .problem(let problem) = self { return problem.status == 403 }
        return false
    }
}

extension Error {
    /// Bequemer 403-Check auch auf `any Error` (Aufrufer müssen nicht casten).
    var isForbiddenAPIError: Bool { (self as? APIError)?.isForbidden ?? false }
}

/// Schlanker URLSession-Client (async/await) für den lokalen Dev-Stack.
///
/// - Bearer-Token kommt pro Request aus dem `tokenProvider` (SessionStore),
///   damit der Client selbst zustandslos bleibt.
/// - Kein Alamofire o. Ä. — nur Foundation (Blueprint-Regel).
/// - Alle Pfade/Typen kommen aus `Endpoints.swift` + generierten Contracts.
struct APIClient {
    var baseURL: URL = DevConfig.baseURL
    /// Liefert das aktuelle Bearer-Token; `nil` = anonym (nur /dev/login, /health).
    var tokenProvider: @Sendable () -> String? = { nil }

    private let session: URLSession = .shared
    // Contracts lassen Timestamps/UUIDs bewusst als String auf der Leitung —
    // keine Custom-Decoding-Strategien nötig (siehe RSMContracts.swift Kopf).
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    // MARK: - Öffentliche Verben

    func get<Response: Decodable>(
        _ path: String,
        query: [URLQueryItem] = []
    ) async throws -> Response {
        try await request(method: "GET", path: path, query: query, body: nil as Never?)
    }

    func post<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        try await request(method: "POST", path: path, query: [], body: body)
    }

    func put<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        try await request(method: "PUT", path: path, query: [], body: body)
    }

    func patch<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        try await request(method: "PATCH", path: path, query: [], body: body)
    }

    // MARK: - Kern

    private func request<Body: Encodable, Response: Decodable>(
        method: String,
        path: String,
        query: [URLQueryItem],
        body: Body?
    ) async throws -> Response {
        var components = URLComponents(
            url: baseURL.appending(path: path),
            resolvingAgainstBaseURL: false
        )
        if !query.isEmpty { components?.queryItems = query }
        guard let url = components?.url else {
            throw APIError.unexpectedStatus(code: -1)
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token = tokenProvider() {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = try encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch {
            throw APIError.transport(underlying: error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.unexpectedStatus(code: -1)
        }
        guard (200..<300).contains(http.statusCode) else {
            // RFC 7807: Fehler-Body als Problem dekodieren, wenn möglich.
            if let problem = try? decoder.decode(Problem.self, from: data) {
                throw APIError.problem(problem)
            }
            throw APIError.unexpectedStatus(code: http.statusCode)
        }

        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(underlying: error)
        }
    }
}
// Hinweis: GET nutzt `Never?` als Body-Typ — `Never` ist seit Swift 5.9
// von Haus aus Codable (SE-0396), es braucht keine eigene Konformanz.
