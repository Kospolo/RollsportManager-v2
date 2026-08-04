package de.rollsportmanager.v2.ui.features.routines

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.rollsportmanager.contracts.RoutineMarker
import de.rollsportmanager.contracts.RoutineScore
import de.rollsportmanager.v2.network.ApiClient
import de.rollsportmanager.v2.network.competitions
import de.rollsportmanager.v2.network.routineMarkers
import de.rollsportmanager.v2.network.routineScores
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Lädt die Detail-Daten einer Kür: Marker + Wertungen (Pflicht) und die
 * Wettkampf-Namen (Beiwerk — ein Ausfall kippt das Detail nicht, die
 * Verlaufszeilen zeigen dann den generischen Titel „Wettkampf").
 */
internal class RoutineDetailViewModel(
    private val api: ApiClient,
    private val clubId: String,
    private val routineId: String,
) : ViewModel() {

    data class Details(
        /** Nach `time_ms` sortiert. */
        val markers: List<RoutineMarker>,
        /** Nach `scored_on` sortiert, nur Einträge mit `total_score`. */
        val scores: List<RoutineScore>,
        /** competition_id → Name. */
        val competitionNames: Map<String, String>,
    )

    sealed interface State {
        data object Loading : State
        data class Error(val message: String) : State
        data class Loaded(val details: Details) : State
    }

    private val _state = MutableStateFlow<State>(State.Loading)
    val state: StateFlow<State> = _state

    init {
        load()
    }

    fun load() {
        _state.value = State.Loading
        viewModelScope.launch {
            try {
                val details = coroutineScope {
                    val markersCall = async { api.routineMarkers(routineId) }
                    val scoresCall = async { api.routineScores(routineId) }
                    val competitionsCall = async {
                        runCatching { api.competitions(clubId) }.getOrDefault(emptyList())
                    }
                    Details(
                        markers = markersCall.await().sortedBy { it.timeMs ?: 0L },
                        scores = scoresCall.await()
                            .filter { it.totalScore != null }
                            .sortedBy { it.scoredOn },
                        competitionNames = competitionsCall.await().associate { it.id to it.name },
                    )
                }
                _state.value = State.Loaded(details)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.value = State.Error(routinesErrorMessage(e))
            }
        }
    }
}
