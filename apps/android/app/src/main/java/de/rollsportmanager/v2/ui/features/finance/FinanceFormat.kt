package de.rollsportmanager.v2.ui.features.finance

import java.math.BigDecimal
import java.text.DecimalFormat
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Currency
import java.util.Locale

/**
 * Formatierung für die Seriositätszone Finanzen: Beträge aus Cents mit
 * echtem Minuszeichen (−, Design-System-Regel — nie Bindestrich),
 * Datumswerte von der Leitung (`yyyy-MM-dd` bzw. ISO-8601-date-time,
 * s. RsmContracts-Kopf: Timestamps bleiben String auf der Leitung).
 *
 * Mono/tabular macht die View (`RsmTypography.monoTable`).
 * Spiegel der iOS-Referenz `FinanceFormat.swift`.
 */
object FinanceFormat {

    // --- Beträge -------------------------------------------------------------

    /**
     * „381,00 €“ aus 38100 Cents. `null` (Betrag im Contract nullable) → „—“.
     * Formatter sind nicht threadsicher — Aufruf nur vom UI-Thread.
     */
    fun amount(cents: Long?, currency: String): String {
        if (cents == null) return "—"
        val value = BigDecimal(cents).movePointLeft(2)
        return currencyFormatter(currency).format(value)
    }

    private var cachedFormatter: NumberFormat? = null
    private var cachedCurrencyCode: String? = null

    private fun currencyFormatter(code: String): NumberFormat {
        cachedFormatter?.takeIf { cachedCurrencyCode == code }?.let { return it }
        val formatter = NumberFormat.getCurrencyInstance(Locale.getDefault())
        runCatching { formatter.currency = Currency.getInstance(code) }
        (formatter as? DecimalFormat)?.let {
            // Echtes Minuszeichen U+2212 statt Bindestrich (Design-System).
            val symbols = it.decimalFormatSymbols
            symbols.minusSign = '−'
            it.decimalFormatSymbols = symbols
        }
        cachedFormatter = formatter
        cachedCurrencyCode = code
        return formatter
    }

    // --- Datum ---------------------------------------------------------------

    private val displayFormatter: DateTimeFormatter =
        DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)

    /**
     * Leitungs-String (date oder date-time) → lokalisiertes Datum
     * („07.07.2026“ / “Jul 7, 2026”). Unparsebares kommt roh zurück,
     * bevor gar nichts angezeigt wird.
     */
    fun date(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        val parsed: LocalDate? =
            runCatching { LocalDate.parse(raw) }.getOrNull()
                ?: runCatching {
                    OffsetDateTime.parse(raw).atZoneSameInstant(ZoneId.systemDefault()).toLocalDate()
                }.getOrNull()
                ?: runCatching {
                    Instant.parse(raw).atZone(ZoneId.systemDefault()).toLocalDate()
                }.getOrNull()
        return parsed?.format(displayFormatter) ?: raw
    }
}
