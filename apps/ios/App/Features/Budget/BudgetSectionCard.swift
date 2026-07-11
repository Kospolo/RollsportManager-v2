import SwiftUI

/// Eine Budget-Sektion (Einnahmen ODER Ausgaben): Karte mit Kopf, je Kategorie
/// eine Zeile (Plan · Ist · farbcodierte Abweichung) und einem Summenfuß.
/// Rein lesend — keine Zeilen-Aktionen (im Gegensatz zur Web-Referenz, die hier
/// Plan-Upserts erlaubt). Die Ampel folgt `varianceCents` (Plan − Ist), grün ≥ 0.
/// Web-Referenz: `_components/BudgetSection`.
struct BudgetSectionCard: View {
    let eyebrow: LocalizedStringKey
    let title: LocalizedStringKey
    let rows: [BudgetReportRow]

    var body: some View {
        if rows.isEmpty {
            EmptyView()
        } else {
            RSMCard {
                VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                    RSMSectionHeader(eyebrow: eyebrow, title: title)

                    VStack(spacing: 0) {
                        ForEach(Array(rows.enumerated()), id: \.element.categoryId) { index, row in
                            if index > 0 {
                                Rectangle()
                                    .fill(Theme.Colors.line)
                                    .frame(height: 1)
                                    .padding(.vertical, Theme.Spacing.s3)
                            }
                            BudgetCategoryRow(row: row)
                        }
                    }

                    subtotalFooter
                }
            }
        }
    }

    // MARK: - Summenfuß

    private var subtotalFooter: some View {
        let totals = BudgetDerive.subtotal(rows)
        return VStack(spacing: Theme.Spacing.s3) {
            Rectangle()
                .fill(Theme.Colors.lineStrong)
                .frame(height: 1)
            HStack(alignment: .firstTextBaseline) {
                Text("budget.subtotalLabel")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkSoft)
                Spacer(minLength: Theme.Spacing.s3)
                HStack(spacing: Theme.Spacing.s4) {
                    Text(BudgetFormat.amount(cents: totals.planned))
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(BudgetFormat.amount(cents: totals.actual))
                        .foregroundStyle(Theme.Colors.inkSoft)
                    Text(BudgetFormat.signed(cents: totals.variance))
                        .foregroundStyle(BudgetDerive.varianceTone(totals.variance).color)
                }
                .font(Theme.Fonts.monoTable)
                .monospacedDigit()
            }
        }
    }
}

/// Eine Kategoriezeile: Name + Abweichung (farbig) oben, Plan/Ist darunter.
private struct BudgetCategoryRow: View {
    let row: BudgetReportRow

    /// Ohne gesetzten Plan liefert der Bericht `plannedCents == nil` — dann „kein Plan“.
    private var hasPlan: Bool { row.plannedCents != nil }

    var body: some View {
        let variance = BudgetDerive.variance(of: row)
        return VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s3) {
                Text(verbatim: row.categoryName ?? "—")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Spacer(minLength: Theme.Spacing.s3)
                Text(BudgetFormat.signed(cents: variance))
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(BudgetDerive.varianceTone(variance).color)
            }
            HStack(spacing: Theme.Spacing.s5) {
                inlineValue(label: "budget.colPlanned", plannedText, muted: !hasPlan)
                inlineValue(label: "budget.colActual", BudgetFormat.amount(cents: row.actualCents))
                Spacer(minLength: 0)
            }
        }
        .padding(.vertical, Theme.Spacing.s1)
        .accessibilityElement(children: .combine)
    }

    private var plannedText: String {
        hasPlan ? BudgetFormat.amount(cents: row.plannedCents) : String(localized: "budget.noPlan")
    }

    private func inlineValue(label: LocalizedStringKey, _ value: String, muted: Bool = false) -> some View {
        HStack(spacing: Theme.Spacing.s2) {
            Text(label)
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            Text(value)
                .font(Theme.Fonts.monoTable)
                .monospacedDigit()
                .foregroundStyle(muted ? Theme.Colors.inkFaint : Theme.Colors.inkSoft)
        }
    }
}
