package de.rollsportmanager.v2.ui.features.routines

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmAvatar
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmEmptyState
import de.rollsportmanager.v2.designsystem.RsmPrimaryButton
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.designsystem.rsmPressable
import de.rollsportmanager.v2.dev.DevHooks
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Küren-Liste: Karten mit Läufer:in zuerst („Menschen zuerst"), dann Titel,
 * Disziplin, Musik, Dauer und letzter RollArt-Wertung mit Delta.
 * Loading/Error(Retry)/Loaded — Spiegel von RoutinesRootView.swift.
 */
@Composable
internal fun RoutinesListScreen(
    viewModel: RoutinesViewModel,
    devHooks: DevHooks,
    onOpenDetail: (routineId: String) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    // DEBUG-Hook: nach dem Laden EINMALIG das Detail der ersten Kür öffnen.
    LaunchedEffect(state) {
        val loaded = state as? RoutinesUiState.Loaded ?: return@LaunchedEffect
        if (devHooks.wantsFirstRoutine && devHooks.consumeOpenFirstRoutine()) {
            loaded.items.firstOrNull()?.let { onOpenDetail(it.routine.id) }
        }
    }

    when (val current = state) {
        RoutinesUiState.Loading -> LoadingView()
        is RoutinesUiState.Error -> ErrorView(message = current.message, onRetry = viewModel::load)
        is RoutinesUiState.Loaded -> LoadedList(items = current.items, onOpenDetail = onOpenDetail)
    }
}

@Composable
private fun LoadingView() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = RsmTheme.colors.brand)
    }
}

@Composable
private fun ErrorView(message: String, onRetry: () -> Unit) {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(RsmSpacing.s5),
    ) {
        RsmCard {
            Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4)) {
                Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
                    Icon(
                        imageVector = Icons.Filled.Warning,
                        contentDescription = null,
                        tint = colors.danger,
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
                        Text(
                            text = stringResource(R.string.routines_list_error_title),
                            style = RsmTypography.bodyStrong,
                            color = colors.danger,
                        )
                        Text(
                            text = message,
                            style = RsmTypography.caption,
                            color = colors.inkSoft,
                        )
                    }
                }
                // Die eine Beere dieses Sichtbereichs: der Weg zurück.
                RsmPrimaryButton(
                    text = stringResource(R.string.routines_common_retry),
                    onClick = onRetry,
                )
            }
        }
    }
}

@Composable
private fun LoadedList(items: List<RoutineListItem>, onOpenDetail: (String) -> Unit) {
    val colors = RsmTheme.colors
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(RsmSpacing.s5),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.cardGap),
    ) {
        item(key = "header") {
            Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
                Text(
                    text = stringResource(R.string.routines_list_title),
                    style = RsmTypography.display,
                    color = colors.inkPrimary,
                )
                Text(
                    text = stringResource(R.string.routines_list_subtitle),
                    style = RsmTypography.body,
                    color = colors.inkSoft,
                )
            }
        }
        if (items.isEmpty()) {
            item(key = "empty") {
                RsmCard {
                    RsmEmptyState(
                        icon = Icons.Filled.MusicNote,
                        title = stringResource(R.string.routines_list_empty_title),
                        message = stringResource(R.string.routines_list_empty_message),
                    )
                }
            }
        } else {
            items(items, key = { it.routine.id }) { item ->
                RoutineCard(item = item, onClick = { onOpenDetail(item.routine.id) })
            }
        }
    }
}

/**
 * Kür-Karte: Läufer:in zuerst, dann Titel, Disziplin, Musik, Dauer und die
 * letzte RollArt-Wertung mit Delta (Mono, echtes −).
 */
@Composable
private fun RoutineCard(item: RoutineListItem, onClick: () -> Unit) {
    val colors = RsmTheme.colors
    val routine = item.routine
    val interactionSource = remember { MutableInteractionSource() }

    RsmCard(
        modifier = Modifier
            .rsmPressable(interactionSource)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClickLabel = stringResource(
                    R.string.routines_list_a11y_card, routine.title, item.skaterNames,
                ),
                role = Role.Button,
                onClick = onClick,
            ),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
            // Kopf: Avatare (Paarlauf überlappend) + Namen + Status-Pill.
            Row(
                horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(-RsmSpacing.s2)) {
                    item.skaters.forEach { member ->
                        RsmAvatar(
                            name = "${member.firstName} ${member.lastName}",
                            personId = member.id,
                            size = 32.dp,
                            modifier = Modifier.border(2.dp, colors.bgSurface, CircleShape),
                        )
                    }
                }
                Text(
                    text = item.skaterNames,
                    style = RsmTypography.bodyStrong,
                    color = colors.inkPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                RsmStatusPill(
                    text = stringResource(routine.status.labelRes),
                    kind = routine.status.pillKind,
                )
            }

            // Titel + Kategorie · Disziplin.
            Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
                Text(
                    text = routine.title,
                    style = RsmTypography.h3,
                    color = colors.inkPrimary,
                )
                val discipline = stringResource(routineDisciplineRes(routine.skaterMemberIds.size))
                Text(
                    text = listOfNotNull(routine.category, discipline).joinToString(" · "),
                    style = RsmTypography.caption,
                    color = colors.inkSoft,
                )
            }

            // Musikzeile — Honig nur hier (Musik-Kontext).
            routine.musicTitle?.let { musicTitle ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Filled.MusicNote,
                        contentDescription = null,
                        tint = colors.honeyDeep,
                        modifier = Modifier.size(14.dp),
                    )
                    Text(
                        text = listOfNotNull(musicTitle, routine.musicArtist).joinToString(" · "),
                        style = RsmTypography.caption,
                        color = colors.inkSoft,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            HorizontalDivider(color = colors.line, thickness = 1.dp)

            // Fußzeile: Dauer (Mono) · letzte Wertung mit Delta.
            Row(
                horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                routine.musicDurationMs?.let { durationMs ->
                    Icon(
                        imageVector = Icons.Filled.Schedule,
                        contentDescription = null,
                        tint = colors.inkFaint,
                        modifier = Modifier.size(14.dp),
                    )
                    Text(
                        text = RoutineFormat.mmss(durationMs.toDouble()),
                        style = RsmTypography.monoTable,
                        color = colors.inkSoft,
                    )
                }
                Spacer(modifier = Modifier.weight(1f))
                if (item.lastTotal != null) {
                    Text(
                        text = stringResource(R.string.routines_list_last_score),
                        style = RsmTypography.caption,
                        color = colors.inkFaint,
                    )
                    Text(
                        text = RoutineFormat.points(item.lastTotal),
                        style = RsmTypography.monoTable,
                        color = colors.inkPrimary,
                    )
                    item.delta?.let { delta ->
                        RoutineDeltaChip(delta = delta)
                    }
                } else {
                    Text(
                        text = stringResource(R.string.routines_list_no_score),
                        style = RsmTypography.caption,
                        color = colors.inkFaint,
                    )
                }
            }
        }
    }
}
