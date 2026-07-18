import SwiftUI
import Charts

/// RollArt-Verlauf (DESIGN-SYSTEM §3.9): Swift-Charts-LineMark über die
/// Gesamtwertungen, Mono-Werte an den Punkten, Delta-Chip — der Trend ist
/// der motivierende Wert, nicht die Einzelzahl. Beere = Verlauf (kein Honig:
/// Wertungen sind kein Musik-Kontext).
struct RoutineScoreTrendView: View {
    /// Vorsortiert nach `scored_on`, nur Einträge mit `total_score`.
    let scores: [RoutineScore]
    /// competition_id → Name (best effort; fehlt der Name: generischer Titel).
    let competitionNames: [String: String]

    private struct ScorePoint: Identifiable {
        let id: String
        let date: Date
        let total: Double
        let technical: Double?
        let components: Double?
        let eventName: String
        let isBest: Bool
    }

    private var points: [ScorePoint] {
        let totals = scores.compactMap(\.totalScore)
        let best = totals.max()
        return scores.compactMap { score in
            guard
                let total = score.totalScore,
                let date = RoutineFormat.scoredOnDate(score.scoredOn)
            else { return nil }
            let name: String
            if let competitionId = score.competitionId {
                name = competitionNames[competitionId]
                    ?? String(localized: "routines.scores.competitionFallback")
            } else {
                name = String(localized: "routines.scores.training")
            }
            return ScorePoint(
                id: score.id,
                date: date,
                total: total,
                technical: score.technicalScore,
                components: score.componentsScore,
                eventName: name,
                isBest: total == best
            )
        }
    }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "routines.scores.eyebrow",
                    title: "routines.scores.title"
                )
                if points.isEmpty {
                    emptyState
                } else {
                    content
                }
            }
        }
    }

    private var emptyState: some View {
        HStack(spacing: Theme.Spacing.s3) {
            Image(systemName: "sparkles")
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            Text("routines.scores.empty")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .padding(.vertical, Theme.Spacing.s3)
    }

    @ViewBuilder private var content: some View {
        let allPoints = points
        let totals = allPoints.map(\.total)
        let valuesText = totals.map { RoutineFormat.points($0) }.joined(separator: " → ")

        chart(allPoints)
            .frame(height: 190)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text("routines.scores.a11y.chart \(valuesText)"))

        // Zeilen unter dem Chart: Wettkampf · Monat — Wert (Mono).
        VStack(spacing: Theme.Spacing.s2) {
            ForEach(allPoints) { point in
                HStack(spacing: Theme.Spacing.s2) {
                    Text(verbatim: point.eventName)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(1)
                    Text(verbatim: RoutineFormat.monthYear(point.date))
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                    Spacer(minLength: Theme.Spacing.s2)
                    Text(verbatim: RoutineFormat.points(point.total))
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(point.isBest ? Theme.Colors.brandInk : Theme.Colors.inkPrimary)
                }
            }
        }

        // Technik/Komponenten des letzten Laufs als Klartext.
        if let last = allPoints.last, let technical = last.technical, let components = last.components {
            HStack(spacing: Theme.Spacing.s1) {
                Text("routines.scores.technical \(RoutineFormat.points(technical))")
                Text(verbatim: "·")
                Text("routines.scores.components \(RoutineFormat.points(components))")
            }
            .font(Theme.Fonts.caption)
            .monospacedDigit()
            .foregroundStyle(Theme.Colors.inkSoft)
        }

        Divider().overlay(Theme.Colors.line)

        footer(totals: totals)
    }

    private func chart(_ chartPoints: [ScorePoint]) -> some View {
        let totals = chartPoints.map(\.total)
        let lower = (totals.min() ?? 0) - 2
        let upper = (totals.max() ?? 0) + 2

        return Chart {
            ForEach(chartPoints) { point in
                LineMark(
                    x: .value("Datum", point.date),
                    y: .value("Punkte", point.total)
                )
                .foregroundStyle(Theme.Colors.brand)
                .interpolationMethod(.monotone)
                .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))

                PointMark(
                    x: .value("Datum", point.date),
                    y: .value("Punkte", point.total)
                )
                .foregroundStyle(Theme.Colors.brand)
                .symbolSize(point.isBest ? 140 : 80)
                .annotation(position: .top, spacing: 6) {
                    Text(verbatim: RoutineFormat.points(point.total))
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkPrimary)
                }
            }
        }
        .chartYScale(domain: lower...upper)
        .chartXAxis {
            AxisMarks(values: chartPoints.map(\.date)) { value in
                AxisGridLine().foregroundStyle(Theme.Colors.line)
                AxisValueLabel {
                    if let date = value.as(Date.self) {
                        Text(verbatim: RoutineFormat.monthYear(date))
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks { _ in
                AxisGridLine().foregroundStyle(Theme.Colors.line)
                AxisValueLabel()
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
    }

    private func footer(totals: [Double]) -> some View {
        HStack(spacing: Theme.Spacing.s2) {
            if totals.count > 1, let first = totals.first, let last = totals.last {
                RoutineDeltaChip(delta: last - first)
                Text("routines.scores.sinceFirst")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            } else {
                RSMStatusPill(text: "routines.scores.first", kind: .neutral)
            }
            Spacer(minLength: Theme.Spacing.s2)
            if let best = totals.max() {
                Text("routines.scores.best \(RoutineFormat.points(best))")
                    .font(Theme.Fonts.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
    }
}
