import Foundation

/// Zahlen-, Betrags- und Datumsformatierung der Auswertung — an EINER Stelle,
/// damit KPI-Kacheln, Verteilungen und Terminliste identisch formatieren.
///
/// Spiegelt die Web-Referenz (`apps/web/lib/format.ts`): Quote als Prozent
/// (der Rohwert ist ein Anteil 0…1), Beträge in Cent → Euro, Termin-Zeitstempel
/// als „Wochentag, Tag Monat, HH:mm“. Alles über `.autoupdatingCurrent`, folgt
/// also der App-/Gerätesprache (DE/EN). Bewusst lokal im Feature-Ordner
/// gehalten — Shared-Code bleibt unangetastet.
enum ReportsFormat {

    // MARK: - Prozent (Anwesenheitsquote)

    private static let percent: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.numberStyle = .percent
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 1
        return formatter
    }()

    /// Anteil 0…1 → „78 %“ bzw. „78,5 %“ (der Formatter multipliziert selbst).
    static func percentText(_ ratio: Double) -> String {
        percent.string(from: NSNumber(value: ratio)) ?? "\(Int(ratio * 100)) %"
    }

    // MARK: - Beträge (offene Posten)

    private static let euro: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.numberStyle = .currency
        formatter.currencyCode = "EUR"
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    /// Cent → „381,00 €“ (wie die Web-Referenz mit zwei Nachkommastellen).
    static func euroText(cents: Int) -> String {
        let amount = Double(cents) / 100
        return euro.string(from: NSNumber(value: amount)) ?? String(format: "%.2f €", amount)
    }

    // MARK: - Termin-Zeitpunkt

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

    /// Timestamps kommen mal mit, mal ohne Millisekunden — beides parsen.
    static func parseISO(_ string: String) -> Date? {
        isoWithFraction.date(from: string) ?? isoPlain.date(from: string)
    }

    private static let dayLong: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.setLocalizedDateFormatFromTemplate("EEEdMMMM")
        return formatter
    }()

    private static let timeShort: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    /// „Fr., 11. Juli, 14:30“ — Datum (Wochentag kurz + Tag + Monat) plus Zeit.
    /// Fällt bei unparsbarem Wert auf den Rohstring zurück (nie leer).
    static func dateTimeText(_ iso: String) -> String {
        guard let date = parseISO(iso) else { return iso }
        return "\(dayLong.string(from: date)), \(timeShort.string(from: date))"
    }
}
