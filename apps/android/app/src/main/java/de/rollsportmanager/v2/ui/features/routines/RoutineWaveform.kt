package de.rollsportmanager.v2.ui.features.routines

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.ui.theme.RsmMotion
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Waveform aus den media_asset-Peaks (Signature-Komponente, §3.8):
 * Honig = Musik — gespielter Teil `honey`, ungespielter `waveOff`,
 * Playhead in Tinte, A–B-Region mit beschrifteten Griffen, 3-2-1 mittig.
 * Tippen/Ziehen springt in der Kür. Spiegel von RoutineWaveformView.swift.
 */
@Composable
internal fun RoutineWaveform(
    peaks: List<Double>,
    durationMs: Double,
    posMs: Double,
    loopAMs: Double,
    loopBMs: Double,
    loopOn: Boolean,
    countdownLeft: Int?,
    onSeek: (Double) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = RsmTheme.colors
    val textMeasurer = rememberTextMeasurer()
    val fraction = if (durationMs > 0) (posMs / durationMs).coerceIn(0.0, 1.0) else 0.0

    // Loop-Region blendet weich zwischen aktiv (1.0) und Vorschau (0.3).
    val loopAlpha by animateFloatAsState(
        targetValue = if (loopOn) 1f else 0.3f,
        animationSpec = tween(durationMillis = RsmMotion.fastMs),
        label = "waveLoopAlpha",
    )

    val a11yText = stringResource(R.string.routines_player_a11y_wave) + ", " +
        stringResource(
            R.string.routines_player_wave_value,
            RoutineFormat.mmss(posMs),
            RoutineFormat.mmss(durationMs),
        )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(132.dp)
            .pointerInput(durationMs) {
                detectTapGestures { offset ->
                    if (durationMs > 0 && size.width > 0) {
                        onSeek((offset.x / size.width).coerceIn(0f, 1f) * durationMs)
                    }
                }
            }
            .pointerInput(durationMs) {
                detectDragGestures(
                    onDragStart = { offset ->
                        if (durationMs > 0 && size.width > 0) {
                            onSeek((offset.x / size.width).coerceIn(0f, 1f) * durationMs)
                        }
                    },
                    onDrag = { change, _ ->
                        change.consume()
                        if (durationMs > 0 && size.width > 0) {
                            onSeek((change.position.x / size.width).coerceIn(0f, 1f) * durationMs)
                        }
                    },
                )
            }
            .semantics { contentDescription = a11yText },
    ) {
        val handleStyle = RsmTypography.monoTable.copy(
            fontSize = 10.5.sp,
            fontWeight = FontWeight.ExtraBold,
            color = colors.bgSurface,
        )

        Canvas(modifier = Modifier.fillMaxSize()) {
            // --- Balken: gespielt = Honig, Rest = waveOff -----------------------
            if (peaks.isNotEmpty()) {
                val gap = size.width / peaks.size
                val barWidth = gap * 0.62f
                val playedUntil = (peaks.size * fraction).toInt()
                peaks.forEachIndexed { index, peak ->
                    val barHeight =
                        (peak.coerceIn(0.09, 1.0) * (size.height - 18.dp.toPx())).toFloat()
                    drawRoundRect(
                        color = if (index <= playedUntil) colors.honey else colors.waveOff,
                        topLeft = Offset(
                            x = index * gap + (gap - barWidth) / 2,
                            y = (size.height - barHeight) / 2,
                        ),
                        size = Size(barWidth, barHeight),
                        cornerRadius = CornerRadius(barWidth / 2),
                    )
                }
            }

            // --- A–B-Loop-Region mit Griffen ------------------------------------
            if (durationMs > 0) {
                val left = (loopAMs / durationMs).toFloat() * size.width
                val regionWidth = maxOf(
                    6.dp.toPx(),
                    ((loopBMs - loopAMs).coerceAtLeast(0.0) / durationMs).toFloat() * size.width,
                )
                drawRoundRect(
                    color = colors.honey.copy(alpha = 0.15f * loopAlpha),
                    topLeft = Offset(left, 0f),
                    size = Size(regionWidth, size.height),
                    cornerRadius = CornerRadius(10.dp.toPx()),
                )
                val edgeWidth = 2.5.dp.toPx()
                drawRect(
                    color = colors.honeyDeep.copy(alpha = loopAlpha),
                    topLeft = Offset(left, 0f),
                    size = Size(edgeWidth, size.height),
                )
                drawRect(
                    color = colors.honeyDeep.copy(alpha = loopAlpha),
                    topLeft = Offset(left + regionWidth - edgeWidth, 0f),
                    size = Size(edgeWidth, size.height),
                )
                // Griffe A/B als kleine Honig-Chips an den Kanten.
                listOf("A" to left, "B" to (left + regionWidth)).forEach { (letter, centerX) ->
                    val layout = textMeasurer.measure(AnnotatedString(letter), handleStyle)
                    val chipWidth = layout.size.width + 12.dp.toPx()
                    val chipHeight = layout.size.height + 2.dp.toPx()
                    val chipLeft = (centerX - chipWidth / 2)
                        .coerceIn(0f, (size.width - chipWidth).coerceAtLeast(0f))
                    drawRoundRect(
                        color = colors.honeyDeep.copy(alpha = loopAlpha),
                        topLeft = Offset(chipLeft, 0f),
                        size = Size(chipWidth, chipHeight),
                        cornerRadius = CornerRadius(7.dp.toPx()),
                    )
                    drawText(
                        textLayoutResult = layout,
                        topLeft = Offset(chipLeft + 6.dp.toPx(), 1.dp.toPx()),
                    )
                }
            }

            // --- Playhead: Linie in Tinte + Knopf mit Surface-Ring ---------------
            val playheadX = (fraction * size.width).toFloat()
            drawRoundRect(
                color = colors.inkPrimary,
                topLeft = Offset(playheadX - 1.25.dp.toPx(), 0f),
                size = Size(2.5.dp.toPx(), size.height),
                cornerRadius = CornerRadius(2.dp.toPx()),
            )
            drawCircle(
                color = colors.inkPrimary,
                radius = 5.5.dp.toPx(),
                center = Offset(playheadX, 5.5.dp.toPx()),
            )
            drawCircle(
                color = colors.bgSurface,
                radius = 5.5.dp.toPx(),
                center = Offset(playheadX, 5.5.dp.toPx()),
                style = Stroke(width = 2.5.dp.toPx()),
            )
        }

        // --- Countdown 3-2-1 (visuell — die Zeitzeile spricht den Countdown) ----
        if (countdownLeft != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(64.dp)
                    .shadow(
                        elevation = 4.dp,
                        shape = CircleShape,
                        ambientColor = colors.inkPrimary,
                        spotColor = colors.inkPrimary,
                    )
                    .clip(CircleShape)
                    .background(colors.bgSurface.copy(alpha = 0.9f))
                    .border(1.dp, colors.line, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = countdownLeft.toString(),
                    style = RsmTypography.display.copy(
                        fontFamily = FontFamily.Monospace,
                        fontSize = 34.sp,
                    ),
                    color = colors.honeyDeep,
                )
            }
        }
    }
}
