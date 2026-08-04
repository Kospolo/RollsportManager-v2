package de.rollsportmanager.v2.features.mehr

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Euro
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.auth.SessionStore
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmSectionHeader
import de.rollsportmanager.v2.features.sparten.SpartenRootScreen
import de.rollsportmanager.v2.features.teams.TeamsRootScreen
import de.rollsportmanager.v2.ui.features.finance.FinanceRootScreen
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography

/**
 * „Mehr“-Hub — Sammelpunkt für alles, was keinen eigenen Tab hat.
 *
 * WARUM ES DEN HUB GIBT: Die untere Navigationsleiste trägt fünf Ziele, bevor
 * sie unleserlich wird. Vier davon sind der Alltag (Übersicht · Termine ·
 * Mitglieder · Küren), das fünfte ist dieser Hub. iOS hat exakt dieselbe
 * Aufteilung (`MainTabView.swift`) — Finanzen ist dort ebenfalls eine Kachel
 * im „Mehr“-Hub statt eines eigenen Tabs. Android folgt dem bewusst, damit
 * beide Plattformen dieselbe Landkarte haben.
 *
 * SAMMELPUNKT-REGEL: Neue Module werden NUR hier registriert (Eintrag in
 * [MehrEntry] + ein `composable(...)` unten). Nicht in MainScaffold — sonst
 * wächst die Tab-Leiste wieder zu.
 */
@Composable
fun MehrHubScreen(session: SessionStore) {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = MEHR_ROUTE_HUB) {
        composable(MEHR_ROUTE_HUB) {
            MehrHubList(onOpen = { entry -> navController.navigate(entry.route) })
        }
        composable(MehrEntry.FINANCE.route) {
            MehrDetailFrame(
                titleRes = MehrEntry.FINANCE.labelRes,
                onBack = { navController.popBackStack() },
            ) {
                FinanceRootScreen(session)
            }
        }
        composable(MehrEntry.TEAMS.route) {
            MehrDetailFrame(
                titleRes = MehrEntry.TEAMS.labelRes,
                onBack = { navController.popBackStack() },
            ) {
                TeamsRootScreen(session)
            }
        }
        composable(MehrEntry.SPARTEN.route) {
            MehrDetailFrame(
                titleRes = MehrEntry.SPARTEN.labelRes,
                onBack = { navController.popBackStack() },
            ) {
                SpartenRootScreen(session)
            }
        }
    }
}

/** Ein Ziel im Hub. Reihenfolge hier = Reihenfolge im UI. */
enum class MehrEntry(
    val route: String,
    val labelRes: Int,
    val descriptionRes: Int,
    val icon: ImageVector,
) {
    FINANCE(
        route = "mehr/finance",
        labelRes = R.string.tab_finance,
        descriptionRes = R.string.mehr_finance_description,
        icon = Icons.Filled.Euro,
    ),
    TEAMS(
        route = "mehr/teams",
        labelRes = R.string.mehr_teams_title,
        descriptionRes = R.string.mehr_teams_description,
        icon = Icons.Filled.Groups,
    ),
    SPARTEN(
        route = "mehr/sparten",
        labelRes = R.string.mehr_sparten_title,
        descriptionRes = R.string.mehr_sparten_description,
        icon = Icons.Filled.AccountTree,
    ),
}

@Composable
private fun MehrHubList(onOpen: (MehrEntry) -> Unit) {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(vertical = RsmSpacing.s5),
        verticalArrangement = Arrangement.spacedBy(RsmSpacing.s4),
    ) {
        Text(
            text = stringResource(R.string.tab_mehr),
            style = RsmTypography.display,
            color = colors.inkPrimary,
            modifier = Modifier.padding(horizontal = RsmSpacing.s5),
        )
        Box(modifier = Modifier.padding(horizontal = RsmSpacing.s5)) {
            RsmCard {
                RsmSectionHeader(
                    eyebrow = stringResource(R.string.mehr_eyebrow),
                    title = stringResource(R.string.mehr_section_title),
                )
                Column(modifier = Modifier.padding(top = RsmSpacing.s3)) {
                    MehrEntry.entries.forEachIndexed { index, entry ->
                        MehrRow(entry = entry, onClick = { onOpen(entry) })
                        if (index < MehrEntry.entries.lastIndex) {
                            HorizontalDivider(color = colors.line)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MehrRow(entry: MehrEntry, onClick: () -> Unit) {
    val colors = RsmTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = RsmSpacing.s3),
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Organisationen/Bereiche tragen Icon-Kacheln, keine runden Monogramme
        // (Kreis ist im Designsystem den Personen vorbehalten).
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(colors.brandSoft),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = entry.icon,
                contentDescription = null,
                tint = colors.brandInk,
                modifier = Modifier.size(20.dp),
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
        ) {
            Text(
                text = stringResource(entry.labelRes),
                style = RsmTypography.body,
                color = colors.inkPrimary,
            )
            Text(
                text = stringResource(entry.descriptionRes),
                style = RsmTypography.caption,
                color = colors.inkSoft,
            )
        }
        Icon(
            imageVector = Icons.Filled.ChevronRight,
            contentDescription = null,
            tint = colors.inkFaint,
        )
    }
}

/**
 * Rahmen für ein Hub-Ziel: nur der Zurück-Weg, KEIN Titel.
 *
 * Warum ohne Titel: Jeder Feature-Root setzt seine eigene Überschrift im
 * Display-Stil („Teams“, „Sparten“, „Finanzen“). Ein zweiter Titel im Rahmen
 * stünde direkt darüber und würde jede Seite doppelt beschriften. Der
 * Zurück-Pfeil trägt den Namen des Ziels als Beschreibung für TalkBack —
 * damit bleibt die Ansage eindeutig, ohne die Seite optisch zu doppeln.
 *
 * Die Feature-Roots bringen teils einen eigenen NavHost mit; deshalb hier
 * bewusst keine zweite Scroll-Ebene, sondern nur ein Box-Rahmen.
 */
@Composable
private fun MehrDetailFrame(
    titleRes: Int,
    onBack: () -> Unit,
    content: @Composable () -> Unit,
) {
    val colors = RsmTheme.colors
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = RsmSpacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(
                        R.string.mehr_back_to_hub,
                        stringResource(titleRes),
                    ),
                    tint = colors.inkPrimary,
                )
            }
        }
        Box(modifier = Modifier.weight(1f)) {
            content()
        }
    }
}

private const val MEHR_ROUTE_HUB = "mehr/hub"
