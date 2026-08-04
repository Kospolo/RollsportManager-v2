package de.rollsportmanager.v2.network

import android.content.Context

/**
 * Dev-Konfiguration der App.
 *
 * Die App spricht AUSSCHLIESSLICH mit dem lokalen Dev-Stack
 * (`scripts/dev-stack.sh up`) — niemals mit rollsportmanager.de oder anderen
 * entfernten Hosts. Der Emulator erreicht den Host-Loopback über 10.0.2.2;
 * Cleartext-HTTP dafür ist NUR im Debug-Build erlaubt
 * (src/debug/res/xml/network_security_config.xml).
 */
object DevConfig {

    /** Default-Basis-URL des lokalen Hono-API-Stacks (Emulator → Host). */
    const val DEFAULT_BASE_URL = "http://10.0.2.2:3022"

    /**
     * SharedPreferences-Schlüssel, um die Basis-URL in Dev-Szenarien zu
     * übersteuern (z. B. echtes Gerät im LAN). Kein Prod-Mechanismus.
     */
    private const val PREFS_NAME = "rsm.dev"
    private const val BASE_URL_KEY = "rsm.dev.baseUrl"

    /**
     * Die eine geseedete Demo-Vereins-ID (RSV Neckarsulm) — identisch zu
     * `services/api/src/routes/dev-login.ts` (DEV_CLUB_ID). Der Dev-Login
     * liefert sie zusätzlich im Profil; dieser Wert ist nur Fallback.
     */
    const val SEED_CLUB_ID = "c1ab0000-0000-4000-8000-000000000001"

    /** Effektive Basis-URL: Override aus SharedPreferences, sonst Default. */
    fun baseUrl(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(BASE_URL_KEY, null) ?: DEFAULT_BASE_URL
    }
}
