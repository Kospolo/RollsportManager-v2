package de.rollsportmanager.v2.ui.features.routines

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.rsmPressable
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import java.text.NumberFormat
import kotlin.math.roundToInt

/**
 * Tempo-Bereich des Trainings-Players (DESIGN-SYSTEM §3.8, „Tempo aus B"):
 * Preset-Pills 50/75/85/100 % PLUS Feinregler 0,5–2,0× — bidirektional
 * synchron (Pill ↔ Slider ↔ Anzeige), immer mit dynamischer Klartext-Folge
 * („bei 85 % läuft die Kür 2:56 statt 2:30 · Tonhöhe bleibt erhalten").
 */
@Composable
internal fun RoutinePlayerTempoControl(playback: RoutinePlaybackEngine) {
    val colors = RsmTheme.colors
    val tempoInt = playback.tempoPercent.roundToInt()

    Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
        HorizontalDivider(color = colors.line, thickness = 1.dp)

        Text(
            text = stringResource(R.string.routines_player_tempo_eyebrow).uppercase(),
            style = RsmTypography.eyebrow,
            color = colors.inkFaint,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2)) {
            TEMPO_PRESETS.forEach { preset ->
                TempoPresetPill(
                    preset = preset,
                    active = tempoInt == preset,
                    onClick = { playback.setTempo(preset.toDouble()) },
                )
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        ) {
            val sliderA11y = stringResource(R.string.routines_player_a11y_tempo_slider)
            Slider(
                value = playback.tempoPercent.toFloat(),
                onValueChange = { playback.setTempo(it.toDouble()) },
                valueRange = 50f..200f,
                steps = 29, // 5-%-Raster wie iOS/Web
                colors = SliderDefaults.colors(
                    thumbColor = colors.brand,
                    activeTrackColor = colors.brand,
                    inactiveTrackColor = colors.bgSunken,
                ),
                modifier = Modifier
                    .weight(1f)
                    .semantics { contentDescription = sliderA11y },
            )
            Text(
                text = factorText(playback.tempoPercent),
                style = RsmTypography.monoTable.copy(
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                ),
                color = colors.inkSoft,
            )
        }

        // Klartext-Folge — IMMER dynamisch aus Tempo und Kürlänge berechnet.
        Text(
            text = if (tempoInt == 100) {
                stringResource(
                    R.string.routines_player_tempo_note_original,
                    RoutineFormat.mmss(playback.durationMs),
                )
            } else {
                stringResource(
                    R.string.routines_player_tempo_note,
                    tempoInt,
                    RoutineFormat.mmss(playback.durationMs * 100.0 / tempoInt),
                    RoutineFormat.mmss(playback.durationMs),
                )
            },
            style = RsmTypography.caption,
            color = colors.inkSoft,
        )
    }
}

@Composable
private fun TempoPresetPill(preset: Int, active: Boolean, onClick: () -> Unit) {
    val colors = RsmTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    Box(
        modifier = Modifier
            .rsmPressable(interactionSource)
            .heightIn(min = RsmSize.touchTarget)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                role = Role.Button,
                onClickLabel = stringResource(R.string.routines_player_a11y_tempo_preset, preset),
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .background(
                    color = if (active) colors.brand else colors.bgSurface,
                    shape = CircleShape,
                )
                .border(
                    width = 1.dp,
                    color = if (active) colors.brand else colors.lineStrong,
                    shape = CircleShape,
                )
                .padding(horizontal = RsmSpacing.s3, vertical = RsmSpacing.s2),
            contentAlignment = Alignment.Center,
        ) {
            //   = schmales geschütztes Leerzeichen vor % (wie iOS).
            Text(
                text = "$preset %",
                style = RsmTypography.caption.copy(
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.Bold,
                ),
                color = if (active) colors.brandContrast else colors.inkSoft,
            )
        }
    }
}

/** "0,85×" — Faktor-Anzeige neben dem Slider (lokalisiertes Dezimaltrennzeichen). */
private fun factorText(tempoPercent: Double): String {
    val formatter = NumberFormat.getNumberInstance().apply {
        minimumFractionDigits = 2
        maximumFractionDigits = 2
    }
    return "${formatter.format(tempoPercent / 100.0)}×"
}

private val TEMPO_PRESETS = listOf(50, 75, 85, 100)
