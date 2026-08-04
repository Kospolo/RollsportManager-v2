package de.rollsportmanager.v2.features.dashboard

import android.text.format.DateFormat
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import de.rollsportmanager.v2.R
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.time.temporal.TemporalAccessor
import java.util.Currency
import java.util.Locale

/**
 * Datums- und Betrags-Formatierung fürs Dashboard — an EINER Stelle,
 * damit KPI, Countdown, Termine und Aufgaben identisch formatieren
 * (Spiegel von iOS DashboardFormatters.swift).
 *
 * Die Contracts lassen Timestamps bewusst als String auf der Leitung
 * (ISO 8601 bzw. yyyy-MM-dd) — hier ist die Kante, an der konvertiert wird.
 */
object DashboardFormat {

    // --- Parsen (Leitung → java.time) ---------------------------------------

    /** API-Timestamps (mit/ohne Millisekunden, mit Offset oder Z) → lokale Zeit. */
    fun parseIso(value: String): ZonedDateTime? = try {
        OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.systemDefault())
    } catch (_: DateTimeParseException) {
        try {
            Instant.parse(value).atZone(ZoneId.systemDefault())
        } catch (_: DateTimeParseException) {
            null
        }
    }

    /** yyyy-MM-dd (z. B. `due_on`) → LocalDate. */
    fun parseDay(value: String): LocalDate? = try {
        LocalDate.parse(value)
    } catch (_: DateTimeParseException) {
        null
    }

    /**
     * Für die `from`/`to`-Query von GET /events: Die API validiert die Werte
     * strikt als date-time — reines yyyy-MM-dd lehnt sie mit 400 ab
     * (siehe Kommentar in network/Endpoints.kt).
     */
    fun apiDateTime(dateTime: ZonedDateTime): String =
        DateTimeFormatter.ISO_INSTANT.format(dateTime.toInstant())

    // --- Anzeigen (java.time → Text) -----------------------------------------

    /**
     * Locale-bestes Muster aus einem Skeleton (Pendant zu iOS
     * `setLocalizedDateFormatFromTemplate`). Klein-Cache pro Skeleton+Locale.
     */
    private val formatterCache = HashMap<String, DateTimeFormatter>()

    private fun skeletonFormatter(skeleton: String, locale: Locale): DateTimeFormatter {
        val key = "$skeleton|${locale.toLanguageTag()}"
        return formatterCache.getOrPut(key) {
            DateTimeFormatter.ofPattern(
                DateFormat.getBestDateTimePattern(locale, skeleton),
                locale,
            )
        }
    }

    /** „Fr." — Wochentag kurz (nimmt ZonedDateTime oder LocalDate). */
    fun weekdayShortText(date: TemporalAccessor, locale: Locale = Locale.getDefault()): String =
        skeletonFormatter("EEE", locale).format(date)

    /** „19.7." (de) bzw. „7/19" (en). */
    fun dayMonthText(date: TemporalAccessor, locale: Locale = Locale.getDefault()): String =
        skeletonFormatter("dM", locale).format(date)

    /** „08:30" bzw. „8:30 AM" — 12/24 h nach Locale. */
    fun timeText(dateTime: ZonedDateTime, locale: Locale = Locale.getDefault()): String =
        skeletonFormatter("jm", locale).format(dateTime)

    /** „Freitag, 10. Juli" — für die Begrüßungs-Eyebrow. */
    fun eyebrowDateText(date: TemporalAccessor, locale: Locale = Locale.getDefault()): String =
        skeletonFormatter("EEEEdMMMM", locale).format(date)

    // --- Beträge (Seriositätszone: tabular läuft über die Typo-Tokens) -------

    /** Cent → „381 €" bzw. „380,50 €" (glatte Beträge ohne Nachkommastellen). */
    fun euroText(cents: Long, locale: Locale = Locale.getDefault()): String {
        val digits = if (cents % 100L == 0L) 0 else 2
        val format = NumberFormat.getCurrencyInstance(locale).apply {
            currency = Currency.getInstance("EUR")
            minimumFractionDigits = digits
            maximumFractionDigits = digits
        }
        return format.format(cents / 100.0)
    }
}

/** „Heute" / „Morgen" / „Sa. 19.7." — für KPI-Kachel und Terminzeilen. */
@Composable
fun relativeDayText(dateTime: ZonedDateTime): String {
    val today = LocalDate.now()
    return when (dateTime.toLocalDate()) {
        today -> stringResource(R.string.dashboard_date_today)
        today.plusDays(1) -> stringResource(R.string.dashboard_date_tomorrow)
        else ->
            "${DashboardFormat.weekdayShortText(dateTime)} ${DashboardFormat.dayMonthText(dateTime)}"
    }
}
