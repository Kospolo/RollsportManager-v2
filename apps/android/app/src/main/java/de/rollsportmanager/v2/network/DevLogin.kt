package de.rollsportmanager.v2.network

import de.rollsportmanager.contracts.ClubRole
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ============================================================================
// Dev-Login-Typen — VON HAND gepflegt (bewusst NICHT aus den Contracts).
//
// POST /dev/login ist eine reine Entwicklungs-Route und steht absichtlich
// nicht in der OpenAPI-Spec (services/api/src/routes/dev-login.ts), daher
// existieren dafür keine generierten Data-Classes. Quelle der Wahrheit für
// die Feldnamen ist die API-Route; bei Änderungen dort hier mitziehen.
// (Spiegel von apps/ios/App/Networking/DevLogin.swift.)
// ============================================================================

/**
 * Die Seed-Personas des Dev-Stacks (Verein „RSV Neckarsulm“).
 * Muss zu `DEV_PERSONAS` in services/api/src/routes/dev-login.ts passen.
 */
enum class DevPersona(val wireName: String) {
    COACH("coach"),
    OWNER("owner"),
    TREASURER("treasurer"),
    ADMIN("admin"),
    MEMBER("member"),
    GUEST("guest");

    companion object {
        fun fromWireName(raw: String?): DevPersona? =
            entries.firstOrNull { it.wireName == raw }
    }
}

@Serializable
data class DevLoginRequest(val persona: String)

/** Profil-Teil der Dev-Login-Antwort. */
@Serializable
data class DevLoginProfile(
    val sub: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("display_name") val displayName: String,
    val email: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("club_role") val clubRole: ClubRole,
)

/** Antwort von POST /dev/login. */
@Serializable
data class DevLoginResponse(
    @SerialName("token_type") val tokenType: String,
    @SerialName("access_token") val accessToken: String,
    @SerialName("expires_in") val expiresIn: Long,
    val persona: String,
    val profile: DevLoginProfile,
)
