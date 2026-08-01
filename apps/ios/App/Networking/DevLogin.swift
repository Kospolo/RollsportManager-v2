import Foundation

// ============================================================================
// Dev-Login-Typen — VON HAND gepflegt (bewusst NICHT aus den Contracts).
//
// POST /dev/login ist eine reine Entwicklungs-Route und steht absichtlich
// nicht in der OpenAPI-Spec (services/api/src/routes/dev-login.ts), daher
// existieren dafür keine generierten Structs. Quelle der Wahrheit für die
// Feldnamen ist die API-Route; bei Änderungen dort hier mitziehen.
// ============================================================================

/// Die Seed-Personas des Dev-Stacks (Verein „RSV Neckarsulm“).
/// Muss zu `DEV_PERSONAS` in services/api/src/routes/dev-login.ts passen.
enum DevPersona: String, Codable, CaseIterable, Identifiable {
    case coach
    case owner
    case treasurer
    case admin
    case moderator
    case member
    case guest
    // BETREIBER-EBENE — die Server-Persona `platform` (super_admin).
    //
    // Sie war hier bewusst ausgespart, solange `DevLoginProfile` seine Felder
    // non-optional hielt: ihr Login-Profil liefert member_id/club_id/club_role
    // = null (sie ist in KEINEM Verein Mitglied) und dazu is_platform_admin =
    // true. Genau das ist jetzt abgebildet — die drei Vereins-Felder sind
    // optional, `isPlatformAdmin` ist da. Ohne diese Persona wäre die
    // Betreiber-Konsole nicht bedienbar: kein anderer Dev-Token trägt den
    // Claim, den `/platform/*` serverseitig verlangt.
    case platform

    var id: String { rawValue }
}

struct DevLoginRequest: Encodable {
    let persona: String
}

/// Profil-Teil der Dev-Login-Antwort.
///
/// ### WARUM DREI FELDER OPTIONAL SIND ###
/// Nicht jede Person ist Mitglied eines Vereins. Der Plattform-Admin ist es
/// definitiv nicht — er hat keine Zeile in `app.club_members`, keine Rolle und
/// keinen Verein; sein Zugang hängt allein am Token-Claim
/// `app_metadata.is_platform_admin`. Die API liefert für ihn seit jeher
/// `member_id: null`, `club_id: null`, `club_role: null`. Solange diese Felder
/// hier `String`/`ClubRole` waren, scheiterte das Dekodieren — die Persona war
/// aus der App schlicht nicht erreichbar.
///
/// Die Optionalität ist damit keine Bequemlichkeit, sondern die Wahrheit über
/// die Daten: „kein Verein“ ist ein gültiger Zustand, kein Fehler.
struct DevLoginProfile: Codable, Equatable {
    let sub: String
    /// `app.club_members.id` — `nil` ohne Mitgliedschaft (Plattform-Admin).
    let memberId: String?
    let displayName: String
    let email: String
    /// Verein der Persona — `nil` ohne Mitgliedschaft.
    let clubId: String?
    /// Rolle im Verein — `nil` ohne Mitgliedschaft.
    let clubRole: ClubRole?
    /// Spiegel von `app_metadata.is_platform_admin`. REINE SICHTBARKEIT:
    /// der Schutz ist `requirePlatformAdmin` auf jedem `/platform/*`-Endpoint.
    let isPlatformAdmin: Bool

    enum CodingKeys: String, CodingKey {
        case sub
        case memberId = "member_id"
        case displayName = "display_name"
        case email
        case clubId = "club_id"
        case clubRole = "club_role"
        case isPlatformAdmin = "is_platform_admin"
    }

    /// Eigener Decoder aus EINEM Grund: eine in UserDefaults liegende Session
    /// aus einer älteren App-Version kennt `is_platform_admin` nicht. Ohne
    /// `decodeIfPresent` würde sie beim Start verworfen — der Nutzer stünde
    /// grundlos wieder vor dem Login. Fehlt der Schlüssel, ist die Antwort
    /// „kein Betreiber“, und das ist die sichere Richtung.
    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        sub = try container.decode(String.self, forKey: .sub)
        memberId = try container.decodeIfPresent(String.self, forKey: .memberId)
        displayName = try container.decode(String.self, forKey: .displayName)
        email = try container.decode(String.self, forKey: .email)
        clubId = try container.decodeIfPresent(String.self, forKey: .clubId)
        clubRole = try container.decodeIfPresent(ClubRole.self, forKey: .clubRole)
        isPlatformAdmin = try container.decodeIfPresent(Bool.self, forKey: .isPlatformAdmin) ?? false
    }

    /// Memberwise-Init fuer den ECHTEN Login (Endpoints+Auth): /auth/login liefert
    /// nur sub/email/Admin-Flag; club_id/member_id kommen aus GET /clubs, den
    /// Anzeigenamen setzt der Aufrufer (Registrierung kennt ihn, Login nutzt
    /// den E-Mail-Praefix als Notbehelf).
    init(
        sub: String,
        memberId: String?,
        displayName: String,
        email: String,
        clubId: String?,
        clubRole: ClubRole?,
        isPlatformAdmin: Bool
    ) {
        self.sub = sub
        self.memberId = memberId
        self.displayName = displayName
        self.email = email
        self.clubId = clubId
        self.clubRole = clubRole
        self.isPlatformAdmin = isPlatformAdmin
    }
}

/// Antwort von POST /dev/login.
struct DevLoginResponse: Codable, Equatable {
    let tokenType: String
    let accessToken: String
    let expiresIn: Int
    let persona: String
    let profile: DevLoginProfile

    enum CodingKeys: String, CodingKey {
        case tokenType = "token_type"
        case accessToken = "access_token"
        case expiresIn = "expires_in"
        case persona
        case profile
    }
}
