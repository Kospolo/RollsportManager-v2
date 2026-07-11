import SwiftUI

/// Finanzen-Sub-Hub (Web-Referenz: apps/web/app/(portal)/finanzen).
/// Einstieg aus dem „Mehr"-Hub. Behält die bestehende Finanz-Übersicht
/// (`FinanceView`) als erste Kachel und ergänzt für can_manage_finance die
/// drei Tiefen-Bereiche Kassenbuch · Rechnungen · Mahnwesen (Platzhalter-
/// Root-Views, die die drei Fach-Teams ausbauen).
///
/// Sichtbarkeit ist reine Menüführung über `permissions().canManageFinance`
/// (treasurer/moderator/admin/owner) — die verbindliche Durchsetzung bleibt
/// serverseitig (RLS + 403). Mitglieder sehen nur die Übersicht (eigene
/// Rechnungen via RLS); die drei Verwaltungs-Kacheln bleiben ihnen verborgen,
/// und die Ziel-Views tragen zusätzlich einen freundlichen Sperr-Screen.
///
/// Erwartet den `SessionStore` im Environment und einen umgebenden
/// `NavigationStack` (kommt vom „Mehr"-Tab).
struct FinanceHubView: View {
    @EnvironmentObject private var session: SessionStore

    private let columns = [
        GridItem(.flexible(), spacing: Theme.Spacing.s3),
        GridItem(.flexible(), spacing: Theme.Spacing.s3),
    ]

    /// Übersicht immer zuerst; die drei Tiefen-Bereiche nur mit Finanz-Recht.
    private var tiles: [MehrTile] {
        var result: [MehrTile] = [
            MehrTile(
                id: "finance-overview",
                titleKey: "finance.hub.overview.title",
                descKey: "finance.hub.overview.desc",
                systemImage: "chart.line.uptrend.xyaxis", tone: .success,
                destination: AnyView(FinanceView())
            )
        ]
        if session.permissions.canManageFinance {
            result.append(MehrTile(
                id: "kassenbuch",
                titleKey: "finance.hub.ledger.title",
                descKey: "finance.hub.ledger.desc",
                systemImage: "book.closed.fill", tone: .brand,
                destination: AnyView(KassenbuchRootView())
            ))
            result.append(MehrTile(
                id: "rechnungen",
                titleKey: "finance.hub.invoices.title",
                descKey: "finance.hub.invoices.desc",
                systemImage: "doc.text.fill", tone: .info,
                destination: AnyView(RechnungenRootView())
            ))
            result.append(MehrTile(
                id: "mahnungen",
                titleKey: "finance.hub.dunning.title",
                descKey: "finance.hub.dunning.desc",
                systemImage: "exclamationmark.bubble.fill", tone: .warn,
                destination: AnyView(MahnwesenRootView())
            ))
        }
        return result
    }

    var body: some View {
        ScrollView {
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
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("finance.hub.title"))
        .navigationBarTitleDisplayMode(.large)
    }
}
