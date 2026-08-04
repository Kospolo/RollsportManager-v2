package de.rollsportmanager.v2.features.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.rollsportmanager.contracts.Task
import de.rollsportmanager.v2.network.ApiClient
import de.rollsportmanager.v2.network.competitions
import de.rollsportmanager.v2.network.events
import de.rollsportmanager.v2.network.invoices
import de.rollsportmanager.v2.network.members
import de.rollsportmanager.v2.network.setTaskDone
import de.rollsportmanager.v2.network.tasks
import java.time.ZonedDateTime
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Lädt und hält die Dashboard-Daten (Loading/Error/Loaded) und kümmert
 * sich ums Aufgaben-Abhaken — optimistisch mit Rollback (Spiegel von
 * iOS DashboardViewModel.swift).
 *
 * Der ApiClient kommt IMMER aus dem SessionStore (`session.api`) und wird
 * pro Aufruf hereingereicht — so greifen Token-Wechsel/Logout automatisch.
 * Achtung: `Task` ist die Contracts-Data-Class, nicht Coroutines.
 */
class DashboardViewModel : ViewModel() {

    private val _state = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val state: StateFlow<DashboardUiState> = _state

    /** Pull-to-Refresh läuft gerade (Indicator der PullToRefreshBox). */
    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing

    /**
     * Fehler beim Pull-to-Refresh, wenn schon Daten auf dem Schirm sind —
     * die bleiben stehen, der Fehler kommt als Banner.
     */
    private val _refreshError = MutableStateFlow<String?>(null)
    val refreshError: StateFlow<String?> = _refreshError

    /** Fehler beim Abhaken einer Aufgabe (der Haken springt dann zurück). */
    private val _taskError = MutableStateFlow<String?>(null)
    val taskError: StateFlow<String?> = _taskError

    /** Aufgaben, deren PATCH gerade läuft (Zeile gesperrt, Spinner). */
    private val _pendingTaskIds = MutableStateFlow<Set<String>>(emptySet())
    val pendingTaskIds: StateFlow<Set<String>> = _pendingTaskIds

    private var hasLoaded = false

    companion object {
        /** Wie weit „demnächst" reicht (Kalendertage ab heute 0:00). */
        const val UPCOMING_WINDOW_DAYS = 14L
    }

    // --- Laden ----------------------------------------------------------------

    /** Erstes Laden beim Erscheinen — lädt genau einmal (Tab-Wechsel feuern erneut). */
    fun loadIfNeeded(api: ApiClient, clubId: String) {
        if (hasLoaded) return
        hasLoaded = true
        viewModelScope.launch {
            _state.value = DashboardUiState.Loading
            load(api, clubId, keepContentOnError = false)
        }
    }

    /** Pull-to-Refresh: lädt still neu; bei Fehlern bleiben die alten Daten stehen. */
    fun refresh(api: ApiClient, clubId: String) {
        if (_isRefreshing.value) return
        viewModelScope.launch {
            _isRefreshing.value = true
            try {
                load(api, clubId, keepContentOnError = true)
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    /** Retry-Button im Fehlerzustand. */
    fun retry(api: ApiClient, clubId: String) {
        viewModelScope.launch {
            _state.value = DashboardUiState.Loading
            load(api, clubId, keepContentOnError = false)
        }
    }

    private suspend fun load(api: ApiClient, clubId: String, keepContentOnError: Boolean) {
        _refreshError.value = null
        val now = ZonedDateTime.now()
        val windowStart = now.toLocalDate().atStartOfDay(now.zone)
        val windowEnd = windowStart.plusDays(UPCOMING_WINDOW_DAYS)

        try {
            // Alle fünf Quellen parallel — das Dashboard ist ein Sammelblick.
            val data = coroutineScope {
                val members = async { api.members(clubId) }
                val events = async {
                    api.events(
                        clubId = clubId,
                        // Volles date-time — die API lehnt reines yyyy-MM-dd mit 400 ab.
                        from = DashboardFormat.apiDateTime(windowStart),
                        to = DashboardFormat.apiDateTime(windowEnd),
                    )
                }
                val competitions = async { api.competitions(clubId) }
                val invoices = async { api.invoices(clubId) }
                val tasks = async { api.tasks(clubId) }
                DashboardData.build(
                    members = members.await(),
                    events = events.await(),
                    competitions = competitions.await(),
                    invoices = invoices.await(),
                    tasks = tasks.await(),
                    now = now,
                )
            }
            _state.value = DashboardUiState.Loaded(data)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            val message = e.message ?: e.javaClass.simpleName
            if (keepContentOnError && _state.value is DashboardUiState.Loaded) {
                _refreshError.value = message
            } else {
                _state.value = DashboardUiState.Error(message)
            }
        }
    }

    // --- Aufgaben abhaken (optimistisch mit Rollback) ---------------------------

    fun toggleTask(task: Task, api: ApiClient) {
        val loaded = _state.value as? DashboardUiState.Loaded ?: return
        if (task.id in _pendingTaskIds.value) return
        val current = loaded.data.tasks.firstOrNull { it.id == task.id } ?: return

        val newDone = !current.done
        _pendingTaskIds.value = _pendingTaskIds.value + task.id
        _taskError.value = null

        // Optimistisch: Haken sofort setzen, Reihenfolge NICHT neu sortieren
        // (kein Springen unterm Finger).
        replaceTask(task.id) { it.copy(done = newDone) }

        viewModelScope.launch {
            try {
                val updated = api.setTaskDone(task.id, newDone)
                replaceTask(task.id) { updated }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Rollback: Haken zurück, Fehler in Klartext (z. B. 403 für member).
                replaceTask(task.id) { it.copy(done = !newDone) }
                _taskError.value = e.message ?: e.javaClass.simpleName
            } finally {
                _pendingTaskIds.value = _pendingTaskIds.value - task.id
            }
        }
    }

    private fun replaceTask(taskId: String, transform: (Task) -> Task) {
        val loaded = _state.value as? DashboardUiState.Loaded ?: return
        val newTasks = loaded.data.tasks.map { if (it.id == taskId) transform(it) else it }
        _state.value = DashboardUiState.Loaded(loaded.data.copy(tasks = newTasks))
    }
}
