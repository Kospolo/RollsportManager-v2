package de.rollsportmanager.v2.ui.features.routines

import android.provider.Settings
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.auth.SessionStore
import de.rollsportmanager.v2.designsystem.RsmAvatar
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmEmptyState
import de.rollsportmanager.v2.designsystem.RsmSecondaryButton
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Kür-Detail: Kopf (Mensch zuerst) + Trainings-Player + Zeitmarken +
 * RollArt-Verlauf + lokale Notizen — Spiegel von RoutineDetailView.swift.
 * Kür und Läufer:innen kommen aus der Liste mit; Marker/Wertungen lädt
 * das ViewModel (Loading/Error/Retry).
 */
@Composable
internal fun RoutineDetailScreen(
    session: SessionStore,
    item: RoutineListItem,
    onBack: () -> Unit,
) {
    val routine = item.routine
    val colors = RsmTheme.colors
    val context = LocalContext.current

    // Reduce Motion = Animator-Skala 0 (Bedienungshilfen/Entwickleroptionen):
    // drosselt nur die sichtbaren Playhead-Updates, nie die Genauigkeit.
    val reduceMotion = remember {
        Settings.Global.getFloat(
            context.contentResolver,
            Settings.Global.ANIMATOR_DURATION_SCALE,
            1f,
        ) == 0f
    }
    val playback = remember(routine.id) {
        RoutinePlaybackEngine(
            durationMs = (routine.musicDurationMs ?: 0L).toDouble(),
            reduceMotion = reduceMotion,
        )
    }
    DisposableEffect(playback) {
        onDispose { playback.stop() }
    }

    val viewModel: RoutineDetailViewModel = viewModel(key = "routineDetail-${routine.id}") {
        RoutineDetailViewModel(session.api, session.clubId, routine.id)
    }
    val state by viewModel.state.collectAsStateWithLifecycle()

    val hasPlayableMusic = playback.durationMs > 0 && !routine.waveformPeaks.isNullOrEmpty()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(RsmSpacing.s5),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.cardGap),
    ) {
        DetailHeader(item = item, onBack = onBack)
        MetaLines(item = item)

        if (hasPlayableMusic) {
            RoutinePlayerCard(routine = routine, playback = playback)
        } else {
            RsmCard {
                RsmEmptyState(
                    icon = Icons.Filled.MusicNote,
                    title = stringResource(R.string.routines_detail_no_music_title),
                    message = stringResource(R.string.routines_detail_no_music_message),
                )
            }
        }

        when (val current = state) {
            RoutineDetailViewModel.State.Loading -> {
                RsmCard {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = RsmSpacing.s6),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = colors.brand)
                    }
                }
            }
            is RoutineDetailViewModel.State.Error -> {
                DetailErrorCard(message = current.message, onRetry = viewModel::load)
            }
            is RoutineDetailViewModel.State.Loaded -> {
                RoutineMarkerListCard(
                    markers = current.details.markers,
                    loopOn = playback.loopOn,
                    loopAMs = playback.loopAMs,
                    loopBMs = playback.loopBMs,
                    onJump = playback::playFrom,
                )
                RoutineScoreTrendCard(
                    scores = current.details.scores,
                    competitionNames = current.details.competitionNames,
                )
            }
        }

        RoutineNotesCard(routineId = routine.id)
    }
}

// --- Kopf: Zurück-Zeile + Mensch zuerst, dann Kür -------------------------------

@Composable
private fun DetailHeader(item: RoutineListItem, onBack: () -> Unit) {
    val colors = RsmTheme.colors
    val routine = item.routine
    Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.routines_detail_back),
                    tint = colors.inkPrimary,
                )
            }
            Text(
                text = stringResource(R.string.routines_list_title),
                style = RsmTypography.caption,
                color = colors.inkFaint,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
            Row(horizontalArrangement = Arrangement.spacedBy(-RsmSpacing.s2)) {
                item.skaters.forEach { member ->
                    RsmAvatar(
                        name = "${member.firstName} ${member.lastName}",
                        personId = member.id,
                        size = 44.dp,
                        modifier = Modifier.border(2.dp, colors.bgSurface, CircleShape),
                    )
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
                Text(
                    text = routine.title,
                    style = RsmTypography.h2,
                    color = colors.inkPrimary,
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RsmStatusPill(
                        text = stringResource(routine.status.labelRes),
                        kind = routine.status.pillKind,
                    )
                    val discipline =
                        stringResource(routineDisciplineRes(routine.skaterMemberIds.size))
                    Text(
                        text = listOfNotNull(routine.category, discipline).joinToString(" · "),
                        style = RsmTypography.caption,
                        color = colors.inkSoft,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

// --- Meta: Musik · Länge/BPM · Läufer:innen -------------------------------------

@Composable
private fun MetaLines(item: RoutineListItem) {
    val colors = RsmTheme.colors
    val routine = item.routine
    Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
        routine.musicTitle?.let { musicTitle ->
            MetaLine(
                icon = Icons.Filled.MusicNote,
                tint = colors.honeyDeep,
                text = listOfNotNull(musicTitle, routine.musicArtist).joinToString(" · "),
            )
        }
        routine.musicDurationMs?.let { durationMs ->
            val length = stringResource(
                R.string.routines_detail_meta_length,
                RoutineFormat.mmss(durationMs.toDouble()),
            )
            val bpm = routine.musicBpm?.let {
                stringResource(R.string.routines_detail_meta_bpm, it)
            }
            MetaLine(
                icon = Icons.Filled.Schedule,
                tint = colors.inkFaint,
                text = listOfNotNull(length, bpm).joinToString(" · "),
            )
        }
        if (item.skaters.isNotEmpty()) {
            MetaLine(
                icon = Icons.Filled.Group,
                tint = colors.inkFaint,
                text = item.skaterNames,
            )
        }
    }
}

@Composable
private fun MetaLine(icon: ImageVector, tint: Color, text: String) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(16.dp),
        )
        Text(
            text = text,
            style = RsmTypography.caption,
            color = RsmTheme.colors.inkSoft,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

// --- Fehlerkarte der Detail-Sektionen (Retry = Sekundär, Beere gehört dem Play) --

@Composable
private fun DetailErrorCard(message: String, onRetry: () -> Unit) {
    val colors = RsmTheme.colors
    RsmCard {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
            Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
                Icon(
                    imageVector = Icons.Filled.Warning,
                    contentDescription = null,
                    tint = colors.danger,
                )
                Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
                    Text(
                        text = stringResource(R.string.routines_detail_error_title),
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
            RsmSecondaryButton(
                text = stringResource(R.string.routines_common_retry),
                onClick = onRetry,
            )
        }
    }
}
