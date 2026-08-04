package de.rollsportmanager.v2.auth

import android.content.Context
import android.content.SharedPreferences
import de.rollsportmanager.v2.network.ApiClient
import de.rollsportmanager.v2.network.ApiException
import de.rollsportmanager.v2.network.DevConfig
import de.rollsportmanager.v2.network.DevLoginProfile
import de.rollsportmanager.v2.network.DevPersona
import de.rollsportmanager.v2.network.devLogin
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/** Persistierte Dev-Session (Token + Profil). */
@Serializable
data class DevSession(
    val accessToken: String,
    /** Unix-Millis — Contracts-Konvention (Strings) gilt nur auf der Leitung. */
    val expiresAtEpochMillis: Long,
    val persona: String,
    val profile: DevLoginProfile,
) {
    val isExpired: Boolean get() = expiresAtEpochMillis <= System.currentTimeMillis()
}

/**
 * Auth-Zustand der App: Persona-Login gegen den lokalen Dev-Stack.
 *
 * WICHTIG (bewusste Dev-Entscheidung): Das Token liegt in einfachen
 * SharedPreferences, NICHT in EncryptedSharedPreferences/Keystore. Es ist
 * ein 12-h-Dev-Token des lokalen Stacks ohne jeden Wert außerhalb dieser
 * Maschine. Sobald echte GoTrue-Logins kommen, MUSS hier
 * EncryptedSharedPreferences rein — dieser Kommentar ist der Marker dafür.
 */
class SessionStore(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val json = Json { ignoreUnknownKeys = true }

    private val _session = MutableStateFlow(restore())
    val session: StateFlow<DevSession?> = _session

    private val _isLoggingIn = MutableStateFlow(false)
    val isLoggingIn: StateFlow<Boolean> = _isLoggingIn

    private val _loginError = MutableStateFlow<String?>(null)
    val loginError: StateFlow<String?> = _loginError

    /**
     * API-Client mit Bearer-Token aus der aktuellen Session.
     * Screen-Teams holen sich den Client IMMER hier (nie selbst bauen),
     * damit Token-Wechsel/Logout automatisch greifen.
     */
    val api: ApiClient = ApiClient(
        baseUrl = DevConfig.baseUrl(context),
        tokenProvider = { _session.value?.takeUnless { it.isExpired }?.accessToken },
    )

    /** Angemeldet, solange eine nicht abgelaufene Session existiert. */
    val isAuthenticated: Boolean
        get() = _session.value?.isExpired == false

    /** Die Vereins-ID für alle club-gebundenen Calls. */
    val clubId: String
        get() = _session.value?.profile?.clubId ?: DevConfig.SEED_CLUB_ID

    // --- Aktionen -----------------------------------------------------------

    suspend fun login(persona: DevPersona) {
        if (_isLoggingIn.value) return
        _isLoggingIn.value = true
        _loginError.value = null
        try {
            val response = api.devLogin(persona)
            val session = DevSession(
                accessToken = response.accessToken,
                expiresAtEpochMillis =
                    System.currentTimeMillis() + response.expiresIn * 1000L,
                persona = response.persona,
                profile = response.profile,
            )
            _session.value = session
            persist(session)
        } catch (e: ApiException) {
            _loginError.value = e.message
        } catch (e: Exception) {
            _loginError.value = e.message ?: e.javaClass.simpleName
        } finally {
            _isLoggingIn.value = false
        }
    }

    fun logout() {
        _session.value = null
        prefs.edit().remove(SESSION_KEY).apply()
    }

    // --- Persistenz (SharedPreferences — Dev only, s. Kopf-Kommentar) --------

    private fun persist(session: DevSession) {
        prefs.edit().putString(SESSION_KEY, json.encodeToString(session)).apply()
    }

    private fun restore(): DevSession? {
        val raw = prefs.getString(SESSION_KEY, null) ?: return null
        val stored = runCatching { json.decodeFromString<DevSession>(raw) }.getOrNull()
        return stored?.takeUnless { it.isExpired }
    }

    private companion object {
        const val PREFS_NAME = "rsm.dev"
        const val SESSION_KEY = "rsm.dev.session"
    }
}
