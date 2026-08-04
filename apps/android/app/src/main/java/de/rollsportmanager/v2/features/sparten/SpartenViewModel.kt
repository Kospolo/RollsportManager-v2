package de.rollsportmanager.v2.features.sparten

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.rollsportmanager.contracts.Sparte
import de.rollsportmanager.contracts.Team
import de.rollsportmanager.v2.network.ApiClient
import de.rollsportmanager.v2.network.sparten
import de.rollsportmanager.v2.network.teams
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Zustand des Features „Sparten“ (Verein → Sparten → Teams).
 *
 * Pflicht-Call ist `GET /clubs/{id}/sparten`; die Teams sind Kür und dienen
 * nur der Anzahl je Sparte. Sparten mit `eigeneFinanzen` werden als Merkmal
 * angezeigt — aber ohne jeden Betrag: das ist eine Struktur-Information,
 * keine Finanzansicht.
 */
class SpartenViewModel(
    private val api: ApiClient,
    private val clubId: String,
) : ViewModel() {

    sealed interface LoadState {
        data object Loading : LoadState
        data class Failed(val message: String) : LoadState
        data object Loaded : LoadState
    }

    private val _state = MutableStateFlow<LoadState>(LoadState.Loading)
    val state: StateFlow<LoadState> = _state

    private val _sparten = MutableStateFlow<List<Sparte>>(emptyList())
    val sparten: StateFlow<List<Sparte>> = _sparten

    private val _teams = MutableStateFlow<List<Team>>(emptyList())
    val teams: StateFlow<List<Team>> = _teams

    init {
        load()
    }

    /** Anzahl Teams je Sparte — nur aus den sichtbaren Teams gezählt. */
    fun teamCount(sparteId: String): Int = _teams.value.count { it.sparteId == sparteId }

    fun load() {
        viewModelScope.launch {
            _state.value = LoadState.Loading
            try {
                coroutineScope {
                    val teamsDeferred = async { runCatching { api.teams(clubId) } }
                    val loadedSparten = api.sparten(clubId)

                    // Anzeige-Reihenfolge kommt vom Verein (`sortierung`),
                    // Gleichstand alphabetisch — nie zufällige Serverordnung.
                    _sparten.value = loadedSparten.sortedWith(
                        compareBy({ it.sortierung }, { it.name.lowercase() }),
                    )
                    _teams.value = teamsDeferred.await().getOrDefault(emptyList())
                }
                _state.value = LoadState.Loaded
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.value = LoadState.Failed(e.message ?: e.javaClass.simpleName)
            }
        }
    }
}
