package de.rollsportmanager.v2.ui.features.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmPrimaryButton
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Mahn-Automatik-Karte (Design-System §3.7): Regel-Zeitleiste als vier
 * Kacheln (+7 / +21 / +35 / +49 Tage) mit 4-dp-Farbkante links, darunter
 * die Kontroll-Mikrocopy („Stufe 2+ wird nie automatisch versendet …“)
 * und die EINZIGE Beere des Screens: „Mahnlauf (Vorschau)“.
 *
 * Der Lauf ist IMMER dry_run — scharfe Läufe gibt es hier bewusst nicht.
 * Eskalationstreppe: Erinnerung (Info/Petrol, NIE Honig) → 1. Mahnung
 * (warn) → 2. Mahnung/Übergabe (danger).
 */
@Composable
fun FinanceDunningCard(
    state: FinanceDunningState,
    onPreview: () -> Unit,
) {
    val colors = RsmTheme.colors
    RsmCard {
        RsmSectionHeader(
            eyebrow = stringResource(R.string.finance_dunning_eyebrow),
            title = stringResource(R.string.finance_dunning_title),
        )
        Column(
            modifier = Modifier.padding(top = RsmSpacing.s4),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
        ) {
            DunningStageTile(
                dayRes = R.string.finance_dunning_stage1_day,
                titleRes = R.string.finance_dunning_stage1_title,
                modeRes = R.string.finance_dunning_stage1_mode,
                accent = colors.info,
            )
            DunningStageTile(
                dayRes = R.string.finance_dunning_stage2_day,
                titleRes = R.string.finance_dunning_stage2_title,
                modeRes = R.string.finance_dunning_stage2_mode,
                accent = colors.warn,
            )
            DunningStageTile(
                dayRes = R.string.finance_dunning_stage3_day,
                titleRes = R.string.finance_dunning_stage3_title,
                modeRes = R.string.finance_dunning_stage3_mode,
                accent = colors.danger,
            )
            DunningStageTile(
                dayRes = R.string.finance_dunning_stage4_day,
                titleRes = R.string.finance_dunning_stage4_title,
                modeRes = R.string.finance_dunning_stage4_mode,
                accent = colors.danger,
            )
        }
        DunningNote()
        if (state == FinanceDunningState.Forbidden) {
            DunningHintBox(
                icon = Icons.Filled.Lock,
                tint = colors.info,
                background = colors.infoSoft,
                title = stringResource(R.string.finance_dunning_forbidden_title),
                message = stringResource(R.string.finance_dunning_forbidden_message),
            )
        }
        if (state is FinanceDunningState.Error) {
            DunningHintBox(
                icon = Icons.Filled.Warning,
                tint = colors.danger,
                background = colors.dangerSoft,
                title = stringResource(R.string.finance_dunning_error_title),
                message = state.message,
            )
        }
        Box(modifier = Modifier.padding(top = RsmSpacing.s4)) {
            RsmPrimaryButton(
                text = stringResource(R.string.finance_dunning_preview),
                onClick = onPreview,
                isLoading = state == FinanceDunningState.Running,
            )
        }
    }
}

// --- Zeitleisten-Kachel --------------------------------------------------------

@Composable
private fun DunningStageTile(
    dayRes: Int,
    titleRes: Int,
    modeRes: Int,
    accent: Color,
) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .clip(RoundedCornerShape(RsmRadius.l))
            .background(colors.bgCanvas)
            .padding(RsmSpacing.s3)
            .semantics(mergeDescendants = true) {},
    ) {
        Box(
            modifier = Modifier
                .width(4.dp)
                .fillMaxHeight()
                .clip(RoundedCornerShape(2.dp))
                .background(accent),
        )
        Column(
            modifier = Modifier.padding(start = RsmSpacing.s3),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = stringResource(dayRes),
                style = RsmTypography.monoTable,
                color = colors.inkFaint,
            )
            Text(
                text = stringResource(titleRes),
                style = RsmTypography.bodyStrong,
                color = colors.inkPrimary,
            )
            Text(
                text = stringResource(modeRes),
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
        }
    }
}

// --- Mikrocopy & Hinweise ---------------------------------------------------------

@Composable
private fun DunningNote() {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier
            .padding(top = RsmSpacing.s4)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
    ) {
        Icon(
            imageVector = Icons.Filled.Info,
            contentDescription = null,
            tint = colors.info,
            modifier = Modifier.size(16.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
            Text(
                text = stringResource(R.string.finance_dunning_note1),
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
            Text(
                text = stringResource(R.string.finance_dunning_note2),
                style = RsmTypography.caption,
                color = colors.inkFaint,
            )
        }
    }
}

@Composable
private fun DunningHintBox(
    icon: ImageVector,
    tint: Color,
    background: Color,
    title: String,
    message: String,
) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier
            .padding(top = RsmSpacing.s4)
            .fillMaxWidth()
            .clip(RoundedCornerShape(RsmRadius.l))
            .background(background)
            .padding(RsmSpacing.s4)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(20.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
            Text(
                text = title,
                style = RsmTypography.bodyStrong,
                color = tint,
            )
            Text(
                text = message,
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
        }
    }
}
