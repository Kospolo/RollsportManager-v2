package de.rollsportmanager.v2.features.shell

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.auth.SessionStore
import de.rollsportmanager.v2.dev.DevHooks
import de.rollsportmanager.v2.features.dashboard.DashboardRootScreen
import de.rollsportmanager.v2.features.mehr.MehrHubScreen
import de.rollsportmanager.v2.features.members.MembersRootScreen
import de.rollsportmanager.v2.ui.features.events.EventsRootScreen
import de.rollsportmanager.v2.ui.features.routines.RoutinesRootScreen
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Tab-Shell der App: Übersicht · Termine · Mitglieder · Küren · Mehr.
 *
 * WARUM FÜNF UND WARUM „MEHR“: Mehr als fünf Ziele werden in der unteren
 * Leiste unleserlich (und auf kleinen Geräten unerreichbar). Finanzen ist
 * deshalb kein eigener Tab mehr, sondern die erste Kachel im „Mehr“-Hub —
 * exakt wie in iOS (`MainTabView.swift`), damit beide Plattformen dieselbe
 * Landkarte haben. Neue Module kommen in den Hub
 * (features/mehr/MehrHubScreen.kt), NICHT in diese Leiste.
 *
 * `devTab finance` bleibt gültig: der Wert führt in den Mehr-Tab
 * (siehe MainScaffold) — Smoke-Skripte müssen nicht angefasst werden.
 */
enum class RsmTab(
    val route: String,
    @StringRes val labelRes: Int,
    val icon: ImageVector,
) {
    DASHBOARD("dashboard", R.string.tab_dashboard, Icons.Filled.Home),
    EVENTS("events", R.string.tab_events, Icons.Filled.CalendarMonth),
    MEMBERS("members", R.string.tab_members, Icons.Filled.Groups),
    ROUTINES("routines", R.string.tab_routines, Icons.Filled.MusicNote),
    MEHR("mehr", R.string.tab_mehr, Icons.Filled.MoreHoriz);

    companion object {
        fun fromRoute(route: String?): RsmTab? = entries.firstOrNull { it.route == route }
    }
}

@Composable
fun MainScaffold(session: SessionStore, devHooks: DevHooks) {
    val navController = rememberNavController()
    val colors = RsmTheme.colors

    // DEBUG-Hooks: devTab wählt den Start-Tab; devOpenFirstRoutine erzwingt
    // zusätzlich den Küren-Tab (das Detail öffnet später das Routines-Team).
    val startTab = when {
        devHooks.wantsFirstRoutine -> RsmTab.ROUTINES
        // „finance“ ist seit dem Mehr-Hub kein eigener Tab mehr; bestehende
        // Smoke-Aufrufe (`--es devTab finance`) landen weiterhin richtig.
        devHooks.startTab == "finance" -> RsmTab.MEHR
        else -> RsmTab.fromRoute(devHooks.startTab) ?: RsmTab.DASHBOARD
    }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    Scaffold(
        containerColor = colors.bgCanvas,
        bottomBar = {
            NavigationBar(containerColor = colors.bgSurface) {
                RsmTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = currentRoute == tab.route,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = null) },
                        label = {
                            Text(
                                text = stringResource(tab.labelRes),
                                style = RsmTypography.caption,
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = tab.iconSelectedColor(),
                            selectedTextColor = colors.brandInk,
                            indicatorColor = colors.brandSoft,
                            unselectedIconColor = colors.inkFaint,
                            unselectedTextColor = colors.inkFaint,
                        ),
                    )
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = startTab.route,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(RsmTab.DASHBOARD.route) { DashboardRootScreen(session) }
            composable(RsmTab.EVENTS.route) { EventsRootScreen(session) }
            composable(RsmTab.MEMBERS.route) { MembersRootScreen(session) }
            composable(RsmTab.ROUTINES.route) { RoutinesRootScreen(session, devHooks) }
            composable(RsmTab.MEHR.route) { MehrHubScreen(session) }
        }
    }
}

@Composable
private fun RsmTab.iconSelectedColor() = RsmTheme.colors.brandInk
