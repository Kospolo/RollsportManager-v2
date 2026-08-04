package de.rollsportmanager.v2.ui.features.routines

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Forward5
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Replay5
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.rollsportmanager.contracts.Routine
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.designsystem.rsmPressable
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import kotlinx.coroutines.delay

/**
 * Trainings-Player (Signature-Komponente, DESIGN-SYSTEM §3.8):
 * Waveform + Zeitzeile + Countdown-Segment + Transport (±5 s, Play 68 dp)
 * + A–B-Loop + Tempo mit Klartext-Folge (RoutinePlayerTempoControl).
 * Das große Play ist die EINE Beere dieses Sichtbereichs.
 *
 * Der Frame-Loop lebt hier (withFrameNanos) und treibt die simulierte
 * Wiedergabe — bewusst KEIN Media3 (kommt später als eigenes Modul).
 */
@Composable
internal fun RoutinePlayerCard(routine: Routine, playback: RoutinePlaybackEngine) {
    // Simulierter Transport: Frame-Loop nur, solange gespielt wird.
    LaunchedEffect(playback.isPlaying) {
        if (!playback.isPlaying) return@LaunchedEffect
        var lastNanos = withFrameNanos { it }
        while (playback.isPlaying) {
            withFrameNanos { now ->
                playback.tick(
                    deltaMs = (now - lastNanos) / 1_000_000.0,
                    frameTimeMs = now / 1_000_000,
                )
                lastNanos = now
            }
        }
    }
    // Countdown: jede sichtbare Sekunde ist ein eigener 1-s-Effekt.
    LaunchedEffect(playback.countdownLeft) {
        if (playback.countdownLeft == null) return@LaunchedEffect
        delay(1_000)
        playback.countdownTick()
    }

    RsmCard {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4)) {
            PlayerHeader(playback)

            RoutineWaveform(
                peaks = routine.waveformPeaks.orEmpty(),
                durationMs = playback.durationMs,
                posMs = playback.posMs,
                loopAMs = playback.loopAMs,
                loopBMs = playback.loopBMs,
                loopOn = playback.loopOn,
                countdownLeft = playback.countdownLeft,
                onSeek = playback::seek,
                modifier = Modifier.padding(top = RsmSpacing.s3), // Platz für A/B-Griffe
            )

            Timeline(playback)
            TransportRow(playback)

            Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s4)) {
                CountdownControl(playback, modifier = Modifier.weight(1f))
                LoopControl(playback)
            }

            RoutinePlayerTempoControl(playback)
        }
    }
}

// --- Kopf: Honig-Eyebrow + Loop-Chip + Demo-Hinweis ------------------------------

@Composable
private fun PlayerHeader(playback: RoutinePlaybackEngine) {
    val colors = RsmTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
        ) {
            Text(
                text = stringResource(R.string.routines_player_eyebrow).uppercase(),
                style = RsmTypography.eyebrow,
                color = colors.honeyDeep,
                modifier = Modifier.weight(1f),
            )
            if (playback.loopOn) {
                RsmStatusPill(
                    text = stringResource(
                        R.string.routines_player_loop_chip,
                        RoutineFormat.mmssTenths(playback.loopAMs),
                        RoutineFormat.mmssTenths(playback.loopBMs),
                    ),
                    kind = RsmStatusKind.HONEY,
                )
            }
        }
        Text(
            text = stringResource(R.string.routines_player_demo_hint),
            style = RsmTypography.caption,
            color = colors.inkFaint,
        )
    }
}

// --- Zeitzeile: 0:00 · aktuelle Zeit groß · Gesamtlänge ---------------------------

