package de.rollsportmanager.v2.ui.features.events

import android.text.format.DateFormat
import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.ui.graphics.vector.ImageVector
import de.rollsportmanager.contracts.AttendanceStatus
import de.rollsportmanager.contracts.ClubMember
import de.rollsportmanager.contracts.Event
import de.rollsportmanager.contracts.EventRsvp
import de.rollsportmanager.contracts.EventType
import de.rollsportmanager.contracts.MemberStatus
import de.rollsportmanager.contracts.RsvpStatus
import de.rollsportmanager.contracts.Team
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.temporal.ChronoUnit
import java.util.Locale

// ============================================================================
// Termine-Feature: reine Anzeige-/Rechenmodelle (kein Netzwerk, kein State).
// Alle Wire-Typen kommen aus den generierten Contracts — hier liegt nur, was
// die Composables zum Gruppieren, Zählen und Beschriften brauchen.
// (Spiegel von iOS apps/ios/App/Features/Events/EventsModels.swift.)
// ============================================================================

// --- Filter (Segmente Alle · Training · Wettkampf · Sonstiges) ---------------

enum class EventsFilter(@StringRes val labelRes: Int) {
    ALL(R.string.events_filter_all),
    TRAINING(R.string.events_filter_training),
    COMPETITION(R.string.events_filter_competition),
    OTHER(R.string.events_filter_other);

    fun matches(event: Event): Boolean = when (this) {
        ALL -> true
        TRAINING -> event.type == EventType.TRAINING
        COMPETITION -> event.type == EventType.COMPETITION
        OTHER -> event.type == EventType.OTHER
    }
}

// --- Gruppierung & Zählung ----------------------------------------------------

/** Ein Tag der Terminliste — Termine bereits nach Startzeit sortiert. */
data class EventsDaySection(val day: LocalDate, val events: List<Event>)

data class EventResponseCounts(
    val going: Int,
    val declined: Int,
    val maybe: Int,
    val open: Int,
)

/** Teilnehmer-Zeile im Detail: eingeladenes Mitglied + (optionale) Antwort. */
data class EventParticipant(
    val memberId: String,
    val member: ClubMember?,
    val rsvp: EventRsvp?,
) {
    /** Anzeigename; `null`, wenn das Mitglied nicht sichtbar/geladen ist. */
    val displayName: String?
        get() = member?.let { "${it.firstName} ${it.lastName}" }
}

object EventsLogic {

    /** Gefilterte Termine, nach Kalendertag gruppiert, aufsteigend sortiert. */
    fun sections(events: List<Event>, filter: EventsFilter): List<EventsDaySection> {
        val grouped = events
            .filter(filter::matches)
            .groupBy { event -> EventsIso.parse(event.startsAt)?.toLocalDate() ?: LocalDate.MIN }
        return grouped.keys.sorted().map { day ->
            // ISO-8601 gleicher Form sortiert lexikografisch korrekt.
            EventsDaySection(day, grouped.getValue(day).sortedBy { it.startsAt })
        }
    }

    /**
     * Eingeladene Mitglieder: Läufer + Trainer der verknüpften Teams;
     * vereinsoffene Termine (keine Teams) zählen alle aktiven Mitglieder.
     */
    fun invitedMemberIds(
        event: Event,
        teamsById: Map<String, Team>,
        membersById: Map<String, ClubMember>,
    ): Set<String> {
        if (event.teamIds.isNotEmpty()) {
            val ids = mutableSetOf<String>()
            for (teamId in event.teamIds) {
                val team = teamsById[teamId] ?: continue
                ids += team.skaterMemberIds
                ids += team.coachMemberIds
            }
            return ids
        }
        return membersById.values
            .filter { it.status == MemberStatus.ACTIVE }
            .map { it.id }
            .toSet()
    }

    /** Zusagen / Absagen (inkl. Krank) / Vielleicht / offen. */
    fun counts(
        event: Event,
        teamsById: Map<String, Team>,
        membersById: Map<String, ClubMember>,
    ): EventResponseCounts {
        val invited = invitedMemberIds(event, teamsById, membersById).toMutableSet()
        var going = 0
        var declined = 0
        var maybe = 0
        val responded = mutableSetOf<String>()
        for (rsvp in event.rsvps) {
            invited += rsvp.memberId
            if (!responded.add(rsvp.memberId)) continue
            when (rsvp.status) {
                RsvpStatus.GOING -> going++
                RsvpStatus.DECLINED, RsvpStatus.SICK -> declined++
                RsvpStatus.MAYBE -> maybe++
            }
        }
        val open = (invited - responded).size
        return EventResponseCounts(going = going, declined = declined, maybe = maybe, open = open)
    }

    /**
     * Teilnehmerliste: Eingeladene ∪ alle, die geantwortet haben —
     * sortiert nach Nachname, Vorname (Unbekannte ans Ende).
     */
    fun participants(
        event: Event,
        teamsById: Map<String, Team>,
        membersById: Map<String, ClubMember>,
    ): List<EventParticipant> {
        val ids = invitedMemberIds(event, teamsById, membersById).toMutableSet()
        event.rsvps.forEach { ids += it.memberId }
        val rsvpByMember = event.rsvps.associateBy { it.memberId }
        return ids
            .map { id -> EventParticipant(memberId = id, member = membersById[id], rsvp = rsvpByMember[id]) }
            .sortedBy(::sortKey)
    }

