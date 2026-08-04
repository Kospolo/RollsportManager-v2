package de.rollsportmanager.v2.features.members

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.UnfoldMore
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import de.rollsportmanager.contracts.AssignableClubRole
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.ClubRole
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.designsystem.rsmPressable
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

// ============================================================================
// Karte „Rolle ändern“ im Mitglieder-Detail (nur Vorstand/Verwaltung sichtbar).
// PATCH …/role macht der ViewModel optimistisch mit Rollback; die Snackbar
// bei Fehlern (403 → „Keine Berechtigung“) zeigt MembersRootScreen.
// ============================================================================

@Composable
internal fun MembersRoleCard(
    member: ClubMember,
    isSelf: Boolean,
    isChangingRole: Boolean,
    onChangeRole: (AssignableClubRole) -> Unit,
) {
    val colors = RsmTheme.colors
    RsmCard {
        RsmSectionHeader(
            eyebrow = stringResource(R.string.members_role_change_eyebrow),
            title = stringResource(R.string.members_role_change_title),
        )
        Column(
            modifier = Modifier.padding(top = RsmSpacing.s4),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        ) {
            if (isSelf) {
                // „Nie sich selbst“ (API-Regel) — nur ein erklärender Hinweis.
                Text(
                    text = stringResource(R.string.members_role_change_self),
                    style = RsmTypography.caption,
                    color = colors.inkFaint,
                )
            } else {
                MembersRoleDropdown(
                    member = member,
                    isChangingRole = isChangingRole,
                    onChangeRole = onChangeRole,
                )
                if (member.role == ClubRole.OWNER) {
                    // Last-Owner-Schutz (409) vorab erklären.
                    Text(
                        text = stringResource(R.string.members_role_change_owner_hint),
                        style = RsmTypography.caption,
                        color = colors.inkFaint,
                    )
                }
            }
        }
    }
}

/** Dropdown „Rolle ändern“ — brand-soft-Pill als Anker (Zweitaktion, keine Beere). */
@Composable
private fun MembersRoleDropdown(
    member: ClubMember,
    isChangingRole: Boolean,
    onChangeRole: (AssignableClubRole) -> Unit,
) {
    val colors = RsmTheme.colors
    var expanded by remember { mutableStateOf(false) }
    val interactionSource = remember { MutableInteractionSource() }
    Box {
        Row(
            modifier = Modifier
                .rsmPressable(interactionSource)
                .clip(CircleShape)
                .background(colors.brandSoft)
                .clickable(
                    interactionSource = interactionSource,
                    indication = null,
                    enabled = !isChangingRole,
                    onClickLabel = stringResource(R.string.members_role_change_a11y),
                    onClick = { expanded = true },
                )
                .heightIn(min = RsmSize.touchTarget)
                .padding(horizontal = RsmSpacing.s4),
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (isChangingRole) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    color = colors.brandInk,
                    strokeWidth = 2.dp,
                )
            }
            Text(
                text = stringResource(R.string.members_role_change_menu),
                style = RsmTypography.bodyStrong,
                color = colors.brandInk,
            )
            Icon(
                imageVector = Icons.Filled.UnfoldMore,
                contentDescription = null,
                tint = colors.brandInk,
                modifier = Modifier.size(18.dp),
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            AssignableClubRole.entries.forEach { role ->
                val isCurrent = role.asClubRole() == member.role
                DropdownMenuItem(
                    text = {
                        Text(
                            text = membersRoleLabel(role),
                            style = RsmTypography.body,
                            color = colors.inkPrimary,
                        )
                    },
                    trailingIcon = if (isCurrent) {
                        {
                            Icon(
                                imageVector = Icons.Filled.Check,
                                contentDescription = null,
                                tint = colors.brandInk,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    } else {
                        null
                    },
                    onClick = {
                        expanded = false
                        if (!isCurrent) onChangeRole(role)
                    },
                )
            }
        }
    }
}