@Composable
private fun Timeline(playback: RoutinePlaybackEngine) {
    val colors = RsmTheme.colors
    val total = RoutineFormat.mmss(playback.durationMs)
    val smallMono = RsmTypography.monoTable.copy(fontSize = 12.sp, fontWeight = FontWeight.Normal)
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = "0:00", style = smallMono, color = colors.inkFaint)
        Spacer(modifier = Modifier.weight(1f))
        Row(
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            val countdownLeft = playback.countdownLeft
            Text(
                text = if (countdownLeft != null) {
                    stringResource(R.string.routines_player_starting_in, countdownLeft)
                } else {
                    RoutineFormat.mmss(playback.posMs)
                },
                style = RsmTypography.monoTable.copy(
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                ),
                color = colors.inkPrimary,
            )
            Text(text = "/ $total", style = smallMono, color = colors.inkFaint)
        }
        Spacer(modifier = Modifier.weight(1f))
        Text(text = total, style = smallMono, color = colors.inkFaint)
    }
}

// --- Transport: −5 s · Play (68 dp, Beere) · +5 s --------------------------------

@Composable
private fun TransportRow(playback: RoutinePlaybackEngine) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s5, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SkipButton(
            icon = Icons.Filled.Replay5,
            contentDescription = stringResource(R.string.routines_player_a11y_skip_back),
            onClick = { playback.skip(-RoutinePlaybackEngine.SKIP_MS) },
        )

        val playSource = remember { MutableInteractionSource() }
        Box(
            modifier = Modifier
                .rsmPressable(playSource)
                .size(RsmSize.playButton)
                .shadow(
                    elevation = 6.dp,
                    shape = CircleShape,
                    ambientColor = colors.inkPrimary,
                    spotColor = colors.inkPrimary,
                )
                .clip(CircleShape)
                .background(colors.brand)
                .clickable(
                    interactionSource = playSource,
                    indication = null,
                    role = Role.Button,
                    onClickLabel = stringResource(
                        if (playback.isActive) {
                            R.string.routines_player_a11y_pause
                        } else {
                            R.string.routines_player_a11y_play
                        },
                    ),
                    onClick = playback::togglePlay,
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = if (playback.isActive) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                contentDescription = null,
                tint = colors.brandContrast,
                modifier = Modifier
                    .size(34.dp)
                    .offset(x = if (playback.isActive) 0.dp else 2.dp),
            )
        }

        SkipButton(
            icon = Icons.Filled.Forward5,
            contentDescription = stringResource(R.string.routines_player_a11y_skip_forward),
            onClick = { playback.skip(RoutinePlaybackEngine.SKIP_MS) },
        )
    }
}

@Composable
private fun SkipButton(icon: ImageVector, contentDescription: String, onClick: () -> Unit) {
    val colors = RsmTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    Box(
        modifier = Modifier
            .rsmPressable(interactionSource)
            .size(48.dp)
            .clip(CircleShape)
            .background(colors.bgSurface)
            .border(1.dp, colors.lineStrong, CircleShape)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                role = Role.Button,
                onClickLabel = contentDescription,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = colors.inkSoft,
            modifier = Modifier.size(22.dp),
        )
    }
}

// --- Countdown-Segment (Aus / 3 s / 5 s / 8 s) -----------------------------------

@Composable
private fun CountdownControl(playback: RoutinePlaybackEngine, modifier: Modifier = Modifier) {
    val colors = RsmTheme.colors
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2)) {
        Text(
            text = stringResource(R.string.routines_player_countdown_eyebrow).uppercase(),
            style = RsmTypography.eyebrow,
            color = colors.inkFaint,
        )
        Row(
            modifier = Modifier
                .clip(CircleShape)
                .background(colors.bgSunken)
                .border(1.dp, colors.line, CircleShape)
                .padding(3.dp),
            horizontalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            COUNTDOWN_OPTIONS.forEach { seconds ->
                CountdownButton(playback, seconds)
            }
        }
    }
}

