import SwiftUI

/// Reine Ableitungs-Helfer der Budgetplanung — ohne Netzwerk, ohne State.
/// Spiegelt `derive.ts` der Web-Referenz (`(portal)/finanzen/budget`):
///
/// - Der Soll-Ist-Bericht (`getBudgetReport`) liefert je Kategorie Plan + Ist +
///   Abweichung. Beträge sind durchweg Integer-Cent.
/// - Ampel folgt bewusst dem Backend-Contract: `varianceCents = Plan − Ist`,
///   grün bei ≥ 0, rot bei < 0 (bei Ausgaben = „im Budget geblieben“).
/// - Das Ergebnis (Einnahmen − Ausgaben) wird separat als Saldo gezeigt; dessen
///   Abweichung ist `Ist − Plan` (positiv = besser als geplant → grün).
enum BudgetDerive {

    /// Aggregierte Kennzahlen für die KPI-Leiste (alles in Cent).
    struct Totals: Equatable {
        var plannedIncome: Int
        var plannedExpense: Int
        var actualIncome: Int
        var actualExpense: Int

        /// Geplantes Ergebnis = geplante Einnahmen − geplante Ausgaben.
        var plannedResult: Int { plannedIncome - plannedExpense }
        /// Ist-Ergebnis = Ist-Einnahmen − Ist-Ausgaben.
        var actualResult: Int { actualIncome - actualExpense }
        /// Abweichung des Ergebnisses = Ist − Plan (positiv = besser als geplant).
        var resultDelta: Int { actualResult - plannedResult }
    }

    /// Plan-/Ist-/Abweichungs-Summe einer Zeilengruppe (Sektionsfuß).
    struct Subtotal: Equatable {
        var planned: Int
        var actual: Int
        var variance: Int
    }

    /// Ampel-Ton — Farbe kommt aus dem Design-System (`Theme.Colors`).
    enum Tone {
        case success, danger, neutral

        var color: Color {
            switch self {
            case .success: Theme.Colors.success
            case .danger: Theme.Colors.danger
            case .neutral: Theme.Colors.inkPrimary
            }
        }
    }

    // MARK: - Ableitungen

    /// Auswahljahre: Vorjahr, laufendes Jahr, Folgejahr (Planung ist vorwärtsgerichtet).
    static func years(around thisYear: Int = Calendar.current.component(.year, from: Date())) -> [Int] {
        [thisYear - 1, thisYear, thisYear + 1]
    }

    /// Berichtszeilen einer Art (Einnahme/Ausgabe), stabil nach Kategoriename sortiert.
    static func rows(_ report: BudgetReport, kind: LedgerCategoryKind) -> [BudgetReportRow] {
        report.rows
            .filter { $0.kind == kind }
            .sorted {
                ($0.categoryName ?? "").localizedCaseInsensitiveCompare($1.categoryName ?? "") == .orderedAscending
            }
    }

    /// Kennzahlen über alle Zeilen (Einnahmen/Ausgaben getrennt, plus Ergebnis-Saldo).
    static func totals(_ report: BudgetReport) -> Totals {
        func sum(_ kind: LedgerCategoryKind, _ pick: (BudgetReportRow) -> Int?) -> Int {
            report.rows
                .filter { $0.kind == kind }
                .reduce(0) { $0 + (pick($1) ?? 0) }
        }
        return Totals(
            plannedIncome: sum(.income) { $0.plannedCents },
            plannedExpense: sum(.expense) { $0.plannedCents },
            actualIncome: sum(.income) { $0.actualCents },
            actualExpense: sum(.expense) { $0.actualCents }
        )
    }

    /// Zeilengruppe zu Plan-/Ist-/Abweichungs-Summe verdichten (Sektionsfuß).
    static func subtotal(_ rows: [BudgetReportRow]) -> Subtotal {
        rows.reduce(into: Subtotal(planned: 0, actual: 0, variance: 0)) { acc, row in
            acc.planned += row.plannedCents ?? 0
            acc.actual += row.actualCents ?? 0
            acc.variance += variance(of: row)
        }
    }

    /// Abweichung einer Berichtszeile — Contract-Wert, sonst `Plan − Ist`.
    static func variance(of row: BudgetReportRow) -> Int {
        row.varianceCents ?? ((row.plannedCents ?? 0) - (row.actualCents ?? 0))
    }

    /// Ampel: Abweichung ≥ 0 (Plan − Ist) → grün, sonst rot — Contract-treu.
    static func varianceTone(_ cents: Int) -> Tone {
        cents >= 0 ? .success : .danger
    }

    /// Ergebnis-Abweichung (Ist − Plan): positiv grün, negativ rot, 0 neutral.
    static func deltaTone(_ cents: Int) -> Tone {
        cents > 0 ? .success : cents < 0 ? .danger : .neutral
    }
}
