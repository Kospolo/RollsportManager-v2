import SwiftUI

/// Kompakte Liste der nächsten Termine aus der Auswertung. Jede Zeile trägt
/// einen Typ-Chip (Training/Wettkampf/Termin), den Titel und den lokalisierten
/// Zeitpunkt. Übersteigt die Gesamtzahl die angezeigten Einträge, folgt ein
/// dezenter „und N weitere“-Hinweis. Rein lesend.
struct ReportsUpcomingEventsCard: View {
    let events: [ReportUpcomingEvent]
    /// Gesamtzahl kommender Termine (`upcomingEventsCount`) für den „+N“-Hinweis.
    let total: Int

    private var rest: Int { max(total - events.count, 0) }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "auswertung.events.eyebrow", title: "auswertung.events.title")
                if events.isEmpty {
                    Text("auswertung.events.empty")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                } else {
                    VStack(spacing: Theme.Spacing.s2) {
                        ForEach(events, id: \.id) { event in
                            row(event)
                        }
                        if rest > 0 {
                            HStack {
                                Text("auswertung.events.more \(rest)")
                                    .font(Theme.Fonts.caption)
                                    .foregroundStyle(Theme.Colors.inkFaint)
                                Spacer(minLength: 0)
                            }
                            .padding(.top, 2)
                        }
                    }
                }
            }
        }
    }

    private func row(_ event: ReportUpcomingEvent) -> some View {
        HStack(spacing: Theme.Spacing.s3) {
            RSMStatusPill(text: Self.typeLabel(event.type), kind: Self.typeKind(event.type))
            Text(verbatim: event.title)
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(verbatim: ReportsFormat.dateTimeText(event.startsAt))
                .font(Theme.Fonts.mono(size: 12, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkFaint)
                .lineLimit(1)
                .layoutPriority(1)
        }
        .padding(.horizontal, Theme.Spacing.s3)
        .padding(.vertical, Theme.Spacing.s3)
        .background(Theme.Colors.bgCanvas)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }

    private static func typeLabel(_ type: EventType) -> LocalizedStringKey {
        switch type {
        case .training: "auswertung.event.training"
        case .competition: "auswertung.event.competition"
        case .other: "auswertung.event.other"
        }
    }

    private static func typeKind(_ type: EventType) -> RSMStatusKind {
        switch type {
        case .training: .info
        case .competition: .warn
        case .other: .neutral
        }
    }
}
