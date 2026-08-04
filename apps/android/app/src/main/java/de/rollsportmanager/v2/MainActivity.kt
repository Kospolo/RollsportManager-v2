package de.rollsportmanager.v2

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import de.rollsportmanager.v2.auth.SessionStore
import de.rollsportmanager.v2.dev.DevHooks
import de.rollsportmanager.v2.ui.theme.RsmTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // DEBUG-Smoke-Hooks (devPersona/devTab/devOpenFirstRoutine) werden
        // AUSSCHLIESSLICH im Debug-Build ausgewertet — Release ignoriert
        // alle Intent-Extras (siehe dev/DevHooks.kt).
        val devHooks = if (BuildConfig.DEBUG) DevHooks.fromIntent(intent) else DevHooks.NONE

        val sessionStore = SessionStore(applicationContext)

        setContent {
            RsmTheme {
                RsmApp(sessionStore = sessionStore, devHooks = devHooks)
            }
        }
    }
}
