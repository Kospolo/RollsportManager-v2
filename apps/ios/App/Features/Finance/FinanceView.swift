import SwiftUI

/// Root-View des Finanzen-Tabs („Beiträge & Finanzen“).
///
/// Wird von der Integration in MainTabView verdrahtet — der NavigationStack
/// kommt von außen. Aufbau: KPI-Karte → Offene-Posten-Liste (Filter-Chips +
/// Summen-Fußzeile) → Mahn-Automatik-Karte. Die einzige Beere des Screens
/// ist „Mahnlauf (Vorschau)“ in der Mahn-Automatik-Karte.
struct FinanceView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = FinanceViewModel()

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
        .navigationTitle(Text("tab.finance"))
        .navigationBarTitleDisplayMode(.large)
        .task {
            await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId)
        }
        .sheet(isPresented: invoiceSheetBinding) {
            if let invoice = viewModel.selectedInvoice {
                FinanceInvoiceDetailSheet(
                    invoice: invoice,
                    memberName: viewModel.memberName(for: invoice.memberId)
                )
            }
        }
        .sheet(isPresented: dunningSheetBinding) {
            if let result = viewModel.dunningResult {
                FinanceDunningPreviewSheet(
                    result: result,
                    memberNames: viewModel.memberNames
                )
            }
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s3) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("finance.loading")
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
                            Text("finance.error.title")
                                .font(Theme.Fonts.bodyStrong)
                                .foregroundStyle(Theme.Colors.danger)
                            Text(verbatim: message)
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkSoft)
                        }
                    }
                    RSMSecondaryButton(title: "finance.error.retry") {
                        // Contracts-Struct `Task` liegt im Modul — daher
                        // voll qualifiziert `_Concurrency.Task`.
                        _Concurrency.Task {
                            await viewModel.load(api: session.api, clubId: session.clubId)
                        }
                    }
                    .accessibilityLabel(Text("finance.error.retry"))
                }
            }
            .padding(Theme.Spacing.s5)
        }
    }

    private var loadedView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                kpiCard
                FinanceListCard(viewModel: viewModel)
                FinanceDunningCard(state: viewModel.dunningState) {
                    _Concurrency.Task {
                        await viewModel.runDunningPreview(
                            api: session.api,
                            clubId: session.clubId
                        )
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable {
            await viewModel.load(api: session.api, clubId: session.clubId)
        }
    }

    // MARK: - KPI-Zeile

    private var kpiCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "finance.kpi.eyebrow",
                    title: "finance.kpi.title"
                )
                HStack(spacing: Theme.Spacing.s3) {
                    RSMKpiTile(
                        eyebrow: "finance.kpi.sum.eyebrow",
                        value: FinanceFormat.amount(
                            cents: viewModel.openTotalCents,
                            currency: viewModel.currencyCode
                        ),
                        caption: "finance.kpi.sum.caption"
                    )
                    RSMKpiTile(
                        eyebrow: "finance.kpi.count.eyebrow",
                        value: "\(viewModel.openInvoices.count)",
                        caption: "finance.kpi.count.caption"
                    )
                }
            }
        }
    }

    // MARK: - Sheet-Bindings
    //
    // Bewusst über `isPresented` statt `.sheet(item:)`: dafür müssten die
    // geteilten Contracts-Typen Identifiable-Konformanzen bekommen —
    // Kollisionsgefahr, wenn mehrere Feature-Teams dieselbe Extension anlegen.

    private var invoiceSheetBinding: Binding<Bool> {
        Binding(
            get: { viewModel.selectedInvoice != nil },
            set: { if !$0 { viewModel.selectedInvoice = nil } }
        )
    }

    private var dunningSheetBinding: Binding<Bool> {
        Binding(
            get: { viewModel.dunningResult != nil },
            set: { if !$0 { viewModel.dunningResult = nil } }
        )
    }
}
