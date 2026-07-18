import SwiftUI

/// Eine Ranglisten-/Startlisten-Zeile: Rang · Starter + Kür + Technik/Komponenten
/// · Gesamtwertung + Delta-Chip (▲▼=). Für den Trainerstab ist die ganze Zeile
/// ein Button, der das RollArt-ScorePad öffnet; Mitglieder sehen sie lesend.
/// Web-Referenz: wettkampf/_components/LiveStandings (CategoryStandings-Zeile).
struct CompetitionStandingRowView: View {
    let row: CompetitionStandingRow
    let canScore: Bool
    var onScore: (() -> Void)?

    var body: some View {
        if canScore, let onScore {
            Button(action: onScore) { rowContent }
                .buttonStyle(RSMPressableButtonStyle())
                .accessibilityHint(Text("wettkampf.row.a11y.score"))
        } else {
            rowContent
        }
    }

    private var rowContent: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            rankBadge
            VStack(alignment: .leading, spacing: 3) {
                Text(verbatim: WettkampfStandings.skaterName(row))
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    .multilineTextAlignment(.leading)
                Text(verbatim: row.routineTitle)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(1)
                scoresLine
            }
            Spacer(minLength: Theme.Spacing.s2)
            trailingColumn
        }
        .padding(Theme.Spacing.s4)
        .frame(minHeight: Theme.Size.listRow)
        .contentShape(Rectangle())
    }

    // MARK: - Rang

    private var rankBadge: some View {
        Text(verbatim: row.rank.map { "\($0)." } ?? "—")
            .font(Theme.Fonts.monoTable.weight(.bold))
            .monospacedDigit()
            .foregroundStyle(rankColor)
            .frame(minWidth: 30, alignment: .leading)
            .padding(.top, 1)
            .accessibilityLabel(rankA11y)
    }

    private var rankColor: Color {
        if let placement = row.placement, placement <= 3 { return Theme.Colors.brand }
        return Theme.Colors.inkPrimary
    }

    private var rankA11y: Text {
        guard let rank = row.rank else { return Text("wettkampf.rank.none") }
        return Text("wettkampf.rank \(rank)")
    }

    // MARK: - Technik / Komponenten

    private var scoresLine: some View {
        (
            Text("wettkampf.col.technical")
            + Text(verbatim: " \(WettkampfScore.formatOptional(row.technicalScore))   ·   ")
            + Text("wettkampf.col.components")
            + Text(verbatim: " \(WettkampfScore.formatOptional(row.componentsScore))")
        )
        .font(Theme.Fonts.caption)
        .monospacedDigit()
        .foregroundStyle(Theme.Colors.inkSoft)
    }

    // MARK: - Gesamt + Delta (+ Wertungs-Hinweis für Trainer)

    private var trailingColumn: some View {
        VStack(alignment: .trailing, spacing: Theme.Spacing.s1) {
            Text(verbatim: WettkampfScore.formatOptional(row.totalScore))
                .font(Theme.Fonts.monoTable.weight(.bold))
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkPrimary)
                .accessibilityLabel(totalA11y)
            DeltaChip(delta: row.delta)
            if canScore {
                Image(systemName: "square.and.pencil")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.Colors.brand)
                    .accessibilityHidden(true)
            }
        }
    }

    private var totalA11y: Text {
        Text("wettkampf.col.total") + Text(verbatim: " ")
            + Text(verbatim: WettkampfScore.formatOptional(row.totalScore))
    }
}

/// Delta-Chip: Gesamtwertung minus Vorwertung derselben Kür (▲ grün / ▼ rot /
/// = neutral / — keine Vorwertung). Das Vorzeichen trägt die Information; die
/// Farbe verstärkt nur (Design-Regel „Status nie nur über Farbe“).
private struct DeltaChip: View {
    let delta: Double?

    var body: some View {
        if let delta {
            if delta > 0 {
                pill(symbol: "▲", value: WettkampfScore.delta(delta), kind: .success, a11y: "wettkampf.delta.up")
            } else if delta < 0 {
                pill(symbol: "▼", value: WettkampfScore.delta(delta), kind: .danger, a11y: "wettkampf.delta.down")
            } else {
                pill(symbol: "=", value: WettkampfScore.format(0), kind: .neutral, a11y: "wettkampf.delta.same")
            }
        } else {
            pill(symbol: "—", value: nil, kind: .neutral, a11y: "wettkampf.delta.none")
        }
    }

    private func pill(symbol: String, value: String?, kind: RSMStatusKind, a11y: LocalizedStringKey) -> some View {
        Text(verbatim: value.map { "\(symbol) \($0)" } ?? symbol)
            .font(Theme.Fonts.caption.weight(.semibold))
            .monospacedDigit()
            .foregroundStyle(kind.foreground)
            .padding(.horizontal, Theme.Spacing.s2)
            .padding(.vertical, 2)
            .background(kind.background)
            .clipShape(Capsule())
            .accessibilityLabel(Text(a11y))
    }
}
