import SwiftUI

/// Kassenbuch — GoBD-Journal des Vereins (Web-Referenz:
/// /(portal)/finanzen/kassenbuch). Buchungsliste mit laufendem Saldo,
/// Kategorie-/Zeitraum-Filter, Summenzeile, „Buchung erfassen“ und Storno.
///
/// Root-View des Bereichs; wird von `KassenbuchRootView` innerhalb des
/// `FinanceGuard` (canManageFinance + Sperr-Screen) gezeigt. Der umgebende
/// `NavigationStack` und der `navigationTitle` kommen von außen — dieser View
/// setzt nur seine Toolbar-Aktion und den Inhalt. Rechte bleiben serverseitig.
struct CashbookView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = CashbookViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .loaded:
                loadedView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .toolbar {
            if case .loaded = viewModel.state {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.showBookingSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(Theme.Colors.brand)
                    }
                    .accessibilityLabel(Text("kassenbuch.add"))
                }
            }
        }
        .task {
            await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId)
        }
        .sheet(isPresented: $viewModel.showBookingSheet) {
            CashbookBookingSheet(
                categories: viewModel.categories,
                members: viewModel.members,
                clubId: session.clubId
            ) { input in
                try await viewModel.createEntry(input, api: session.api, clubId: session.clubId)
            }
        }
        .sheet(isPresented: reverseSheetBinding) {
            if let entry = viewModel.reverseTarget {
                CashbookReverseSheet(entry: entry, currency: viewModel.currencyCode) { description in
                    do {
                        try await viewModel.reverseEntry(
                            id: entry.id,
                            description: description,
                            api: session.api,
                            clubId: session.clubId
                        )
                    } catch {
                        // 409: Zustand ist veraltet — Liste im Hintergrund
                        // auffrischen, dann den Klartext im Sheet zeigen.
                        if case APIError.problem(let problem) = error, problem.status == 409 {
                            await viewModel.load(api: session.api, clubId: session.clubId)
                        }
                        throw error
                    }
                }
            }
        }
    }

    private func reload() {
        _Concurrency.Task {
            await viewModel.load(api: session.api, clubId: session.clubId)
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s3) {
            ProgressView().tint(Theme.Colors.brand)
            Text("kassenbuch.loading")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
    }

    private func errorView(_ message: String) -> some View {
        ScrollView {
            RSMCard {
                VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                    HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(Theme.Colors.danger)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                            Text("kassenbuch.error.title")
                                .font(Theme.Fonts.bodyStrong)
                                .foregroundStyle(Theme.Colors.danger)
                            Text(verbatim: message)
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkSoft)
                        }
                    }
                    RSMSecondaryButton(title: "kassenbuch.error.retry") {
                        reload()
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
    }

    private var loadedView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                balanceCard
                if viewModel.isEmpty {
                    emptyCard
                } else {
                    CashbookFilterBar(viewModel: viewModel)
                    CashbookListCard(viewModel: viewModel)
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable {
            await viewModel.load(api: session.api, clubId: session.clubId)
        }
    }

    // MARK: - Kopf: Kassenstand + Anzahl

    private var balanceCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "kassenbuch.list.eyebrow",
                    title: "kassenbuch.list.title"
                )
                HStack(spacing: Theme.Spacing.s3) {
                    RSMKpiTile(
                        eyebrow: "kassenbuch.kpi.balance.eyebrow",
                        value: FinanceFormat.amount(
                            cents: viewModel.totalBalanceCents,
                            currency: viewModel.currencyCode
                        ),
                        caption: "kassenbuch.kpi.balance.caption",
                        valueColor: viewModel.totalBalanceCents < 0
                            ? Theme.Colors.danger : Theme.Colors.inkPrimary
                    )
                    RSMKpiTile(
                        eyebrow: "kassenbuch.kpi.count.eyebrow",
                        value: "\(viewModel.ledger.count)",
                        caption: "kassenbuch.kpi.count.caption"
                    )
                }
            }
        }
    }

    private var emptyCard: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "book.closed",
                title: "kassenbuch.empty.title",
                message: "kassenbuch.empty.message",
                actionTitle: "kassenbuch.empty.cta",
                action: { viewModel.showBookingSheet = true }
            )
        }
    }

    // MARK: - Sheet-Bindings
    //
    // Bewusst über `isPresented` statt `.sheet(item:)`: dafür müssten die
    // geteilten Contracts-Typen Identifiable-Konformanzen bekommen —
    // Kollisionsgefahr, wenn mehrere Feature-Teams dieselbe Extension anlegen.

    private var reverseSheetBinding: Binding<Bool> {
        Binding(
            get: { viewModel.reverseTarget != nil },
            set: { if !$0 { viewModel.reverseTarget = nil } }
        )
    }
}
