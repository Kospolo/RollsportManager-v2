import Foundation
import SwiftUI

/// Rechnungs-Detail als Sheet: Kopf (Betrag/Status/Mahnstufe) · Empfänger ·
/// Eckdaten · Positionen · EPC-QR-Hinweis (nur offen) · Verlauf (inkl.
/// Mahnprotokoll) und die terminalen Aktionen „als bezahlt markieren"
/// (Zahlweg + optionale Kassenbuch-Einnahme) und „stornieren".
///
/// GoBD: kein Re-Open. „Bezahlt" und „Storniert" sind Endzustände, jede
/// scharfe Aktion verlangt eine bewusste Bestätigung. Der Server bleibt die
/// verbindliche Grenze (403/409 werden als klare Meldung aufgefangen).
/// Web-Referenz: rechnungen/_components/InvoiceDetailSheet.tsx.
struct InvoiceDetailSheet: View {
    let invoice: Invoice
    let member: ClubMember?
    let categories: [LedgerCategory]
    let api: APIClient
    let clubId: String
    let onChanged: (Invoice) -> Void

    @Environment(\.dismiss) private var dismiss

    private enum Mode { case view, settle }
    @State private var mode: Mode = .view
    @State private var busy = false
    @State private var actionError: String?
    @State private var log: [DunningLogEntry] = []
    @State private var showCancelConfirm = false

    @State private var via: InvoicePayVia = .sepa
    @State private var postToLedger = true
    @State private var categoryId = ""

    private var displayName: String {
        member.map { "\($0.firstName) \($0.lastName)" }
            ?? String(localized: "rechnungen.member.unknown")
    }

    private var amountText: String {
        FinanceFormat.amount(cents: invoice.amountCents, currency: invoice.currency)
    }

    private var canMarkPaid: Bool { invoice.status == .open }
    private var canCancel: Bool { invoice.status == .open || invoice.status == .draft }

    private var historyItems: [InvoiceHistoryItem] {
        InvoiceHistory.build(invoice: invoice, log: log)
    }

