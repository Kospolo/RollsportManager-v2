import SwiftUI

/// Registry-Einhängepunkt des Budget-Moduls
/// (Web-Referenz: /(portal)/finanzen/budget). Stabiler Aufrufpunkt für den
/// „Mehr“-Hub (`MehrCatalog` → `BudgetRootView()`) und den DEBUG-Deeplink
/// (`MehrDeepLink.budget`).
///
/// BERECHTIGUNG: Budget ist `can_manage_finance` (owner/admin/treasurer). Die
/// Kachel im Hub ist für ALLE sichtbar (Konsistenz mit der Web-Navigation),
/// der Screen selbst ist aber gated — Rollen ohne Finanzrecht sehen einen
/// klaren „Keine Berechtigung“-Leerzustand statt eines 403-Fehlers. Der Server
/// erzwingt dieselbe Regel (RLS/403); dieser Client-Gate ist nur die
/// freundliche Vorab-Meldung.
///
/// Bei Berechtigung rendert diese Root-View die native Umsetzung `BudgetView`
/// (Soll/Ist via `api.getBudgetReport(clubId:year:)`); der Typname + der Gate
/// bleiben als stabiler Registry-/Deeplink-Einhängepunkt unverändert.
struct BudgetRootView: View {
    @EnvironmentObject private var session: SessionStore

    /// `can_manage_finance` — Rollen mit Zugriff aufs Vereins-Budget.
    private static let financeRoles: Set<ClubRole> = [.owner, .admin, .treasurer]

    private var canManageFinance: Bool {
        guard let role = session.session?.profile.clubRole else { return false }
        return Self.financeRoles.contains(role)
    }

    var body: some View {
        Group {
            if canManageFinance {
                BudgetView()
            } else {
                lockedState
            }
        }
    }

    private var lockedState: some View {
        ScrollView {
            RSMEmptyState(
                systemImage: "lock.fill",
                title: "module.budget.locked.title",
                message: "module.budget.locked.message"
            )
            .padding(.top, Theme.Spacing.s7)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("module.budget.title"))
        .navigationBarTitleDisplayMode(.large)
    }
}
