import Foundation

/// Betrags-Formatierung der Budgetplanung (Seriositätszone Finanzen).
/// Beträge kommen als Integer-Cent aus dem Contract (`BudgetReport`), werden
/// hier lokalisiert in Euro gezeigt — mit echtem Minuszeichen (−, Design-System
/// §Typografie), nie einem Bindestrich. Die Mono-/tabular-Darstellung macht die
/// View (`Theme.Fonts.monoTable` + `.monospacedDigit()`), nicht der Formatter.
///
/// Bewusst eigenständig im Budget-Ordner gehalten (kein Griff in fremde
/// Feature-Ordner) — spiegelt das Muster von `FinanceFormat`.
enum BudgetFormat {

    /// Seed-Währung — `static let` ist thread-sicher initialisiert.
    private static let euroFormatter = makeCurrencyFormatter()

    /// „1.800,00 €“ aus 180000 Cents. `nil` (Betrag offen im Contract) → „—“.
    static func amount(cents: Int?) -> String {
        guard let cents else { return "—" }
        let value = Decimal(cents) / 100
        return euroFormatter.string(from: value as NSDecimalNumber) ?? "\(value) €"
    }

    /// Betrag mit Vorzeichen: „+1.800,00 €“ bzw. „−…“ (der Formatter liefert das
    /// echte Minus bereits selbst). Für Abweichungen/Salden.
    static func signed(cents: Int?) -> String {
        guard let cents else { return "—" }
        let base = amount(cents: cents)
        return cents > 0 ? "+\(base)" : base
    }

    private static func makeCurrencyFormatter() -> NumberFormatter {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "EUR"
        formatter.minusSign = "−" // echtes Minuszeichen, nie Bindestrich
        return formatter
    }
}
