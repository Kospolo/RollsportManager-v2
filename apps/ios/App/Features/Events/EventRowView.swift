import SwiftUI

/// Termin-Zeile der Tagesliste: Zeitspalte · Titel/Ort/Team-Pills ·
/// ResponseBar mit Klartext-Zählung · Chevron. Öffnet das Detail-Sheet.
struct EventRowView: View {
    let event: Event
    let counts: EventResponseCounts
    /// Aufgelöste Teams des Termins (können leer sein, solange Teams laden).
    let teams: [Team]
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                timeColumn
                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    titleLine
                    if let location = event.location, !location.isEmpty {
                        locationLine(location)
                    }
                    if !teams.isEmpty {
                        teamPills
                    }
                    responses
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkFaint)
                    .padding(.top, Theme.Spacing.s1)
                    .accessibilityHidden(true)
            }
            .padding(Theme.Spacing.s4)
            .frame(minHeight: Theme.Size.listRow)
            .contentShape(Rectangle())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityHint(Text("events.row.a11y.hint"))
    }

    // MARK: - Bausteine

    private var timeColumn: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: EventsDisplay.time(event.startsAt))
                .font(Theme.Fonts.bodyStrong)
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text(verbatim: EventsDisplay.time(event.endsAt))
                .font(Theme.Fonts.caption)
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkFaint)
        }
        .frame(width: 52, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var titleLine: some View {
        HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
            Text(verbatim: event.title)
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .multilineTextAlignment(.leading)
            Spacer(minLength: 0)
            RSMStatusPill(
                text: EventsDisplay.typeLabelKey(event.type),
                kind: EventsDisplay.typePillKind(event.type)
            )
        }
    }

    private func locationLine(_ location: String) -> some View {
        HStack(spacing: Theme.Spacing.s1) {
            Image(systemName: "mappin.and.ellipse")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            Text(verbatim: location)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .lineLimit(1)
        }
    }

    private var teamPills: some View {
        HStack(spacing: Theme.Spacing.s1) {
            ForEach(teams.prefix(2), id: \.id) { team in
                RSMStatusPill(text: "\(team.name)", kind: .neutral)
            }
            if teams.count > 2 {
                RSMStatusPill(text: "events.teams.more \(teams.count - 2)", kind: .neutral)
            }
        }
    }

    /// 6-pt-Balken (rein visuell, a11y-hidden) + Klartext-Zeile darunter —
    /// „Vielleicht“ zählt im Balken zum offenen Rest, der Text schlüsselt auf.
    private var responses: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            RSMResponseBar(
                going: counts.going,
                declined: counts.declined,
                open: counts.open + counts.maybe
            )
            EventsDisplay.countsText(counts)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
    }
}
