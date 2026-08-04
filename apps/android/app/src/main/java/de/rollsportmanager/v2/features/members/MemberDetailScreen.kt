package de.rollsportmanager.v2.features.members

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.FamilyRestroom
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.ClubRole
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmAvatar
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmEmptyState
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.designsystem.rsmPressable
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Detailansicht eines Mitglieds: Stammdaten · Familie · Rolle
 * (Spiegel von iOS MemberDetailView.swift).
 *
 * Der Rollenwechsel (PATCH …/role) läuft optimistisch mit Rollback;
 * die Snackbar dazu zeigt der Feature-Root (MembersRootScreen).
 * Die Familien-Sektion zeigt, was die API liefert — RLS-bedingt sehen
 * Nicht-Vorstände nur die eigene Familie (der EmptyState erklärt das).
 */
@Composable
internal fun MemberDetailScreen(
    viewModel: MembersViewModel,
    memberId: String,
    viewerRole: ClubRole?,
    viewerMemberId: String?,
    onOpenMember: (String) -> Unit,
    onBack: () -> Unit,
) {
    val members by viewModel.members.collectAsStateWithLifecycle()
    val teams by viewModel.teams.collectAsStateWithLifecycle()
    val guardianships by viewModel.guardianships.collectAsStateWithLifecycle()
    val invoices by viewModel.invoices.collectAsStateWithLifecycle()
    val isChangingRole by viewModel.isChangingRole.collectAsStateWithLifecycle()

    val member = members.firstOrNull { it.id == memberId }
    // Vorstand/Verwaltung dürfen Rollen ändern — alle anderen sehen die Karte nicht.
    val viewerIsBoard = viewerRole == ClubRole.OWNER || viewerRole == ClubRole.ADMIN

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(RsmSpacing.s5),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.cardGap),
    ) {
        MembersDetailTopBar(title = member?.membersFullName.orEmpty(), onBack = onBack)
        if (member == null) {
            RsmCard {
                RsmEmptyState(
                    icon = Icons.Filled.PersonSearch,
                    title = stringResource(R.string.members_detail_missing_title),
                    message = stringResource(R.string.members_detail_missing_message),
                )
            }
        } else {
            MembersDetailHeaderCard(
                member = member,
                feeStatus = membersFeeStatus(member, invoices),
            )
            MembersMasterDataCard(
                member = member,
                teamNames = membersTeamNames(member, teams),
            )
            MembersFamilyCard(
                links = membersFamilyLinks(member, guardianships, members),
                viewerIsBoard = viewerIsBoard,
                onOpenMember = onOpenMember,
            )
            if (viewerIsBoard) {
                MembersRoleCard(
                    member = member,
                    // „Nie sich selbst“ (API-Regel) — für die eigene Person nur ein Hinweis.
                    isSelf = member.id == viewerMemberId,
                    isChangingRole = isChangingRole,
                    onChangeRole = { viewModel.changeRole(member, it) },
                )
            }
        }
    }
}

// --- Kopfzeile (kein App-TopBar in der Shell — Feature bringt den Zurück-Weg mit) ---

@Composable
private fun MembersDetailTopBar(title: String, onBack: () -> Unit) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = stringResource(R.string.members_back),
                tint = colors.inkPrimary,
            )
        }
        Text(
            text = title,
            style = RsmTypography.h2,
            color = colors.inkPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

// --- Kopfkarte ---------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MembersDetailHeaderCard(
    member: ClubMember,
    feeStatus: MembersViewModel.FeeStatus?,
) {
    val colors = RsmTheme.colors
    RsmCard {
        Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s4)) {
            RsmAvatar(name = member.membersFullName, personId = member.id, size = 56.dp)
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
            ) {
                Text(
                    text = member.membersFullName,
                    style = RsmTypography.h2,
                    color = colors.inkPrimary,
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                    verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                ) {
                    RsmStatusPill(
                        text = membersRoleLabel(member.role),
                        kind = membersRoleKind(member.role),
                    )
                    RsmStatusPill(
                        text = stringResource(membersStatusLabelRes(member.status)),
                        kind = membersStatusKind(member.status),
                    )
                    feeStatus?.let { MembersFeePill(status = it) }
                }
            }
        }
    }
}

