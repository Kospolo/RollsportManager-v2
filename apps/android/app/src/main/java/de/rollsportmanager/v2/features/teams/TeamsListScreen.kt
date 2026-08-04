package de.rollsportmanager.v2.features.teams

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import de.rollsportmanager.contracts.Team
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmEmptyState
import de.rollsportmanager.v2.designsystem.RsmPrimaryButton
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Teamliste, nach Sparten gruppiert (Verein → Sparten → Teams).
 * Zeigt je Team Altersgruppe, Anzahl Läufer:innen und Anzahl Trainer:innen —
 * bewusst KEINE Beiträge, keine Mahnstufen (Teams sind Kinderlisten).
 */
@Composable
internal fun TeamsListScreen(
    viewModel: TeamsViewModel,
    onOpenTeam: (String) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    when (val current = state) {
        TeamsViewModel.LoadState.Loading -> TeamsLoading()
        is TeamsViewModel.LoadState.Failed ->
            TeamsError(message = current.message, onRetry = viewModel::load)

        TeamsViewModel.LoadState.Loaded ->
            TeamsLoadedContent(viewModel = viewModel, onOpenTeam = onOpenTeam)
    }
}

// --- Zustände -----------------------------------------------------------------

@Composable
private fun TeamsLoading() {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4, Alignment.CenterVertically),
    ) {
        CircularProgressIndicator(color = colors.brand)
        Text(
            text = stringResource(R.string.teams_loading),
            style = RsmTypography.body,
            color = colors.inkSoft,
        )
    }
}

@Composable
private fun TeamsError(message: String, onRetry: () -> Unit) {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(RsmSpacing.s5),
    ) {
        RsmCard {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = RsmSpacing.s4),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4),
            ) {
                Icon(
                    imageVector = Icons.Filled.CloudOff,
                    contentDescription = null,
                    tint = colors.danger,
                    modifier = Modifier.size(40.dp),
                )
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                ) {
                    Text(
                        text = stringResource(R.string.teams_error_title),
                        style = RsmTypography.h3,
                        color = colors.inkPrimary,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        text = message,
                        style = RsmTypography.caption,
                        color = colors.inkSoft,
                        textAlign = TextAlign.Center,
                    )
                }
                RsmPrimaryButton(
                    text = stringResource(R.string.teams_error_retry),
                    onClick = onRetry,
                    fillWidth = false,
                )
            }
        }
    }
}

// --- Geladene Liste --------------------------------------------------------------

@Composable
private fun TeamsLoadedContent(
    viewModel: TeamsViewModel,
    onOpenTeam: (String) -> Unit,
) {
    val groups by viewModel.groupedTeams.collectAsStateWithLifecycle()
    val searchText by viewModel.searchText.collectAsStateWithLifecycle()
    val colors = RsmTheme.colors

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(vertical = RsmSpacing.s5),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4),
    ) {
        Text(
            text = stringResource(R.string.teams_title),
            style = RsmTypography.display,
            color = colors.inkPrimary,
            modifier = Modifier.padding(horizontal = RsmSpacing.s5),
        )
        TeamsSearchField(
            value = searchText,
            onValueChange = viewModel::onSearchChange,
            modifier = Modifier.padding(horizontal = RsmSpacing.s5),
        )

        if (groups.isEmpty()) {
            Box(modifier = Modifier.padding(horizontal = RsmSpacing.s5)) {
                RsmCard {
                    RsmEmptyState(
                        icon = Icons.Filled.Groups,
                        title = stringResource(R.string.teams_empty_title),
                        message = stringResource(R.string.teams_empty_message),
                        actionText = if (searchText.isNotBlank()) {
                            stringResource(R.string.teams_empty_reset)
                        } else {
                            null
                        },
                        onAction = if (searchText.isNotBlank()) viewModel::resetFilters else null,
                    )
                }
            }
        } else {
            groups.forEach { group ->
                Box(modifier = Modifier.padding(horizontal = RsmSpacing.s5)) {
                    RsmCard {
                        RsmSectionHeader(
                            eyebrow = group.sparte?.name
                                ?: stringResource(R.string.teams_group_no_sparte),
                            title = pluralStringResource(
                                R.plurals.teams_group_count,
                                group.teams.size,
                                group.teams.size,
                            ),
                        )
                        Column(modifier = Modifier.padding(top = RsmSpacing.s3)) {
                            group.teams.forEachIndexed { index, team ->
                                TeamsRow(team = team, onClick = { onOpenTeam(team.id) })
                                if (index < group.teams.lastIndex) {
                                    HorizontalDivider(color = colors.line)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** Eine Team-Zeile: Name, Altersgruppe, Größen — ohne jede Geldangabe. */
@Composable
private fun TeamsRow(team: Team, onClick: () -> Unit) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = RsmSpacing.s3),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            Text(
                text = team.name,
                style = RsmTypography.body,
                color = colors.inkPrimary,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2)) {
                team.ageGroup?.takeIf { it.isNotBlank() }?.let { ageGroup ->
                    RsmStatusPill(text = ageGroup, kind = RsmStatusKind.NEUTRAL)
                }
                RsmStatusPill(
                    text = pluralStringResource(
                        R.plurals.teams_skater_count,
                        team.skaterMemberIds.size,
                        team.skaterMemberIds.size,
                    ),
                    kind = RsmStatusKind.BRAND,
                )
            }
        }
        Icon(
            imageVector = Icons.Filled.ChevronRight,
            contentDescription = null,
            tint = colors.inkFaint,
        )
    }
}
