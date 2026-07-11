import SwiftUI

/// Verwaltungs-Sub-Hub (Web-Referenz: apps/web/app/(portal)/verwaltung).
/// Karten-Raster im „Mehr"-Stil mit vier Bereichen — Mitglieder-Verwaltung,
/// Rollen & Rechte, Teams, Vereins-Einstellungen. Jede Kachel erscheint nur,
/// wenn die aktuelle Rolle sie darf (Sichtbarkeit über `permissions()`); der
/// verbindliche Schutz bleibt serverseitig.
///
/// Erreichbar ist der Hub selbst nur, wenn `permissions(role).isClubAdmin`
/// (Gate sitzt in `MehrHubView`), erwartet den `SessionStore` im Environment
/// und einen umgebenden `NavigationStack` (kommt vom „Mehr"-Tab).
struct VerwaltungHubView: View {
    @EnvironmentObject private var session: SessionStore

    private let columns = [
        GridItem(.flexible(), spacing: Theme.Spacing.s3),
        GridItem(.flexible(), spacing: Theme.Spacing.s3),
    ]

    /// Nur die Kacheln, die die aktuelle Rolle sehen darf — Reihenfolge wie im
    /// Web-Hub (Mitglieder → Rollen → Teams → Einstellungen → Plattform).
    private var tiles: [MehrTile] {
        let perms = session.permissions
        var result: [MehrTile] = []

        if perms.canManageMembers {
            result.append(MehrTile(
                id: "verw-mitglieder",
                titleKey: "verwaltung.tile.members.title",
                descKey: "verwaltung.tile.members.desc",
                systemImage: "person.2.fill", tone: .brand,
                destination: AnyView(MembersAdminRootView())
            ))
        }
        if perms.isClubAdmin {
            result.append(MehrTile(
                id: "verw-rollen",
                titleKey: "verwaltung.tile.roles.title",
                descKey: "verwaltung.tile.roles.desc",
                systemImage: "lock.shield.fill", tone: .info,
                destination: AnyView(RolesRootView())
            ))
            result.append(MehrTile(
                id: "verw-teams",
                titleKey: "verwaltung.tile.teams.title",
                descKey: "verwaltung.tile.teams.desc",
                systemImage: "person.3.fill", tone: .success,
                destination: AnyView(TeamsAdminRootView())
            ))
        }
        if perms.canManageClubSettings {
            result.append(MehrTile(
                id: "verw-verein",
                titleKey: "verwaltung.tile.club.title",
                descKey: "verwaltung.tile.club.desc",
                systemImage: "gearshape.fill", tone: .neutral,
                destination: AnyView(ClubSettingsRootView())
            ))
        }
        return result
    }

    var body: some View {
        ScrollView {
            if tiles.isEmpty {
                RSMEmptyState(
                    systemImage: "lock.fill",
                    title: "verwaltung.empty.title",
                    message: "verwaltung.empty.message"
                )
                .padding(.top, Theme.Spacing.s7)
            } else {
                LazyVGrid(columns: columns, spacing: Theme.Spacing.s3) {
                    ForEach(tiles) { tile in
                        NavigationLink {
                            tile.destination
                        } label: {
                            MehrTileCard(tile: tile)
                        }
                        .buttonStyle(RSMPressableButtonStyle())
                        .id(tile.id)
                    }
                }
                .padding(Theme.Spacing.s5)
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("verwaltung.title"))
        .navigationBarTitleDisplayMode(.large)
    }
}