@Composable
private fun CountdownButton(playback: RoutinePlaybackEngine, seconds: Int) {
    val colors = RsmTheme.colors
    val active = playback.countdownSetting == seconds
    val interactionSource = remember { MutableInteractionSource() }
    val label = if (seconds == 0) {
        stringResource(R.string.routines_player_countdown_off)
    } else {
        stringResource(R.string.routines_player_countdown_seconds, seconds)
    }
    val a11y = if (seconds == 0) {
        stringResource(R.string.routines_player_a11y_countdown_off)
    } else {
        stringResource(R.string.routines_player_a11y_countdown, seconds)
    }
    Box(
        modifier = Modifier
            .clip(CircleShape)
            .background(if (active) colors.bgSurface else colors.bgSunken.copy(alpha = 0f))
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                role = Role.Button,
                onClickLabel = a11y,
                onClick = { playback.countdownSetting = seconds },
            )
            .widthIn(min = 40.dp)
            .heightIn(min = 38.dp)
            .padding(horizontal = RsmSpacing.s1),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = RsmTypography.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.Bold),
            color = if (active) colors.inkPrimary else colors.inkSoft,
        )
    }
}

private val COUNTDOWN_OPTIONS = listOf(0, 3, 5, 8)

// --- A–B-Loop: A-/B-Griffe + Toggle mit Wortlabel ---------------------------------

@Composable
private fun LoopControl(playback: RoutinePlaybackEngine) {
    val colors = RsmTheme.colors
    Column(
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
    ) {
        Text(
            text = stringResource(R.string.routines_player_loop_eyebrow).uppercase(),
            style = RsmTypography.eyebrow,
            color = colors.inkFaint,
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LoopPointButton(
                letter = "A",
                valueMs = playback.loopAMs,
                a11yRes = R.string.routines_player_a11y_set_loop_a,
                onClick = playback::setLoopAAtPlayhead,
            )
            LoopPointButton(
                letter = "B",
                valueMs = playback.loopBMs,
                a11yRes = R.string.routines_player_a11y_set_loop_b,
                onClick = playback::setLoopBAtPlayhead,
            )
            LoopToggle(playback)
        }
    }
}

@Composable
private fun LoopPointButton(letter: String, valueMs: Double, a11yRes: Int, onClick: () -> Unit) {
    val colors = RsmTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    val time = RoutineFormat.mmssTenths(valueMs)
    val shape = RoundedCornerShape(10.dp)
    Box(
        modifier = Modifier
            .rsmPressable(interactionSource)
            .clip(shape)
            .background(colors.bgSunken)
            .border(1.dp, colors.line, shape)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                role = Role.Button,
                onClickLabel = stringResource(a11yRes, time),
                onClick = onClick,
            )
            .heightIn(min = RsmSize.touchTarget)
            .padding(horizontal = RsmSpacing.s3),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "$letter $time",
            style = RsmTypography.monoTable.copy(fontSize = 12.5.sp, fontWeight = FontWeight.Bold),
            color = colors.inkSoft,
        )
    }
}

@Composable
private fun LoopToggle(playback: RoutinePlaybackEngine) {
    val colors = RsmTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    val on = playback.loopOn
    Row(
        modifier = Modifier
            .rsmPressable(interactionSource)
            .clip(CircleShape)
            .background(if (on) colors.honeySoft else colors.bgSunken)
            .border(
                width = 1.dp,
                color = if (on) colors.honeyDeep.copy(alpha = 0.3f) else colors.lineStrong,
                shape = CircleShape,
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                role = Role.Switch,
                onClickLabel = stringResource(R.string.routines_player_a11y_loop_toggle),
                onClick = playback::toggleLoop,
            )
            .heightIn(min = RsmSize.touchTarget)
            .padding(horizontal = RsmSpacing.s3),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Icons.Filled.Repeat,
            contentDescription = null,
            tint = if (on) colors.honeyDeep else colors.inkFaint,
            modifier = Modifier.size(16.dp),
        )
        Text(
            text = stringResource(
                if (on) R.string.routines_player_loop_on else R.string.routines_player_loop_off,
            ),
            style = RsmTypography.caption.copy(fontSize = 13.sp, fontWeight = FontWeight.ExtraBold),
            color = if (on) colors.honeyDeep else colors.inkFaint,
        )
    }
}
