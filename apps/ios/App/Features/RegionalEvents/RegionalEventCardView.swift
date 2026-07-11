import SwiftUI

/// Karte eines überregionalen Events: Disziplin-/Vergangen-Chip, Titel,
/// Ausrichter, Ort und Datum(sspanne); darunter — falls hinterlegt — ein
/// Anmelde-Link. Der Titel-/Meta-Bereich ist ein Button (44-pt-Ziel) und öffnet
/// die Detail-Ansicht; der Anmelde-Link ist ein eigenes Ziel (kein
/// verschachteltes Control). Vergangene Events werden gedämpft dargestellt.
/// Web-Referenz: events/_components/RegionalEventCard.tsx.
struct RegionalEventCardView: View {
    let event: RegionalEvent
    /// Vergangenes Event — gedämpfte Darstellung + „Vergangen“-Chip.
    let isPast: Bool
    let onOpen: () -> Void

    private var registerURL: URL? { RegionalEventLink.safeExternalURL(event.registrationUrl) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onOpen) {
                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    if event.discipline != nil || isPast {
                        RegionalEventBadges(discipline: event.discipline, isPast: isPast)
                    }
                    Text(verbatim: event.title)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .multilineTextAlignment(.leading)
                    meta
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(Theme.Spacing.s5)
                .contentShape(Rectangle())
            }
            .buttonStyle(RSMPressableButtonStyle())
            .accessibilityHint(Text("events.regional.card.a11y.hint"))

            if let registerURL {
                RegionalEventRegisterLink(url: registerURL, compact: true)
                    .padding(.horizontal, Theme.Spacing.s5)
                    .padding(.bottom, Theme.Spacing.s5)
            }
        }
        .opacity(isPast ? 0.65 : 1)
    }

    /// Meta-Zeilen: Datum(sspanne), Ausrichter, Ort — jeweils Icon + Text.
    private var meta: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            metaRow(icon: "calendar", text: RegionalEventDate.span(startsOn: event.startsOn, endsOn: event.endsOn))
            if let host = event.hostOrg, !host.isEmpty {
                metaRow(icon: "person.2.fill", text: host)
            }
            if let location = event.location, !location.isEmpty {
                metaRow(icon: "mappin.and.ellipse", text: location)
            }
        }
    }

    private func metaRow(icon: String, text: String) -> some View {
        HStack(spacing: Theme.Spacing.s2) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Theme.Colors.inkFaint)
                .frame(width: 15)
                .accessibilityHidden(true)
            Text(verbatim: text)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
                .multilineTextAlignment(.leading)
        }
    }
}

/// Chip-Reihe: Disziplin (Info-Tint, Freitext) und/oder „Vergangen“ (neutral).
/// Geteilt von Karte und Detail-Sheet, damit beide dieselbe Semantik zeigen.
struct RegionalEventBadges: View {
    let discipline: String?
    let isPast: Bool

    var body: some View {
        HStack(spacing: Theme.Spacing.s2) {
            if let discipline, !discipline.isEmpty {
                Text(verbatim: discipline)
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .foregroundStyle(Theme.Colors.info)
                    .padding(.horizontal, Theme.Spacing.s3)
                    .padding(.vertical, Theme.Spacing.s1)
                    .background(Theme.Colors.infoSoft)
                    .clipShape(Capsule())
            }
            if isPast {
                RSMStatusPill(text: "events.regional.badge.past", kind: .neutral)
            }
        }
    }
}

/// Anmelde-Link als Pill (brand-soft): öffnet die externe URL im Browser.
/// `compact` = kleinere Variante für die Karte, sonst die Detail-Größe.
struct RegionalEventRegisterLink: View {
    let url: URL
    var compact = false

    var body: some View {
        Link(destination: url) {
            HStack(spacing: Theme.Spacing.s2) {
                Image(systemName: "globe")
                    .font(.system(size: compact ? 13 : 15, weight: .semibold))
                Text("events.regional.register")
                    .font(Theme.Fonts.caption.weight(.bold))
            }
            .foregroundStyle(Theme.Colors.brandInk)
            .padding(.horizontal, compact ? Theme.Spacing.s3 : Theme.Spacing.s5)
            .frame(minHeight: compact ? 36 : Theme.Size.touchTarget)
            .background(Theme.Colors.brandSoft)
            .clipShape(Capsule())
        }
        .accessibilityLabel(Text("events.regional.register.a11y"))
    }
}
