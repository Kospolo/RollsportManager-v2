package de.rollsportmanager.v2.features.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.Competition
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmAvatar
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import de.rollsportmanager.v2.ui.theme.TABULAR_NUMS

/**
 * Wettkampf-Countdown-Hero (Design-System §3.9): brand-soft-Tint,
 * Display-Zahl, Klartext-Meta — KEIN Gradient, KEINE Animation.
 * Spiegel von iOS DashboardCountdownCard.swift.
 */
@Composable
fun DashboardCountdownCard(
    competition: Competition,
    /** Kalendertage bis zum Start (0 = heute). */
    days: Int,
    /** Gemeldete Mitglieder (nicht zurückgezogen) für den Avatar-Stack. */
    entrants: List<ClubMember>,
) {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(RsmRadius.xl))
            .background(colors.brandSoft)
            .padding(RsmSpacing.s5)
            .semantics(mergeDescendants = true) {},
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4),
    ) {
        Text(
            text = stringResource(R.string.dashboard_countdown_eyebrow).uppercase(),
            style = RsmTypography.eyebrow,
            color = colors.brandInk,
        )

        // „12 | Tage bis zum Start" — bzw. „Heute ist Wettkampftag!".
        if (days == 0) {
            Text(
                text = stringResource(R.string.dashboard_countdown_today),
                style = RsmTypography.display,
                color = colors.brandInk,
            )
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2)) {
                Text(
                    text = days.toString(),
                    style = RsmTypography.display.copy(
                        fontSize = 44.sp,
                        lineHeight = 48.sp,
                        fontFeatureSettings = TABULAR_NUMS,
                    ),
                    color = colors.brandInk,
                    modifier = Modifier.alignByBaseline(),
                )
                Text(
                    text = pluralStringResource(R.plurals.dashboard_countdown_unit, days),
                    style = RsmTypography.h3,
                    color = colors.inkPrimary,
                    modifier = Modifier.alignByBaseline(),
                )
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
            Text(
                text = competition.name,
                style = RsmTypography.h3,
                color = colors.inkPrimary,
            )
            Text(
                text = metaLine(competition),
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
        }

        if (entrants.isNotEmpty()) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                DashboardAvatarStack(members = entrants, ringColor = colors.brandSoft)
                // Die Klartext-Zeile trägt die Information — der Stack
                // ist rein visuell (clearAndSetSemantics).
                Text(
                    text = stringResource(R.string.dashboard_countdown_entrants, entrants.size),
                    style = RsmTypography.caption,
                    color = colors.inkSoft,
                )
            }
        }
    }
}

/** „Sa. 19.7. · 08:30 · Ludwigsburg" — Klartext-Meta unter dem Titel. */
private fun metaLine(competition: Competition): String {
    val parts = mutableListOf<String>()
    DashboardFormat.parseIso(competition.startsAt)?.let { start ->
        parts.add("${DashboardFormat.weekdayShortText(start)} ${DashboardFormat.dayMonthText(start)}")
        parts.add(DashboardFormat.timeText(start))
    }
    competition.location?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
    return parts.joinToString(" · ")
}

/**
 * Überlappende Avatar-Reihe mit „+n"-Überlauf — rein dekorativ,
 * die Information trägt immer eine Klartext-Zeile daneben.
 */
@Composable
fun DashboardAvatarStack(
    members: List<ClubMember>,
    modifier: Modifier = Modifier,
    ringColor: Color = RsmTheme.colors.bgSurface,
    maxVisible: Int = 5,
    size: Dp = 28.dp,
) {
    val colors = RsmTheme.colors
    Row(
        modifier = modifier.clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(-(size * 0.3f)),
    ) {
        members.take(maxVisible).forEach { member ->
            RsmAvatar(
                name = "${member.firstName} ${member.lastName}",
                personId = member.id,
                size = size,
                modifier = Modifier.border(2.dp, ringColor, CircleShape),
            )
        }
        if (members.size > maxVisible) {
            Box(
                modifier = Modifier
                    .size(size)
                    .clip(CircleShape)
                    .background(colors.bgSunken)
                    .border(2.dp, ringColor, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "+${members.size - maxVisible}",
                    style = RsmTypography.body.copy(
                        fontSize = (size.value * 0.38f).sp,
                        fontWeight = FontWeight.Bold,
                    ),
                    color = colors.inkSoft,
                )
            }
        }
    }
}
