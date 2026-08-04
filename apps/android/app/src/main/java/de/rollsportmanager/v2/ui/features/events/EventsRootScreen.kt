package de.rollsportmanager.v2.ui.features.events

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EventBusy
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import de.rollsportmanager.contracts.Event
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.auth.SessionStore
import de.rollsportmanager.v2.designsystem.RsmCard
import de.rollsportmanager.v2.designsystem.RsmEmptyState
import de.rollsportmanager.v2.ui.theme.RsmSize
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import java.time.LocalDate
import java.util.Locale

/**
 * ÖFFENTLICHE ROOT-COMPOSABLE des Termine-Features (Spiegel von iOS
 * EventsRootView.swift): Tages-gruppierte Liste mit Filter-Segmenten,
 * Pull-to-Refresh und Detail-BottomSheet (RSVP + Anwesenheit).
 *
 * INTEGRATION: in MainScaffold.kt das Ziel
 * `composable(RsmTab.EVENTS.route) { EventsRootScreen(session) }` setzen.
 */
@Composable
fun EventsRootScreen(session: SessionStore) {
    val model: EventsViewModel = viewModel()
    LaunchedEffect(Unit) { model.loadIfNeeded(session.api, session.clubId) }

    val state by model.state.collectAsStateWithLifecycle()
    val filter by model.filter.collectAsStateWithLifecycle()
    val isRefreshing by model.isRefreshing.collectAsStateWithLifecycle()
    val refreshError by model.refreshError.collectAsStateWithLifecycle()
    val devSession by session.session.collectAsStateWithLifecycle()

    var selectedEventId by rememberSaveable { mutableStateOf<String?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(refreshError) {
        val message = refreshError ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(message)
        model.consumeRefreshError()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val current = state) {
            is EventsUiState.Loading -> EventsLoading()
            is EventsUiState.Error -> EventsError(message = current.message, onRetry = model::retry)
            is EventsUiState.Loaded -> EventsListContent(
                loaded = current,
                filter = filter,
                isRefreshing = isRefreshing,
                onFilterChange = model::setFilter,
                onRefresh = model::refresh,
                onOpenEvent = { selectedEventId = it.id },
            )
        }
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }

    // Fürs Sheet immer den aktuellsten Stand aus der Liste nehmen
    // (die Auswahl ist nur die ID — kein veralteter Schnappschuss).
    val loaded = state as? EventsUiState.Loaded
    val selectedEvent = loaded?.events?.firstOrNull { it.id == selectedEventId }
    if (loaded != null && selectedEvent != null) {
        EventDetailSheet(
            event = selectedEvent,
            api = session.api,
            clubId = session.clubId,
            myMemberId = devSession?.profile?.memberId.orEmpty(),
            clubRole = devSession?.profile?.clubRole,
            teamsById = loaded.teamsById,
            membersById = loaded.membersById,
            onEventUpdated = model::applyUpdatedEvent,
            onDismiss = { selectedEventId = null },
        )
    }
}

// --- Zustände -----------------------------------------------------------------

@Composable
private fun EventsLoading() {
    val colors = RsmTheme.colors
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator(color = colors.brand)
        Spacer(Modifier.height(RsmSpacing.s4))
        Text(
            text = stringResource(R.string.events_loading),
            style = RsmTypography.body,
            color = colors.inkSoft,
        )
    }
}

@Composable
private fun EventsError(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(RsmSpacing.s5),
    ) {
        RsmCard {
            // Die eine Beere dieses Sichtbereichs: erneut laden.
            RsmEmptyState(
                icon = Icons.Filled.WifiOff,
                title = stringResource(R.string.events_error_title),
                message = message,
                actionText = stringResource(R.string.events_error_retry),
                onAction = onRetry,
            )
        }
    }
}

