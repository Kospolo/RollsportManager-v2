import Foundation

// ============================================================================
// Endpoints+Auth.swift — der ECHTE E-Mail/Passwort-Login + Registrierung.
//
// Gegenstueck zu DevLogin.swift (Persona-Login, nur DEBUG). Diese Routen
// (/auth/login, /auth/register) laufen gegen die live API (self-contained Auth,
// AUTH_MODE=selfhosted) und stellen denselben Bearer-Token aus.
//
// WICHTIG: Die Antwort traegt KEIN club_id (anders als der Dev-Login). Nach dem
// Login holt SessionStore die Vereine des Nutzers per GET /clubs (RLS-scoped)
// und waehlt den aktiven Verein — ein frisch registriertes Konto hat 0 Vereine.
// ============================================================================

struct AuthLoginRequest: Encodable {
    let email: String
    let password: String
}

struct AuthRegisterRequest: Encodable {
    let email: String
    let password: String
    let displayName: String
    enum CodingKeys: String, CodingKey {
        case email, password
        case displayName = "display_name"
    }
}

/// Minimalprofil aus /auth/login bzw. /auth/register (NUR sub/email/Admin-Flag).
struct AuthProfile: Decodable, Equatable {
    let sub: String
    let email: String
    let isPlatformAdmin: Bool
    enum CodingKeys: String, CodingKey {
        case sub, email
        case isPlatformAdmin = "is_platform_admin"
    }
    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        sub = try c.decode(String.self, forKey: .sub)
        email = try c.decode(String.self, forKey: .email)
        isPlatformAdmin = try c.decodeIfPresent(Bool.self, forKey: .isPlatformAdmin) ?? false
    }
}

struct AuthResponse: Decodable, Equatable {
    let tokenType: String
    let accessToken: String
    let expiresIn: Int
    let profile: AuthProfile
    enum CodingKeys: String, CodingKey {
        case tokenType = "token_type"
        case accessToken = "access_token"
        case expiresIn = "expires_in"
        case profile
    }
}

extension APIClient {
    /// POST /auth/login — E-Mail + Passwort → Zugangstoken.
    func authLogin(email: String, password: String) async throws -> AuthResponse {
        try await post("/auth/login", body: AuthLoginRequest(email: email, password: password))
    }

    /// POST /auth/register — Konto anlegen; man ist danach sofort angemeldet.
    func authRegister(email: String, password: String, displayName: String) async throws -> AuthResponse {
        try await post(
            "/auth/register",
            body: AuthRegisterRequest(email: email, password: password, displayName: displayName)
        )
    }

    /// GET /clubs — die Vereine des angemeldeten Nutzers (RLS-scoped, kann leer sein).
    func listClubs() async throws -> [Club] {
        try await get("/clubs")
    }

    /// DELETE /me — das EIGENE Konto unwiderruflich löschen (Apple 5.1.1(v)).
    /// 409 (APIError), wenn man alleiniger Inhaber eines Vereins ist.
    func deleteAccount() async throws -> AccountDeleted {
        try await delete("/me")
    }

    /// POST /clubs — Verein GRÜNDEN (Contract-Typ ClubRegistration/-Result). Der
    /// Aufrufer wird sofort Owner (aktive Mitgliedschaft + 30-Tage-Testphase).
    /// Zustimmung zu Bedingungen/Datenschutz ist Pflicht (DSGVO).
    func createClub(name: String, city: String) async throws -> ClubRegistrationResult {
        try await post("/clubs", body: ClubRegistration(
            name: name, city: city, acceptTerms: true, acceptPrivacy: true
        ))
    }

    /// POST /clubs/join — Beitritt per Vereinscode BEANTRAGEN (ClubJoinInput/
    /// -Result). Ergebnis ist ein ANTRAG (status meist "pending") — die
    /// Mitgliedschaft wird erst nach Freigabe durch einen Vereins-Admin aktiv.
    func joinClub(code: String, firstName: String, lastName: String) async throws -> ClubJoinResult {
        try await post("/clubs/join", body: ClubJoinInput(
            code: code, firstName: firstName, lastName: lastName, acceptTerms: true, acceptPrivacy: true
        ))
    }
}
