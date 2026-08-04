package de.rollsportmanager.v2.features.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmKpiTile
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.ui.theme.RsmSpacing

/**
 * KPI-Karte: aktive Mitglieder + offene Beiträge nebeneinander,
 * darunter der nächste Termin als breite Kachel (Spiegel von
 * iOS DashboardKpiRow.swift).
 *
 * RLS-bewusst: Die Beitrags-Summe ist rollenabhängig gefiltert (member
 * sieht nur eigene Rechnungen, coach ggf. keine) — die Caption sagt darum
 * neutral „aus deiner Sicht" statt eine Vereins-Gesamtsumme zu behaupten.
 */
@Composable
fun DashboardKpiCard(data: DashboardData) {
    RsmCard {
        Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4)) {
            RsmSectionHeader(
                eyebrow = stringResource(R.string.dashboard_kpi_eyebrow),
                title = stringResource(R.string.dashboard_kpi_title),
            )
            Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
                    verticalAlignment = Alignment.Top,
                ) {
                    RsmKpiTile(
                        eyebrow = stringResource(R.string.dashboard_kpi_members_eyebrow),
                        value = data.activeMemberCount.toString(),
                        caption = stringResource(R.string.dashboard_kpi_members_caption),
                        modifier = Modifier.weight(1f),
                    )
                    RsmKpiTile(
                        eyebrow = stringResource(R.string.dashboard_kpi_dues_eyebrow),
                        value = DashboardFormat.euroText(data.openInvoiceSumCents),
                        caption = duesCaption(data.openInvoiceCount),
                        modifier = Modifier.weight(1f),
                    )
                }
                NextEventTile(data)
            }
        }
    }
}

@Composable
private fun duesCaption(openInvoiceCount: Int): String = when (openInvoiceCount) {
    0 -> stringResource(R.string.dashboard_kpi_dues_caption_empty)
    else -> pluralStringResource(
        R.plurals.dashboard_kpi_dues_caption,
        openInvoiceCount,
        openInvoiceCount,
    )
}

@Composable
private fun NextEventTile(data: DashboardData) {
    val nextEvent = data.nextEvent
    val start = nextEvent?.let { DashboardFormat.parseIso(it.startsAt) }
    if (nextEvent != null && start != null) {
        RsmKpiTile(
            eyebrow = stringResource(R.string.dashboard_kpi_next_eyebrow),
            value = relativeDayText(start),
            // Titel + Uhrzeit kommen von der API — bewusst kein Katalog-Key.
            caption = "${nextEvent.title} · ${DashboardFormat.timeText(start)}",
            modifier = Modifier.fillMaxWidth(),
        )
    } else {
        RsmKpiTile(
            eyebrow = stringResource(R.string.dashboard_kpi_next_eyebrow),
            value = "—",
            caption = stringResource(R.string.dashboard_kpi_next_caption_none),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
