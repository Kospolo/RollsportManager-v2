import SwiftUI

/// KPI-Leiste der Budgetplanung: geplante Einnahmen/Ausgaben (jeweils mit Ist
/// als Caption), das geplante Ergebnis (Einnahmen − Ausgaben, Ist darunter) und
/// die Abweichung des Ergebnisses (Ist − Plan; positiv = besser als geplant →
/// grün). Zwei-spaltiges Raster (auf dem iPhone 2×2). Beträge laufen tabular
/// über `BudgetFormat`, nie hart codiert. Web-Referenz: `_components/BudgetKpis`.
struct BudgetKpiRow: View {
    let totals: BudgetDerive.Totals

    private let columns = [
        GridItem(.flexible(), spacing: Theme.Spacing.s3),
        GridItem(.flexible(), spacing: Theme.Spacing.s3),
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: Theme.Spacing.s3) {
            RSMKpiTile(
                eyebrow: "budget.kpiPlannedIncome",
                value: BudgetFormat.amount(cents: totals.plannedIncome),
                caption: actualCaption(totals.actualIncome),
                valueColor: Theme.Colors.success
            )
            RSMKpiTile(
                eyebrow: "budget.kpiPlannedExpense",
                value: BudgetFormat.amount(cents: totals.plannedExpense),
                caption: actualCaption(totals.actualExpense),
                valueColor: Theme.Colors.danger
            )
            RSMKpiTile(
                eyebrow: "budget.kpiPlannedResult",
                value: BudgetFormat.amount(cents: totals.plannedResult),
                caption: actualCaption(totals.actualResult),
                valueColor: Theme.Colors.brand
            )
            RSMKpiTile(
                eyebrow: "budget.kpiResultDelta",
                value: BudgetFormat.signed(cents: totals.resultDelta),
                caption: deltaCaption(totals.resultDelta),
                valueColor: BudgetDerive.deltaTone(totals.resultDelta).color
            )
        }
    }

    /// „Ist 1.650,00 €“ — lokalisiertes Präfix plus formatierter Ist-Betrag.
    /// (String-Interpolation ⇒ die Teile werden Format-Argumente, kein Key-Lookup.)
    private func actualCaption(_ cents: Int) -> LocalizedStringKey {
        "\(String(localized: "budget.kpiActualPrefix")) \(BudgetFormat.amount(cents: cents))"
    }

    /// Klartext zur Ergebnis-Abweichung: besser/​schlechter/​wie geplant.
    private func deltaCaption(_ cents: Int) -> LocalizedStringKey {
        if cents > 0 { return "budget.kpiDeltaAhead" }
        if cents < 0 { return "budget.kpiDeltaBehind" }
        return "budget.kpiDeltaEven"
    }
}
