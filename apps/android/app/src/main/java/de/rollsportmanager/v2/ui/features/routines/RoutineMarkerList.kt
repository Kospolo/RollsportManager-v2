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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.rollsportmanager.contracts.RoutineMarker
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.designsystem.rsmPressable
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Zeitmarken-Liste (DESIGN-SYSTEM §3.8): Mono-Zeit-Badge in Honig,
 * Elementname + RollArt-Kürzel-Chip, Tap = „ab hier abspielen".
 * Marker innerhalb des aktiven A–B-Loops tragen den Honig-Chip „im Loop".
 */
@Composable
internal fun RoutineMarkerListCard(
    markers: List<RoutineMarker>,
    loopOn: Boolean,
    loopAMs: Double,
    loopBMs: Double,
    onJump: (Double) -> Unit,
) {
    val colors = RsmTheme.colors
    RsmCard {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
            RsmSectionHeader(
                eyebrow = stringResource(R.string.routines_markers_eyebrow),
                title = stringResource(R.string.routines_markers_title),
            )
            if (markers.isEmpty()) {
                Text(
                    text = stringResource(R.string.routines_markers_empty),
                    style = RsmTypography.body,
                    color = colors.inkSoft,
                )
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    markers.forEach { marker ->
                        MarkerRow(
                            marker = marker,
                            inLoop = loopOn &&
                                (marker.timeMs ?: 0L).toDouble() in loopAMs..loopBMs,
                            onJump = onJump,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MarkerRow(marker: RoutineMarker, inLoop: Boolean, onJump: (Double) -> Unit) {
    val colors = RsmTheme.colors
    val interactionSource = remember { MutableInteractionSource() }
    val timeMs = (marker.timeMs ?: 0L).toDouble()
    val time = RoutineFormat.mmss(timeMs)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .rsmPressable(interactionSource)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                role = Role.Button,
                onClickLabel = stringResource(
                    R.string.routines_markers_a11y_play_from, time, marker.label,
                ),
                onClick = { onJump(timeMs) },
            )
            .heightIn(min = RsmSize.listRow),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Zeit-Badge: Mono in Honig — Musik-Kontext.
        Text(
            text = time,
            style = RsmTypography.monoTable,
            color = colors.honeyDeep,
            modifier = Modifier
                .clip(RoundedCornerShape(RsmRadius.s))
                .background(colors.honeySoft)
                .padding(horizontal = RsmSpacing.s2, vertical = RsmSpacing.s1),
        )

        Row(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = marker.label,
                style = RsmTypography.bodyStrong,
                color = colors.inkPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f, fill = false),
            )
            marker.elementCode?.let { RoutineElementChip(code = it) }
            if (inLoop) {
                RsmStatusPill(
                    text = stringResource(R.string.routines_markers_in_loop),
                    kind = RsmStatusKind.HONEY,
                )
            }
        }

        Box(
            modifier = Modifier
                .size(34.dp)
                .border(1.dp, colors.line, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.PlayArrow,
                contentDescription = null,
                tint = colors.inkFaint,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}
