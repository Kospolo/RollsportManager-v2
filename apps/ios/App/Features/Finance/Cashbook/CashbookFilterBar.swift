import SwiftUI

/// Filter über der Buchungsliste (Web-Referenz: Kategorie-Dropdown +
/// Zeitraum-Chips). Kategorie als natives Menü-Picker, Zeitraum als Pill-Chips
/// (Design-System §3.3). Beträge/Zeilen filtern nur die Anzeige — der laufende
/// Saldo bleibt der echte Kontostand (siehe `CashbookDerive`).
struct CashbookFilterBar: View {
    @ObservedObject var viewModel: CashbookViewModel

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                categoryPicker
                periodChips
            }
        }
    }

    // MARK: - Kategorie (Menü-Picker)

    private var categoryPicker: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("kassenbuch.filter.category")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            Picker(selection: $viewModel.categoryFilter) {
                Text("kassenbuch.filter.allCategories")
                    .tag(CashbookCategoryFilter.all)
                ForEach(viewModel.categories, id: \.id) { category in
                    (Text(verbatim: category.name + "  ·  ")
                        + Text(category.kind == .income ? "kassenbuch.income" : "kassenbuch.expense"))
                        .tag(CashbookCategoryFilter.category(category.id))
                }
                Text("kassenbuch.filter.noCategory")
                    .tag(CashbookCategoryFilter.none)
            } label: {
                Text("kassenbuch.filter.category")
            }
            .pickerStyle(.menu)
            .tint(Theme.Colors.brand)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Theme.Spacing.s3)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(Theme.Colors.bgSunken)
            .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
        }
    }

    // MARK: - Zeitraum (Chips)

    private var periodChips: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
            Text("kassenbuch.filter.period")
                .font(Theme.Fonts.bodyStrong)
                .foregroundStyle(Theme.Colors.inkPrimary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.Spacing.s2) {
                    ForEach(CashbookPeriod.allCases) { item in
                        CashbookChip(
                            label: item.labelKey,
                            isActive: viewModel.period == item
                        ) {
                            withAnimation(.easeOut(duration: Theme.Motion.fast)) {
                                viewModel.period = item
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Pill-Chip: aktiv = brand-soft/brand-ink (§3.3). Touch-Ziel bleibt 44 pt.
struct CashbookChip: View {
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
