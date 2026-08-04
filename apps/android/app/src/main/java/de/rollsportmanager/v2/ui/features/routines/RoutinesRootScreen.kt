package de.rollsportmanager.v2.ui.features.routines

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import de.rollsportmanager.v2.auth.SessionStore
import de.rollsportmanager.v2.dev.DevHooks

/**
 * ÖFFENTLICHE Root-Composable des Küren-Moduls (Tab „Küren").
 *
 * Integration (macht die Shell/Integration, NICHT dieses Team):
 * in MainScaffold.kt das Tab-Ziel ersetzen durch
 *
 *     composable(RsmTab.ROUTINES.route) { RoutinesRootScreen(session, devHooks) }
 *
 * Die Sub-Navigation Liste → Detail läuft in einem EIGENEN NavHost hier drin;
 * der System-Back-Button poppt zuerst diesen inneren Stack.
 *
 * DEBUG-Hook: `devOpenFirstRoutine` wird nach dem Laden der Liste einmalig
 * über [DevHooks.consumeOpenFirstRoutine] konsumiert und öffnet das Detail
 * der ersten Kür (Spiegel des iOS-Launch-Arguments).
 */
@Composable
fun RoutinesRootScreen(
    session: SessionStore,
    devHooks: DevHooks = DevHooks.NONE,
) {
    val navController = rememberNavController()
    // Ein Listen-ViewModel für Liste UND Detail-Lookup — überlebt die
    // interne Navigation (Owner ist der Tab-Eintrag der Shell).
    val listViewModel: RoutinesViewModel =
        viewModel { RoutinesViewModel(session.api, session.clubId) }

    NavHost(navController = navController, startDestination = ROUTE_LIST) {
        composable(ROUTE_LIST) {
            RoutinesListScreen(
                viewModel = listViewModel,
                devHooks = devHooks,
                onOpenDetail = { routineId ->
                    navController.navigate("$ROUTE_DETAIL/$routineId")
                },
            )
        }
        composable("$ROUTE_DETAIL/{$ARG_ROUTINE_ID}") { entry ->
            val routineId = entry.arguments?.getString(ARG_ROUTINE_ID)
            val listState by listViewModel.state.collectAsStateWithLifecycle()
            val item = (listState as? RoutinesUiState.Loaded)
                ?.items
                ?.firstOrNull { it.routine.id == routineId }
            if (item == null) {
                // Kür nicht (mehr) in der Liste — zurück statt leerer Screen.
                LaunchedEffect(routineId) { navController.popBackStack() }
            } else {
                RoutineDetailScreen(
                    session = session,
                    item = item,
                    onBack = { navController.popBackStack() },
                )
            }
        }
    }
}

private const val ROUTE_LIST = "routines/list"
private const val ROUTE_DETAIL = "routines/detail"
private const val ARG_ROUTINE_ID = "routineId"