// --- Liste --------------------------------------------------------------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EventsListContent(
    loaded: EventsUiState.Loaded,
    filter: EventsFilter,
    isRefreshing: Boolean,
    onFilterChange: (EventsFilter) -> Unit,
    onRefresh: () -> Unit,
    onOpenEvent: (Event) -> Unit,
) {
    val colors = RsmTheme.colors
    val sections = remember(loaded.events, filter) {
        EventsLogic.sections(loaded.events, filter)
    }
    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(RsmSpacing.s5),
            verticalArrangement = Arrangement.spacedBy(RsmSpacing.cardGap),
        ) {
            item(key = "events_title") {
                Text(
                    text = stringResource(R.string.events_title),
                    style = RsmTypography.display,
                    color = colors.inkPrimary,
                )
            }
            item(key = "events_filter") {
                EventsFilterBar(selection = filter, onSelect = onFilterChange)
            }
            if (sections.isEmpty()) {
                item(key = "events_empty") {
                    RsmCard {
                        RsmEmptyState(
                            icon = Icons.Filled.EventBusy,
                            title = stringResource(R.string.events_empty_title),
                            message = stringResource(
                                if (filter == EventsFilter.ALL) R.string.events_empty_message
                                else R.string.events_empty_filtered_message,
                            ),
                        )
                    }
                }
            }
            items(sections, key = { "events_day_${it.day}" }) { section ->
                EventsDaySectionView(section = section, loaded = loaded, onOpenEvent = onOpenEvent)
            }
        }
    }
}

@Composable
private fun EventsDaySectionView(
    section: EventsDaySection,
    loaded: EventsUiState.Loaded,
    onOpenEvent: (Event) -> Unit,
) {
    val colors = RsmTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(RsmSpacing.s3)) {
        EventsDayHeader(section.day)
        RsmCard(padding = 0.dp) {
            section.events.forEachIndexed { index, event ->
                EventRow(
                    event = event,
                    counts = remember(event, loaded.teamsById, loaded.membersById) {
                        EventsLogic.counts(event, loaded.teamsById, loaded.membersById)
                    },
                    teams = event.teamIds.mapNotNull { loaded.teamsById[it] },
                    onClick = { onOpenEvent(event) },
                )
                if (index < section.events.lastIndex) {
                    HorizontalDivider(color = colors.line)
                }
            }
        }
    }
}

@Composable
private fun EventsDayHeader(day: LocalDate) {
    val locale = Locale.getDefault()
    val base = EventsDisplay.dayHeader(day, locale)
    val today = LocalDate.now()
    val text = when (day) {
        today -> "${stringResource(R.string.events_section_today)} · $base"
        today.plusDays(1) -> "${stringResource(R.string.events_section_tomorrow)} · $base"
        else -> base
    }
    Text(
        text = text.uppercase(locale),
        style = RsmTypography.eyebrow,
        color = RsmTheme.colors.inkFaint,
        modifier = Modifier.padding(start = RsmSpacing.s1),
    )
}

// --- Segmented-Filter (Mulden-Pille laut Design-System) -------------------------

/**
 * Segmente Alle · Training · Wettkampf · Sonstiges in einer Sunken-Pille;
 * das aktive Segment liegt als Surface-Pille obenauf (wie iOS EventsFilterBar).
 */
@Composable
private fun EventsFilterBar(
    selection: EventsFilter,
    onSelect: (EventsFilter) -> Unit,
) {
    val colors = RsmTheme.colors
    val a11yLabel = stringResource(R.string.events_filter_a11y)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(CircleShape)
            .background(colors.bgSunken)
            .padding(RsmSpacing.s1)
            .selectableGroup()
            .semantics { contentDescription = a11yLabel },
        horizontalArrangement = Arrangement.spacedBy(RsmSpacing.s1),
    ) {
        EventsFilter.entries.forEach { filter ->
            val selected = filter == selection
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(CircleShape)
                    .background(if (selected) colors.bgSurface else Color.Transparent)
                    .selectable(selected = selected, onClick = { onSelect(filter) })
                    // 36 dp Segment + 2×4 dp Muldenrand = 44-dp-Touch-Ziel.
                    .heightIn(min = RsmSize.touchTarget - RsmSpacing.s2),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = stringResource(filter.labelRes),
                    style = RsmTypography.caption.copy(fontWeight = FontWeight.SemiBold),
                    color = if (selected) colors.inkPrimary else colors.inkSoft,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    modifier = Modifier.padding(horizontal = RsmSpacing.s1),
                )
            }
        }
    }
}
