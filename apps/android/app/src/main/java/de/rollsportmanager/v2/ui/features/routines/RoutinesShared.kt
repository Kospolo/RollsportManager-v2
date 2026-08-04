package de.rollsportmanager.v2.ui.features.routines

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import de.rollsportmanager.contracts.RoutineStatus
import de.rollsportmanager.v2.R
import de.rollsportmanager.v2.designsystem.RsmStatusKind
import de.rollsportmanager.v2.ui.theme.RsmSpacing
import de.rollsportmanager.v2.ui.theme.RsmTheme
import de.rollsportmanager.v2.ui.theme.RsmTypography
import java.text.DecimalFormatSymbols
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

// ============================================================================
// Gemeinsame Helfer des Küren-Moduls — Spiegel von RoutinesShared.swift (iOS)
// und formatDurationMs im Web. Honig ist hier ERLAUBT: Küren = Musik-Kontext
// (DESIGN-SYSTEM §3.8). Zeiten/Punkte immer Mono (RsmTypography.monoTable),
// Deltas mit ECHTEM Minuszeichen (−, U+2212).
// ============================================================================

internal object RoutineFormat {

    /** "2:30" aus Millisekunden — Sekunden gerundet; Rundung auf :60 trägt über. */
    fun mmss(ms: Double): String {
        val totalSeconds = max(0.0, ms) / 1000.0
        val minutes = (totalSeconds / 60).toInt()
        val seconds = (totalSeconds - minutes * 60).roundToInt()
        if (seconds >= 60) return "${minutes + 1}:00"
        return String.format(Locale.ROOT, "%d:%02d", minutes, seconds)
    }

    /** "0:38,2" — Timecode mit Zehnteln für die A/B-Griffe (Trennzeichen nach Sprache). */
    fun mmssTenths(ms: Double): String {
        val totalSeconds = max(0.0, ms) / 1000.0
        val minutes = (totalSeconds / 60).toInt()
        val rest = totalSeconds - minutes * 60
        val whole = rest.toInt()
        val tenths = ((rest - whole) * 10).toInt()
        val separator = DecimalFormatSymbols.getInstance().decimalSeparator
        return String.format(Locale.ROOT, "%d:%02d%c%d", minutes, whole, separator, tenths)
    }

    /** RollArt-Punkte: immer 2 Nachkommastellen, lokalisiert („44,10"). */
    fun points(value: Double): String =
        NumberFormat.getNumberInstance().apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }.format(value)

    /** Delta mit Vorzeichen und ECHTEM Minus: "+1,30" / "−0,25" / "±0,00". */
    fun pointsDelta(value: Double): String {
        val absText = points(abs(value))
        return when {
            value > 0 -> "+$absText"
            value < 0 -> "−$absText"
            else -> "±$absText"
        }
    }

    /** `scored_on` kommt als "yyyy-MM-dd" über die Leitung (Contracts: String). */
    fun scoredOnDate(raw: String): LocalDate? =
        runCatching { LocalDate.parse(raw) }.getOrNull()

    /** "Jun 2026" — Achsen-/Zeilenbeschriftung im RollArt-Verlauf. */
    fun monthYear(date: LocalDate): String =
        date.format(DateTimeFormatter.ofPattern("MMM uuuu", Locale.getDefault()))

    /** Zeitstempel der Notizen („10. Juli 2026, 14:32"). */
    fun savedAt(epochMillis: Long): String =
        DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
            .withLocale(Locale.getDefault())
            .format(Instant.ofEpochMilli(epochMillis).atZone(ZoneId.systemDefault()))
}

// --- Status-Optik (Chip-Ton wie Web STATUS_TONE — Farbe trägt IMMER ein Wort) --

internal val RoutineStatus.pillKind: RsmStatusKind
    get() = when (this) {
        RoutineStatus.DRAFT, RoutineStatus.ARCHIVED -> RsmStatusKind.NEUTRAL
        RoutineStatus.READY -> RsmStatusKind.SUCCESS
        RoutineStatus.COMPETITION -> RsmStatusKind.INFO
    }

internal val RoutineStatus.labelRes: Int
    @StringRes get() = when (this) {
        RoutineStatus.DRAFT -> R.string.routines_status_draft
        RoutineStatus.READY -> R.string.routines_status_ready
        RoutineStatus.COMPETITION -> R.string.routines_status_competition
        RoutineStatus.ARCHIVED -> R.string.routines_status_archived
    }

/** Anzeige-Reihenfolge der Liste: aktive Küren zuerst, Archiv ans Ende. */
internal val RoutineStatus.sortRank: Int
    get() = when (this) {
        RoutineStatus.COMPETITION -> 0
        RoutineStatus.READY -> 1
        RoutineStatus.DRAFT -> 2
        RoutineStatus.ARCHIVED -> 3
    }

/** Disziplin aus der Besetzung abgeleitet: 1 = Einzellauf, 2+ = Paarlauf. */
@StringRes
internal fun routineDisciplineRes(skaterCount: Int): Int =
    if (skaterCount >= 2) R.string.routines_discipline_pair else R.string.routines_discipline_single

// --- Kleine Chips -------------------------------------------------------------

/**
 * Punkte-Delta-Chip: Mono-Ziffern, success/danger/neutral — der Trend ist der
 * motivierende Wert (DESIGN-SYSTEM §3.9).
 */
@Composable
internal fun RoutineDeltaChip(delta: Double, modifier: Modifier = Modifier) {
    val kind = when {
        delta > 0 -> RsmStatusKind.SUCCESS
        delta < 0 -> RsmStatusKind.DANGER
        else -> RsmStatusKind.NEUTRAL
    }
    val colors = RsmTheme.colors
    Text(
        text = RoutineFormat.pointsDelta(delta),
        style = RsmTypography.monoTable,
        color = kind.foreground(colors),
        modifier = modifier
            .clip(CircleShape)
            .background(kind.background(colors))
            .padding(horizontal = RsmSpacing.s2, vertical = 2.dp),
    )
}

/** RollArt-Kürzel-Chip (2S, SSp, StSq) — Mono, neutral getönt. */
@Composable
internal fun RoutineElementChip(code: String, modifier: Modifier = Modifier) {
    val colors = RsmTheme.colors
    Text(
        text = code,
        style = RsmTypography.monoTable,
        color = colors.inkSoft,
        modifier = modifier
            .clip(CircleShape)
            .background(colors.bgSunken)
            .padding(horizontal = RsmSpacing.s2, vertical = 2.dp),
    )
}
