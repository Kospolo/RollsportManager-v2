package de.rollsportmanager.v2.designsystem

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import de.rollsportmanager.v2.ui.theme.RsmMotion
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Druck-Feedback: scale 0.98 (Token `motion.press`).
 * Systemweite Animations-Abschaltung (Entwickleroptionen/Bedienungshilfen)
 * greift automatisch über die Compose-Animations-Infrastruktur.
 */
@Composable
fun Modifier.rsmPressable(interactionSource: MutableInteractionSource): Modifier {
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) RsmMotion.pressScale else 1f,
        animationSpec = tween(durationMillis = RsmMotion.fastMs),
        label = "rsmPress",
    )
    return graphicsLayer {
        scaleX = scale
        scaleY = scale
        alpha = if (pressed) 0.9f else 1f
    }
}

/**
 * Primär-Button „Beere = Handlung“: Pill-Form, min. 44 dp Touch-Ziel,
 * Text in `brandContrast` (Light: Weiß, Dark: dunkles Espresso — Signatur).
 * Regel: genau EINE Beere-Primäraktion pro Sichtbereich.
 */
@Composable
fun RsmPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    fillWidth: Boolean = true,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val colors = RsmTheme.colors
    Button(
        onClick = onClick,
        enabled = !isLoading,
        shape = CircleShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = colors.brand,
            contentColor = colors.brandContrast,
            disabledContainerColor = colors.brand.copy(alpha = 0.45f),
            disabledContentColor = colors.brandContrast,
        ),
        interactionSource = interactionSource,
        modifier = modifier
            .then(if (fillWidth) Modifier.fillMaxWidth() else Modifier)
            .heightIn(min = RsmSize.touchTarget)
            .rsmPressable(interactionSource),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    color = colors.brandContrast,
                    strokeWidth = 2.dp,
                )
            }
            Text(text = text, style = RsmTypography.bodyStrong)
        }
    }
}

/** Sekundär-Button: brand-soft-Tint mit brand-ink-Text (naheliegende Zweitaktion). */
@Composable
fun RsmSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    fillWidth: Boolean = true,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val colors = RsmTheme.colors
    Button(
        onClick = onClick,
        shape = CircleShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = colors.brandSoft,
            contentColor = colors.brandInk,
        ),
        interactionSource = interactionSource,
        modifier = modifier
            .then(if (fillWidth) Modifier.fillMaxWidth() else Modifier)
            .heightIn(min = RsmSize.touchTarget)
            .rsmPressable(interactionSource),
    ) {
        Text(text = text, style = RsmTypography.bodyStrong)
    }
}
