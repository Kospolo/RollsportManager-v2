package de.rollsportmanager.v2.features.teams

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.SportsScore
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmAvatar
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmEmptyState
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Team-Detail: Kopfdaten, Trainer:innen und Läufer:innen.
 *
 * KINDERSCHUTZ — bewusste Entscheidungen dieser Ansicht:
 * - Personen erscheinen ausschließlich als Monogramm + Farbton (RsmAvatar mit
 *   `personId`). KEIN Foto: der Member-Pfad trägt keine Einwilligungs-Wache.
 * - Keine Beitrags-, Mahn- oder sonstigen Geldangaben. Ein Team ist eine
 *   Kinderliste; wer offene Rechnungen hat, geht die Mannschaft nichts an.
 * - Es werden nur Personen gezeigt, die der Server dem Betrachter ohnehin
 *   ausliefert. Fehlende IDs fallen still weg statt als „unbekannt“
 *   aufzutauchen — die Anzahl in der Liste ist deshalb die *sichtbare* Anzahl.
 */
@Composable
internal fun TeamDetailScreen(
    viewModel: TeamsViewModel,
    teamId: String,
    onBack: () -> Unit,
) {
    val teams by viewModel.teams.collectAsStateWithLifecycle()
    val allMembers by viewModel.members.collectAsStateWithLifecycle()
    val sparten by viewModel.sparten.collectAsStateWithLifecycle()
    val colors = RsmTheme.colors

    val team = teams.firstOrNull { it.id == teamId }
    val sparte = team?.sparteId?.let { id -> sparten.firstOrNull { it.id == id } }
    val coaches = teamsResolveMembers(team?.coachMemberIds.orEmpty(), allMembers)
    val skaters = teamsResolveMembers(team?.skaterMemberIds.orEmpty(), allMembers)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(vertical = RsmSpacing.s5),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4),
    ) {
        TeamsDetailTopBar(title = team?.name.orEmpty(), onBack = onBack)

        if (team == null) {
            // Kann nur passieren, wenn die Liste zwischenzeitlich neu geladen
            // wurde und das Team weg ist — kein leerer Screen ohne Weg.
            Column(modifier = Modifier.padding(horizontal = RsmSpacing.s5)) {
                RsmCard {
                    RsmEmptyState(
                        icon = Icons.Filled.Groups,
                        title = stringResource(R.string.teams_detail_gone_title),
                        message = stringResource(R.string.teams_detail_gone_message),
                    )
                }
            }
            return@Column
        }

        // --- Kopfkarte ---------------------------------------------------------
        Column(modifier = Modifier.padding(horizontal = RsmSpacing.s5)) {
            RsmCard {
                RsmSectionHeader(
                    eyebrow = stringResource(R.string.teams_detail_eyebrow),
                    title = team.name,
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = RsmSpacing.s3),
                    horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                ) {
                    sparte?.let {
                        RsmStatusPill(text = it.name, kind = RsmStatusKind.BRAND)
                    }
                    team.ageGroup?.takeIf { it.isNotBlank() }?.let {
                        RsmStatusPill(text = it, kind = RsmStatusKind.NEUTRAL)
                    }
                }
            }
        }

        // --- Trainer:innen -----------------------------------------------------
        Column(modifier = Modifier.padding(horizontal = RsmSpacing.s5)) {
            RsmCard {
                RsmSectionHeader(
                    eyebrow = stringResource(R.string.teams_detail_coaches_eyebrow),
                    title = pluralStringResource(
                        R.plurals.teams_coach_count,
                        coaches.size,
                        coaches.size,
                    ),
                )
                if (coaches.isEmpty()) {
                    Text(
                        text = stringResource(R.string.teams_detail_no_coaches),
                        style = RsmTypography.caption,
                        color = colors.inkSoft,
                        modifier = Modifier.padding(top = RsmSpacing.s3),
                    )
                } else {
                    Column(modifier = Modifier.padding(top = RsmSpacing.s3)) {
                        coaches.forEach { TeamsPersonRow(member = it) }
                    }
                }
            }
        }

        // --- Läufer:innen ------------------------------------------------------
        Column(modifier = Modifier.padding(horizontal = RsmSpacing.s5)) {
            RsmCard {
                RsmSectionHeader(
                    eyebrow = stringResource(R.string.teams_detail_skaters_eyebrow),
                    title = pluralStringResource(
                        R.plurals.teams_skater_count,
                        skaters.size,
                        skaters.size,
                    ),
                )
                if (skaters.isEmpty()) {
                    Text(
                        text = stringResource(R.string.teams_detail_no_skaters),
                        style = RsmTypography.caption,
                        color = colors.inkSoft,
                        modifier = Modifier.padding(top = RsmSpacing.s3),
                    )
                } else {
                    Column(modifier = Modifier.padding(top = RsmSpacing.s3)) {
                        skaters.forEach { TeamsPersonRow(member = it) }
                    }
                }
            }
        }
    }
}

@Composable
private fun TeamsDetailTopBar(title: String, onBack: () -> Unit) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onBack) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = stringResource(R.string.teams_back),
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

/**
 * Personenzeile im Team — Monogramm + Name, sonst nichts.
 * Absichtlich NICHT klickbar: der Sprung ins Mitglieder-Detail gehört in den
 * Mitglieder-Tab (dort hängt die Rollen-/Familienlogik), nicht in eine
 * Kinderliste.
 */
@Composable
private fun TeamsPersonRow(member: ClubMember) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = RsmSpacing.s2),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RsmAvatar(name = member.teamsFullName, personId = member.id)
        Text(
            text = member.teamsFullName,
            style = RsmTypography.body,
            color = colors.inkPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
