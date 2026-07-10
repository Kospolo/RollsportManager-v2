import SwiftUI

/// Offene-Posten-Karte: Filter-Chips (Alle · Offen · Erinnert · Gemahnt),
/// Zeilen im Tabellen-Stil der Seriositätszone (Avatar-first, Beträge Mono
/// rechtsbündig, nie eingefärbte Zeilen) und Summen-Fußzeile.
struct FinanceListCard: View {
    @ObservedObject var viewModel: FinanceViewModel

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "finance.list.eyebrow",
                    title: "finance.list.title"
                )
                filterChips
                if viewModel.filteredInvoices.isEmpty {
                    RSMEmptyState(
                        systemImage: "checkmark.seal",
                        title: "finance.list.empty.title",
                        message: "finance.list.empty.message"
                    )
                } else {
                    rows
                    footer
                }
            }
        }
    }

    // MARK: - Filter-Chips

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                ForEach(FinanceFilter.allCases) { item in
                    FinanceFilterChip(
                        label: item.labelKey,
                        isActive: viewModel.filter == item
                    ) {
                        withAnimation(.easeOut(duration: Theme.Motion.fast)) {
                            viewModel.filter = item
                        }
                    }
                }
            }
        }
    }

    // MARK: - Zeilen

    private var rows: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.filteredInvoices, id: \.id) { invoice in
                if invoice.id != viewModel.filteredInvoices.first?.id {
                    Divider().overlay(Theme.Colors.line)
                }
                FinanceInvoiceRow(
                    invoice: invoice,
                    memberName: viewModel.memberName(for: invoice.memberId)
                ) {
                    viewModel.selectedInvoice = invoice
                }
            }
        }
    }

    // MARK: - Summen-Fußzeile („angezeigte Posten + Summe + Gesamtwert“)

    private var footer: some View {
        VStack(spacing: Theme.Spacing.s2) {
            Divider().overlay(Theme.Colors.lineStrong)
            HStack(alignment: .firstTextBaseline) {
                Text("finance.list.footer.count \(viewModel.filteredInvoices.count)")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                Spacer(minLength: Theme.Spacing.s2)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(verbatim: FinanceFormat.amount(
                        cents: viewModel.filteredTotalCents,
                        currency: viewModel.currencyCode
                    ))
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
                    Text("finance.list.footer.total \(FinanceFormat.amount(cents: viewModel.openTotalCents, currency: viewModel.currencyCode))")
                        .font(Theme.Fonts.caption)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }
}

/// Pill-Chip über der Tabelle — aktiv = brand-soft/brand-ink (§3.3).
/// Die Kapsel bleibt kompakt, das Touch-Ziel hält trotzdem 44 pt.
private struct FinanceFilterChip: View {
    let label: LocalizedStringKey
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(isActive ? Theme.Colors.brandInk : Theme.Colors.inkSoft)
                .padding(.horizontal, Theme.Spacing.s4)
                .padding(.vertical, Theme.Spacing.s2)
                .background(isActive ? Theme.Colors.brandSoft : Theme.Colors.bgSunken)
                .clipShape(Capsule())
                .frame(minHeight: Theme.Size.touchTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityLabel(Text(label))
        .accessibilityAddTraits(isActive ? [.isSelected] : [])
    }
}

/// Listenzeile: [Avatar] [Name fett + Rechnungsnummer Mono] … [Betrag Mono,
/// Mahnstufen-Pill]. Eskalationsfarbe NUR am Badge — nie an der Zeile.
private struct FinanceInvoiceRow: View {
    let invoice: Invoice
    let memberName: String?
    let action: () -> Void

    private var displayName: String {
        memberName ?? String(localized: "finance.member.unknown")
    }

    private var amountText: String {
        FinanceFormat.amount(cents: invoice.amountCents, currency: invoice.currency)
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s3) {
                RSMAvatarView(name: displayName, personId: invoice.memberId, size: 36)
                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    Text(verbatim: displayName)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(1)
                    Text(verbatim: invoice.number)
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
                Spacer(minLength: Theme.Spacing.s2)
                VStack(alignment: .trailing, spacing: Theme.Spacing.s1) {
                    Text(verbatim: amountText)
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    RSMStatusPill.dunning(level: invoice.dunningLevel)
                }
            }
            .padding(.vertical, Theme.Spacing.s3)
            .frame(minHeight: Theme.Size.listRow)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            Text("finance.a11y.invoiceRow \(invoice.number) \(displayName) \(amountText)")
        )
        .accessibilityHint(Text("finance.a11y.invoiceRow.hint"))
        .accessibilityAddTraits(.isButton)
    }
}
