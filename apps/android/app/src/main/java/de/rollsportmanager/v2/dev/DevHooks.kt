package de.rollsportmanager.v2.dev

import android.content.Intent
import de.rollsportmanager.v2.network.DevPersona

/**
 * DEBUG-Smoke-Hooks (Spiegel der iOS-Launch-Argumente) — werden NUR im
 * Debug-Build aus den Intent-Extras gelesen (MainActivity prüft
 * BuildConfig.DEBUG; im Release-Build bleibt immer die leere Instanz).
 *
 *   adb shell am start -n de.rollsportmanager.v2/.MainActivity \
 *       --es devPersona admin \
 *       --es devTab routines \
 *       --ez devOpenFirstRoutine true
 *
 * - `devPersona`: loggt die Persona beim Start automatisch ein
 *   (coach|owner|treasurer|admin|member|guest; ohne Extra oder mit gültiger
 *   Session passiert nichts).
 * - `devTab`: Start-Tab (dashboard|events|members|routines|finance).
 * - `devOpenFirstRoutine`: erzwingt den Küren-Tab; das Routines-Feature-Team
 *   konsumiert das Flag über `consumeOpenFirstRoutine()` und öffnet damit
 *   das Detail der ersten Kür (einmalig, wie iOS).
 */
class DevHooks(
    val persona: DevPersona? = null,
    val startTab: String? = null,
    openFirstRoutine: Boolean = false,
) {
    private var pendingOpenFirstRoutine = openFirstRoutine

    /** true, solange der Hook noch nicht konsumiert wurde (Anzeige/Nav). */
    val wantsFirstRoutine: Boolean get() = pendingOpenFirstRoutine

    /** Einmal-Konsum für das Routines-Feature (Detail der ersten Kür öffnen). */
    fun consumeOpenFirstRoutine(): Boolean {
        val value = pendingOpenFirstRoutine
        pendingOpenFirstRoutine = false
        return value
    }

    companion object {
        val NONE = DevHooks()

        fun fromIntent(intent: Intent?): DevHooks {
            intent ?: return NONE
            return DevHooks(
                persona = DevPersona.fromWireName(intent.getStringExtra("devPersona")),
                startTab = intent.getStringExtra("devTab"),
                openFirstRoutine = intent.getBooleanExtra("devOpenFirstRoutine", false),
            )
        }
    }
}
