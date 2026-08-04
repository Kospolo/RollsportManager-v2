package de.rollsportmanager.v2.features.sparten

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import de.rollsportmanager.contracts.Sparte
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.auth.SessionStore
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmEmptyState
import de.rollsportmanager.v2.designsystem.RsmPrimaryButton
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.designsystem.RsmStatusPill
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * Root-Composable des Features „Sparten“ — die Gliederungsebene zwischen
 * Verein und Teams (Verein → Sparten → Teams). Reine Leseansicht: Anlegen und
 * Umhängen von Teams passiert in der Verwaltung, nicht hier.
 *
 * Einsparten-Vereine (der Normalfall, z. B. RSV Neckarsulm) sehen genau eine
 * Karte — das ist gewollt und kein leerer Zustand.
 */
@Composable
fun SpartenRootScreen(session: SessionStore) {
    val viewModel: SpartenViewModel = viewModel {
        SpartenViewModel(api = session.api, clubId = session.clubId)
    }
    val state by viewModel.state.collectAsStateWithLifecycle()

    when (val current = state) {
        SpartenViewModel.LoadState.Loading -> SpartenLoading()
        is SpartenViewModel.LoadState.Failed ->
            SpartenError(message = current.message, onRetry = viewModel::load)

        SpartenViewModel.LoadState.Loaded -> SpartenLoaded(viewModel)
    }
}

// --- Zustände -----------------------------------------------------------------

@Composable
private fun SpartenLoading() {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4, Alignment.CenterVertically),
    ) {
        CircularProgressIndicator(color = colors.brand)
        Text(
            text = stringResource(R.string.sparten_loading),
            style = RsmTypography.body,
            color = colors.inkSoft,
        )
    }
}

@Composable
private fun SpartenError(message: String, onRetry: () -> Unit) {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(RsmSpacing.s5),
    ) {
        RsmCard {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = RsmSpacing.s4),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4),
            ) {
                Icon(
                    imageVector = Icons.Filled.CloudOff,
                    contentDescription = null,
                    tint = colors.danger,
                    modifier = Modifier.size(40.dp),
                )
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(RsmSpacing.s2),
                ) {
                    Text(
                        text = stringResource(R.string.sparten_error_title),
                        style = RsmTypography.h3,
                        color = colors.inkPrimary,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        text = message,
                        style = RsmTypography.caption,
                        color = colors.inkSoft,
                        textAlign = TextAlign.Center,
                    )
                }
                RsmPrimaryButton(
                    text = stringResource(R.string.sparten_error_retry),
                    onClick = onRetry,
                    fillWidth = false,
                )
            }
        }
    }
}

// --- Geladen ----------------------------------------------------------------------

@Composable
private fun SpartenLoaded(viewModel: SpartenViewModel) {
    val sparten by viewModel.sparten.collectAsStateWithLifecycle()
    val colors = RsmTheme.colors

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(vertical = RsmSpacing.s5),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4),
    ) {
        Text(
            text = stringResource(R.string.sparten_title),
            style = RsmTypography.display,
            color = colors.inkPrimary,
            modifier = Modifier.padding(horizontal = RsmSpacing.s5),
        )
        Box(modifier = Modifier.padding(horizontal = RsmSpacing.s5)) {
            if (sparten.isEmpty()) {
                RsmCard {
                    RsmEmptyState(
                        icon = Icons.Filled.AccountTree,
                        title = stringResource(R.string.sparten_empty_title),
                        message = stringResource(R.string.sparten_empty_message),
                    )
                }
            } else {
                RsmCard {
                    RsmSectionHeader(
                        eyebrow = stringResource(R.string.sparten_list_eyebrow),
                        title = pluralStringResource(
                            R.plurals.sparten_list_count,
                            sparten.size,
                            sparten.size,
                        ),
                    )
                    Column(modifier = Modifier.padding(top = RsmSpacing.s3)) {
                        sparten.forEachIndexed { index, sparte ->
                            SparteRow(
                                sparte = sparte,
                                teamCount = viewModel.teamCount(sparte.id),
                            )
                            if (index < sparten.lastIndex) {
                                HorizontalDivider(color = colors.line)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SparteRow(sparte: Sparte, teamCount: Int) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = RsmSpacing.s3),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Farbpunkt der Sparte — Vereinsfarbe, rein dekorativ (der Name steht
        // daneben, die Farbe trägt also keine Information allein).
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(CircleShape)
                .background(spartenColor(sparte.farbe) ?: colors.brand),
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            Text(
                text = sparte.name,
                style = RsmTypography.body,
                color = colors.inkPrimary,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s2)) {
                RsmStatusPill(
                    text = pluralStringResource(
                        R.plurals.sparten_team_count,
                        teamCount,
                        teamCount,
                    ),
                    kind = RsmStatusKind.NEUTRAL,
                )
                if (!sparte.aktiv) {
                    RsmStatusPill(
                        text = stringResource(R.string.sparten_inactive),
                        kind = RsmStatusKind.NEUTRAL,
                    )
                }
                if (sparte.eigeneFinanzen) {
                    // Struktur-Merkmal, KEIN Betrag: sagt nur, dass die Sparte
                    // eine eigene Kasse führt.
                    RsmStatusPill(
                        text = stringResource(R.string.sparten_own_finances),
                        kind = RsmStatusKind.INFO,
                    )
                }
            }
        }
    }
}

/**
 * `#RRGGBB` / `#AARRGGBB` aus der Vereinsverwaltung in eine Compose-Farbe.
 * Bewusst tolerant: Unsinn im Feld darf die Liste nicht zum Absturz bringen —
 * dann greift der Aufrufer auf die Markenfarbe zurück.
 */
internal fun spartenColor(raw: String?): Color? {
    val hex = raw?.trim()?.removePrefix("#") ?: return null
    if (hex.length != 6 && hex.length != 8) return null
    val value = hex.toULongOrNull(radix = 16) ?: return null
    // 6-stellig = ohne Alpha → volle Deckkraft ergänzen.
    val argb = if (hex.length == 6) value or 0xFF000000UL else value
    return Color(argb.toLong())
}
