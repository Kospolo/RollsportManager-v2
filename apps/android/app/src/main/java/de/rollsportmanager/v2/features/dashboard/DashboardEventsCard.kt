package de.rollsportmanager.v2.features.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.rollsportmanager.contracts.Event
import de.rollsportmanager.contracts.EventType
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmEmptyState
import de.rollsportmanager.v2.designsystem.RsmResponseBar
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import de.rollsportmanager.v2.ui.theme.TABULAR_NUMS
import java.time.LocalDate
import java.time.ZonedDateTime

private const val MAX_ROWS = 5

/**
 * „Heute & demnächst": die nächsten Termine mit Antwort-Balken und
 * Klartext-Zeile („5 zugesagt · 1 abgesagt · 3 offen") — Spiegel von
 * iOS DashboardEventsCard.swift.
 */
@Composable
fun DashboardEventsCard(data: DashboardData) {
    val colors = RsmTheme.colors
    RsmCard {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4)) {
            RsmSectionHeader(
                eyebrow = stringResource(R.string.dashboard_events_eyebrow),
                title = stringResource(R.string.dashboard_events_title),
            )
            if (data.upcomingEvents.isEmpty()) {
                RsmEmptyState(
                    icon = Icons.Filled.CalendarMonth,
                    title = stringResource(R.string.dashboard_events_empty_title),
                    message = stringResource(R.string.dashboard_events_empty_message),
                )
            } else {
                Column {
                    data.upcomingEvents.take(MAX_ROWS).forEachIndexed { index, event ->
                        if (index > 0) {
                            HorizontalDivider(thickness = 1.dp, color = colors.line)
                        }
                        EventRow(event = event, summary = data.responseSummary(event))
                    }
                }
                if (data.upcomingEvents.size > MAX_ROWS) {
                    Text(
                        text = stringResource(
                            R.string.dashboard_events_more,
                            data.upcomingEvents.size - MAX_ROWS,
                        ),
                        style = RsmTypography.caption,
                        color = colors.inkFaint,
                    )
                }
            }
        }
    }
}

// --- Zeile ---------------------------------------------------------------------

@Composable
private fun EventRow(event: Event, summary: DashboardResponseSummary) {
    val colors = RsmTheme.colors
    val start = DashboardFormat.parseIso(event.startsAt)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = RsmSize.listRow)
            .padding(vertical = RsmSpacing.s3)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        DateBadge(start)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = event.title,
                    style = RsmTypography.bodyStrong,
                    color = colors.inkPrimary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (event.type == EventType.COMPETITION) {
                    RsmStatusPill(
                        text = stringResource(R.string.dashboard_events_type_competition),
                        kind = RsmStatusKind.BRAND,
                    )
                }
            }
            metaLine(event, start)?.let { meta ->
                Text(
                    text = meta,
                    style = RsmTypography.caption,
                    color = colors.inkSoft,
                )
            }
            RsmResponseBar(
                going = summary.going,
                declined = summary.declined,
                open = summary.open,
                modifier = Modifier.padding(top = RsmSpacing.s1),
            )
            Text(
                text = stringResource(
                    R.string.dashboard_events_responses,
                    summary.going,
                    summary.declined,
                    summary.open,
                ),
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
        }
    }
}

/**
 * Datums-Spalte links: Wochentag über Tag.Monat; „Heute" hebt sich
 * per brand-soft-Mulde ab.
 */
@Composable
private fun DateBadge(start: ZonedDateTime?) {
    val colors = RsmTheme.colors
    val isToday = start?.toLocalDate() == LocalDate.now()
    Column(
        modifier = Modifier
            .width(56.dp)
            .clip(RoundedCornerShape(RsmRadius.m))
            .background(if (isToday) colors.brandSoft else colors.bgSunken)
            .padding(vertical = RsmSpacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (start != null) {
            if (isToday) {
                Text(
                    text = stringResource(R.string.dashboard_date_today),
                    style = RsmTypography.caption.copy(fontWeight = FontWeight.Bold),
                    color = colors.brandInk,
                )
            } else {
                Text(
                    text = DashboardFormat.weekdayShortText(start),
                    style = RsmTypography.caption,
                    color = colors.inkFaint,
                )
            }
            Text(
                text = DashboardFormat.dayMonthText(start),
                style = RsmTypography.bodyStrong.copy(fontFeatureSettings = TABULAR_NUMS),
                color = if (isToday) colors.brandInk else colors.inkPrimary,
            )
        } else {
            Text(
                text = "–",
                style = RsmTypography.bodyStrong,
                color = colors.inkFaint,
            )
        }
    }
}

/** „17:00 · Rollhalle Neckarsulm" */
private fun metaLine(event: Event, start: ZonedDateTime?): String? {
    val parts = mutableListOf<String>()
    start?.let { parts.add(DashboardFormat.timeText(it)) }
    event.location?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
    return if (parts.isEmpty()) null else parts.joinToString(" · ")
}
