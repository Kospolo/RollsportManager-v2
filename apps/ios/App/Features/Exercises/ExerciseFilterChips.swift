import SwiftUI

/// Horizontale Chip-Reihe zum Filtern nach Kategorie — „Alle“ plus die sieben
/// Kategorien in fester Reihenfolge, jeweils mit Zähler. Der aktive Chip trägt
/// die Beere (brand), inaktive das gedämpfte Mulden-Tint. Web-Referenz:
/// components/ui/FilterChips (in uebungen/_components/ExercisesLibrary.tsx).
struct ExerciseFilterChips: View {
    @ObservedObject var model: ExercisesViewModel

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                chip(
                    titleKey: "uebungen.filter.all",
                    count: model.totalCount,
                    isSelected: model.selectedCategory == nil
                ) {
                    model.selectedCategory = nil
                }

                ForEach(ExerciseCatalog.order, id: \.self) { category in
                    chip(
                        titleKey: ExerciseCatalog.labelKey(category),
                        count: model.count(for: category),
                        isSelected: model.selectedCategory == category
                    ) {
                        model.selectedCategory = category
                    }
                }
            }
            .padding(.horizontal, Theme.Spacing.s1)
            .padding(.vertical, Theme.Spacing.s1)
        }
        .accessibilityLabel(Text("uebungen.filter.a11y"))
    }

    private func chip(
        titleKey: LocalizedStringKey,
        count: Int,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.s2) {
                Text(titleKey)
                    .font(Theme.Fonts.caption.weight(.semibold))
                Text(verbatim: "\(count)")
                    .font(Theme.Fonts.caption.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(isSelected ? Theme.Colors.brandContrast : Theme.Colors.inkFaint)
            }
            .foregroundStyle(isSelected ? Theme.Colors.brandContrast : Theme.Colors.inkSoft)
            .padding(.horizontal, Theme.Spacing.s4)
            .frame(minHeight: Theme.Size.touchTarget)
            .background(isSelected ? Theme.Colors.brand : Theme.Colors.bgSunken)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }
}
