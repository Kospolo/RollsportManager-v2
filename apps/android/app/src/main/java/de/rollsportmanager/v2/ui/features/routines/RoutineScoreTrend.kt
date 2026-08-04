package de.rollsportmanager.v2.ui.features.routines

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.rollsportmanager.contracts.RoutineScore
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import java.time.LocalDate

/**
 * RollArt-Verlauf (DESIGN-SYSTEM §3.9): einfaches Liniendiagramm per Canvas
 * über die Gesamtwertungen, Mono-Werte an den Punkten, Delta-Chip — der
 * Trend ist der motivierende Wert, nicht die Einzelzahl. Beere = Verlauf
 * (kein Honig: Wertungen sind kein Musik-Kontext).
 */
@Composable
internal fun RoutineScoreTrendCard(
    scores: List<RoutineScore>,
    competitionNames: Map<String, String>,
) {
    val colors = RsmTheme.colors
    val trainingLabel = stringResource(R.string.routines_scores_training)
    val competitionFallback = stringResource(R.string.routines_scores_competition_fallback)

    val points = remember(scores, competitionNames, trainingLabel, competitionFallback) {
        val best = scores.mapNotNull { it.totalScore }.maxOrNull()
        scores.mapNotNull { score ->
            val total = score.totalScore ?: return@mapNotNull null
            val date = RoutineFormat.scoredOnDate(score.scoredOn) ?: return@mapNotNull null
            ScorePoint(
                id = score.id,
                date = date,
                total = total,
                technical = score.technicalScore,
                components = score.componentsScore,
                eventName = score.competitionId
                    ?.let { competitionNames[it] ?: competitionFallback }
                    ?: trainingLabel,
                isBest = total == best,
            )
        }
    }

    RsmCard {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4)) {
            RsmSectionHeader(
                eyebrow = stringResource(R.string.routines_scores_eyebrow),
                title = stringResource(R.string.routines_scores_title),
            )
            if (points.isEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(vertical = RsmSpacing.s3),
                ) {
                    Icon(
                        imageVector = Icons.Filled.AutoAwesome,
                        contentDescription = null,
                        tint = colors.inkFaint,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(
                        text = stringResource(R.string.routines_scores_empty),
                        style = RsmTypography.body,
                        color = colors.inkSoft,
                    )
                }
            } else {
                TrendChart(points)
                ScoreRows(points)
                LastRunBreakdown(points)
                HorizontalDivider(color = colors.line, thickness = 1.dp)
                TrendFooter(points)
            }
        }
    }
}

private data class ScorePoint(
    val id: String,
    val date: LocalDate,
    val total: Double,
    val technical: Double?,
    val components: Double?,
    val eventName: String,
    val isBest: Boolean,
)

// --- Liniendiagramm (Canvas) ------------------------------------------------------

