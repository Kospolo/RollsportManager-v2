package de.rollsportmanager.v2.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.ui.theme.RsmColors
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Farbwelt eines Status-Chips: Tint-Hintergrund + dunkler Text.
 * Regel „Status nie nur über Farbe“: der Chip trägt IMMER ein Wort.
 */
enum class RsmStatusKind {
    NEUTRAL, BRAND, INFO, SUCCESS, WARN, DANGER,

    /** Honig ist EXKLUSIV für Musik/Küren — nie im Mahnwesen verwenden. */
    HONEY;

    fun background(colors: RsmColors): Color = when (this) {
        NEUTRAL -> colors.bgSunken
        BRAND -> colors.brandSoft
        INFO -> colors.infoSoft
        SUCCESS -> colors.successSoft
        WARN -> colors.warnSoft
        DANGER -> colors.dangerSoft
        HONEY -> colors.honeySoft
    }

    fun foreground(colors: RsmColors): Color = when (this) {
        NEUTRAL -> colors.inkSoft
        BRAND -> colors.brandInk
        INFO -> colors.info
        SUCCESS -> colors.success
        WARN -> colors.warn
        DANGER -> colors.danger
        HONEY -> colors.honeyDeep
    }
}

/** Pill-Chip mit Wort + Tint — Grundbaustein für Status, Rollen, Mahnstufen. */
@Composable
fun RsmStatusPill(
    text: String,
    modifier: Modifier = Modifier,
    kind: RsmStatusKind = RsmStatusKind.NEUTRAL,
) {
    val colors = RsmTheme.colors
    Text(
        text = text,
        style = RsmTypography.caption.copy(fontWeight = FontWeight.SemiBold),
        color = kind.foreground(colors),
        modifier = modifier
            .clip(CircleShape)
            .background(kind.background(colors))
            .padding(horizontal = RsmSpacing.s3, vertical = RsmSpacing.s1),
    )
}

/**
 * Mahnstufen-Ampel (vierstufige Treppe, Design-System §3.6):
 * 0 Offen (neutral) → 1 Erinnerung (Info/Petrol, NICHT Honig) →
 * 2 1. Mahnung (warn) → 3+ 2. Mahnung/Übergabe (danger).
 * Eskalationsfarbe nur am Badge — nie ganze Zeilen einfärben.
 */
@Composable
fun RsmDunningPill(level: Int, modifier: Modifier = Modifier) {
    val (textRes, kind) = when {
        level < 1 -> R.string.rsm_status_dunning_0 to RsmStatusKind.NEUTRAL
        level == 1 -> R.string.rsm_status_dunning_1 to RsmStatusKind.INFO
        level == 2 -> R.string.rsm_status_dunning_2 to RsmStatusKind.WARN
        else -> R.string.rsm_status_dunning_3 to RsmStatusKind.DANGER
    }
    RsmStatusPill(text = stringResource(textRes), kind = kind, modifier = modifier)
}
