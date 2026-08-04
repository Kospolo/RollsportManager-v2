package de.rollsportmanager.v2.features.members

import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Search
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
import de.rollsportmanager.contracts.ClubRole
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmEmptyState
import de.rollsportmanager.v2.designsystem.RsmPrimaryButton
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Durchsuchbare Mitgliederliste mit Rollen-Filter-Chips
 * (Spiegel von iOS MembersListView.swift).
 */
@Composable
internal fun MembersListScreen(
    viewModel: MembersViewModel,
    onOpenMember: (String) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    when (val current = state) {
        MembersViewModel.LoadState.Loading -> MembersLoading()
        is MembersViewModel.LoadState.Failed ->
            MembersError(message = current.message, onRetry = viewModel::load)

        MembersViewModel.LoadState.Loaded ->
            MembersLoadedContent(viewModel = viewModel, onOpenMember = onOpenMember)
    }
}

// --- Zustände -----------------------------------------------------------------

@Composable
private fun MembersLoading() {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4, Alignment.CenterVertically),
    ) {
        CircularProgressIndicator(color = colors.brand)
        Text(
            text = stringResource(R.string.members_loading),
            style = RsmTypography.body,
            color = colors.inkSoft,
        )
    }
}

/** Fehlerkarte mit Klartext (ApiException.message) + Retry. */
@Composable
private fun MembersError(message: String, onRetry: () -> Unit) {
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
                        text = stringResource(R.string.members_error_title),
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
                    text = stringResource(R.string.members_error_retry),
                    onClick = onRetry,
                    fillWidth = false,
                )
            }
        }
    }
}

// --- Geladene Liste --------------------------------------------------------------

@Composable
private fun MembersLoadedContent(
    viewModel: MembersViewModel,
    onOpenMember: (String) -> Unit,
) {
    val filtered by viewModel.filteredMembers.collectAsStateWithLifecycle()
    val teams by viewModel.teams.collectAsStateWithLifecycle()
    val invoices by viewModel.invoices.collectAsStateWithLifecycle()
    val searchText by viewModel.searchText.collectAsStateWithLifecycle()
    val roleFilter by viewModel.roleFilter.collectAsStateWithLifecycle()
    val colors = RsmTheme.colors
    val hasActiveFilter = searchText.isNotBlank() || roleFilter != null

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(vertical = RsmSpacing.s5),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4),
    ) {
        Text(
            text = stringResource(R.string.members_title),
            style = RsmTypography.display,
            color = colors.inkPrimary,
            modifier = Modifier.padding(horizontal = RsmSpacing.s5),
        )
        MembersSearchField(
            value = searchText,
            onValueChange = viewModel::onSearchChange,
            modifier = Modifier.padding(horizontal = RsmSpacing.s5),
        )
        MembersRoleFilterRow(
            selected = roleFilter,
            onSelect = viewModel::onRoleFilterChange,
        )
        Box(modifier = Modifier.padding(horizontal = RsmSpacing.s5)) {
            if (filtered.isEmpty()) {
                RsmCard {
                    // Kein Treffer für Suche/Filter — nie ein leerer Screen ohne Weg.
                    RsmEmptyState(
                        icon = Icons.Filled.Search,
                        title = stringResource(R.string.members_empty_title),
                        message = stringResource(R.string.members_empty_message),
                        actionText = if (hasActiveFilter) {
                            stringResource(R.string.members_empty_reset)
                        } else {
                            null
                        },
                        onAction = if (hasActiveFilter) viewModel::resetFilters else null,
                    )
                }
            } else {
                RsmCard {
                    RsmSectionHeader(
                        eyebrow = stringResource(R.string.members_list_eyebrow),
                        title = pluralStringResource(
                            R.plurals.members_list_count,
                            filtered.size,
                            filtered.size,
                        ),
                    )
                    Column(modifier = Modifier.padding(top = RsmSpacing.s3)) {
                        filtered.forEachIndexed { index, member ->
                            MembersRow(
                                member = member,
                                teamNames = membersTeamNames(member, teams),
                                feeStatus = membersFeeStatus(member, invoices),
                                onClick = { onOpenMember(member.id) },
                            )
                            if (index < filtered.lastIndex) {
                                HorizontalDivider(color = colors.line)
                            }
                        }
                    }
                }
            }
        }
    }
}

/** „Alle“ + eine Pill je Rolle; zweiter Tap auf den aktiven Chip hebt den Filter auf. */
@Composable
private fun MembersRoleFilterRow(
    selected: ClubRole?,
    onSelect: (ClubRole?) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = RsmSpacing.s5),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
    ) {
        MembersFilterChip(
            text = stringResource(R.string.members_filter_all),
            selected = selected == null,
            onClick = { onSelect(null) },
        )
        ClubRole.entries.forEach { role ->
            MembersFilterChip(
                text = membersRoleLabel(role),
                selected = selected == role,
                onClick = { onSelect(if (selected == role) null else role) },
            )
        }
    }
}
