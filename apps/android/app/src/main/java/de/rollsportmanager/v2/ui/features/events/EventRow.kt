package de.rollsportmanager.v2.ui.features.events

import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import de.rollsportmanager.contracts.Event
import de.rollsportmanager.contracts.Team
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmResponseBar
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.designsystem.rsmPressable
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import de.rollsportmanager.v2.ui.theme.TABULAR_NUMS
import java.util.Locale

/**
 * Termin-Zeile der Tagesliste: Zeitspalte · Titel + Typ-Pill · Ort ·
 * Team-Pills · ResponseBar mit Klartext-Zählung · Chevron.
 * (Spiegel von iOS EventRowView.swift.)
 */
@Composable
internal fun EventRow(
    event: Event,
    counts: EventResponseCounts,
    /** Aufgelöste Teams des Termins (können leer sein, solange Teams laden). */
    teams: List<Team>,
    onClick: () -> Unit,
) {
    val colors = RsmTheme.colors
    val locale = Locale.getDefault()
    val interactionSource = remember { MutableInteractionSource() }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .rsmPressable(interactionSource)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClickLabel = stringResource(R.string.events_row_a11y_hint),
                onClick = onClick,
            )
            .heightIn(min = RsmSize.listRow)
            .padding(RsmSpacing.s4),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        // Zeitspalte (tabular — Zeiten stehen bündig untereinander).
        Column(
            modifier = Modifier.width(RsmSpacing.s10),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            Text(
                text = EventsDisplay.time(event.startsAt, locale),
                style = RsmTypography.bodyStrong.copy(fontFeatureSettings = TABULAR_NUMS),
                color = colors.inkPrimary,
                maxLines = 1,
            )
            Text(
                text = EventsDisplay.time(event.endsAt, locale),
                style = RsmTypography.caption.copy(fontFeatureSettings = TABULAR_NUMS),
                color = colors.inkFaint,
                maxLines = 1,
            )
        }

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = event.title,
                    style = RsmTypography.bodyStrong,
                    color = colors.inkPrimary,
                    modifier = Modifier.weight(1f),
                )
                RsmStatusPill(
                    text = stringResource(EventsDisplay.typeLabelRes(event.type)),
                    kind = EventsDisplay.typePillKind(event.type),
                )
            }

            val location = event.location
            if (!location.isNullOrEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Filled.Place,
                        contentDescription = null,
                        tint = colors.inkFaint,
                        modifier = Modifier.size(RsmSpacing.s3),
                    )
                    Text(
                        text = location,
                        style = RsmTypography.caption,
                        color = colors.inkSoft,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            if (teams.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
                    teams.take(2).forEach { team ->
                        RsmStatusPill(text = team.name, kind = RsmStatusKind.NEUTRAL)
                    }
                    if (teams.size > 2) {
                        RsmStatusPill(
                            text = stringResource(R.string.events_teams_more, teams.size - 2),
                            kind = RsmStatusKind.NEUTRAL,
                        )
                    }
                }
            }

            // 6-dp-Balken (rein visuell, a11y-frei) + Klartext-Zeile darunter —
            // „Vielleicht“ zählt im Balken zum offenen Rest, der Text schlüsselt auf.
            Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
                RsmResponseBar(
                    going = counts.going,
                    declined = counts.declined,
                    open = counts.open + counts.maybe,
                )
                Text(
                    text = eventCountsText(counts),
                    style = RsmTypography.caption,
                    color = colors.inkSoft,
                )
            }
        }

        Icon(
            imageVector = Icons.Filled.ChevronRight,
            contentDescription = null,
            tint = colors.inkFaint,
            modifier = Modifier
                .padding(top = RsmSpacing.s1)
                .size(RsmSpacing.s4),
        )
    }
}

/**
 * Klartext-Zeile zum ResponseBar — trägt die Information (der Balken selbst
 * ist semantikfrei): „3 Zusagen · 1 Absage · 2 offen“; „Vielleicht“ nur > 0.
 */
@Composable
internal fun eventCountsText(counts: EventResponseCounts): String {
    val parts = mutableListOf(
        pluralStringResource(R.plurals.events_counts_going, counts.going, counts.going),
        pluralStringResource(R.plurals.events_counts_declined, counts.declined, counts.declined),
    )
    if (counts.maybe > 0) {
        parts += pluralStringResource(R.plurals.events_counts_maybe, counts.maybe, counts.maybe)
    }
    parts += pluralStringResource(R.plurals.events_counts_open, counts.open, counts.open)
    return parts.joinToString(" · ")
}
