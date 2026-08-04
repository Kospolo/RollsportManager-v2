package de.rollsportmanager.v2.ui.features.events

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import de.rollsportmanager.contracts.Attendance
import de.rollsportmanager.contracts.AttendanceStatus
import de.rollsportmanager.contracts.AttendanceUpsert
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.ClubRole
import de.rollsportmanager.contracts.Event
import de.rollsportmanager.contracts.EventRsvp
import de.rollsportmanager.contracts.EventRsvpUpsert
import de.rollsportmanager.contracts.RsvpStatus
import de.rollsportmanager.contracts.Team
import de.rollsportmanager.v2.network.ApiClient
import de.rollsportmanager.v2.network.attendance
import de.rollsportmanager.v2.network.putAttendance
import de.rollsportmanager.v2.network.putRsvp
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Detail-ViewModel eines Termins: eigene Zu-/Absage (PUT rsvp, optimistisch
 * mit Rollback + Fehler-Snackbar) und Trainer-Anwesenheit (GET/PUT attendance).
 * (Spiegel von iOS EventDetailViewModel.swift.)
 */
class EventDetailViewModel(
    initialEvent: Event,
    private val api: ApiClient,
    private val clubId: String,
    val myMemberId: String,
    clubRole: ClubRole?,
    val teamsById: Map<String, Team>,
    val membersById: Map<String, ClubMember>,
    private val onEventUpdated: (Event) -> Unit,
) : ViewModel() {

    private val _event = MutableStateFlow(initialEvent)
    val event: StateFlow<Event> = _event

    private val _isSavingRsvp = MutableStateFlow(false)
    val isSavingRsvp: StateFlow<Boolean> = _isSavingRsvp

    /** Absage-Kommentar-Bereich (aufgeklappt nach Tipp auf „Absagen“). */
    private val _isDeclineExpanded = MutableStateFlow(false)
    val isDeclineExpanded: StateFlow<Boolean> = _isDeclineExpanded

    private val _declineComment = MutableStateFlow("")
    val declineComment: StateFlow<String> = _declineComment

    /** Fehler aus RSVP/Anwesenheit — die View zeigt daraus eine Snackbar. */
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage

    private val _attendanceByMember = MutableStateFlow<Map<String, Attendance>>(emptyMap())
    val attendanceByMember: StateFlow<Map<String, Attendance>> = _attendanceByMember

    /**
     * Anwesenheit erfassen dürfen Coach und höher, inkl. guest_coach
     * (Spec: PUT /events/{eventId}/attendance).
     */
    val canMarkAttendance: Boolean = clubRole != null && clubRole in setOf(
        ClubRole.OWNER, ClubRole.ADMIN, ClubRole.COACH, ClubRole.GUEST_COACH,
    )

    private var hasLoadedAttendance = false

    init {
        val mine = initialEvent.rsvps.firstOrNull { it.memberId == myMemberId }
        if (mine?.status == RsvpStatus.DECLINED) {
            _declineComment.value = mine.comment.orEmpty()
        }
    }

    // --- Sync mit der Liste ----------------------------------------------------

    /** Aktuellsten Listen-Stand übernehmen (nicht mitten im optimistischen Save). */
    fun syncFromList(event: Event) {
        if (!_isSavingRsvp.value) _event.value = event
    }

    fun setDeclineComment(value: String) {
        _declineComment.value = value
    }

    fun consumeError() {
        _errorMessage.value = null
    }

    // --- Eigene Rückmeldung (PUT rsvp, optimistisch) -----------------------------

    /**
     * Zusage/Vielleicht senden sofort; „Absagen“ klappt erst den
     * Kommentar-Bereich auf (Kommentar bei Absage, dann [sendDecline]).
     */
    fun selectStatus(status: RsvpStatus) {
        if (status == RsvpStatus.DECLINED) {
            _isDeclineExpanded.value = true
            return
        }
        _isDeclineExpanded.value = false
        viewModelScope.launch { putMyRsvp(status, comment = null) }
    }

    fun sendDecline() {
        viewModelScope.launch {
            val trimmed = _declineComment.value.trim()
            val ok = putMyRsvp(RsvpStatus.DECLINED, comment = trimmed.ifEmpty { null })
            if (ok) _isDeclineExpanded.value = false
        }
    }

    private suspend fun putMyRsvp(status: RsvpStatus, comment: String?): Boolean {
        if (_isSavingRsvp.value || myMemberId.isEmpty()) return false
        _isSavingRsvp.value = true

        // Optimistisch: sofort lokal eintragen, bei Fehler zurückrollen.
        val previousRsvps = _event.value.rsvps
        val myCurrent = previousRsvps.firstOrNull { it.memberId == myMemberId }
        replaceRsvp(
            EventRsvp(
                id = myCurrent?.id ?: "optimistic-${UUID.randomUUID()}",
                clubId = _event.value.clubId,
                eventId = _event.value.id,
                memberId = myMemberId,
                status = status,
                comment = comment,
                respondedAt = EventsIso.nowString(),
            ),
        )

        return try {
            val saved = api.putRsvp(
                eventId = _event.value.id,
                upsert = EventRsvpUpsert(memberId = myMemberId, status = status, comment = comment),
            )
            replaceRsvp(saved)
            true
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            _event.value = _event.value.copy(rsvps = previousRsvps)
            onEventUpdated(_event.value)
            _errorMessage.value = EventsViewModel.friendlyMessage(e)
            false
        } finally {
            _isSavingRsvp.value = false
        }
    }

    private fun replaceRsvp(rsvp: EventRsvp) {
        val others = _event.value.rsvps.filter { it.memberId != rsvp.memberId }
        _event.value = _event.value.copy(rsvps = others + rsvp)
        onEventUpdated(_event.value)
    }

    // --- Anwesenheit (Trainer-Sicht) ---------------------------------------------

    fun loadAttendanceIfNeeded() {
        if (!canMarkAttendance || hasLoadedAttendance) return
        hasLoadedAttendance = true
        viewModelScope.launch {
            try {
                val records = api.attendance(clubId = clubId, eventId = _event.value.id)
                _attendanceByMember.value = records.associateBy { it.memberId }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                hasLoadedAttendance = false // nächstes Öffnen versucht es erneut
                _errorMessage.value = EventsViewModel.friendlyMessage(e)
            }
        }
    }

    /** Anwesenheits-Status setzen — optimistisch mit Rollback + Snackbar. */
    fun setAttendance(memberId: String, status: AttendanceStatus) {
        viewModelScope.launch {
            val previous = _attendanceByMember.value[memberId]
            _attendanceByMember.value = _attendanceByMember.value + (
                memberId to Attendance(
                    id = previous?.id ?: "optimistic-${UUID.randomUUID()}",
                    clubId = _event.value.clubId,
                    eventId = _event.value.id,
                    memberId = memberId,
                    status = status,
                    checkedInAt = previous?.checkedInAt,
                )
                )
            try {
                val saved = api.putAttendance(
                    eventId = _event.value.id,
                    upsert = AttendanceUpsert(memberId = memberId, status = status, checkedInAt = null),
                )
                _attendanceByMember.value = _attendanceByMember.value + (memberId to saved)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _attendanceByMember.value = if (previous != null) {
                    _attendanceByMember.value + (memberId to previous)
                } else {
                    _attendanceByMember.value - memberId
                }
                _errorMessage.value = EventsViewModel.friendlyMessage(e)
            }
        }
    }

    companion object {
        /** Factory für `viewModel(key = "event_detail_<id>")` — kein Hilt (Blueprint). */
        fun factory(
            event: Event,
            api: ApiClient,
            clubId: String,
            myMemberId: String,
            clubRole: ClubRole?,
            teamsById: Map<String, Team>,
            membersById: Map<String, ClubMember>,
            onEventUpdated: (Event) -> Unit,
        ): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T =
                EventDetailViewModel(
                    initialEvent = event,
                    api = api,
                    clubId = clubId,
                    myMemberId = myMemberId,
                    clubRole = clubRole,
                    teamsById = teamsById,
                    membersById = membersById,
                    onEventUpdated = onEventUpdated,
                ) as T
        }
    }
}
