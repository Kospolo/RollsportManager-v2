package de.rollsportmanager.v2.ui.features.finance

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import de.rollsportmanager.contracts.DunningAction
import de.rollsportmanager.contracts.DunningActionAction
import de.rollsportmanager.contracts.DunningRunResult
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmDunningPill
import de.rollsportmanager.v2.designsystem.RsmEmptyState
import de.rollsportmanager.v2.designsystem.RsmSecondaryButton
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.ui.theme.RsmRadius
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Inhalt des Ergebnis-BottomSheets des Vorschau-Mahnlaufs (dry_run):
 * Banner „nichts wurde versendet“, Zusammenfassung, dann die Aktionen
 * gruppiert nach automatisch / wartet auf Freigabe / keine Aktion.
 * Gruppen-Pills: auto=Info, pending=Warn, none=Neutral — nie Honig.
 */
@Composable
fun FinanceDunningPreviewSheet(
    result: DunningRunResult,
    memberNames: Map<String, String>,
    onClose: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = RsmSpacing.s5)
            .padding(bottom = RsmSpacing.s7),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4),
    ) {
        Text(
            text = stringResource(R.string.finance_preview_title),
            style = RsmTypography.h2,
            color = RsmTheme.colors.inkPrimary,
        )
        PreviewBanner(result)
        if (result.actions.isEmpty()) {
            RsmCard {
                RsmEmptyState(
                    icon = Icons.Filled.Inbox,
                    title = stringResource(R.string.finance_preview_empty_title),
                    message = stringResource(R.string.finance_preview_empty_message),
                )
            }
        } else {
            DunningActionAction.entries.forEach { kind ->
                val actions = result.actions.filter { it.action == kind }
                if (actions.isNotEmpty()) {
                    PreviewGroupCard(
                        kind = kind,
                        actions = actions,
                        memberNames = memberNames,
                    )
                }
            }
        }
        RsmSecondaryButton(
            text = stringResource(R.string.finance_preview_close),
            onClick = onClose,
        )
    }
}

// --- Banner + Zusammenfassung ------------------------------------------------------

@Composable
private fun PreviewBanner(result: DunningRunResult) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(RsmRadius.l))
            .background(colors.infoSoft)
            .padding(RsmSpacing.s4)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
    ) {
        Icon(
            imageVector = Icons.Filled.Visibility,
            contentDescription = null,
            tint = colors.info,
            modifier = Modifier.size(20.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
            Text(
                text = stringResource(R.string.finance_preview_banner),
                style = RsmTypography.bodyStrong,
                color = colors.info,
            )
            Text(
                text = stringResource(
                    R.string.finance_preview_summary,
                    result.summary.auto,
                    result.summary.pendingApproval,
                    result.summary.none,
                ),
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
            FinanceFormat.date(result.asOf)?.let { asOf ->
                Text(
                    text = stringResource(R.string.finance_preview_as_of, asOf),
                    style = RsmTypography.caption,
                    color = colors.inkFaint,
                )
            }
        }
    }
}

// --- Gruppen ------------------------------------------------------------------------

@Composable
private fun PreviewGroupCard(
    kind: DunningActionAction,
    actions: List<DunningAction>,
    memberNames: Map<String, String>,
) {
    val colors = RsmTheme.colors
    val titleRes = when (kind) {
        DunningActionAction.AUTO -> R.string.finance_preview_group_auto
        DunningActionAction.PENDING_APPROVAL -> R.string.finance_preview_group_pending
        DunningActionAction.NONE -> R.string.finance_preview_group_none
    }
    val pillKind = when (kind) {
        DunningActionAction.AUTO -> RsmStatusKind.INFO
        DunningActionAction.PENDING_APPROVAL -> RsmStatusKind.WARN
        DunningActionAction.NONE -> RsmStatusKind.NEUTRAL
    }
    RsmCard(padding = RsmSpacing.s4) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.semantics(mergeDescendants = true) {},
        ) {
            RsmStatusPill(text = stringResource(titleRes), kind = pillKind)
            Text(
                text = actions.size.toString(),
                style = RsmTypography.monoTable,
                color = colors.inkFaint,
            )
        }
        Column(modifier = Modifier.padding(top = RsmSpacing.s2)) {
            actions.forEachIndexed { index, action ->
                if (index > 0) HorizontalDivider(color = colors.line)
                PreviewActionRow(
                    action = action,
                    memberName = memberNames[action.memberId],
                )
            }
        }
    }
}

// --- Zeile --------------------------------------------------------------------------

@Composable
private fun PreviewActionRow(action: DunningAction, memberName: String?) {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = RsmSpacing.s3)
            .semantics(mergeDescendants = true) {},
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = memberName ?: stringResource(R.string.finance_member_unknown),
                style = RsmTypography.bodyStrong,
                color = colors.inkPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            // Contracts-Lücke: DunningAction führt keine Währung —
            // Annahme EUR (Seed), gemeldet als offener Punkt (wie iOS).
            Text(
                text = FinanceFormat.amount(action.amountCents, "EUR"),
                style = RsmTypography.monoTable,
                color = colors.inkPrimary,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2)) {
            Text(
                text = action.number,
                style = RsmTypography.monoTable,
                color = colors.inkFaint,
            )
            Text(
                text = pluralStringResource(
                    R.plurals.finance_preview_overdue,
                    action.daysOverdue.toInt(),
                    action.daysOverdue.toInt(),
                ),
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
        }
        if (action.action != DunningActionAction.NONE) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RsmDunningPill(level = action.proposedLevel.toInt())
                Text(
                    text = stringResource(
                        R.string.finance_preview_level,
                        action.currentLevel,
                        action.proposedLevel,
                    ),
                    style = RsmTypography.caption,
                    color = colors.inkFaint,
                )
            }
        }
    }
}
