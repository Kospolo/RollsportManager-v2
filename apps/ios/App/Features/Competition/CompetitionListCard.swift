import SwiftUI

/// Karten-Zeile der Wettkampf-Liste: Kopf (Datum · relativ + Status-Pill),
/// Titel, Ort/Uhrzeit, Meldeschluss-Badge und gemeldete Starter/Küren.
/// Web-Referenz: wettkampf/_components/OverviewTab (Wettkampf-Karte).
struct CompetitionListCard: View {
    let competition: Competition

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                header
                titleLine
                metaLine
                deadlineBadge
                startersLine
            }
        }
    }

    // MARK: - Bausteine

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
            Text(verbatim: dateEyebrow)
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            Spacer(minLength: 0)
            RSMStatusPill(
                text: WettkampfStatusDisplay.labelKey(competition.status),
                kind: WettkampfStatusDisplay.pillKind(competition.status)
            )
        }
    }

    private var titleLine: some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
            Text(verbatim: competition.name)
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
        }
    }

    private var metaLine: some View {
        HStack(spacing: Theme.Spacing.s4) {
            if let location = competition.location, !location.isEmpty {
                metaItem(icon: "mappin.and.ellipse", text: location)
            }
            metaItem(icon: "clock", text: timeRange)
            Spacer(minLength: 0)
        }
        .font(Theme.Fonts.caption)
        .foregroundStyle(Theme.Colors.inkSoft)
    }

    private func metaItem(icon: String, text: String) -> some View {
        HStack(spacing: Theme.Spacing.s1) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            Text(verbatim: text)
                .monospacedDigit()
                .lineLimit(1)
        }
    }

    @ViewBuilder
    private var deadlineBadge: some View {
        if let deadline = competition.registrationDeadline {
            let diff = WettkampfDate.dayDiff(deadline)
            let passed = (diff ?? 0) < 0
            let soon = !passed && (diff ?? .max) <= 3
            RSMStatusPill(
                text: passed
                    ? "wettkampf.deadline.passed"
                    : "wettkampf.deadline \(WettkampfDate.relative(deadline))",
                kind: passed ? .neutral : (soon ? .warn : .info)
            )
        }
    }

    private var startersLine: some View {
        let starters = WettkampfEntries.starterCount(competition)
        let routines = WettkampfEntries.routineCount(competition)
        return (
            Text("wettkampf.starters \(starters)")
            + Text(verbatim: "  ·  ")
            + Text("wettkampf.routines \(routines)")
        )
        .font(Theme.Fonts.caption)
        .foregroundStyle(Theme.Colors.inkSoft)
    }

    // MARK: - Ableitungen

    /// „9. Aug. 2026 · in 5 Tagen“ — absolutes Datum plus relativer Abstand.
    private var dateEyebrow: String {
        let absolute = WettkampfDate.absolute(competition.startsAt)
        let relative = WettkampfDate.relative(competition.startsAt)
        guard !relative.isEmpty else { return absolute }
        return "\(absolute) · \(relative)"
    }

    private var timeRange: String {
        "\(WettkampfDate.time(competition.startsAt))–\(WettkampfDate.time(competition.endsAt))"
    }
}
