import SwiftUI

/// ÖFFENTLICHE ROOT-VIEW der Budgetplanung (Jahres-Plan gegen Ist je Kategorie).
///
/// Integration: wird von `BudgetRootView` gerendert (Registry-Einhängepunkt im
/// „Mehr“-Hub + DEBUG-Deeplink `MehrDeepLink.budget`) und läuft damit im
/// NavigationStack des Mehr-Tabs. Der Finanz-Gate (`can_manage_finance`) sitzt
/// in `BudgetRootView` DAVOR — hier stehen also nur berechtigte Rollen.
///
/// Aufbau wie die Web-Referenz `(portal)/finanzen/budget`: Jahr-Auswahl,
/// KPI-Leiste (Plan/Ist/Ergebnis/Abweichung), zwei Sektionen (Einnahmen &
/// Ausgaben) mit Plan · Ist · Ampel-Abweichung je Kategorie und ein
/// Abweichungs-Hinweis. Rein lesend.
struct BudgetView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var model = BudgetViewModel()
    @State private var year = Calendar.current.component(.year, from: Date())

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                header
                stateContent
            }
            .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text("module.budget.title"))
        .navigationBarTitleDisplayMode(.large)
        .refreshable { await model.refresh(year: year) }
        .task { await model.load(api: session.api, clubId: session.clubId, year: year) }
        .onChange(of: year) { _, newYear in
            _Concurrency.Task {
                await model.load(api: session.api, clubId: session.clubId, year: newYear)
            }
        }
        .alert("budget.loadError.title", isPresented: refreshErrorBinding) {
            Button("budget.error.ok", role: .cancel) {}
        } message: {
            Text(verbatim: model.refreshErrorMessage ?? "")
        }
    }

    // MARK: - Kopf + Jahr-Auswahl

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
            Text("budget.subtitle")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)

            VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                Text("budget.yearLabel")
                    .font(Theme.Fonts.eyebrow)
                    .tracking(Theme.Fonts.eyebrowTracking)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.Colors.inkFaint)
                Picker("budget.yearLabel", selection: $year) {
                    ForEach(BudgetDerive.years(), id: \.self) { value in
                        Text(verbatim: String(value)).tag(value)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
            }
        }
    }

    // MARK: - Zustände

    @ViewBuilder
    private var stateContent: some View {
        switch model.state {
        case .loading:
            loadingView
        case .error(let message):
            errorView(message)
        case .loaded(let report):
            loadedView(report)
        }
    }

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s4) {
            ProgressView()
                .tint(Theme.Colors.brand)
            Text("budget.loading")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Theme.Spacing.s9)
    }

    private func errorView(_ message: String) -> some View {
        RSMCard {
            VStack(spacing: Theme.Spacing.s4) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 40, weight: .medium))
                    .foregroundStyle(Theme.Colors.danger)
                    .accessibilityHidden(true)
                Text("budget.loadError.title")
                    .font(Theme.Fonts.h3)
                    .foregroundStyle(Theme.Colors.inkPrimary)
                Text(verbatim: message)
                    .font(Theme.Fonts.body)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .multilineTextAlignment(.center)
                RSMPrimaryButton(title: "budget.retry") {
                    _Concurrency.Task { await model.retry(year: year) }
                }
                .fixedSize()
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Theme.Spacing.s4)
        }
    }

    @ViewBuilder
    private func loadedView(_ report: BudgetReport) -> some View {
        if report.rows.isEmpty {
            RSMEmptyState(
                systemImage: "chart.pie",
                title: "budget.empty.title",
                message: "budget.empty.body"
            )
            .padding(.top, Theme.Spacing.s6)
        } else {
            BudgetKpiRow(totals: BudgetDerive.totals(report))
            BudgetSectionCard(
                eyebrow: "budget.incomeEyebrow",
                title: "budget.incomeTitle",
                rows: BudgetDerive.rows(report, kind: .income)
            )
            BudgetSectionCard(
                eyebrow: "budget.expenseEyebrow",
                title: "budget.expenseTitle",
                rows: BudgetDerive.rows(report, kind: .expense)
            )
            Text("budget.varianceHint")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Helfer

    private var refreshErrorBinding: Binding<Bool> {
        Binding(
            get: { model.refreshErrorMessage != nil },
            set: { if !$0 { model.refreshErrorMessage = nil } }
        )
    }
}
