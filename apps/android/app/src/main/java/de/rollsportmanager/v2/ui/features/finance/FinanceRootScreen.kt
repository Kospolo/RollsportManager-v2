package de.rollsportmanager.v2.ui.features.finance

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import de.rollsportmanager.contracts.DunningRunResult
import de.rollsportmanager.contracts.Invoice
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.auth.SessionStore
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmKpiTile
import de.rollsportmanager.v2.designsystem.RsmSecondaryButton
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Root-Composable des Finanzen-Tabs („Beiträge & Finanzen“) — wird von der
 * Integration in MainScaffold als `composable(RsmTab.FINANCE.route)`-Ziel
 * verdrahtet: `FinanceRootScreen(session)`.
 *
 * Aufbau (Spiegel der iOS-Referenz FinanceView): KPI-Karte →
 * Offene-Posten-Liste (Filter-Chips + Summen-Fußzeile) → Mahn-Automatik-Karte.
 * Die einzige Beere des Screens ist „Mahnlauf (Vorschau)“ in der
 * Mahn-Automatik-Karte; das Dry-Run-Ergebnis öffnet ein BottomSheet.
 */
@Composable
fun FinanceRootScreen(session: SessionStore) {
    val viewModel: FinanceViewModel = viewModel { FinanceViewModel(session) }

    val state by viewModel.state.collectAsStateWithLifecycle()
    val openInvoices by viewModel.openInvoices.collectAsStateWithLifecycle()
    val memberNames by viewModel.memberNames.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val dunningState by viewModel.dunningState.collectAsStateWithLifecycle()
    val dunningResult by viewModel.dunningResult.collectAsStateWithLifecycle()

    when (val loadState = state) {
        FinanceLoadState.Loading -> FinanceLoading()
        is FinanceLoadState.Error -> FinanceError(
            message = if (loadState.forbidden) {
                stringResource(R.string.finance_error_forbidden)
            } else {
                loadState.message
            },
            onRetry = viewModel::load,
        )
        FinanceLoadState.Loaded -> FinanceLoaded(
            openInvoices = openInvoices,
            memberNames = memberNames,
            filter = filter,
            onFilterChange = viewModel::setFilter,
            dunningState = dunningState,
            onDunningPreview = viewModel::runDunningPreview,
        )
    }

    FinanceDunningResultSheet(
        result = dunningResult,
        memberNames = memberNames,
        onDismiss = viewModel::dismissDunningResult,
    )
}

// --- Zustände -----------------------------------------------------------------

@Composable
private fun FinanceLoading() {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier
            .fillMaxSize()
            .semantics(mergeDescendants = true) {},
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator(color = colors.brand)
        Text(
            text = stringResource(R.string.finance_loading),
            style = RsmTypography.caption,
            color = colors.inkSoft,
            modifier = Modifier.padding(top = RsmSpacing.s3),
        )
    }
}

@Composable
private fun FinanceError(message: String, onRetry: () -> Unit) {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(RsmSpacing.s5),
    ) {
        RsmCard {
            Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
                Icon(
                    imageVector = Icons.Filled.Warning,
                    contentDescription = null,
                    tint = colors.danger,
                )
                Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1)) {
                    Text(
                        text = stringResource(R.string.finance_error_title),
                        style = RsmTypography.bodyStrong,
                        color = colors.danger,
                    )
                    Text(
                        text = message,
                        style = RsmTypography.caption,
                        color = colors.inkSoft,
                    )
                }
            }
            Box(modifier = Modifier.padding(top = RsmSpacing.s4)) {
                RsmSecondaryButton(
                    text = stringResource(R.string.finance_error_retry),
                    onClick = onRetry,
                    fillWidth = false,
                )
            }
        }
    }
}

// --- Geladen --------------------------------------------------------------------

@Composable
private fun FinanceLoaded(
    openInvoices: List<Invoice>,
    memberNames: Map<String, String>,
    filter: FinanceFilter,
    onFilterChange: (FinanceFilter) -> Unit,
    dunningState: FinanceDunningState,
    onDunningPreview: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(RsmSpacing.s5),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.cardGap),
    ) {
        FinanceKpiCard(openInvoices)
        FinanceListCard(
            openInvoices = openInvoices,
            memberNames = memberNames,
            filter = filter,
            onFilterChange = onFilterChange,
        )
        FinanceDunningCard(
            state = dunningState,
            onPreview = onDunningPreview,
        )
    }
}

/** KPI-Zeile: „Offen gesamt“ (Summe geladener offener Rechnungen, Mono) + Anzahl. */
@Composable
private fun FinanceKpiCard(openInvoices: List<Invoice>) {
    val currency = openInvoices.firstOrNull()?.currency ?: "EUR"
    val totalCents = openInvoices.sumOf { it.amountCents ?: 0L }
    RsmCard {
        RsmSectionHeader(
            eyebrow = stringResource(R.string.finance_kpi_eyebrow),
            title = stringResource(R.string.finance_kpi_title),
        )
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = RsmSpacing.s4),
            horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        ) {
            RsmKpiTile(
                eyebrow = stringResource(R.string.finance_kpi_sum_eyebrow),
                value = FinanceFormat.amount(totalCents, currency),
                caption = stringResource(R.string.finance_kpi_sum_caption),
                modifier = Modifier.weight(1f),
            )
            RsmKpiTile(
                eyebrow = stringResource(R.string.finance_kpi_count_eyebrow),
                value = openInvoices.size.toString(),
                caption = stringResource(R.string.finance_kpi_count_caption),
                modifier = Modifier.weight(1f),
            )
        }
    }
}

// --- Ergebnis-BottomSheet ---------------------------------------------------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FinanceDunningResultSheet(
    result: DunningRunResult?,
    memberNames: Map<String, String>,
    onDismiss: () -> Unit,
) {
    if (result == null) return
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = RsmTheme.colors.bgCanvas,
    ) {
        FinanceDunningPreviewSheet(
            result = result,
            memberNames = memberNames,
            onClose = onDismiss,
        )
    }
}
