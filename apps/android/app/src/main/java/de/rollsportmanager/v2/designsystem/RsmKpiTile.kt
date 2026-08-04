package de.rollsportmanager.v2.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.semantics
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import de.rollsportmanager.v2.ui.theme.TABULAR_NUMS

/**
 * KPI-Kachel: Eyebrow → große Display-Zahl → Klartext-Caption.
 * Display-Schrift ist den KPI-Zahlen vorbehalten — nie Fließtext.
 * Zahlen laufen tabular (`tnum`), Pflicht für Beträge/Quoten.
 * Kachel-Look: `radius.l` (16) auf `bg.canvas` — Kachel IN einer Karte.
 */
@Composable
fun RsmKpiTile(
    eyebrow: String,
    /** Bereits formatierter Wert („24“, „381,00 €“) — Formatierung macht der Screen. */
    value: String,
    modifier: Modifier = Modifier,
    caption: String? = null,
    /** Akzent für den Wert, z. B. `RsmTheme.colors.danger` bei Überfälligem. */
    valueColor: Color = Color.Unspecified,
) {
    val colors = RsmTheme.colors
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(RsmRadius.l))
            .background(colors.bgCanvas)
            .padding(RsmSpacing.s4)
            .semantics(mergeDescendants = true) {},
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
    ) {
        Text(
            text = eyebrow.uppercase(),
            style = RsmTypography.eyebrow,
            color = colors.inkFaint,
        )
        Text(
            text = value,
            style = RsmTypography.display.copy(fontFeatureSettings = TABULAR_NUMS),
            color = if (valueColor == Color.Unspecified) colors.inkPrimary else valueColor,
        )
        if (caption != null) {
            Text(
                text = caption,
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
        }
    }
}
