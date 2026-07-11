import SwiftUI

/// Detail-Ansicht eines überregionalen Events als Sheet: Disziplin-/Vergangen-
/// Chip, Titel, Datum(sspanne), Ausrichter, Ort, Anmelde-Link-Button und die
/// vollständige Beschreibung (Zeilenumbrüche erhalten). Rein lesend —
/// Bearbeiten/Löschen liegt im Web beim Trainerstab, nicht auf iOS.
/// Web-Referenz: events/_components/RegionalEventDetailSheet.tsx.
struct RegionalEventDetailSheet: View {
    let event: RegionalEvent
    let isPast: Bool
    @Environment(\.dismiss) private var dismiss

    private var registerURL: URL? { RegionalEventLink.safeExternalURL(event.registrationUrl) }
    private var trimmedDescription: String {
        event.description?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    RSMCard {
                        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                            header
                            if event.discipline != nil || isPast {
                                RegionalEventBadges(discipline: event.discipline, isPast: isPast)
                            }
                            metaList
                            if let registerURL {
                                RegionalEventRegisterLink(url: registerURL)
                            }
                            Divider().overlay(Theme.Colors.line)
                            description
                        }
                    }
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("events.regional.detail.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("events.regional.detail.close") { dismiss() }
                        .tint(Theme.Colors.inkSoft)
                }
            }
        }
        .presentationDragIndicator(.visible)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text("events.regional.detail.eyebrow")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
            Text(verbatim: event.title)
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)
        }
        .accessibilityElement(children: .combine)
    }

    private var metaList: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            metaRow(
                icon: "calendar",
                value: Text(verbatim: RegionalEventDate.span(startsOn: event.startsOn, endsOn: event.endsOn))
                    .foregroundColor(Theme.Colors.inkPrimary)
            )
            if let host = event.hostOrg, !host.isEmpty {
                metaRow(
                    icon: "person.2.fill",
                    value: Text("events.regional.host").foregroundColor(Theme.Colors.inkSoft)
                        + Text(verbatim: ": ").foregroundColor(Theme.Colors.inkSoft)
                        + Text(verbatim: host).foregroundColor(Theme.Colors.inkPrimary)
                )
            }
            if let location = event.location, !location.isEmpty {
                metaRow(
                    icon: "mappin.and.ellipse",
                    value: Text(verbatim: location).foregroundColor(Theme.Colors.inkPrimary)
                )
            }
        }
    }

    private func metaRow(icon: String, value: Text) -> some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundStyle(Theme.Colors.inkFaint)
                .frame(width: 18)
                .padding(.top, 1)
                .accessibilityHidden(true)
            value
                .font(Theme.Fonts.body)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var description: some View {
        if trimmedDescription.isEmpty {
            Text("events.regional.noDescription")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkFaint)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            Text(verbatim: event.description ?? "")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
