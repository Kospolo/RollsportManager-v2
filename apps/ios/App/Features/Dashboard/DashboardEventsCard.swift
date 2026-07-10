import SwiftUI

/// „Heute & demnächst“: die nächsten Termine mit Antwort-Balken und
/// Klartext-Zeile („5 zugesagt · 1 abgesagt · 3 offen“).
struct DashboardEventsCard: View {
    let data: DashboardData

    private let maxRows = 5

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "dashboard.events.eyebrow",
                    title: "dashboard.events.title"
                )
                if data.upcomingEvents.isEmpty {
                    RSMEmptyState(
                        systemImage: "calendar",
                        title: "dashboard.events.empty.title",
                        message: "dashboard.events.empty.message"
                    )
                } else {
                    VStack(spacing: 0) {
                        ForEach(
                            Array(data.upcomingEvents.prefix(maxRows).enumerated()),
                            id: \.element.id
                        ) { index, event in
                            if index > 0 {
                                Divider().overlay(Theme.Colors.line)
                            }
                            eventRow(event)
                        }
                    }
                    if data.upcomingEvents.count > maxRows {
                        Text("dashboard.events.more \(data.upcomingEvents.count - maxRows)")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkFaint)
                    }
                }
            }
        }
    }

    // MARK: - Zeile

    private func eventRow(_ event: Event) -> some View {
        let start = DashboardFormat.parseISO(event.startsAt)
        let summary = data.responseSummary(for: event)

        return HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            dateBadge(start)
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                HStack(spacing: Theme.Spacing.s2) {
                    Text(event.title)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(2)
                    if event.type == .competition {
                        RSMStatusPill(text: "dashboard.events.type.competition", kind: .brand)
                    }
                }
                if let meta = metaLine(event, start: start) {
                    Text(meta)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                RSMResponseBar(
                    going: summary.going,
                    declined: summary.declined,
                    open: summary.open
                )
                .padding(.top, Theme.Spacing.s1)
                Text("dashboard.events.responses \(summary.going) \(summary.declined) \(summary.open)")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .padding(.vertical, Theme.Spacing.s3)
        .frame(maxWidth: .infinity, minHeight: Theme.Size.listRow, alignment: .topLeading)
        .accessibilityElement(children: .combine)
    }

    /// Datums-Spalte links: Wochentag über Tag.Monat; „Heute“ hebt sich
    /// per brand-soft-Mulde ab.
    @ViewBuilder
    private func dateBadge(_ start: Date?) -> some View {
        let isToday = start.map { Calendar.current.isDateInToday($0) } ?? false
        VStack(spacing: 0) {
            if let start {
                if isToday {
                    Text("dashboard.date.today")
                        .font(Theme.Fonts.caption.weight(.bold))
                        .foregroundStyle(Theme.Colors.brandInk)
                } else {
                    Text(DashboardFormat.weekdayShortText(start))
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
                Text(DashboardFormat.dayMonthText(start))
                    .font(Theme.Fonts.bodyStrong)
                    .monospacedDigit()
                    .foregroundStyle(isToday ? Theme.Colors.brandInk : Theme.Colors.inkPrimary)
            } else {
                Text(verbatim: "–")
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
        }
        .frame(width: 56)
        .padding(.vertical, Theme.Spacing.s2)
        .background(isToday ? Theme.Colors.brandSoft : Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    /// „17:00 · Rollhalle Neckarsulm“
    private func metaLine(_ event: Event, start: Date?) -> String? {
        var parts: [String] = []
        if let start {
            parts.append(DashboardFormat.timeText(start))
        }
        if let location = event.location, !location.isEmpty {
            parts.append(location)
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
