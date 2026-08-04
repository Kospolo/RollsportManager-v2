package de.rollsportmanager.v2.features.members

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import de.rollsportmanager.contracts.AssignableClubRole
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.ClubMemberRoleChange
import de.rollsportmanager.contracts.ClubRole
import de.rollsportmanager.contracts.Guardianship
import de.rollsportmanager.contracts.Invoice
import de.rollsportmanager.contracts.InvoiceStatus
import de.rollsportmanager.contracts.Team
import de.rollsportmanager.v2.network.ApiClient
import de.rollsportmanager.v2.network.ApiException
import de.rollsportmanager.v2.network.changeMemberRole
import de.rollsportmanager.v2.network.guardianships
import de.rollsportmanager.v2.network.invoices
import de.rollsportmanager.v2.network.members
import de.rollsportmanager.v2.network.teams
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Zustand + Ladelogik des Features „Mitglieder“ (Spiegel von iOS
 * MembersViewModel.swift).
 *
 * Pflicht-Call ist die Vereinsliste (`GET /clubs/{id}/members`) — Teams,
 * Familienbeziehungen und Rechnungen sind RLS-abhängige Kür und dürfen
 * still fehlen („Beitragsampel wo sichtbar“).
 */
class MembersViewModel(
    private val api: ApiClient,
    private val clubId: String,
) : ViewModel() {

    sealed interface LoadState {
        data object Loading : LoadState
        data class Failed(val message: String) : LoadState
        data object Loaded : LoadState
    }

    /** Beitragsampel — abgeleitet aus den für den Betrachter sichtbaren Rechnungen. */
    sealed interface FeeStatus {
        /** Mindestens eine offene Rechnung; `level` = höchste Mahnstufe. */
        data class Dunning(val level: Int) : FeeStatus

        /** Rechnungen sichtbar und alle bezahlt. */
        data object Paid : FeeStatus
    }

    /** Fehlgeschlagener Rollenwechsel — Grundlage für die Snackbar im Root. */
    sealed interface RoleChangeFailure {
        /** 403 vom Server → „Keine Berechtigung“. */
        data object Forbidden : RoleChangeFailure

        /** Alles andere (Transport, 409 Last-Owner, …) mit Klartext. */
        data class Other(val message: String) : RoleChangeFailure
    }

    /** Eine Familien-Beziehung aus Sicht des angezeigten Mitglieds. */
    data class FamilyLink(
        val id: String,
        /** Die andere Person der Beziehung. */
        val other: ClubMember,
        /** true = die andere Person ist das Kind, false = erziehungsberechtigt. */
        val otherIsChild: Boolean,
        /** Beziehungscode von der API (Seed: „parent“). */
        val relation: String,
    )

    // --- State ----------------------------------------------------------------

    private val _state = MutableStateFlow<LoadState>(LoadState.Loading)
    val state: StateFlow<LoadState> = _state

    private val _members = MutableStateFlow<List<ClubMember>>(emptyList())
    val members: StateFlow<List<ClubMember>> = _members

    private val _teams = MutableStateFlow<List<Team>>(emptyList())
    val teams: StateFlow<List<Team>> = _teams

    private val _guardianships = MutableStateFlow<List<Guardianship>>(emptyList())
    val guardianships: StateFlow<List<Guardianship>> = _guardianships

    private val _invoices = MutableStateFlow<List<Invoice>>(emptyList())
    val invoices: StateFlow<List<Invoice>> = _invoices

    private val _searchText = MutableStateFlow("")
    val searchText: StateFlow<String> = _searchText

    private val _roleFilter = MutableStateFlow<ClubRole?>(null)
    val roleFilter: StateFlow<ClubRole?> = _roleFilter

    private val _roleChangeFailure = MutableStateFlow<RoleChangeFailure?>(null)
    val roleChangeFailure: StateFlow<RoleChangeFailure?> = _roleChangeFailure

    private val _isChangingRole = MutableStateFlow(false)
    val isChangingRole: StateFlow<Boolean> = _isChangingRole

    /** Liste nach Suchtext (Name/E-Mail) und Rollen-Filter. */
    val filteredMembers: StateFlow<List<ClubMember>> =
        combine(_members, _searchText, _roleFilter) { all, query, role ->
            val needle = query.trim()
            all.filter { member ->
                (role == null || member.role == role) &&
                    (
                        needle.isEmpty() ||
                            member.membersFullName.contains(needle, ignoreCase = true) ||
                            member.email?.contains(needle, ignoreCase = true) == true
                        )
            }
        }.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    init {
        load()
    }

    // --- Laden ------------------------------------------------------------------

    fun load() {
        viewModelScope.launch {
            _state.value = LoadState.Loading
            coroutineScope {
                // Kür-Daten parallel anstoßen; Fehlschläge (RLS, Rolle) bewusst
                // schlucken — die Liste funktioniert auch ohne Team-Namen,
                // Ampel und Familie.
                val teamsCall = async { runCatching { api.teams(clubId) } }
                val guardianshipsCall = async { runCatching { api.guardianships(clubId) } }
                val invoicesCall = async { runCatching { api.invoices(clubId) } }

                try {
                    val roster = api.members(clubId)
                    _members.value = roster.sortedWith(
                        compareBy<ClubMember, String>(String.CASE_INSENSITIVE_ORDER) { it.lastName }
                            .thenBy(String.CASE_INSENSITIVE_ORDER) { it.firstName },
                    )
                    _state.value = LoadState.Loaded
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    _state.value = LoadState.Failed(messageFor(e))
                }

                _teams.value = teamsCall.await().getOrDefault(emptyList())
                _guardianships.value = guardianshipsCall.await().getOrDefault(emptyList())
                _invoices.value = invoicesCall.await().getOrDefault(emptyList())
            }
        }
    }

    // --- Filter -------------------------------------------------------------------

    fun onSearchChange(value: String) {
        _searchText.value = value
    }

    fun onRoleFilterChange(role: ClubRole?) {
        _roleFilter.value = role
    }

    fun resetFilters() {
        _searchText.value = ""
        _roleFilter.value = null
    }

    // --- Rollenwechsel (optimistisch, mit Rollback) ---------------------------------

    /**
     * PATCH /clubs/{clubId}/members/{memberId}/role — optimistisch:
     * die Zeile wechselt sofort, der Server-Stand ersetzt sie danach.
     * Bei Fehler kommt der alte Stand zurück; 403 → [RoleChangeFailure.Forbidden]
     * („Keine Berechtigung“-Snackbar), Rest → Klartext.
     */
    fun changeRole(member: ClubMember, newRole: AssignableClubRole) {
        val optimistic = newRole.asClubRole()
        if (_isChangingRole.value || member.role == optimistic) return
        if (_members.value.none { it.id == member.id }) return

        _isChangingRole.value = true
        replaceMember(member.copy(role = optimistic))

        viewModelScope.launch {
            try {
                val updated = api.changeMemberRole(
                    clubId = clubId,
                    memberId = member.id,
                    change = ClubMemberRoleChange(role = newRole),
                )
                replaceMember(updated)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                replaceMember(member) // Rollback auf den alten Stand
                _roleChangeFailure.value =
                    if (e is ApiException.ProblemResponse && e.problem.status == 403L) {
                        RoleChangeFailure.Forbidden
                    } else {
                        RoleChangeFailure.Other(messageFor(e))
                    }
            } finally {
                _isChangingRole.value = false
            }
        }
    }

    fun dismissRoleChangeFailure() {
        _roleChangeFailure.value = null
    }

    // --- Helfer ------------------------------------------------------------------

    private fun replaceMember(updated: ClubMember) {
        _members.update { list -> list.map { if (it.id == updated.id) updated else it } }
    }

    private fun messageFor(e: Exception): String =
        e.message ?: e.javaClass.simpleName
}

