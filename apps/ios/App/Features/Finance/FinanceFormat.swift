import Foundation

/// Formatierung für die Seriositätszone Finanzen: Beträge aus Cents,
/// echtes Minuszeichen (−, Design-System-Regel), Datumswerte von der
/// Leitung (`yyyy-MM-dd` bzw. ISO-8601-date-time, s. RSMContracts-Kopf).
///
/// Die Mono-/tabular-Darstellung macht die View
/// (`Theme.Fonts.monoTable` + `.monospacedDigit()`).
enum FinanceFormat {

    // MARK: - Beträge

    /// Seed-Währung — `static let` ist thread-sicher initialisiert.
    private static let euroFormatter = makeCurrencyFormatter(code: "EUR")

    /// „381,00 €“ aus 38100 Cents. `nil` (Betrag noch offen im Contract) → „—“.
    static func amount(cents: Int?, currency: String) -> String {
        guard let cents else { return "—" }
        let formatter = currency == "EUR" ? euroFormatter : makeCurrencyFormatter(code: currency)
        let value = Decimal(cents) / 100
        return formatter.string(from: value as NSDecimalNumber) ?? "\(value) \(currency)"
    }

    private static func makeCurrencyFormatter(code: String) -> NumberFormatter {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code
        formatter.minusSign = "−" // echtes Minuszeichen, nie Bindestrich
        return formatter
    }

    // MARK: - Datum

    private static let dateOnlyParser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let isoParser: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoParserNoFraction = ISO8601DateFormatter()

    private static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    /// Leitungs-String (date oder date-time) → lokalisiertes Datum
    /// („07.07.2026“ / “Jul 7, 2026”). Unparsebares kommt roh zurück,
    /// bevor gar nichts angezeigt wird.
    static func date(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        let parsed = dateOnlyParser.date(from: raw)
            ?? isoParser.date(from: raw)
            ?? isoParserNoFraction.date(from: raw)
        guard let parsed else { return raw }
        return displayFormatter.string(from: parsed)
    }
}
