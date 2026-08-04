package de.rollsportmanager.v2.features.dashboard

import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.Competition
import de.rollsportmanager.contracts.CompetitionEntryStatus
import de.rollsportmanager.contracts.CompetitionStatus
import de.rollsportmanager.contracts.Event
import de.rollsportmanager.contracts.Invoice
import de.rollsportmanager.contracts.InvoiceStatus
import de.rollsportmanager.contracts.MemberStatus
import de.rollsportmanager.contracts.RsvpStatus
import de.rollsportmanager.contracts.Task
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit

/** Ladezustand des Dashboards — ein Screen, drei klare Zustände. */
sealed interface DashboardUiState {
    data object Loading : DashboardUiState
    data class Error(val message: String) : DashboardUiState
    data class Loaded(val data: DashboardData) : DashboardUiState
}

/**
 * Antwort-Zusammenfassung eines Termins: Klartext-Zeile + Response-Balken.
 * „Vielleicht" zählt als offen (unentschieden), „krank" als Absage.
 */
data class DashboardResponseSummary(
    val going: Int,
    val declined: Int,
    val open: Int,
)

/**
 * Aggregierte, fürs UI vorgerechnete Dashboard-Daten (Spiegel von
 * iOS DashboardModels.swift).
 *
 * RLS-Hinweis: Rechnungen kommen rollenabhängig gefiltert von der API
 * (member sieht nur eigene, coach ggf. gar keine) — die Beitrags-KPI ist
 * deshalb bewusst neutral formuliert („aus deiner Sicht"), nie als
 * Vereins-Gesamtsumme verkauft.
 */
data class DashboardData(
    private val activeMembers: List<ClubMember>,
    val activeMemberCount: Int,
    val openInvoiceCount: Int,
    val openInvoiceSumCents: Long,
    /** Termine im 14-Tage-Fenster, aufsteigend sortiert, Ende noch nicht vorbei. */
    val upcomingEvents: List<Event>,
    val nextCompetition: Competition?,
    /** Kalendertage bis zum nächsten Wettkampf (0 = heute). */
    val countdownDays: Int,
    /** Gemeldete (nicht zurückgezogene) Mitglieder des nächsten Wettkampfs. */
    val competitionEntrants: List<ClubMember>,
    /** Aufgaben: offene zuerst (nach Fälligkeit), erledigte hinten. */
    val tasks: List<Task>,
) {
    val nextEvent: Event? get() = upcomingEvents.firstOrNull()

    /**
     * Zusagen/Absagen/offen für einen Termin. „Eingeladen" sind die aktiven
     * Mitglieder der Event-Teams (bzw. alle aktiven, wenn keine Teams gesetzt).
     */
    fun responseSummary(event: Event): DashboardResponseSummary {
        val invitedCount = if (event.teamIds.isEmpty()) {
            activeMembers.size
        } else {
            val eventTeams = event.teamIds.toSet()
            activeMembers.count { member -> member.teamIds.any { it in eventTeams } }
        }
        val going = event.rsvps.count { it.status == RsvpStatus.GOING }
        val declined = event.rsvps.count {
            it.status == RsvpStatus.DECLINED || it.status == RsvpStatus.SICK
        }
        val open = (invitedCount - going - declined).coerceAtLeast(0)
        return DashboardResponseSummary(going = going, declined = declined, open = open)
    }

    companion object {
        fun build(
            members: List<ClubMember>,
            events: List<Event>,
            competitions: List<Competition>,
            invoices: List<Invoice>,
            tasks: List<Task>,
            now: ZonedDateTime = ZonedDateTime.now(),
        ): DashboardData {
            val active = members.filter { it.status == MemberStatus.ACTIVE }

            val openInvoices = invoices.filter { it.status == InvoiceStatus.OPEN }

            // Termine: nach Startzeit sortieren, bereits beendete ausblenden.
            val upcoming = events
                .mapNotNull { event ->
                    DashboardFormat.parseIso(event.startsAt)?.let { event to it }
                }
                .filter { (event, start) ->
                    val end = DashboardFormat.parseIso(event.endsAt) ?: start
                    !end.isBefore(now)
                }
                .sortedBy { it.second }
                .map { it.first }

            // Nächster Wettkampf: frühester, der noch bevorsteht oder läuft.
            val nextCompetitionPair = competitions
                .filter {
                    it.status == CompetitionStatus.UPCOMING ||
                        it.status == CompetitionStatus.RUNNING
                }
                .mapNotNull { competition ->
                    DashboardFormat.parseIso(competition.startsAt)?.let { competition to it }
                }
                .minByOrNull { it.second }

            val nextCompetition: Competition?
            val countdownDays: Int
            val entrants: List<ClubMember>
            if (nextCompetitionPair != null) {
                val (competition, start) = nextCompetitionPair
                nextCompetition = competition
                countdownDays = ChronoUnit.DAYS
                    .between(now.toLocalDate(), start.toLocalDate())
                    .coerceAtLeast(0L)
                    .toInt()
                val membersById = members.associateBy { it.id }
                entrants = competition.entries
                    .filter { it.status != CompetitionEntryStatus.WITHDRAWN }
                    .mapNotNull { membersById[it.memberId] }
            } else {
                nextCompetition = null
                countdownDays = 0
                entrants = emptyList()
            }

            // Aufgaben: offen vor erledigt, innerhalb offen nach Fälligkeit
            // (yyyy-MM-dd sortiert lexikographisch korrekt), ohne Datum hinten.
            val sortedTasks = tasks.sortedWith(
                compareBy<Task> { it.done }
                    .thenBy(nullsLast(naturalOrder<String>())) { it.dueOn }
                    .thenBy { it.title },
            )

            return DashboardData(
                activeMembers = active,
                activeMemberCount = active.size,
                openInvoiceCount = openInvoices.size,
                openInvoiceSumCents = openInvoices.sumOf { it.amountCents ?: 0L },
                upcomingEvents = upcoming,
                nextCompetition = nextCompetition,
                countdownDays = countdownDays,
                competitionEntrants = entrants,
                tasks = sortedTasks,
            )
        }
    }
}
