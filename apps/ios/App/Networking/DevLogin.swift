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
    // MELDEN / bewusst NICHT enthalten: die Server-Persona `platform`
    // (super_admin). Ihr Login-Profil liefert member_id/club_id/club_role = null
    // und zusätzlich is_platform_admin=true. `DevLoginProfile` hat diese Felder
    // non-optional und kennt is_platform_admin nicht — das Dekodieren würde
    // fehlschlagen. Für echtes Plattform-Admin-Gating müssen zuerst
    // DevLoginProfile.{memberId,clubId,clubRole} optional werden und ein
    // `isPlatformAdmin`-Feld dazukommen (betrifft mehrere Feature-ViewModels).

    var id: String { rawValue }
}

struct DevLoginRequest: Encodable {
    let persona: String
}

/// Profil-Teil der Dev-Login-Antwort.
struct DevLoginProfile: Codable, Equatable {
    let sub: String
    let memberId: String
    let displayName: String
    let email: String
    let clubId: String
    let clubRole: ClubRole

    enum CodingKeys: String, CodingKey {
        case sub
        case memberId = "member_id"
        case displayName = "display_name"
        case email
        case clubId = "club_id"
        case clubRole = "club_role"
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
