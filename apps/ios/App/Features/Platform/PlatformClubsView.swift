import SwiftUI

/// Betreiber-Sicht „Vereine": alle Vereine der Plattform als Verzeichnis.
///
/// Web-Referenz: apps/web/app/(super)/vereine. Bewusst als KARTENLISTE, nicht
/// als Tabelle: ein Verein ist eine Organisation mit Namen, Ort und Sportart —
/// „Mensch statt Tabelle" gilt auch hier. Die Mitgliederzahl ist eine
/// Betriebsgröße und steht als Chip daneben, nicht als Spalte.
struct PlatformClubsView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = PlatformSectionModel<[PlatformClub]>()
    @State private var search = ""

    var body: some View {
        PlatformSectionScreen(
            title: "platform.clubs.title",
            model: model,
            fetch: { try await session.api.listPlatformClubs() },
            isEmpty: { $0.isEmpty },
            emptyImage: "building.2",
            emptyTitle: "platform.clubs.empty.title",
            emptyMessage: "platform.clubs.empty.message"
        ) { clubs in
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                Text("platform.clubs.count \(clubs.count)")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .padding(.leading, Theme.Spacing.s1)
                ForEach(filtered(clubs), id: \.id) { club in
                    clubCard(club)
                }
                if filtered(clubs).isEmpty {
                    Text("platform.search.noMatch")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .padding(.top, Theme.Spacing.s5)
                }
            }
        }
        .searchable(text: $search, prompt: Text("platform.clubs.search"))
    }

    private func filtered(_ clubs: [PlatformClub]) -> [PlatformClub] {
        let needle = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return clubs }
        return clubs.filter {
            $0.name.lowercased().contains(needle)
                || ($0.shortName?.lowercased().contains(needle) ?? false)
                || ($0.city?.lowercased().contains(needle) ?? false)
        }
    }

    private func clubCard(_ club: PlatformClub) -> some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                    // Das Vereinslogo ist ein Marken-Asset und öffentlich —
                    // hier also erlaubt, anders als jedes Personenfoto.
                    RSMClubLogoView(clubId: club.id, size: 44)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(verbatim: club.name)
                            .font(Theme.Fonts.listTitle)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                        if let city = club.city, !city.isEmpty {
                            Text(verbatim: city)
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkSoft)
                        }
                    }
                    Spacer(minLength: 0)
                }

                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    PlatformDetailRow(
                        label: "platform.clubs.shortName",
                        value: PlatformFormat.text(club.shortName)
                    )
                    PlatformDetailRow(
                        label: "platform.clubs.discipline",
                        value: PlatformFormat.text(club.discipline)
                    )
                    PlatformDetailRow(
                        label: "platform.clubs.members",
                        value: PlatformFormat.count(club.memberCount),
                        monospaced: true
                    )
                    PlatformDetailRow(
                        label: "platform.clubs.createdAt",
                        value: PlatformFormat.day(club.createdAt)
                    )
                }
            }
        }
    }
}
