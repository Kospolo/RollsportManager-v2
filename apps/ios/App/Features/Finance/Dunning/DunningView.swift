import SwiftUI

/// Mahnwesen — Fach-UI des Finanz-Tiefen-Bereichs „Mahnungen"
/// (Web-Referenz: apps/web/app/(portal)/finanzen/mahnungen).
///
/// Aufbau: KPI-/Aktions-Karte (Überfällig · In Mahnung · Übergabe + Mahnlauf-
/// Beere) → Ampel-Gruppen nach Mahnstufe (0–3) → unveränderliches Mahnprotokoll.
/// Der Mahnlauf ist bewusst zweistufig: erst Vorschau (dryRun), dann Anwenden;
/// Stufe 1 automatisch, Stufe ≥ 2 nur mit ausdrücklicher Freigabe + Rückfrage.
///
/// Diese View ist der Inhalt hinter dem `FinanceGuard` in `MahnwesenRootView`
/// (der `navigationTitle` „Mahnungen" und den Mitglieder-Sperr-Screen liefert).
/// Zusätzlich fängt sie ein serverseitiges 403 selbst als ruhigen Zustand ab —
/// der Server bleibt die verbindliche Grenze.
struct DunningView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var viewModel = DunningViewModel()

    @State private var runOpen = false
    @State private var mailTarget: MailTarget?

    /// Ziel der E-Mail-Vorschau — Invoice ist nicht Identifiable, deshalb ein
    /// eigener, stabiler Wrapper für `.sheet(item:)`.
    private struct MailTarget: Identifiable {
        let invoiceId: String
        let stage: Int
        var id: String { invoiceId }
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .loading:
                loadingView
            case .forbidden:
                forbiddenView
            case .error(let message):
                errorView(message)
            case .loaded:
                loadedView
            }
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .task { await viewModel.loadIfNeeded(api: session.api, clubId: session.clubId) }
        .sheet(isPresented: $runOpen) {
            DunningRunSheet(
                api: session.api,
                clubId: session.clubId,
                currencyCode: viewModel.currencyCode,
                memberName: { viewModel.memberName(for: $0) }
            ) {
                _Concurrency.Task {
                    await viewModel.reloadAfterApply(api: session.api, clubId: session.clubId)
                }
            }
        }
        .sheet(item: $mailTarget) { target in
            if let invoice = viewModel.invoice(id: target.invoiceId) {
                let member = viewModel.member(id: invoice.memberId)
                let sender = viewModel.sender
                DunningMailPreviewSheet(
                    invoice: invoice,
                    memberName: viewModel.memberName(for: invoice.memberId)
                        ?? String(localized: "finance.member.unknown"),
                    memberEmail: member?.email,
                    senderName: sender.map { "\($0.firstName) \($0.lastName)" }
                        ?? String(localized: "mahnungen.history.system"),
                    senderEmail: sender?.email,
                    currencyCode: viewModel.currencyCode,
                    stage: target.stage
                )
            }
        }
    }

    // MARK: - Zustände

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.s3) {
            ProgressView().tint(Theme.Colors.brand)
            Text("mahnungen.loading")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
    }

    private var forbiddenView: some View {
        ScrollView {
            RSMEmptyState(
                systemImage: "lock.fill",
                title: "mahnungen.forbidden.title",
                message: "mahnungen.forbidden.message"
            )
            .padding(.top, Theme.Spacing.s7)
        }
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
                            Text("mahnungen.error.title")
                                .font(Theme.Fonts.bodyStrong)
                                .foregroundStyle(Theme.Colors.danger)
                            Text(verbatim: message)
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkSoft)
                        }
                    }
                    RSMSecondaryButton(title: "mahnungen.retry") {
                        _Concurrency.Task { await viewModel.load(api: session.api, clubId: session.clubId) }
                    }
                }
            }
            .padding(Theme.Spacing.s5)
        }
    }

    private var loadedView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                heroCard
                if viewModel.items.isEmpty {
                    emptyItemsCard
                } else {
                    ForEach(viewModel.stages) { bucket in
                        DunningStageGroupCard(bucket: bucket, currencyCode: viewModel.currencyCode) { invoiceId, stage in
                            mailTarget = MailTarget(invoiceId: invoiceId, stage: stage)
                        }
                    }
                }
                historySection
            }
            .padding(Theme.Spacing.s5)
        }
        .refreshable {
            await viewModel.load(api: session.api, clubId: session.clubId)
        }
    }

    // MARK: - Hero (KPI + Mahnlauf-Beere)

    private var heroCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "mahnungen.kpi.eyebrow", title: "mahnungen.kpi.title")
                Text("mahnungen.subtitle \(DunningFormat.today(viewModel.asOf))")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                overdueTile
                HStack(spacing: Theme.Spacing.s3) {
                    dunningTile
                    handoverTile
                }
                RSMPrimaryButton(title: "mahnungen.run.button") { runOpen = true }
                    .accessibilityLabel(Text("mahnungen.run.button"))
            }
        }
    }

    private var overdueTile: some View {
        RSMKpiTile(
            eyebrow: "mahnungen.kpi.overdue.eyebrow",
            value: FinanceFormat.amount(cents: viewModel.overdueTotalCents, currency: viewModel.currencyCode),
            caption: viewModel.overdueItems.isEmpty
                ? "mahnungen.kpi.overdue.caption.none"
                : "mahnungen.kpi.overdue.caption.some \(viewModel.overdueItems.count)",
            valueColor: viewModel.overdueItems.isEmpty ? Theme.Colors.inkPrimary : Theme.Colors.warn
        )
    }

    private var dunningTile: some View {
        RSMKpiTile(
            eyebrow: "mahnungen.kpi.dunning.eyebrow",
            value: "\(viewModel.stage2PlusItems.count)",
            caption: viewModel.stage2PlusItems.isEmpty
                ? "mahnungen.kpi.dunning.caption.none"
                : "mahnungen.kpi.dunning.caption.some \(FinanceFormat.amount(cents: viewModel.stage2PlusTotalCents, currency: viewModel.currencyCode))",
            valueColor: dunningTone
        )
    }

    private var handoverTile: some View {
        RSMKpiTile(
            eyebrow: "mahnungen.kpi.handover.eyebrow",
            value: "\(viewModel.handoverItems.count)",
            caption: viewModel.handoverItems.isEmpty
                ? "mahnungen.kpi.handover.caption.none"
                : "mahnungen.kpi.handover.caption.some",
            valueColor: viewModel.handoverItems.isEmpty ? Theme.Colors.inkPrimary : Theme.Colors.danger
        )
    }

    private var dunningTone: Color {
        if !viewModel.handoverItems.isEmpty { return Theme.Colors.danger }
        if !viewModel.stage2PlusItems.isEmpty { return Theme.Colors.warn }
        return Theme.Colors.inkPrimary
    }

    private var emptyItemsCard: some View {
        RSMCard {
            RSMEmptyState(
                systemImage: "checkmark.seal",
                title: "mahnungen.empty.title",
                message: "mahnungen.empty.message"
            )
        }
    }

    // MARK: - Mahnprotokoll

    @ViewBuilder
    private var historySection: some View {
        switch viewModel.logState {
        case .loading:
            RSMCard {
                HStack(spacing: Theme.Spacing.s3) {
                    ProgressView().tint(Theme.Colors.brand)
                    Text("mahnungen.history.loading")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        case .error(let message):
            RSMCard {
                VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                    RSMSectionHeader(eyebrow: "mahnungen.history.eyebrow", title: "mahnungen.history.title")
                    Text(verbatim: message)
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                    RSMSecondaryButton(title: "mahnungen.retry") {
                        _Concurrency.Task { await viewModel.loadLog(api: session.api, clubId: session.clubId) }
                    }
                }
            }
        case .loaded:
            DunningHistoryCard(
                log: viewModel.log,
                invoiceLookup: { viewModel.invoice(id: $0) },
                memberNameLookup: { viewModel.memberName(for: $0) }
            )
        }
    }
}
