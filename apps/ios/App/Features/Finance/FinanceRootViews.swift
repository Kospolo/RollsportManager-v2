import SwiftUI

// ============================================================================
// Platzhalter-Root-Views der drei Finanz-Tiefen-Bereiche (Finanz-Tiefe A).
//
// Stabile Aufrufpunkte (analog VerwaltungRootViews): der Finanzen-Sub-Hub und
// der „Mehr"-Deeplink verdrahten diese Typen; die drei Fach-Teams ersetzen den
// Scaffold-Body durch ihre echte Umsetzung. Die Endpoints stehen bereit
// (Endpoints+Finance.swift), das Gating ebenso (`permissions().canManageFinance`).
//
// Alle drei Bereiche sind can_manage_finance-only. Wer ohne das Recht landet
// (z. B. via DEBUG-Deeplink als `member`), sieht einen freundlichen
// Sperr-Screen statt Inhalt — der Server bleibt die verbindliche Grenze (403).
// ============================================================================

/// Gemeinsamer Rahmen: prüft `canManageFinance` und zeigt sonst den
/// Sperr-Screen. Der `content` wird nur für berechtigte Rollen ausgewertet.
private struct FinanceGuard<Content: View>: View {
    @EnvironmentObject private var session: SessionStore
    let titleKey: LocalizedStringKey
    @ViewBuilder let content: () -> Content

    var body: some View {
        Group {
            if session.permissions.canManageFinance {
                content()
            } else {
                ScrollView {
                    RSMEmptyState(
                        systemImage: "lock.fill",
                        title: "finance.locked.title",
                        message: "finance.locked.message"
                    )
                    .padding(.top, Theme.Spacing.s7)
                }
                .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            }
        }
        .navigationTitle(Text(titleKey))
        .navigationBarTitleDisplayMode(.large)
    }
}

/// Kassenbuch — GoBD-Journal (listLedger / createLedgerEntry /
/// reverseLedgerEntry / listLedgerCategories).
/// Web-Referenz: /(portal)/finanzen/kassenbuch.
struct KassenbuchRootView: View {
    var body: some View {
        FinanceGuard(titleKey: "finance.hub.ledger.title") {
            CashbookView()
        }
    }
}

/// Rechnungen — Liste/Detail/Anlegen/Status (listInvoices / getInvoice /
/// createInvoice / setInvoiceStatus).
/// Web-Referenz: /(portal)/finanzen/rechnungen.
struct RechnungenRootView: View {
    var body: some View {
        FinanceGuard(titleKey: "finance.hub.invoices.title") {
            InvoicesView()
        }
    }
}

/// Mahnwesen — Lauf/Anwenden/Log (runDunning / applyDunning / listDunningLog).
/// Web-Referenz: /(portal)/finanzen/mahnungen.
struct MahnwesenRootView: View {
    var body: some View {
        FinanceGuard(titleKey: "finance.hub.dunning.title") {
            DunningView()
        }
    }
}

