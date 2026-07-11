import SwiftUI

/// Buchungsliste im Tabellen-Stil der Seriositätszone: Datum, Buchung (Person =
/// Avatar, Organisation = Icon-Kachel — nie Monogramme), Kategorie-Chip, Betrag
/// (Mono, echtes −, Einnahme grün, „+“ vor Einnahmen), laufender Saldo und die
/// Storno-Aktion. GoBD: kein Löschen — nur nicht-stornierte Originalbuchungen
/// bieten „Stornieren“; Storno-Gegenbuchungen und bereits stornierte Zeilen
/// zeigen stattdessen einen Status-Chip. Die Summenzeile rechnet über die
/// SICHTBAREN (gefilterten) Zeilen.
struct CashbookListCard: View {
    @ObservedObject var viewModel: CashbookViewModel

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                if viewModel.rows.isEmpty {
                    filteredEmpty
                } else {
                    rows
                    footer
                }
            }
        }
    }

    private var rows: some View {
        VStack(spacing: 0) {
            ForEach(viewModel.rows) { row in
                if row.id != viewModel.rows.first?.id {
                    Divider().overlay(Theme.Colors.line)
                }
                CashbookRowView(
                    row: row,
                    currency: viewModel.currencyCode,
                    memberName: viewModel.memberName(for: row.entry.counterpartyMemberId)
                ) {
                    viewModel.reverseTarget = row.entry
                }
            }
        }
    }

    private var filteredEmpty: some View {
        RSMEmptyState(
            systemImage: "line.3.horizontal.decrease.circle",
            title: "kassenbuch.emptyFilter.title",
            message: "kassenbuch.emptyFilter.message",
            actionTitle: "kassenbuch.emptyFilter.cta",
            action: { withAnimation { viewModel.resetFilter() } }
        )
    }

    // MARK: - Summenzeile (Einnahmen/Ausgaben + GoBD-Hinweis)

    private var footer: some View {
        let sums = viewModel.sums
        let income = FinanceFormat.amount(cents: sums.incomeCents, currency: viewModel.currencyCode)
        let expense = FinanceFormat.amount(cents: sums.expenseCents, currency: viewModel.currencyCode)
        return VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Divider().overlay(Theme.Colors.lineStrong)
            HStack(alignment: .firstTextBaseline) {
                Text("kassenbuch.foot.count \(sums.count)")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                Spacer(minLength: Theme.Spacing.s2)
                VStack(alignment: .trailing, spacing: 2) {
                    Text("kassenbuch.foot.income \(income)")
                        .foregroundStyle(Theme.Colors.success)
                    Text("kassenbuch.foot.expense \(expense)")
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
                .font(Theme.Fonts.caption)
                .monospacedDigit()
            }
            .accessibilityElement(children: .combine)
            Text("kassenbuch.foot.hint")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
        }
    }
}

/// Eine Buchungszeile. Eskalations-/Statusfarbe nur am Chip — nie an der Zeile.
private struct CashbookRowView: View {
    let row: CashbookRow
    let currency: String
    let memberName: String?
    let onReverse: () -> Void

    private var entry: LedgerEntry { row.entry }

    private var displayName: String {
        memberName ?? entry.counterpartyName ?? String(localized: "kassenbuch.member.unknown")
    }

    private var dateText: String {
        FinanceFormat.date(entry.entryOn) ?? entry.entryOn
    }

    private var amountText: String {
        let cents = CashbookDerive.amountCents(entry)
        let base = FinanceFormat.amount(cents: cents, currency: currency)
        return cents > 0 ? "+" + base : base
    }

    private var amountColor: Color {
        if row.reversed { return Theme.Colors.inkFaint }
        return CashbookDerive.amountCents(entry) > 0 ? Theme.Colors.success : Theme.Colors.inkPrimary
    }

    private var balanceText: String {
        FinanceFormat.amount(cents: row.balanceCents, currency: currency)
    }

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.s3) {
            leadingBadge
            VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
                Text(verbatim: entry.description)
                    .font(Theme.Fonts.bodyStrong)
                    .foregroundStyle(row.reversed ? Theme.Colors.inkFaint : Theme.Colors.inkPrimary)
                    .strikethrough(row.reversed)
                    .lineLimit(2)
                HStack(spacing: Theme.Spacing.s2) {
                    Text(verbatim: dateText)
                        .font(Theme.Fonts.caption)
                        .monospacedDigit()
                        .foregroundStyle(Theme.Colors.inkFaint)
                    categoryChip
                }
                secondaryLine
            }
            Spacer(minLength: Theme.Spacing.s2)
            VStack(alignment: .trailing, spacing: Theme.Spacing.s1) {
                Text(verbatim: amountText)
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(amountColor)
                    .strikethrough(row.reversed)
                Text("kassenbuch.balanceRow \(balanceText)")
                    .font(Theme.Fonts.caption)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkFaint)
            }
            trailingAction
        }
        .padding(.vertical, Theme.Spacing.s3)
        .frame(minHeight: Theme.Size.listRow)
        .contentShape(Rectangle())
    }

    // MARK: - Bausteine

    @ViewBuilder private var leadingBadge: some View {
        if entry.counterpartyKind == .person, entry.counterpartyMemberId != nil {
            RSMAvatarView(name: displayName, personId: entry.counterpartyMemberId, size: 36)
        } else {
            CashbookOrgTile()
        }
    }

    @ViewBuilder private var categoryChip: some View {
        if let name = entry.categoryName ?? entry.category {
            Text(verbatim: name)
                .font(Theme.Fonts.caption.weight(.semibold))
                .foregroundStyle(entry.categoryKind == .income ? Theme.Colors.success : Theme.Colors.inkSoft)
                .padding(.horizontal, Theme.Spacing.s2)
                .padding(.vertical, 2)
                .background(entry.categoryKind == .income ? Theme.Colors.successSoft : Theme.Colors.bgSunken)
                .clipShape(Capsule())
                .lineLimit(1)
        }
    }

    @ViewBuilder private var secondaryLine: some View {
        if row.isReversal {
            Text("kassenbuch.reversalOf")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
                .lineLimit(1)
        } else if entry.counterpartyKind == .person || entry.counterpartyName != nil {
            Text(verbatim: displayName)
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
                .lineLimit(1)
        }
    }

    @ViewBuilder private var trailingAction: some View {
        if row.isReversal {
            RSMStatusPill(text: "kassenbuch.badge.reversal", kind: .info)
        } else if row.reversed {
            RSMStatusPill(text: "kassenbuch.badge.reversed", kind: .neutral)
        } else {
            Button(action: onReverse) {
                Image(systemName: "arrow.uturn.backward")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .frame(width: Theme.Size.touchTarget, height: Theme.Size.touchTarget)
                    .background(Theme.Colors.bgSunken)
                    .clipShape(Circle())
                    .contentShape(Circle())
            }
            .buttonStyle(RSMPressableButtonStyle())
            .accessibilityLabel(Text("kassenbuch.reverseAction"))
            .accessibilityHint(Text("kassenbuch.a11y.reverseHint"))
        }
    }
}

/// Icon-Kachel für Organisationen/Sammelbuchungen (Design-System: keine
/// Pseudo-Monogramme, `Theme.Radius.org`).
private struct CashbookOrgTile: View {
    var body: some View {
        RoundedRectangle(cornerRadius: Theme.Radius.org, style: .continuous)
            .fill(Theme.Colors.bgSunken)
            .frame(width: 36, height: 36)
            .overlay(
                Image(systemName: "building.2.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Colors.inkSoft)
            )
            .accessibilityHidden(true)
    }
}