    private fun sortKey(participant: EventParticipant): String =
        participant.member
            ?.let { "${it.lastName} ${it.firstName}".lowercase() }
            // Unbekannte stabil ans Ende, untereinander nach ID.
            ?: "zzz~${participant.memberId}"
}

// --- ISO-8601 (Contracts lassen Timestamps als String auf der Leitung) --------

object EventsIso {

    /** ISO-String → lokale Zeit; ohne Offset als lokale Zeit interpretiert. */
    fun parse(iso: String): ZonedDateTime? =
        runCatching { OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault()) }
            .recoverCatching { LocalDateTime.parse(iso).atZone(ZoneId.systemDefault()) }
            .getOrNull()

    /** Jetzt als voller ISO-date-time-String (für optimistische RSVPs). */
    fun nowString(): String =
        DateTimeFormatter.ISO_INSTANT.format(Instant.now().truncatedTo(ChronoUnit.SECONDS))

    /**
     * `from`-Query: ab letzter Woche (Trainer tragen Anwesenheit rückwirkend
     * nach). WICHTIG: volle ISO-date-time — reines `yyyy-MM-dd` liefert 400
     * (siehe Doku an ApiClient.events in network/Endpoints.kt).
     */
    fun fromQueryString(): String {
        val start = LocalDate.now().minusDays(7).atStartOfDay(ZoneId.systemDefault())
        return DateTimeFormatter.ISO_INSTANT.format(start.toInstant())
    }
}

// --- Anzeige-Mapping (eigener Namensraum — kollisionsfrei zu anderen Teams) ---

object EventsDisplay {

    /** Uhrzeit (lokalisiert, kurz) aus einem ISO-String — "–" wenn unlesbar. */
    fun time(iso: String, locale: Locale): String {
        val date = parseOrNull(iso) ?: return "–"
        return DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(locale).format(date)
    }

    /** Volles Datum (z. B. „Freitag, 10. Juli 2026") — `null` wenn unlesbar. */
    fun fullDate(iso: String, locale: Locale): String? {
        val date = parseOrNull(iso) ?: return null
        return DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL).withLocale(locale).format(date)
    }

    /** Tages-Header wie iOS (Wochentag + Tag + Monat, ohne Jahr, lokalisiert). */
    fun dayHeader(day: LocalDate, locale: Locale): String {
        val pattern = DateFormat.getBestDateTimePattern(locale, "EEEEdMMMM")
        return DateTimeFormatter.ofPattern(pattern, locale).format(day)
    }

    private fun parseOrNull(iso: String): ZonedDateTime? = EventsIso.parse(iso)

    // Termin-Typ → Pill (Honig bleibt exklusiv Küren/Musik!).
    @StringRes
    fun typeLabelRes(type: EventType): Int = when (type) {
        EventType.TRAINING -> R.string.events_type_training
        EventType.COMPETITION -> R.string.events_type_competition
        EventType.OTHER -> R.string.events_type_other
    }

    fun typePillKind(type: EventType): RsmStatusKind = when (type) {
        EventType.TRAINING -> RsmStatusKind.NEUTRAL
        EventType.COMPETITION -> RsmStatusKind.BRAND
        EventType.OTHER -> RsmStatusKind.INFO
    }

    // RSVP-Status → Pill (null = noch offen).
    @StringRes
    fun rsvpLabelRes(status: RsvpStatus?): Int = when (status) {
        RsvpStatus.GOING -> R.string.events_status_going
        RsvpStatus.DECLINED -> R.string.events_status_declined
        RsvpStatus.MAYBE -> R.string.events_status_maybe
        RsvpStatus.SICK -> R.string.events_status_sick
        null -> R.string.events_status_open
    }

    fun rsvpPillKind(status: RsvpStatus?): RsmStatusKind = when (status) {
        RsvpStatus.GOING -> RsmStatusKind.SUCCESS
        RsvpStatus.DECLINED -> RsmStatusKind.DANGER
        RsvpStatus.MAYBE -> RsmStatusKind.INFO
        RsvpStatus.SICK -> RsmStatusKind.WARN
        null -> RsmStatusKind.NEUTRAL
    }

    // Anwesenheit → Pill + Icon (Trainer-Sicht).
    @StringRes
    fun attendanceLabelRes(status: AttendanceStatus): Int = when (status) {
        AttendanceStatus.PRESENT -> R.string.events_attendance_present
        AttendanceStatus.LATE -> R.string.events_attendance_late
        AttendanceStatus.EXCUSED -> R.string.events_attendance_excused
        AttendanceStatus.ABSENT -> R.string.events_attendance_absent
    }

    fun attendancePillKind(status: AttendanceStatus): RsmStatusKind = when (status) {
        AttendanceStatus.PRESENT -> RsmStatusKind.SUCCESS
        AttendanceStatus.LATE -> RsmStatusKind.WARN
        AttendanceStatus.EXCUSED -> RsmStatusKind.INFO
        AttendanceStatus.ABSENT -> RsmStatusKind.DANGER
    }

    fun attendanceIcon(status: AttendanceStatus): ImageVector = when (status) {
        AttendanceStatus.PRESENT -> Icons.Filled.CheckCircle
        AttendanceStatus.LATE -> Icons.Filled.Schedule
        AttendanceStatus.EXCUSED -> Icons.Filled.PanTool
        AttendanceStatus.ABSENT -> Icons.Filled.Cancel
    }
}
