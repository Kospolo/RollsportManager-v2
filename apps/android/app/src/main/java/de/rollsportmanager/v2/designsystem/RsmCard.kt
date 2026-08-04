package de.rollsportmanager.v2.designsystem

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Standard-Karte im Heimspiel-Look: Surface-Fläche, Hairline-Rand,
 * Radius XL (20), dezenter warm getönter Schatten (Dark trägt der Rand).
 *
 * Struktur laut Design-System: Eyebrow → H3-Titel → Inhalt → max. EINE
 * Beere-Aktion. Eyebrow/Titel liefert [RsmSectionHeader].
 */
@Composable
fun RsmCard(
    modifier: Modifier = Modifier,
    padding: Dp = RsmSpacing.s5,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(RsmRadius.xl)
    val colors = RsmTheme.colors
    Column(
        modifier = modifier
            .fillMaxWidth()
            .shadow(
                elevation = 2.dp,
                shape = shape,
                // Warm getönt statt Schwarz — Espresso-Ton aus den Tokens.
                ambientColor = colors.inkPrimary,
                spotColor = colors.inkPrimary,
            )
            .clip(shape)
            .background(colors.bgSurface)
            .border(BorderStroke(1.dp, colors.line), shape)
            .padding(padding),
        content = content,
    )
}

/**
 * Karten-/Sektionskopf: Eyebrow (11 sp, VERSALIEN, Laufweite) über
 * H3-Titel in Menschensprache („Wer noch offen ist“, nicht „Debitoren“).
 */
@Composable
fun RsmSectionHeader(
    eyebrow: String,
    title: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.semantics(mergeDescendants = true) {},
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
    ) {
        Text(
            text = eyebrow.uppercase(),
            style = RsmTypography.eyebrow,
            color = RsmTheme.colors.inkFaint,
        )
        Text(
            text = title,
            style = RsmTypography.h3,
            color = RsmTheme.colors.inkPrimary,
        )
    }
}