// ============================================================================
// Pure Ableitungen (testbar, ohne UI) — arbeiten auf den eingesammelten
// Flow-Snapshots der Screens.
// ============================================================================

/** Anzeigename „Vorname Nachname“ — eigener Name wg. Kollisionsschutz Parallel-Teams. */
internal val ClubMember.membersFullName: String
    get() = "$firstName $lastName"

/** Zuweisbare Rolle → Anzeige-Rolle (Wire-Namen sind identisch, OWNER fehlt bewusst). */
internal fun AssignableClubRole.asClubRole(): ClubRole = when (this) {
    AssignableClubRole.ADMIN -> ClubRole.ADMIN
    AssignableClubRole.MODERATOR -> ClubRole.MODERATOR
    AssignableClubRole.TREASURER -> ClubRole.TREASURER
    AssignableClubRole.COACH -> ClubRole.COACH
    AssignableClubRole.MEMBER -> ClubRole.MEMBER
    AssignableClubRole.GUEST_COACH -> ClubRole.GUEST_COACH
}

/** Team-Namen („Sternchen · Minis“) — null ohne Team oder ohne /teams-Sicht. */
internal fun membersTeamNames(member: ClubMember, teams: List<Team>): String? {
    val names = member.teamIds.mapNotNull { teamId -> teams.firstOrNull { it.id == teamId }?.name }
    return names.takeIf { it.isNotEmpty() }?.joinToString(" · ")
}

/**
 * Beitragsampel — null, wenn für dieses Mitglied keine Rechnungen sichtbar
 * sind (RLS: Mitglieder sehen nur die eigene Familie).
 */
internal fun membersFeeStatus(
    member: ClubMember,
    invoices: List<Invoice>,
): MembersViewModel.FeeStatus? {
    val visible = invoices.filter { it.memberId == member.id }
    val worstOpen = visible
        .filter { it.status == InvoiceStatus.OPEN }
        .maxOfOrNull { it.dunningLevel }
    if (worstOpen != null) return MembersViewModel.FeeStatus.Dunning(level = worstOpen.toInt())
    if (visible.any { it.status == InvoiceStatus.PAID }) return MembersViewModel.FeeStatus.Paid
    return null
}

/** Familien-Beziehungen des Mitglieds, aufgelöst gegen die Vereinsliste. */
internal fun membersFamilyLinks(
    member: ClubMember,
    guardianships: List<Guardianship>,
    roster: List<ClubMember>,
): List<MembersViewModel.FamilyLink> = guardianships.mapNotNull { guardianship ->
    when (member.id) {
        guardianship.guardianMemberId ->
            roster.firstOrNull { it.id == guardianship.childMemberId }?.let { child ->
                MembersViewModel.FamilyLink(
                    id = guardianship.id,
                    other = child,
                    otherIsChild = true,
                    relation = guardianship.relation,
                )
            }

        guardianship.childMemberId ->
            roster.firstOrNull { it.id == guardianship.guardianMemberId }?.let { guardian ->
                MembersViewModel.FamilyLink(
                    id = guardianship.id,
                    other = guardian,
                    otherIsChild = false,
                    relation = guardianship.relation,
                )
            }

        else -> null
    }
}
