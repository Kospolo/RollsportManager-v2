package de.rollsportmanager.v2.ui.features.events

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.Event
import de.rollsportmanager.contracts.Team
import de.rollsportmanager.v2.network.ApiClient
import de.rollsportmanager.v2.network.events
import de.rollsportmanager.v2.network.members
import de.rollsportmanager.v2.network.teams
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/** Zustand der Terminliste — Loading/Error(Retry)/Loaded, Konvention aller Teams. */
sealed interface EventsUiState {
    data object Loading : EventsUiState
    data class Error(val message: String) : EventsUiState
    data class Loaded(
        val events: List<Event>,
        val teamsById: Map<String, Team>,
        val membersById: Map<String, ClubMember>,
    ) : EventsUiState
}

/**
 * Listen-ViewModel des Termine-Features: lädt Termine, Teams und Mitglieder
 * des Vereins (Teams/Roster best-effort — für Team-Pills und die
 * „offen“-Zählung); Gruppierung/Filterung rechnet [EventsLogic.sections].
 * (Spiegel von iOS EventsViewModel.swift.)
 */
class EventsViewModel : ViewModel() {

    private val _state = MutableStateFlow<EventsUiState>(EventsUiState.Loading)
    val state: StateFlow<EventsUiState> = _state

    private val _filter = MutableStateFlow(EventsFilter.ALL)
    val filter: StateFlow<EventsFilter> = _filter

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing

    /**
     * Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Snackbar statt
     * die Liste durch einen Fehler-Screen zu ersetzen).
     */
    private val _refreshError = MutableStateFlow<String?>(null)
    val refreshError: StateFlow<String?> = _refreshError

    private var api: ApiClient? = null
    private var clubId: String? = null
    private var hasLoadedOnce = false

    // --- Laden ---------------------------------------------------------------

    /** Erststart aus `LaunchedEffect` — `api`/`clubId` kommen aus dem SessionStore. */
    fun loadIfNeeded(api: ApiClient, clubId: String) {
        this.api = api
        this.clubId = clubId
        if (hasLoadedOnce) return
        hasLoadedOnce = true
        viewModelScope.launch { load(showLoadingState = true) }
    }

    fun retry() {
        viewModelScope.launch { load(showLoadingState = true) }
    }

    /** Pull-to-Refresh: kein Lade-Screen, Fehler nur als Snackbar. */
    fun refresh() {
        if (_isRefreshing.value) return
        viewModelScope.launch {
            _isRefreshing.value = true
            try {
                load(showLoadingState = false)
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun setFilter(filter: EventsFilter) {
        _filter.value = filter
    }

    fun consumeRefreshError() {
        _refreshError.value = null
    }

    /** Termin-Update aus dem Detail (z. B. neue RSVP) in die Liste mergen. */
    fun applyUpdatedEvent(updated: Event) {
        val current = _state.value as? EventsUiState.Loaded ?: return
        _state.value = current.copy(
            events = current.events.map { if (it.id == updated.id) updated else it },
        )
    }

    private suspend fun load(showLoadingState: Boolean) {
        val api = api ?: return
        val clubId = clubId ?: return
        if (showLoadingState) _state.value = EventsUiState.Loading
        try {
            coroutineScope {
                val eventsCall = async { api.events(clubId, from = EventsIso.fromQueryString()) }
                // Teams + Roster sind Beiwerk (Pills, Namen, „offen“-Zahl) —
                // ein RLS-403 einer Rolle darf die Liste nicht verhindern.
                val teamsCall = async { bestEffort { api.teams(clubId) } }
                val membersCall = async { bestEffort { api.members(clubId) } }

                val events = eventsCall.await()
                val teams = teamsCall.await()
                val members = membersCall.await()

                _state.value = EventsUiState.Loaded(
                    events = events,
                    teamsById = teams.associateBy { it.id },
                    membersById = members.associateBy { it.id },
                )
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            val message = friendlyMessage(e)
            if (_state.value is EventsUiState.Loaded && !showLoadingState) {
                _refreshError.value = message
            } else {
                _state.value = EventsUiState.Error(message)
            }
        }
    }

    private inline fun <T> bestEffort(block: () -> List<T>): List<T> = try {
        block()
    } catch (e: CancellationException) {
        throw e
    } catch (_: Exception) {
        emptyList()
    }

    companion object {
        /** ApiException trägt bereits einen lesbaren Text (RFC-7807-Titel). */
        fun friendlyMessage(e: Exception): String = e.message ?: e.javaClass.simpleName
    }
}