    private func historyLabel(_ kind: InvoiceHistoryItem.Kind) -> Text {
        InvoiceHistory.label(kind)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    headerCard
                    if mode == .settle {
                        settleSection
                    } else {
                        detailsCard
                        positionsCard
                        if invoice.status == .open { epcCard }
                        historyCard
                        terminalHint
                        actionButtons
                    }
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("rechnungen.detail.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("rechnungen.detail.close") { dismiss() }
                        .font(Theme.Fonts.bodyStrong)
                        .tint(Theme.Colors.brandInk)
                }
            }
            .alert("rechnungen.error.title", isPresented: errorBinding) {
                Button("rechnungen.error.ok", role: .cancel) {}
            } message: {
                Text(verbatim: actionError ?? "")
            }
            .confirmationDialog(
                "rechnungen.cancel.title",
                isPresented: $showCancelConfirm,
                titleVisibility: .visible
            ) {
                Button("rechnungen.cancel.confirm", role: .destructive) {
                    _Concurrency.Task { await doCancel() }
                }
                Button("rechnungen.cancel.back", role: .cancel) {}
            } message: {
                Text("rechnungen.cancel.warning")
            }
            .task {
                if let entries = try? await api.listDunningLog(clubId: clubId, invoiceId: invoice.id) {
                    log = entries
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Kopf

    private var headerCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    Text(verbatim: invoice.title)
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(verbatim: invoice.number)
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
                HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.s2) {
                    Text(verbatim: amountText)
                        .font(Theme.Fonts.monoHero.weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Spacer(minLength: Theme.Spacing.s2)
                    if invoice.status == .open && invoice.dunningLevel > 0 {
                        RSMStatusPill.dunning(level: invoice.dunningLevel)
                    }
                    RSMStatusPill(
                        text: InvoiceStatusDisplay.labelKey(invoice.status),
                        kind: InvoiceStatusDisplay.pillKind(invoice.status)
                    )
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: - Empfänger + Eckdaten

    private var detailsCard: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack(spacing: Theme.Spacing.s3) {
                    RSMAvatarView(name: displayName, personId: invoice.memberId, size: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("rechnungen.detail.recipient")
                            .font(Theme.Fonts.eyebrow)
                            .tracking(Theme.Fonts.eyebrowTracking)
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.Colors.inkFaint)
                        Text(verbatim: displayName)
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                        if let email = member?.email, !email.isEmpty {
                            Text(verbatim: email)
                                .font(Theme.Fonts.caption)
                                .foregroundStyle(Theme.Colors.inkSoft)
                        }
                    }
                }
                .accessibilityElement(children: .combine)
                Divider().overlay(Theme.Colors.line)
                if let issued = FinanceFormat.date(invoice.issuedOn) {
                    detailRow("rechnungen.detail.issued", issued)
                }
                if let due = FinanceFormat.date(invoice.dueOn) {
                    detailRow("rechnungen.detail.due", due)
                }
                if invoice.status == .paid, let paid = FinanceFormat.date(invoice.paidAt) {
                    detailRow("rechnungen.detail.paidAt", paid)
                }
                if invoice.status == .paid, let paidVia = invoice.paidVia, !paidVia.isEmpty {
                    detailRow("rechnungen.detail.paidVia", paidVia)
                }
            }
        }
    }

    private func detailRow(_ label: LocalizedStringKey, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
            Spacer(minLength: Theme.Spacing.s2)
            Text(verbatim: value)
                .font(Theme.Fonts.body)
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkPrimary)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Positionen

    private var positionsCard: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                RSMSectionHeader(eyebrow: "rechnungen.pos.eyebrow", title: "rechnungen.pos.title")
                HStack(alignment: .firstTextBaseline) {
                    Text(verbatim: invoice.title)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Spacer(minLength: Theme.Spacing.s2)
                    Text(verbatim: amountText)
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkPrimary)
                }
                Divider().overlay(Theme.Colors.lineStrong)
                HStack(alignment: .firstTextBaseline) {
                    Text("rechnungen.pos.total")
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkSoft)
                    Spacer(minLength: Theme.Spacing.s2)
                    Text(verbatim: amountText)
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkPrimary)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: - EPC-QR-Hinweis

    private var epcCard: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                Image(systemName: "qrcode")
                    .font(.system(size: 28, weight: .regular))
                    .foregroundStyle(Theme.Colors.info)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    Text("rechnungen.epc.title")
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text("rechnungen.epc.body")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: - Verlauf

    private var historyCard: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                RSMSectionHeader(eyebrow: "rechnungen.hist.eyebrow", title: "rechnungen.hist.title")
                ForEach(historyItems) { item in
                    HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                        Circle()
                            .fill(Theme.Colors.brand)
                            .frame(width: 8, height: 8)
                            .padding(.top, 6)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            historyLabel(item.kind)
                                .font(Theme.Fonts.bodyStrong)
                                .foregroundStyle(Theme.Colors.inkPrimary)
                            if let note = item.note, !note.isEmpty {
                                Text(verbatim: note)
                                    .font(Theme.Fonts.caption)
                                    .foregroundStyle(Theme.Colors.inkSoft)
                            }
                            if let date = FinanceFormat.date(item.dateIso) {
                                Text(verbatim: date)
                                    .font(Theme.Fonts.caption)
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.Colors.inkFaint)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
    }

    // MARK: - Terminal-Hinweis + Aktionen

    @ViewBuilder private var terminalHint: some View {
        if invoice.status == .paid {
            Text("rechnungen.terminal.paid")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        } else if invoice.status == .cancelled {
            Text("rechnungen.terminal.cancelled")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkSoft)
        }
    }

    @ViewBuilder private var actionButtons: some View {
        if canMarkPaid || canCancel {
            VStack(spacing: Theme.Spacing.s3) {
                if canMarkPaid {
                    RSMPrimaryButton(title: "rechnungen.action.markPaid") {
                        withAnimation(.easeOut(duration: Theme.Motion.fast)) { mode = .settle }
                    }
                }
                if canCancel {
                    Button {
                        showCancelConfirm = true
                    } label: {
                        Text("rechnungen.action.cancel")
                            .font(Theme.Fonts.bodyStrong)
                            .frame(maxWidth: .infinity, minHeight: Theme.Size.touchTarget)
                            .foregroundStyle(Theme.Colors.danger)
                            .background(Theme.Colors.dangerSoft)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(RSMPressableButtonStyle())
                    .accessibilityLabel(Text("rechnungen.action.cancel"))
                }
            }
        }
    }

    // MARK: - Bezahlt-buchen-Abschnitt

    private var settleSection: some View {
        VStack(spacing: Theme.Spacing.cardGap) {
            RSMCard {
                InvoiceSettlePanel(
                    via: $via,
                    postToLedger: $postToLedger,
                    categoryId: $categoryId,
                    categories: categories
                )
            }
            HStack(spacing: Theme.Spacing.s3) {
                RSMSecondaryButton(title: "rechnungen.settle.back") {
                    withAnimation(.easeOut(duration: Theme.Motion.fast)) { mode = .view }
                }
                RSMPrimaryButton(title: "rechnungen.settle.confirm", isLoading: busy) {
                    _Concurrency.Task { await doSettle() }
                }
            }
        }
    }

    // MARK: - Aktionen (Server bleibt die Grenze)

    private func doSettle() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        let update = InvoiceUpdate(
            status: .paid,
            paidVia: via.storedText,
            postToLedger: postToLedger,
            ledgerCategoryId: (postToLedger && !categoryId.isEmpty) ? categoryId : nil
        )
        do {
            let updated = try await api.setInvoiceStatus(id: invoice.id, update)
            onChanged(updated)
            withAnimation(.easeOut(duration: Theme.Motion.fast)) { mode = .view }
        } catch {
            actionError = message(for: error, conflictKey: "rechnungen.settle.notOpen")
        }
    }

    private func doCancel() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let updated = try await api.setInvoiceStatus(id: invoice.id, status: .cancelled)
            onChanged(updated)
        } catch {
            actionError = message(for: error, conflictKey: "rechnungen.cancel.notAllowed")
        }
    }

    private func message(for error: Error, conflictKey: String.LocalizationValue) -> String {
        if case APIError.problem(let problem) = error {
            if problem.status == 409 { return String(localized: conflictKey) }
            if problem.status == 403 { return String(localized: "rechnungen.forbidden.message") }
        }
        return (error as? APIError)?.errorDescription ?? error.localizedDescription
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { actionError != nil }, set: { if !$0 { actionError = nil } })
    }
}
