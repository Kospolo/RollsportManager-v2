package de.rollsportmanager.v2.designsystem

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Leerer Zustand mit Handlung: Icon + ein Satz + optionaler CTA
 * („Noch keine Kür — Musik hochladen“). Nie ein leerer Screen ohne Weg.
 */
@Composable
fun RsmEmptyState(
    icon: ImageVector,
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    actionText: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val colors = RsmTheme.colors
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(RsmSpacing.s7),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = colors.inkFaint,
            modifier = Modifier.size(40.dp),
        )
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
        ) {
            Text(
                text = title,
                style = RsmTypography.h3,
                color = colors.inkPrimary,
                textAlign = TextAlign.Center,
            )
            Text(
                text = message,
                style = RsmTypography.body,
                color = colors.inkSoft,
                textAlign = TextAlign.Center,
            )
        }
        if (actionText != null && onAction != null) {
            RsmPrimaryButton(
                text = actionText,
                onClick = onAction,
                fillWidth = false,
            )
        }
    }
}
