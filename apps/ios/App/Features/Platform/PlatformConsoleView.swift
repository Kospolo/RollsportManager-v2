import SwiftUI

// ============================================================================
// BETREIBER-KONSOLE (Web-Referenz: apps/web/app/(super)/**).
//
// Das ist die einzige Ebene der App, die NICHT einem Verein gehört. Sie sieht
// über alle Vereine hinweg und dient dem Betrieb der Plattform: Wer ist da,
// wer hat welche Lizenz, wo klemmt es, was läuft.
//
// ### WARUM SIE IN iOS NUR LIEST ###
// Die folgenschweren Betreiber-Eingriffe (Lizenz umstufen, Preise, SMTP)
// bleiben im Web. Auf dem Telefon fehlt der Überblick, der zu so einer
// Entscheidung gehört — und ein versehentlicher Tipper stellt sonst einen
// fremden Verein ab. Was iOS dagegen wirklich braucht: unterwegs nachsehen
// können. Genau das kann diese Konsole.
//
// ### DAS GATE IST MENÜFÜHRUNG, KEIN SCHUTZ ###
// Verbindlich ist `requirePlatformAdmin` auf jedem `/platform/*`-Endpoint.
// Diese View blendet den Zugang nur aus, wenn das Token den Claim nicht trägt
// — und zeigt dieselbe Karte, die der Server bei 403 auslöst.
// ============================================================================

/// Einstieg in die Betreiber-Ebene: Kennzahlen + Raster der Abschnitte.
struct PlatformConsoleView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var stats = PlatformSectionModel<PlatformStats>()

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var columns: [GridItem] {
        let count = dynamicTypeSize.isAccessibilitySize ? 1 : 2
        return Array(repeating: GridItem(.flexible(), spacing: Theme.Spacing.s3), count: count)
    }

    var body: some View {
        ScrollView {
            if session.permissions.isPlatformAdmin {
                granted
            } else {
                PlatformDeniedCard()
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("platform.title"))
        .navigationBarTitleDisplayMode(.large)
        .task {
            guard session.permissions.isPlatformAdmin else { return }
            await stats.loadIfNeeded { try await session.api.getPlatformStats() }
        }
    }

    // MARK: - Freigegebene Ansicht

    private var granted: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
            intro
            statsCard
            tileGrid
        }
        .padding(Theme.Spacing.s5)
    }

    /// Ein Satz, der sagt, wo man hier gelandet ist. Ohne ihn wirkt die
    /// Konsole wie ein weiterer Vereinsbereich — sie ist das Gegenteil.
    private var intro: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                RSMSectionHeader(
                    eyebrow: "platform.intro.eyebrow",
                    title: "platform.intro.title"
                )
                Text("platform.intro.body")
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
                Label("platform.intro.readOnly", systemImage: "eye")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    @ViewBuilder
    private var statsCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "platform.stats.eyebrow",
                    title: "platform.stats.title"
                )
                switch stats.state {
                case .loading:
                    ProgressView()
                        .tint(Theme.Colors.brand)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Spacing.s5)
                case .forbidden:
                    Text("platform.denied.message")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                case .failed(let message):
                    PlatformErrorCard(message: message) {
                        _Concurrency.Task {
                            await stats.load { try await session.api.getPlatformStats() }
                        }
                    }
                case .loaded(let value):
                    statsGrid(value)
                }
            }
        }
    }

    private func statsGrid(_ value: PlatformStats) -> some View {
        LazyVGrid(
            columns: RSMKpiTile.columns(for: dynamicTypeSize),
            spacing: Theme.Spacing.s3
        ) {
            RSMKpiTile(
                eyebrow: "platform.stats.clubs",
                value: number(value.clubs),
                caption: "platform.stats.clubs.caption"
            )
            RSMKpiTile(
                eyebrow: "platform.stats.members",
                value: number(value.members),
                caption: "platform.stats.members.caption"
            )
            RSMKpiTile(
                eyebrow: "platform.stats.activeMembers",
                value: number(value.activeMembers)
            )
            RSMKpiTile(
                eyebrow: "platform.stats.users",
                value: number(value.users)
            )
            RSMKpiTile(
                eyebrow: "platform.stats.events",
                value: number(value.events)
            )
            RSMKpiTile(
                eyebrow: "platform.stats.openInvoices",
                value: number(value.openInvoices),
                // Offene Rechnungen sind eine Betriebszahl, kein Alarm —
                // Rot bleibt hier bewusst aus.
                valueColor: Theme.Colors.inkPrimary
            )
        }
    }

    private func number(_ value: Int?) -> String {
        value.map { $0.formatted(.number.grouping(.automatic)) } ?? "–"
    }

    // MARK: - Abschnitte

    private var tileGrid: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            Text("platform.sections.eyebrow")
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
                .padding(.leading, Theme.Spacing.s1)

            LazyVGrid(columns: columns, spacing: Theme.Spacing.s3) {
                ForEach(PlatformCatalog.tiles) { tile in
                    NavigationLink {
                        tile.destination
                    } label: {
                        MehrTileCard(tile: tile)
                    }
                    .buttonStyle(RSMPressableButtonStyle())
                    .id(tile.id)
                }
            }
        }
    }
}

/// Die Abschnitte der Konsole — Reihenfolge wie in der Web-Betreiber-Navigation
/// (apps/web/app/(super)/nav.ts): Vereine → Küren → Support → Lizenzen → System.
/// „Zahlungen" und „Plattform-Einstellungen" fehlen absichtlich: beides sind
/// Schreib-Bereiche und bleiben im Web (siehe Kopf von Endpoints+Platform).
enum PlatformCatalog {
    static let tiles: [MehrTile] = [
        MehrTile(
            id: "plat-clubs",
            titleKey: "platform.tile.clubs.title",
            descKey: "platform.tile.clubs.desc",
            systemImage: "building.2.fill", tone: .brand,
            destination: AnyView(PlatformClubsView())
        ),
        MehrTile(
            id: "plat-users",
            titleKey: "platform.tile.users.title",
            descKey: "platform.tile.users.desc",
            systemImage: "person.crop.circle.fill", tone: .info,
            destination: AnyView(PlatformUsersView())
        ),
        MehrTile(
            id: "plat-licenses",
            titleKey: "platform.tile.licenses.title",
            descKey: "platform.tile.licenses.desc",
            systemImage: "shield.lefthalf.filled", tone: .success,
            destination: AnyView(PlatformLicensesView())
        ),
        MehrTile(
            id: "plat-support",
            titleKey: "platform.tile.support.title",
            descKey: "platform.tile.support.desc",
            systemImage: "lifepreserver.fill", tone: .warn,
            destination: AnyView(PlatformSupportView())
        ),
        MehrTile(
            id: "plat-routines",
            titleKey: "platform.tile.routines.title",
            descKey: "platform.tile.routines.desc",
            systemImage: "music.note.list", tone: .honey,
            destination: AnyView(PlatformRoutinesView())
        ),
        MehrTile(
            id: "plat-system",
            titleKey: "platform.tile.system.title",
            descKey: "platform.tile.system.desc",
            systemImage: "bolt.horizontal.circle.fill", tone: .neutral,
            destination: AnyView(PlatformSystemView())
        ),
    ]
}
