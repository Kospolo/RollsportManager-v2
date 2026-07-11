import SwiftUI

/// Root-View der Rechnungs-Verwaltung (Web-Referenz:
/// /(portal)/finanzen/rechnungen). Eingehängt aus `RechnungenRootView`, das
/// den `FinanceGuard` (can_manage_finance + Sperr-Screen) und den
/// `navigationTitle` beisteuert — dieser View liefert nur den Inhalt.
///
/// Aufbau: Filter-/Suchleiste + Rechnungsliste mit Summenzeile, dazu die beiden
/// Sheets „Rechnung erstellen" und Rechnungs-Detail (bezahlt/stornieren). Der
/// Server bleibt die verbindliche Grenze — 403 wird als freundlicher Zustand
/// aufgefangen, GoBD-Regeln (kein Re-Open) trägt das Detail-Sheet.
struct InvoicesView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = InvoicesViewModel()

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                loadingView
            case .error(let message):
                errorView(message)
            case .forbidden:
                forbiddenView
            case .loaded:
                loadedView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .task {
            await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId)
        }
        .toolbar {
            if viewModel.state == .loaded {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.createOpen = true
                    } label: {
                        Image(systemName: "plus")
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.brandInk)
                    }
                    .accessibilityLabel(Text("rechnungen.create.action"))
                }
            }
        }
        .sheet(isPresented: $viewModel.createOpen) {
            CreateInvoiceSheet(
                api: session.api,
                clubId: session.clubId,
                members: viewModel.members,
                onCreated: { viewModel.addCreated($0) }
            )
        }
        .sheet(isPresented: detailBinding) {
            if let invoice = viewModel.selectedInvoice {
                InvoiceDetailSheet(
                    invoice: invoice,
                    member: viewModel.member(for: invoice.memberId),
                    categories: viewModel.incomeCategories,
                    api: session.api,
                    clubId: session.clubId,
                    onChanged: { viewModel.applyChange($0) }
                )
            }
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s3) {
            ProgressView().tint(Theme.Colors.brand)
            Text("rechnungen.loading")
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
                            Text("rechnungen.error.title")
                                .font(Theme.Fonts.bodyStrong)
                                .foregroundStyle(Theme.Colors.danger)
                            Text(verbatim: message)
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkSoft)
                        }
                    }
                    RSMSecondaryButton(title: "rechnungen.retry") {
                        _Concurrency.Task {
                            await viewModel.load(api: session.api, clubId: session.clubId)
                        }
                    }
                    .accessibilityLabel(Text("rechnungen.retry"))
                }
            }
            .padding(Theme.Spacing.s5)
        }
    }

    private var forbiddenView: some View {
        ScrollView {
            RSMEmptyState(
                systemImage: "lock.fill",
                title: "rechnungen.forbidden.title",
                message: "rechnungen.forbidden.message"
            )
            .padding(.top, Theme.Spacing.s7)
        }
    }

    private var loadedView: some View {
        ScrollView {
            InvoicesListCard(viewModel: viewModel)
                .padding(Theme.Spacing.s5)
        }
        .refreshable {
            await viewModel.load(api: session.api, clubId: session.clubId)
        }
    }

    // MARK: - Sheet-Binding
    //
    // Bewusst über `isPresented` statt `.sheet(item:)`: die geteilten
    // Contracts-Typen (Invoice) sollen keine feature-lokale Identifiable-
    // Konformanz bekommen (Kollisionsgefahr mit anderen Finanz-Teams).

    private var detailBinding: Binding<Bool> {
        Binding(
            get: { viewModel.selectedInvoice != nil },
            set: { if !$0 { viewModel.selectedInvoice = nil } }
        )
    }
}