@Composable
private fun TrendChart(points: List<ScorePoint>) {
    val colors = RsmTheme.colors
    val textMeasurer = rememberTextMeasurer()
    val valueStyle = RsmTypography.monoTable.copy(color = colors.inkPrimary)
    val axisStyle = RsmTypography.caption.copy(color = colors.inkFaint)

    val totals = points.map { it.total }
    val chartA11y = stringResource(
        R.string.routines_scores_a11y_chart,
        totals.joinToString(" → ") { RoutineFormat.points(it) },
    )

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(190.dp)
            .semantics { contentDescription = chartA11y },
    ) {
        val padTop = 28.dp.toPx()
        val padBottom = 22.dp.toPx()
        val padH = 16.dp.toPx()
        val plotWidth = size.width - padH * 2
        val plotHeight = size.height - padTop - padBottom

        val lower = (totals.min()) - 2.0
        val upper = (totals.max()) + 2.0
        fun yFor(value: Double): Float =
            padTop + (((upper - value) / (upper - lower)).toFloat() * plotHeight)

        val minDay = points.first().date.toEpochDay()
        val maxDay = points.last().date.toEpochDay()
        fun xFor(date: LocalDate): Float =
            if (maxDay == minDay) {
                padH + plotWidth / 2
            } else {
                padH + ((date.toEpochDay() - minDay).toFloat() / (maxDay - minDay)) * plotWidth
            }

        // Hairline-Gitter (unten / Mitte / oben).
        listOf(lower, (lower + upper) / 2, upper).forEach { value ->
            drawLine(
                color = colors.line,
                start = Offset(padH, yFor(value)),
                end = Offset(size.width - padH, yFor(value)),
                strokeWidth = 1.dp.toPx(),
            )
        }

        // Verlaufslinie in Beere.
        val path = Path()
        points.forEachIndexed { index, point ->
            val x = xFor(point.date)
            val y = yFor(point.total)
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(
            path = path,
            color = colors.brand,
            style = Stroke(
                width = 2.5.dp.toPx(),
                cap = StrokeCap.Round,
                join = StrokeJoin.Round,
            ),
        )

        // Punkte + Mono-Werte + Monatslabels.
        points.forEach { point ->
            val x = xFor(point.date)
            val y = yFor(point.total)
            drawCircle(
                color = colors.brand,
                radius = if (point.isBest) 6.dp.toPx() else 4.5.dp.toPx(),
                center = Offset(x, y),
            )
            val valueLayout =
                textMeasurer.measure(AnnotatedString(RoutineFormat.points(point.total)), valueStyle)
            drawText(
                textLayoutResult = valueLayout,
                topLeft = Offset(
                    x = (x - valueLayout.size.width / 2f)
                        .coerceIn(0f, (size.width - valueLayout.size.width).coerceAtLeast(0f)),
                    y = (y - valueLayout.size.height - 8.dp.toPx()).coerceAtLeast(0f),
                ),
            )
            val monthLayout =
                textMeasurer.measure(AnnotatedString(RoutineFormat.monthYear(point.date)), axisStyle)
            drawText(
                textLayoutResult = monthLayout,
                topLeft = Offset(
                    x = (x - monthLayout.size.width / 2f)
                        .coerceIn(0f, (size.width - monthLayout.size.width).coerceAtLeast(0f)),
                    y = size.height - monthLayout.size.height,
                ),
            )
        }
    }
}

// --- Zeilen unter dem Chart: Wettkampf · Monat — Wert (Mono) -----------------------

@Composable
private fun ScoreRows(points: List<ScorePoint>) {
    val colors = RsmTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2)) {
        points.forEach { point ->
            Row(
                horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = point.eventName,
                    style = RsmTypography.caption,
                    color = colors.inkPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Text(
                    text = RoutineFormat.monthYear(point.date),
                    style = RsmTypography.caption,
                    color = colors.inkFaint,
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = RoutineFormat.points(point.total),
                    style = RsmTypography.monoTable,
                    color = if (point.isBest) colors.brandInk else colors.inkPrimary,
                )
            }
        }
    }
}

// --- Technik/Komponenten des letzten Laufs als Klartext ----------------------------

@Composable
private fun LastRunBreakdown(points: List<ScorePoint>) {
    val colors = RsmTheme.colors
    val last = points.lastOrNull() ?: return
    val technical = last.technical ?: return
    val components = last.components ?: return
    Text(
        text = stringResource(R.string.routines_scores_technical, RoutineFormat.points(technical)) +
            " · " +
            stringResource(R.string.routines_scores_components, RoutineFormat.points(components)),
        style = RsmTypography.caption,
        color = colors.inkSoft,
    )
}

// --- Fußzeile: Delta seit der ersten Wertung + Bestwert ----------------------------

@Composable
private fun TrendFooter(points: List<ScorePoint>) {
    val colors = RsmTheme.colors
    val totals = points.map { it.total }
    Row(
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (totals.size > 1) {
            RoutineDeltaChip(delta = totals.last() - totals.first())
            Text(
                text = stringResource(R.string.routines_scores_since_first),
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
        } else {
            RsmStatusPill(
                text = stringResource(R.string.routines_scores_first),
                kind = RsmStatusKind.NEUTRAL,
            )
        }
        Spacer(modifier = Modifier.weight(1f))
        totals.maxOrNull()?.let { best ->
            Text(
                text = stringResource(R.string.routines_scores_best, RoutineFormat.points(best)),
                style = RsmTypography.caption,
                color = colors.inkFaint,
            )
        }
    }
}
