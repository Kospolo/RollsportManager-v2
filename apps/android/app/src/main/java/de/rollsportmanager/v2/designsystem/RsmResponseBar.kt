package de.rollsportmanager.v2.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import de.rollsportmanager.v2.ui.theme.RsmTheme

/**
 * Gestapelter Antwort-Balken (6 dp): Zusagen (success) · Absagen (danger) ·
 * offen (line-strong). REIN visuell — der Balken hat keine Semantik,
 * die Information trägt IMMER die Klartext-Zeile daneben
 * („9 Zusagen · 1 Absage · 4 offen“).
 */
@Composable
fun RsmResponseBar(
    going: Int,
    declined: Int,
    open: Int,
    modifier: Modifier = Modifier,
) {
    val colors = RsmTheme.colors
    val total = maxOf(going + declined + open, 1)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(6.dp)
            .clip(CircleShape)
            .clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Segment(going, total, colors.success)
        Segment(declined, total, colors.danger)
        Segment(open, total, colors.lineStrong)
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.Segment(
    count: Int,
    total: Int,
    color: Color,
) {
    if (count > 0) {
        Box(
            modifier = Modifier
                .weight(count.toFloat() / total)
                .fillMaxHeight()
                .background(color),
        )
    }
}
