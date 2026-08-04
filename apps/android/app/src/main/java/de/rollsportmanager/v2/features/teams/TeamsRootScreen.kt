package de.rollsportmanager.v2.features.teams

import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import de.rollsportmanager.v2.auth.SessionStore

/**
 * Root-Composable des Features „Teams“ — eigener NavHost: Liste → Detail.
 *
 * Ein ViewModel für Liste UND Detail (Detail liest denselben Snapshot), damit
 * das Aufklappen eines Teams keinen zweiten Netz-Call auslöst.
 */
@Composable
fun TeamsRootScreen(session: SessionStore) {
    val viewModel: TeamsViewModel = viewModel {
        TeamsViewModel(api = session.api, clubId = session.clubId)
    }
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = TEAMS_ROUTE_LIST) {
        composable(TEAMS_ROUTE_LIST) {
            TeamsListScreen(
                viewModel = viewModel,
                onOpenTeam = { id -> navController.navigate("$TEAMS_ROUTE_DETAIL_PREFIX$id") },
            )
        }
        composable(
            route = "$TEAMS_ROUTE_DETAIL_PREFIX{$TEAMS_ARG_TEAM_ID}",
            arguments = listOf(navArgument(TEAMS_ARG_TEAM_ID) { type = NavType.StringType }),
        ) { entry ->
            TeamDetailScreen(
                viewModel = viewModel,
                teamId = entry.arguments?.getString(TEAMS_ARG_TEAM_ID).orEmpty(),
                onBack = { navController.popBackStack() },
            )
        }
    }
}

private const val TEAMS_ROUTE_LIST = "teams/list"
private const val TEAMS_ROUTE_DETAIL_PREFIX = "teams/detail/"
private const val TEAMS_ARG_TEAM_ID = "teamId"
