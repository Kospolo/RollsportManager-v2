import SwiftUI

/// Rechnungs-Detail-Sheet: Kopf mit Titel/Nummer/Betrag (Mono), Status- bzw.
/// Mahnstufen-Pill, Detailzeilen (Mitglied, Daten) und der
/// EPC-QR-Platzhalter („Giro-Code“ — kommt später, Hinweis statt Loch).
struct FinanceInvoiceDetailSheet: View {
    let invoice: Invoice
    let memberName: String?

    @Environment(\.dismiss) private var dismiss

    private var displayName: String {
        memberName ?? String(localized: "finance.member.unknown")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.cardGap) {
                    headerCard
                    detailsCard
                    qrCard
                }
                .padding(Theme.Spacing.s5)
            }
            .background(Theme.Colors.bgCanvas.ignoresSafeArea())
            .navigationTitle(Text("finance.detail.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Text("finance.preview.close")
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.brandInk)
                    }
                    .accessibilityLabel(Text("finance.preview.close"))
                }
            }
        }
        .presentationDetents([.medium, .large])
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
                HStack(alignment: .firstTextBaseline) {
                    Text(verbatim: FinanceFormat.amount(
                        cents: invoice.amountCents,
                        currency: invoice.currency
                    ))
                    .font(Theme.Fonts.monoHero.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    Spacer(minLength: Theme.Spacing.s2)
                    statusPill
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    /// Offene Rechnungen zeigen die Mahnstufen-Ampel (deckt „Offen“ ab),
    /// alle anderen den Rechnungsstatus.
    @ViewBuilder
    private var statusPill: some View {
        switch invoice.status {
        case .open:
            RSMStatusPill.dunning(level: invoice.dunningLevel)
        case .draft:
            RSMStatusPill(text: "finance.status.draft", kind: .neutral)
        case .partiallyPaid:
            // Teilbezahlt (0072) ist bewusst kein „bezahlt": es ist noch etwas
            // offen — gleiche Lesart wie im Web.
            RSMStatusPill(text: "finance.status.partiallyPaid", kind: .warn)
        case .paid:
            RSMStatusPill(text: "finance.status.paid", kind: .success)
        case .cancelled:
            RSMStatusPill(text: "finance.status.cancelled", kind: .neutral)
        }
    }

    // MARK: - Details

    private var detailsCard: some View {
        RSMCard(padding: Theme.Spacing.s4) {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                HStack(spacing: Theme.Spacing.s3) {
                    RSMAvatarView(name: displayName, personId: invoice.memberId, size: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("finance.detail.member")
                            .font(Theme.Fonts.eyebrow)
                            .tracking(Theme.Fonts.eyebrowTracking)
                            .textCase(.uppercase)
                            .foregroundStyle(Theme.Colors.inkFaint)
                        Text(verbatim: displayName)
                            .font(Theme.Fonts.bodyStrong)
                            .foregroundStyle(Theme.Colors.inkPrimary)
                    }
                }
                .accessibilityElement(children: .combine)
                Divider().overlay(Theme.Colors.line)
                if let issued = FinanceFormat.date(invoice.issuedOn) {
                    detailRow(label: "finance.detail.issued", value: issued)
                }
                if let due = FinanceFormat.date(invoice.dueOn) {
                    detailRow(label: "finance.detail.due", value: due)
                }
                if let paid = FinanceFormat.date(invoice.paidAt) {
                    detailRow(label: "finance.detail.paid", value: paid)
                }
            }
        }
    }

    private func detailRow(label: LocalizedStringKey, value: String) -> some View {
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

    // MARK: - EPC-QR-Platzhalter

    private var qrCard: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
                RSMSectionHeader(
                    eyebrow: "finance.detail.qr.eyebrow",
                    title: "finance.detail.qr.title"
                )
                HStack(alignment: .top, spacing: Theme.Spacing.s4) {
                    ZStack {
                        RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                            .fill(Theme.Colors.bgSunken)
                        RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous)
                            .strokeBorder(
                                Theme.Colors.lineStrong,
                                style: StrokeStyle(lineWidth: 1, dash: [5, 4])
                            )
                        Image(systemName: "qrcode")
                            .font(.system(size: 40, weight: .regular))
                            .foregroundStyle(Theme.Colors.inkFaint)
                    }
                    .frame(width: 92, height: 92)
                    .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                        RSMStatusPill(text: "finance.detail.qr.badge", kind: .info)
                        Text("finance.detail.qr.message")
                            .font(Theme.Fonts.caption)
                            .foregroundStyle(Theme.Colors.inkSoft)
                    }
                }
            }
            .accessibilityElement(children: .combine)
        }
    }
}
