package de.rollsportmanager.v2.ui.features.finance

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import de.rollsportmanager.contracts.Invoice
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmAvatar
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmDunningPill
import de.rollsportmanager.v2.designsystem.RsmEmptyState
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Offene-Posten-Karte: Filter-Chips (Alle · Offen · Erinnert · Gemahnt),
 * Zeilen im Tabellen-Stil der Seriositätszone (Avatar-first, Beträge Mono
 * rechtsbündig, nie eingefärbte Zeilen — Eskalationsfarbe NUR am Badge)
 * und Summen-Fußzeile (angezeigte Posten + Summe + Gesamtwert).
 */
@Composable
fun FinanceListCard(
    openInvoices: List<Invoice>,
    memberNames: Map<String, String>,
    filter: FinanceFilter,
    onFilterChange: (FinanceFilter) -> Unit,
) {
    val filtered = remember(openInvoices, filter) { openInvoices.filter(filter::matches) }
    val currency = openInvoices.firstOrNull()?.currency ?: "EUR"

    RsmCard {
        RsmSectionHeader(
            eyebrow = stringResource(R.string.finance_list_eyebrow),
            title = stringResource(R.string.finance_list_title),
        )
        FinanceFilterChips(
            active = filter,
            onFilterChange = onFilterChange,
            modifier = Modifier.padding(top = RsmSpacing.s4),
        )
        if (filtered.isEmpty()) {
            RsmEmptyState(
                icon = Icons.Filled.CheckCircle,
                title = stringResource(R.string.finance_list_empty_title),
                message = stringResource(R.string.finance_list_empty_message),
            )
        } else {
            Column(modifier = Modifier.padding(top = RsmSpacing.s2)) {
                filtered.forEachIndexed { index, invoice ->
                    if (index > 0) HorizontalDivider(color = RsmTheme.colors.line)
                    FinanceInvoiceRow(
                        invoice = invoice,
                        memberName = memberNames[invoice.memberId],
                    )
                }
            }
            FinanceListFooter(
                shownCount = filtered.size,
                shownTotal = FinanceFormat.amount(
                    filtered.sumOf { it.amountCents ?: 0L },
                    currency,
                ),
                openTotal = FinanceFormat.amount(
                    openInvoices.sumOf { it.amountCents ?: 0L },
                    currency,
                ),
            )
        }
    }
}

// --- Filter-Chips -----------------------------------------------------------------

@StringRes
private fun FinanceFilter.labelRes(): Int = when (this) {
    FinanceFilter.ALL -> R.string.finance_filter_all
    FinanceFilter.OPEN -> R.string.finance_filter_open
    FinanceFilter.REMINDED -> R.string.finance_filter_reminded
    FinanceFilter.DUNNED -> R.string.finance_filter_dunned
}

@Composable
private fun FinanceFilterChips(
    active: FinanceFilter,
    onFilterChange: (FinanceFilter) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
    ) {
        FinanceFilter.entries.forEach { item ->
            FinanceFilterChip(
                text = stringResource(item.labelRes()),
                active = item == active,
                onClick = { onFilterChange(item) },
            )
        }
    }
}

/** Pill-Chip über der Tabelle — aktiv = brand-soft/brand-ink (§3.3), 44-dp-Touch-Ziel. */
@Composable
private fun FinanceFilterChip(
    text: String,
    active: Boolean,
    onClick: () -> Unit,
) {
    val colors = RsmTheme.colors
    Box(
        modifier = Modifier
            .heightIn(min = RsmSize.touchTarget)
            .clip(CircleShape)
            .background(if (active) colors.brandSoft else colors.bgSunken)
            .selectable(selected = active, role = Role.Tab, onClick = onClick)
            .padding(horizontal = RsmSpacing.s4),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            style = RsmTypography.bodyStrong,
            color = if (active) colors.brandInk else colors.inkSoft,
        )
    }
}

// --- Zeile ------------------------------------------------------------------------

/**
 * Listenzeile: [Avatar] [Name fett + Rechnungsnummer Mono] … [Betrag Mono
 * rechtsbündig, Mahnstufen-Ampel-Pill]. Zeile bleibt farblich neutral.
 */
@Composable
private fun FinanceInvoiceRow(invoice: Invoice, memberName: String?) {
    val colors = RsmTheme.colors
    val displayName = memberName ?: stringResource(R.string.finance_member_unknown)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = RsmSize.listRow)
            .padding(vertical = RsmSpacing.s3)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RsmAvatar(name = displayName, personId = invoice.memberId)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            Text(
                text = displayName,
                style = RsmTypography.bodyStrong,
                color = colors.inkPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = invoice.number,
                style = RsmTypography.monoTable,
                color = colors.inkFaint,
                maxLines = 1,
            )
        }
        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            Text(
                text = FinanceFormat.amount(invoice.amountCents, invoice.currency),
                style = RsmTypography.monoTable,
                color = colors.inkPrimary,
            )
            RsmDunningPill(level = invoice.dunningLevel.toInt())
        }
    }
}

// --- Summen-Fußzeile ----------------------------------------------------------------

@Composable
private fun FinanceListFooter(
    shownCount: Int,
    shownTotal: String,
    openTotal: String,
) {
    val colors = RsmTheme.colors
    HorizontalDivider(color = colors.lineStrong)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = RsmSpacing.s2)
            .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            text = pluralStringResource(
                R.plurals.finance_list_footer_count,
                shownCount,
                shownCount,
            ),
            style = RsmTypography.caption,
            color = colors.inkSoft,
            modifier = Modifier.weight(1f),
        )
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = shownTotal,
                style = RsmTypography.monoTable,
                color = colors.inkPrimary,
            )
            Text(
                text = stringResource(R.string.finance_list_footer_total, openTotal),
                style = RsmTypography.caption,
                color = colors.inkFaint,
            )
        }
    }
}
