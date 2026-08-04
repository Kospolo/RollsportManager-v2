package de.rollsportmanager.v2.features.teams

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.Sparte
import de.rollsportmanager.contracts.Team
import de.rollsportmanager.v2.network.ApiClient
import de.rollsportmanager.v2.network.members
import de.rollsportmanager.v2.network.sparten
import de.rollsportmanager.v2.network.teams
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Zustand + Ladelogik des Features „Teams“ (Verein → Sparten → Teams).
 *
 * Pflicht-Call ist `GET /clubs/{id}/teams`. Mitglieder und Sparten sind
 * RLS-abhängige Kür: Wer sie nicht sehen darf, bekommt 403 — dann bleibt die
 * jeweilige Liste leer und der Screen zeigt einfach weniger, statt zu
 * scheitern (gleiches Muster wie MembersViewModel).
 *
 * KINDERSCHUTZ: Teams bestehen überwiegend aus Kindern. Dieses ViewModel
 * liefert deshalb bewusst NUR Namen und Rollen — keine Rechnungen, keine
 * Mahnstufen, keine Fotos. Die Identität trägt im UI das Monogramm
 * (RsmAvatar mit personId), nie ein Bild über den Member-Pfad.
 */
class TeamsViewModel(
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

    private val _teams = MutableStateFlow<List<Team>>(emptyList())
    val teams: StateFlow<List<Team>> = _teams

    private val _members = MutableStateFlow<List<ClubMember>>(emptyList())
    val members: StateFlow<List<ClubMember>> = _members

    private val _sparten = MutableStateFlow<List<Sparte>>(emptyList())
    val sparten: StateFlow<List<Sparte>> = _sparten

    private val _searchText = MutableStateFlow("")
    val searchText: StateFlow<String> = _searchText

    /**
     * Teams nach Sparte gruppiert und stabil sortiert: Sparten in ihrer
     * `sortierung`, Teams alphabetisch. Teams ohne Sparte landen in einer
     * eigenen Gruppe am Ende (Sparte = null ist erlaubt).
     */
    val groupedTeams: StateFlow<List<TeamsGroup>> =
        combine(_teams, _sparten, _searchText) { teams, sparten, query ->
            val matching = teams.filter { team ->
                query.isBlank() ||
                    team.name.contains(query, ignoreCase = true) ||
                    team.ageGroup?.contains(query, ignoreCase = true) == true
            }
            val bySparteId = sparten.associateBy { it.id }
            matching
                .groupBy { it.sparteId }
                .map { (sparteId, group) ->
                    TeamsGroup(
                        sparte = sparteId?.let { bySparteId[it] },
                        teams = group.sortedBy { it.name.lowercase() },
                    )
                }
                // Ohne-Sparte-Gruppe ans Ende, sonst nach Sparten-Sortierung.
                .sortedWith(
                    compareBy(
                        { it.sparte == null },
                        { it.sparte?.sortierung ?: Long.MAX_VALUE },
                        { it.sparte?.name?.lowercase() ?: "" },
                    ),
                )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        load()
    }

    fun onSearchChange(value: String) {
        _searchText.value = value
    }

    fun resetFilters() {
        _searchText.value = ""
    }

    fun load() {
        viewModelScope.launch {
            _state.value = LoadState.Loading
            try {
                coroutineScope {
                    // Kür-Calls parallel, aber einzeln fehlertolerant: ein 403
                    // auf Mitglieder/Sparten darf den Screen nicht kippen.
                    val membersDeferred = async { runCatching { api.members(clubId) } }
                    val spartenDeferred = async { runCatching { api.sparten(clubId) } }

                    val loadedTeams = api.teams(clubId)

                    _teams.value = loadedTeams
                    _members.value = membersDeferred.await().getOrDefault(emptyList())
                    _sparten.value = spartenDeferred.await().getOrDefault(emptyList())
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

/** Eine Sparten-Gruppe der Teamliste; `sparte == null` = „Ohne Sparte“. */
data class TeamsGroup(
    val sparte: Sparte?,
    val teams: List<Team>,
)

// ============================================================================
// Pure Ableitungen (testbar, ohne UI)
// ============================================================================

/** Anzeigename „Vorname Nachname“ — eigener Name wg. Kollisionsschutz Parallel-Teams. */
internal val ClubMember.teamsFullName: String
    get() = "$firstName $lastName"

/** Mitglieder zu IDs auflösen; unbekannte IDs fallen still weg (RLS-Sicht). */
internal fun teamsResolveMembers(ids: List<String>, all: List<ClubMember>): List<ClubMember> {
    val byId = all.associateBy { it.id }
    return ids.mapNotNull { byId[it] }.sortedBy { it.teamsFullName.lowercase() }
}
