import SwiftUI

/// Hallen-Karte in der Liste: Art-Chip, Kapazität, Name, Ort und die Zahl der
/// kommenden Buchungen. Die ganze Karte ist ein Button, der das Detail-Sheet
/// öffnet. Web-Referenz: belegungsplan/_components/FacilityCard.tsx.
struct FacilityCardView: View {
    let facility: Facility
    let upcomingCount: Int
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            RSMCard {
                VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                    header
                    Text(verbatim: facility.name)
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .multilineTextAlignment(.leading)

                    if let address = facility.address, !address.isEmpty {
                        Label {
                            Text(verbatim: address)
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkSoft)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                        } icon: {
                            Image(systemName: "mappin.and.ellipse")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.Colors.inkFaint)
                        }
                    }

                    Divider()
                        .overlay(Theme.Colors.line)

                    Label {
                        Text(upcomingLabel)
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    } icon: {
                        Image(systemName: "clock")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.Colors.inkFaint)
                    }
                }
            }
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(verbatim: facility.name))
        .accessibilityHint(Text("belegungsplan.card.a11yHint"))
    }

    private var header: some View {
        HStack(alignment: .center, spacing: Theme.Spacing.s2) {
            RSMStatusPill(text: BelegungDisplay.kindLabelKey(facility.kind), kind: .brand)
            if let capacity = facility.capacity {
                Spacer(minLength: Theme.Spacing.s2)
                Label {
                    Text("belegungsplan.capacity \(capacity)")
                        .font(Theme.Fonts.caption)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkSoft)
                } icon: {
                    Image(systemName: "person.3.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
            }
        }
    }

    private var upcomingLabel: LocalizedStringKey {
        switch upcomingCount {
        case 0: "belegungsplan.upcoming.none"
        case 1: "belegungsplan.upcoming.one"
        default: "belegungsplan.upcoming.many \(upcomingCount)"
        }
    }
}
