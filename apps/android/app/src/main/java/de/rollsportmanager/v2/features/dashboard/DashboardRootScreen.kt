package de.rollsportmanager.v2.features.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.auth.SessionStore
import de.rollsportmanager.v2.designsystem.RsmAvatar
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmPrimaryButton
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import java.time.LocalTime
import java.time.ZonedDateTime

/**
 * Root-Composable des Dashboard-Features („Heute im Verein") — Spiegel von
 * iOS DashboardView.swift.
 *
 * INTEGRATION: in MainScaffold.kt das Ziel
 * `composable(RsmTab.DASHBOARD.route) { DashboardRootScreen(session) }` setzen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardRootScreen(session: SessionStore) {
    val viewModel: DashboardViewModel = viewModel()
    val state by viewModel.state.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val refreshError by viewModel.refreshError.collectAsStateWithLifecycle()
    val taskError by viewModel.taskError.collectAsStateWithLifecycle()
    val pendingTaskIds by viewModel.pendingTaskIds.collectAsStateWithLifecycle()
    val devSession by session.session.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.loadIfNeeded(session.api, session.clubId) }

    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = { viewModel.refresh(session.api, session.clubId) },
        modifier = Modifier.fillMaxSize(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(RsmSpacing.s5),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.cardGap),
        ) {
            DashboardGreetingHeader(
                displayName = devSession?.profile?.displayName ?: "",
                memberId = devSession?.profile?.memberId,
                onLogout = session::logout,
            )
            refreshError?.let { RefreshErrorBanner(it) }
            when (val current = state) {
                is DashboardUiState.Loading -> LoadingCard()
                is DashboardUiState.Error -> ErrorCard(current.message) {
                    viewModel.retry(session.api, session.clubId)
                }
                is DashboardUiState.Loaded -> {
                    DashboardKpiCard(current.data)
                    current.data.nextCompetition?.let { competition ->
                        DashboardCountdownCard(
                            competition = competition,
                            days = current.data.countdownDays,
                            entrants = current.data.competitionEntrants,
                        )
                    }
                    DashboardEventsCard(current.data)
                    DashboardTasksCard(
                        tasks = current.data.tasks,
                        pendingTaskIds = pendingTaskIds,
                        errorMessage = taskError,
                        onToggle = { task -> viewModel.toggleTask(task, session.api) },
                    )
                }
            }
        }
    }
}

// --- Begrüßung + Profil-Menü (Logout) ----------------------------------------

@Composable
private fun DashboardGreetingHeader(
    displayName: String,
    memberId: String?,
    onLogout: () -> Unit,
) {
    val colors = RsmTheme.colors
    val firstName = displayName.split(" ").firstOrNull { it.isNotBlank() } ?: displayName
    val greeting = when {
        LocalTime.now().hour < 11 -> stringResource(R.string.dashboard_greeting_morning, firstName)
        LocalTime.now().hour < 18 -> stringResource(R.string.dashboard_greeting_day, firstName)
        else -> stringResource(R.string.dashboard_greeting_evening, firstName)
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = RsmSpacing.s2),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .semantics(mergeDescendants = true) {},
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            Text(
                text = DashboardFormat.eyebrowDateText(ZonedDateTime.now()).uppercase(),
                style = RsmTypography.eyebrow,
                color = colors.inkFaint,
            )
            Text(
                text = greeting,
                style = RsmTypography.display,
                color = colors.inkPrimary,
            )
        }
        ProfileMenu(displayName = displayName, memberId = memberId, onLogout = onLogout)
    }
}

@Composable
private fun ProfileMenu(
    displayName: String,
    memberId: String?,
    onLogout: () -> Unit,
) {
    val colors = RsmTheme.colors
    var menuOpen by remember { mutableStateOf(false) }
    val a11yLabel = stringResource(R.string.dashboard_a11y_profile_menu)

    Box {
        Box(
            modifier = Modifier
                .size(RsmSize.touchTarget)
                .clip(CircleShape)
                .clickable { menuOpen = true }
                .semantics { contentDescription = a11yLabel },
            contentAlignment = Alignment.Center,
        ) {
            RsmAvatar(
                name = displayName.ifBlank { "?" },
                personId = memberId,
                size = 32.dp,
            )
        }
        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
            DropdownMenuItem(
                text = {
                    Text(
                        text = stringResource(R.string.dashboard_menu_logout),
                        style = RsmTypography.body,
                        color = colors.danger,
                    )
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Logout,
                        contentDescription = null,
                        tint = colors.danger,
                    )
                },
                onClick = {
                    menuOpen = false
                    onLogout()
                },
            )
        }
    }
}

// --- Lade-/Fehlerzustände ------------------------------------------------------

@Composable
private fun LoadingCard() {
    val colors = RsmTheme.colors
    RsmCard {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 120.dp)
                .semantics(mergeDescendants = true) {},
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = colors.brand,
                strokeWidth = 2.dp,
            )
            Text(
                text = stringResource(R.string.dashboard_loading),
                style = RsmTypography.body,
                color = colors.inkSoft,
            )
        }
    }
}

@Composable
private fun ErrorCard(message: String, onRetry: () -> Unit) {
    val colors = RsmTheme.colors
    RsmCard {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Filled.Warning,
                    contentDescription = null,
                    tint = colors.danger,
                )
                Text(
                    text = stringResource(R.string.dashboard_error_title),
                    style = RsmTypography.h3,
                    color = colors.inkPrimary,
                )
            }
            Text(
                text = message,
                style = RsmTypography.body,
                color = colors.inkSoft,
            )
            // Die einzige Beere in diesem Sichtbereich: der Weg zurück.
            RsmPrimaryButton(
                text = stringResource(R.string.dashboard_error_retry),
                onClick = onRetry,
            )
        }
    }
}

@Composable
private fun RefreshErrorBanner(message: String) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(RsmRadius.l))
            .background(colors.warnSoft)
            .padding(RsmSpacing.s4)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            imageVector = Icons.Filled.Refresh,
            contentDescription = null,
            tint = colors.warn,
        )
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
            Text(
                text = stringResource(R.string.dashboard_error_refresh),
                style = RsmTypography.bodyStrong,
                color = colors.warn,
            )
            Text(
                text = message,
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
        }
    }
}
