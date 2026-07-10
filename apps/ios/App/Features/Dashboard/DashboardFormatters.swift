import Foundation

/// Datums- und Betrags-Formatierung fürs Dashboard — an EINER Stelle,
/// damit KPI, Countdown, Termine und Aufgaben identisch formatieren.
///
/// Die Contracts lassen Timestamps bewusst als String auf der Leitung
/// (ISO 8601 bzw. yyyy-MM-dd) — hier ist die Kante, an der konvertiert wird.
enum DashboardFormat {

    // MARK: - Parsen (Leitung → Date)

    private static let isoWithFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoPlain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    /// yyyy-MM-dd (z. B. `due_on`) — POSIX-Locale, lokale Zeitzone.
    private static let wireDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    /// API-Timestamps kommen mal mit, mal ohne Millisekunden — beides parsen.
    static func parseISO(_ string: String) -> Date? {
        isoWithFraction.date(from: string) ?? isoPlain.date(from: string)
    }

    static func parseDay(_ string: String) -> Date? {
        wireDay.date(from: string)
    }

    /// Für die `from`/`to`-Query von GET /events: Die API validiert die Werte
    /// als date-time — reines yyyy-MM-dd lehnt sie mit 400 ab (verifiziert
    /// gegen den Dev-Stack; Kommentar in Endpoints.swift ist da zu großzügig).
    static func apiDateTime(_ date: Date) -> String {
        isoPlain.string(from: date)
    }

    // MARK: - Anzeigen (Date → Text)

    private static func localizedFormatter(_ template: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.setLocalizedDateFormatFromTemplate(template)
        return formatter
    }

    private static let weekdayShort = localizedFormatter("EEE")
    private static let dayMonth = localizedFormatter("dM")
    private static let eyebrowDate = localizedFormatter("EEEEdMMMM")

    private static let timeOnly: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    /// „Fr.“ — Wochentag kurz.
    static func weekdayShortText(_ date: Date) -> String {
        weekdayShort.string(from: date)
    }

    /// „19.7.“ (de) bzw. „7/19“ (en).
    static func dayMonthText(_ date: Date) -> String {
        dayMonth.string(from: date)
    }

    /// „08:30“ bzw. „8:30 AM“.
    static func timeText(_ date: Date) -> String {
        timeOnly.string(from: date)
    }

    /// „Freitag, 10. Juli“ — für die Begrüßungs-Eyebrow.
    static func eyebrowDateText(_ date: Date) -> String {
        eyebrowDate.string(from: date)
    }

    /// „Heute“ / „Morgen“ / „Sa. 19.7.“ — für KPI und Terminzeilen.
    static func relativeDayText(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return String(localized: "dashboard.date.today")
        }
        if calendar.isDateInTomorrow(date) {
            return String(localized: "dashboard.date.tomorrow")
        }
        return "\(weekdayShortText(date)) \(dayMonthText(date))"
    }

    // MARK: - Beträge (Seriositätszone: tabular, echtes Minus via Formatter)

    private static func euroFormatter(fractionDigits: Int) -> NumberFormatter {
        let formatter = NumberFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.numberStyle = .currency
        formatter.currencyCode = "EUR"
        formatter.minimumFractionDigits = fractionDigits
        formatter.maximumFractionDigits = fractionDigits
        return formatter
    }

    private static let euroWhole = euroFormatter(fractionDigits: 0)
    private static let euroExact = euroFormatter(fractionDigits: 2)

    /// Cent → „381 €“ bzw. „380,50 €“ (glatte Beträge ohne Nachkommastellen).
    static func euroText(cents: Int) -> String {
        let amount = Double(cents) / 100
        let formatter = cents % 100 == 0 ? euroWhole : euroExact
        return formatter.string(from: NSNumber(value: amount)) ?? String(format: "%.2f €", amount)
    }
}
