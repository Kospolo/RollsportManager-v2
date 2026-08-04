package de.rollsportmanager.v2.ui.features.finance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.rollsportmanager.contracts.DunningRunRequest
import de.rollsportmanager.contracts.DunningRunResult
import de.rollsportmanager.contracts.Invoice
import de.rollsportmanager.contracts.InvoiceStatus
import de.rollsportmanager.v2.auth.SessionStore
import de.rollsportmanager.v2.network.ApiException
import de.rollsportmanager.v2.network.dunningRun
import de.rollsportmanager.v2.network.invoices
import de.rollsportmanager.v2.network.members
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Filter-Chips über der Offene-Posten-Liste (Design-System §3.3):
 * Alle · Offen · Erinnert · Gemahnt — gefiltert wird nach Mahnstufe
 * innerhalb der offenen Rechnungen (Spiegel der iOS-`FinanceFilter`).
 */
enum class FinanceFilter {
    ALL, OPEN, REMINDED, DUNNED;

    fun matches(invoice: Invoice): Boolean = when (this) {
        ALL -> true
        OPEN -> invoice.dunningLevel <= 0L
        REMINDED -> invoice.dunningLevel == 1L
        DUNNED -> invoice.dunningLevel >= 2L
    }
}

/** Ladezustand des Screens — Fehler mit Retry (Blueprint-Konvention). */
sealed interface FinanceLoadState {
    data object Loading : FinanceLoadState
    /** `forbidden` mappt die UI auf den freundlichen 403-Hinweistext. */
    data class Error(val message: String, val forbidden: Boolean) : FinanceLoadState
    data object Loaded : FinanceLoadState
}

/**
 * Zustand des Vorschau-Mahnlaufs; das Ergebnis liegt separat in
 * [FinanceViewModel.dunningResult], damit das Sheet nach einem
 * späteren Fehler nicht verschwindet.
 */
sealed interface FinanceDunningState {
    data object Idle : FinanceDunningState
    data object Running : FinanceDunningState
    data object Forbidden : FinanceDunningState
    data class Error(val message: String) : FinanceDunningState
}

/**
 * Lädt Rechnungen + Mitgliedsnamen über `SessionStore.api` (nie eigener
 * Client — Token/Logout greifen automatisch) und hält den Zustand des
 * Vorschau-Mahnlaufs. Der Lauf ist IMMER `dry_run = true` — scharfe
 * Läufe gibt es in diesem Screen bewusst nicht (UI-Freigabe-Regel).
 */
class FinanceViewModel(private val session: SessionStore) : ViewModel() {

    private val _state = MutableStateFlow<FinanceLoadState>(FinanceLoadState.Loading)
    val state: StateFlow<FinanceLoadState> = _state

    /** Nur offene Rechnungen — Basis für KPI, Liste und Summen. */
    private val _openInvoices = MutableStateFlow<List<Invoice>>(emptyList())
    val openInvoices: StateFlow<List<Invoice>> = _openInvoices

    /** member_id → Anzeigename; leer, wenn /members für die Rolle tabu ist. */
    private val _memberNames = MutableStateFlow<Map<String, String>>(emptyMap())
    val memberNames: StateFlow<Map<String, String>> = _memberNames

    private val _filter = MutableStateFlow(FinanceFilter.ALL)
    val filter: StateFlow<FinanceFilter> = _filter

    private val _dunningState = MutableStateFlow<FinanceDunningState>(FinanceDunningState.Idle)
    val dunningState: StateFlow<FinanceDunningState> = _dunningState

    /** Ergebnis des Dry-Runs — nicht-null öffnet das BottomSheet. */
    private val _dunningResult = MutableStateFlow<DunningRunResult?>(null)
    val dunningResult: StateFlow<DunningRunResult?> = _dunningResult

    init {
        load()
    }

    fun setFilter(filter: FinanceFilter) {
        _filter.value = filter
    }

    // --- Laden ----------------------------------------------------------------

    fun load() {
        viewModelScope.launch {
            if (_openInvoices.value.isEmpty()) _state.value = FinanceLoadState.Loading
            try {
                val loaded = session.api.invoices(session.clubId)
                _openInvoices.value = loaded
                    .filter { it.status == InvoiceStatus.OPEN }
                    .sortedWith(
                        // Höchste Mahnstufe zuerst, innerhalb der Stufe älteste
                        // Fälligkeit oben (ISO-Strings sortieren lexikografisch korrekt).
                        compareByDescending<Invoice> { it.dunningLevel }
                            .thenBy { it.dueOn ?: it.createdAt },
                    )
                _state.value = FinanceLoadState.Loaded
                loadMemberNames()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.value = FinanceLoadState.Error(
                    message = e.message ?: e.javaClass.simpleName,
                    forbidden = e.isForbidden(),
                )
            }
        }
    }

    /**
     * Namen sind Beiwerk: Schlägt /members fehl (z. B. RLS der Rolle),
     * zeigt die Liste eben „Mitglied“ + Rechnungsnummer — kein Grund,
     * den ganzen Screen zu kippen.
     */
    private suspend fun loadMemberNames() {
        val loadedMembers = runCatching { session.api.members(session.clubId) }.getOrNull() ?: return
        _memberNames.value = loadedMembers.associate { it.id to "${it.firstName} ${it.lastName}" }
    }

    // --- Mahnlauf (Vorschau) ----------------------------------------------------

    /**
     * POST /clubs/{id}/dunning/run mit `dry_run = true` — 403 (kein
     * Kassenwart/Vorstand) wird als freundlicher Hinweis gemappt.
     */
    fun runDunningPreview() {
        if (_dunningState.value == FinanceDunningState.Running) return
        viewModelScope.launch {
            _dunningState.value = FinanceDunningState.Running
            try {
                val result = session.api.dunningRun(
                    session.clubId,
                    DunningRunRequest(dryRun = true),
                )
                _dunningState.value = FinanceDunningState.Idle
                _dunningResult.value = result
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _dunningState.value = if (e.isForbidden()) {
                    FinanceDunningState.Forbidden
                } else {
                    FinanceDunningState.Error(e.message ?: e.javaClass.simpleName)
                }
            }
        }
    }

    fun dismissDunningResult() {
        _dunningResult.value = null
    }

    private fun Exception.isForbidden(): Boolean =
        (this as? ApiException.ProblemResponse)?.problem?.status == 403L
}
