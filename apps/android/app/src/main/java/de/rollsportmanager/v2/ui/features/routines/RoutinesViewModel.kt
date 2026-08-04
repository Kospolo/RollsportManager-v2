package de.rollsportmanager.v2.ui.features.routines

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.Routine
import de.rollsportmanager.contracts.RoutineScore
import de.rollsportmanager.v2.network.ApiClient
import de.rollsportmanager.v2.network.members
import de.rollsportmanager.v2.network.routineScores
import de.rollsportmanager.v2.network.routines
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/** Zeile der Küren-Liste: Kür + aufgelöste Läufer:innen + letzte RollArt-Wertung. */
internal data class RoutineListItem(
    val routine: Routine,
    /** Reihenfolge wie `skater_member_ids`. */
    val skaters: List<ClubMember>,
    /** Letzte Gesamtwertung (nach `scored_on`) und Delta zur vorherigen. */
    val lastTotal: Double?,
    val delta: Double?,
) {
    /** "Lina Sommer & Jonas Brandt". */
    val skaterNames: String
        get() = skaters.joinToString(" & ") { "${it.firstName} ${it.lastName}" }
}

internal sealed interface RoutinesUiState {
    data object Loading : RoutinesUiState
    data class Error(val message: String) : RoutinesUiState
    data class Loaded(val items: List<RoutineListItem>) : RoutinesUiState
}

/**
 * Lädt die Küren-Liste: Küren + Mitglieder parallel, danach die Wertungen je
 * Kür parallel. Loading/Error/Loaded mit Retry (Team-Konvention).
 *
 * Hinweis (Contract-Lücke, an Fundament gemeldet): die Listen-Antwort von
 * GET /routines trägt keinen letzten Score, daher N Einzel-Calls auf
 * /routines/{id}/scores — der Ausfall EINER Kür kippt die Liste nicht
 * (die Karte zeigt dann „Noch keine Wertung").
 */
internal class RoutinesViewModel(
    private val api: ApiClient,
    private val clubId: String,
) : ViewModel() {

    private val _state = MutableStateFlow<RoutinesUiState>(RoutinesUiState.Loading)
    val state: StateFlow<RoutinesUiState> = _state

    init {
        load()
    }

    fun load() {
        _state.value = RoutinesUiState.Loading
        viewModelScope.launch {
            try {
                val (routines, members) = coroutineScope {
                    val routinesCall = async { api.routines(clubId) }
                    val membersCall = async { api.members(clubId) }
                    routinesCall.await() to membersCall.await()
                }
                val scoresById: Map<String, List<RoutineScore>> = coroutineScope {
                    routines.map { routine ->
                        async {
                            routine.id to runCatching { api.routineScores(routine.id) }
                                .getOrDefault(emptyList())
                        }
                    }.awaitAll().toMap()
                }
                val membersById = members.associateBy { it.id }
                val items = routines
                    .map { routine ->
                        val totals = scoresById[routine.id].orEmpty()
                            .mapNotNull { score -> score.totalScore?.let { score.scoredOn to it } }
                            .sortedBy { it.first }
                        val last = totals.lastOrNull()?.second
                        val previous = totals.dropLast(1).lastOrNull()?.second
                        RoutineListItem(
                            routine = routine,
                            skaters = routine.skaterMemberIds.mapNotNull { membersById[it] },
                            lastTotal = last,
                            delta = if (last != null && previous != null) last - previous else null,
                        )
                    }
                    .sortedWith(compareBy({ it.routine.status.sortRank }, { it.routine.title }))
                _state.value = RoutinesUiState.Loaded(items)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.value = RoutinesUiState.Error(routinesErrorMessage(e))
            }
        }
    }
}

/** ApiException liefert fertige RFC-7807-Texte; alles andere via message/Klasse. */
internal fun routinesErrorMessage(e: Exception): String =
    e.message ?: e.javaClass.simpleName
