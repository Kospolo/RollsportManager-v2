import SwiftUI

/// Rechnungsliste als Karte: Suchfeld → Filter-Chips (mit Zählern) → Zeilen im
/// Tabellen-Stil der Seriositätszone (Avatar-first, Beträge Mono rechtsbündig,
/// nie eingefärbte Zeilen — Eskalationsfarbe nur am Mahn-Badge) → Summenzeile.
/// Die Summe entsteht aus DENSELBEN Zeilen wie die Anzeige.
struct InvoicesListCard: View {
    @ObservedObject var viewModel: InvoicesViewModel

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(
                    eyebrow: "rechnungen.list.eyebrow",
                    title: "rechnungen.list.title"
                )
                searchField
                filterChips
                if viewModel.rows.isEmpty {
                    emptyState
                } else {
                    rows
                    footer
                }
            }
        }
    }

    // MARK: - Suche

    private var searchField: some View {
        HStack(spacing: Theme.Spacing.s2) {
            Image(systemName: "magnifyingglass")
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkFaint)
                .accessibilityHidden(true)
            TextField("rechnungen.search.placeholder", text: $viewModel.query)
                .font(Theme.Fonts.body)
                .foregroundStyle(Theme.Colors.inkPrimary)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityLabel(Text("rechnungen.search.label"))
            if !viewModel.query.isEmpty {
                Button {
                    viewModel.query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Theme.Colors.inkFaint)
                }
                .accessibilityLabel(Text("rechnungen.search.clear"))
            }
        }
        .padding(Theme.Spacing.s3)
        .frame(minHeight: Theme.Size.touchTarget)
        .background(Theme.Colors.bgSunken)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
    }

    // MARK: - Filter-Chips

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                ForEach(InvoiceStatusFilter.allCases) { item in
                    InvoiceFilterChip(
                        label: item.labelKey,
                        count: viewModel.count(for: item),
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

    // MARK: - Leerzustand

    private var emptyState: some View {
        RSMEmptyState(
            systemImage: "doc.text.magnifyingglass",
            title: "rechnungen.empty.title",
            message: "rechnungen.empty.message",
            actionTitle: "rechnungen.empty.reset",
            action: {
                withAnimation(.easeOut(duration: Theme.Motion.fast)) {
                    viewModel.filter = .all
                    viewModel.query = ""
                }
            }
        )
    }

    // MARK: - Zeilen

    private var rows: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.rows, id: \.id) { invoice in
                if invoice.id != viewModel.rows.first?.id {
                    Divider().overlay(Theme.Colors.line)
                }
                InvoiceRow(
                    invoice: invoice,
                    memberName: viewModel.memberName(for: invoice.memberId)
                ) {
                    viewModel.selectedInvoice = invoice
                }
            }
        }
    }

    // MARK: - Summenzeile

    private var footer: some View {
        VStack(spacing: Theme.Spacing.s2) {
            Divider().overlay(Theme.Colors.lineStrong)
            HStack(alignment: .firstTextBaseline) {
                Text("rechnungen.footer.shown \(viewModel.shownCount) \(viewModel.totalCount)")
                    .font(Theme.Fonts.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkSoft)
                Spacer(minLength: Theme.Spacing.s2)
                VStack(alignment: .trailing, spacing: 2) {
                    Text("rechnungen.footer.sumLabel")
                        .font(Theme.Fonts.caption)
                        .foregroundStyle(Theme.Colors.inkFaint)
                    Text(verbatim: FinanceFormat.amount(
                        cents: viewModel.shownSumCents,
                        currency: viewModel.currencyCode
                    ))
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }
}

/// Filter-Pille mit Zähler — aktiv = brand-soft/brand-ink (§3.3), 44 pt Ziel.
private struct InvoiceFilterChip: View {
    let label: LocalizedStringKey
    let count: Int
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s2) {
                Text(label)
                    .font(Theme.Fonts.bodyStrong)
                Text(verbatim: "\(count)")
                    .font(Theme.Fonts.caption.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(isActive ? Theme.Colors.brandInk : Theme.Colors.inkFaint)
            }
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
        .accessibilityValue(Text("rechnungen.a11y.filterCount \(count)"))
        .accessibilityAddTraits(isActive ? [.isSelected] : [])
    }
}

/// Listenzeile: [Avatar] [Name · Nr. mono · Fällig] … [Betrag mono ·
/// Status-Pill · Mahn-Pill]. Deckt die sechs Spalten Nr/Mitglied/Betrag/
/// fällig/Status/Mahnstufe mobil in zwei Ebenen ab.
private struct InvoiceRow: View {
    let invoice: Invoice
    let memberName: String?
    let action: () -> Void

    private var displayName: String {
        memberName ?? String(localized: "rechnungen.member.unknown")
    }

    private var amountText: String {
        FinanceFormat.amount(cents: invoice.amountCents, currency: invoice.currency)
    }

    /// Mahn-Badge nur bei offenen Rechnungen mit Stufe > 0 (sonst kein Rauschen).
    private var showsDunning: Bool {
        invoice.status == .open && invoice.dunningLevel > 0
    }

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: Theme.Spacing.s3) {
                RSMAvatarView(name: displayName, personId: invoice.memberId, size: 36)
                VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                    Text(verbatim: displayName)
                        .font(Theme.Fonts.bodyStrong)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .lineLimit(1)
                    HStack(spacing: Theme.Spacing.s2) {
                        Text(verbatim: invoice.number)
                            .font(Theme.Fonts.monoTable)
                            .monospacedDigit()
                            .foregroundStyle(Theme.Colors.inkFaint)
                        if let due = FinanceFormat.date(invoice.dueOn) {
                            Text("rechnungen.row.due \(due)")
                                .font(Theme.Fonts.caption)
                                .monospacedDigit()
                                .foregroundStyle(Theme.Colors.inkSoft)
                                .lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: Theme.Spacing.s2)
                VStack(alignment: .trailing, spacing: Theme.Spacing.s1) {
                    Text(verbatim: amountText)
                        .font(Theme.Fonts.monoTable)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    HStack(spacing: Theme.Spacing.s2) {
                        if showsDunning {
                            RSMStatusPill.dunning(level: invoice.dunningLevel)
                        }
                        RSMStatusPill(
                            text: InvoiceStatusDisplay.labelKey(invoice.status),
                            kind: InvoiceStatusDisplay.pillKind(invoice.status)
                        )
                    }
                }
            }
            .padding(.vertical, Theme.Spacing.s3)
            .frame(minHeight: Theme.Size.listRow)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            Text("rechnungen.a11y.row \(invoice.number) \(displayName) \(amountText)")
        )
        .accessibilityHint(Text("rechnungen.a11y.row.hint"))
        .accessibilityAddTraits(.isButton)
    }
}
