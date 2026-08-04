package de.rollsportmanager.v2

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import de.rollsportmanager.v2.auth.SessionStore
import de.rollsportmanager.v2.dev.DevHooks
import de.rollsportmanager.v2.features.login.LoginScreen
import de.rollsportmanager.v2.features.shell.MainScaffold

/**
 * Wurzel der Compose-App: LoginScreen solange keine (gültige) Dev-Session
 * existiert, danach die Tab-Shell. Auto-Login via DEBUG-Hook `devPersona`.
 */
@Composable
fun RsmApp(sessionStore: SessionStore, devHooks: DevHooks) {
    val session by sessionStore.session.collectAsStateWithLifecycle()

    LaunchedEffect(devHooks.persona) {
        val persona = devHooks.persona
        if (persona != null && !sessionStore.isAuthenticated) {
            sessionStore.login(persona)
        }
    }

    if (session != null && !session!!.isExpired) {
        MainScaffold(session = sessionStore, devHooks = devHooks)
    } else {
        LoginScreen(session = sessionStore)
    }
}
