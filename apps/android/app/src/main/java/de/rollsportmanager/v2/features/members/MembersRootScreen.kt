package de.rollsportmanager.v2.features.members

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.auth.SessionStore

/**
 * Root-Composable des Features „Mitglieder“.
 *
 * Integration (macht die Integration, nicht dieses Team): in
 * features/shell/MainScaffold.kt das Ziel des Mitglieder-Tabs ersetzen —
 *   composable(RsmTab.MEMBERS.route) { MembersRootScreen(session) }
 *
 * Eigener NavHost fürs Feature: Liste → Detail (auch Detail → Detail über
 * die Familien-Sektion). Die Snackbar für fehlgeschlagene Rollenwechsel
 * (403 → „Keine Berechtigung“, Rest → Klartext) lebt hier, damit sie beide
 * Sub-Screens überdauert.
 */
@Composable
fun MembersRootScreen(session: SessionStore) {
    val membersViewModel: MembersViewModel = viewModel {
        MembersViewModel(api = session.api, clubId = session.clubId)
    }
    val devSession by session.session.collectAsStateWithLifecycle()
    val viewerRole = devSession?.profile?.clubRole
    val viewerMemberId = devSession?.profile?.memberId

    val navController = rememberNavController()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    val roleChangeFailure by membersViewModel.roleChangeFailure.collectAsStateWithLifecycle()
    LaunchedEffect(roleChangeFailure) {
        val failure = roleChangeFailure ?: return@LaunchedEffect
        val text = when (failure) {
            MembersViewModel.RoleChangeFailure.Forbidden ->
                context.getString(R.string.members_role_change_forbidden)

            is MembersViewModel.RoleChangeFailure.Other -> failure.message
        }
        snackbarHostState.showSnackbar(text)
        membersViewModel.dismissRoleChangeFailure()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        NavHost(
            navController = navController,
            startDestination = MEMBERS_ROUTE_LIST,
        ) {
            composable(MEMBERS_ROUTE_LIST) {
                MembersListScreen(
                    viewModel = membersViewModel,
                    onOpenMember = { id ->
                        navController.navigate("$MEMBERS_ROUTE_DETAIL_PREFIX$id")
                    },
                )
            }
            composable(
                route = "$MEMBERS_ROUTE_DETAIL_PREFIX{$MEMBERS_ARG_MEMBER_ID}",
                arguments = listOf(
                    navArgument(MEMBERS_ARG_MEMBER_ID) { type = NavType.StringType },
                ),
            ) { entry ->
                MemberDetailScreen(
                    viewModel = membersViewModel,
                    memberId = entry.arguments?.getString(MEMBERS_ARG_MEMBER_ID).orEmpty(),
                    viewerRole = viewerRole,
                    viewerMemberId = viewerMemberId,
                    onOpenMember = { id ->
                        navController.navigate("$MEMBERS_ROUTE_DETAIL_PREFIX$id")
                    },
                    onBack = { navController.popBackStack() },
                )
            }
        }
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

private const val MEMBERS_ROUTE_LIST = "members/list"
private const val MEMBERS_ROUTE_DETAIL_PREFIX = "members/detail/"
private const val MEMBERS_ARG_MEMBER_ID = "memberId"