// --- Stammdaten ----------------------------------------------------------------------

@Composable
private fun MembersMasterDataCard(member: ClubMember, teamNames: String?) {
    RsmCard {
        RsmSectionHeader(
            eyebrow = stringResource(R.string.members_detail_master_eyebrow),
            title = stringResource(R.string.members_detail_master_title),
        )
        Column(
            modifier = Modifier.padding(top = RsmSpacing.s4),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        ) {
            MembersDetailRow(
                label = stringResource(R.string.members_detail_email),
                value = member.email,
            )
            MembersDetailRow(
                label = stringResource(R.string.members_detail_birth_date),
                value = member.birthDate?.let(::membersFormatDay),
            )
            MembersDetailRow(
                label = stringResource(R.string.members_detail_joined_on),
                value = member.joinedOn?.let(::membersFormatDay),
            )
            MembersDetailRow(
                label = stringResource(R.string.members_detail_teams),
                value = teamNames,
                emptyText = stringResource(R.string.members_row_no_team),
            )
        }
    }
}

// --- Familie -------------------------------------------------------------------------

@Composable
private fun MembersFamilyCard(
    links: List<MembersViewModel.FamilyLink>,
    viewerIsBoard: Boolean,
    onOpenMember: (String) -> Unit,
) {
    val colors = RsmTheme.colors
    RsmCard {
        RsmSectionHeader(
            eyebrow = stringResource(R.string.members_family_eyebrow),
            title = stringResource(R.string.members_family_title),
        )
        if (links.isEmpty()) {
            RsmEmptyState(
                icon = Icons.Filled.FamilyRestroom,
                title = stringResource(R.string.members_family_empty_title),
                message = stringResource(
                    if (viewerIsBoard) {
                        R.string.members_family_empty_admin_message
                    } else {
                        R.string.members_family_empty_own_message
                    },
                ),
            )
        } else {
            Column(modifier = Modifier.padding(top = RsmSpacing.s3)) {
                links.forEachIndexed { index, link ->
                    MembersFamilyRow(link = link, onClick = { onOpenMember(link.other.id) })
                    if (index < links.lastIndex) {
                        HorizontalDivider(color = colors.line)
                    }
                }
            }
        }
    }
}

@Composable
private fun MembersFamilyRow(
    link: MembersViewModel.FamilyLink,
    onClick: () -> Unit,
) {
    val colors = RsmTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .rsmPressable(interactionSource)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClickLabel = stringResource(R.string.members_row_a11y, link.other.membersFullName),
                onClick = onClick,
            )
            .heightIn(min = RsmSize.listRow)
            .padding(vertical = RsmSpacing.s2),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RsmAvatar(name = link.other.membersFullName, personId = link.other.id, size = 36.dp)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            Text(
                text = link.other.membersFullName,
                style = RsmTypography.bodyStrong,
                color = colors.inkPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            // Beziehungscode gehört zur erziehungsberechtigten Seite.
            if (!link.otherIsChild) {
                Text(
                    text = if (link.relation == "parent") {
                        stringResource(R.string.members_family_relation_parent)
                    } else {
                        link.relation
                    },
                    style = RsmTypography.caption,
                    color = colors.inkSoft,
                )
            }
        }
        RsmStatusPill(
            text = stringResource(
                if (link.otherIsChild) {
                    R.string.members_family_child_pill
                } else {
                    R.string.members_family_guardian_pill
                },
            ),
            kind = RsmStatusKind.INFO,
        )
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = colors.inkFaint,
            modifier = Modifier.size(20.dp),
        )
    }
}

// Karte „Rolle ändern“ (nur Vorstand/Verwaltung): MembersRoleSection.kt
