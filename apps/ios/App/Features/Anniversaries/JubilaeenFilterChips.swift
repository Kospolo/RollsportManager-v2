import SwiftUI

/// Filter der Jubiläen-Liste: Alle · Vereinsjubiläen · Geburtstage. Rein
/// darstellend — die Auswahl scoped die schon geladene Liste im View.
enum JubilaeenFilter: CaseIterable, Hashable {
    case all, membership, birthday

    var label: LocalizedStringKey {
        switch self {
        case .all: "jubilaeen.filter.all"
        case .membership: "jubilaeen.filter.membership"
        case .birthday: "jubilaeen.filter.birthday"
        }
    }

    func matches(_ kind: AnniversaryKind) -> Bool {
        switch self {
        case .all: true
        case .membership: kind == .membership
        case .birthday: kind == .birthday
        }
    }
}

/// Pillen-Zeile mit Label + Anzahl je Art. Ausgewählt = Beere-Fläche (genau
/// eine Auswahl), sonst Mulde. Horizontal scrollbar für schmale Geräte.
struct JubilaeenFilterChips: View {
    let counts: [JubilaeenFilter: Int]
    @Binding var selection: JubilaeenFilter

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.s2) {
                ForEach(JubilaeenFilter.allCases, id: \.self) { filter in
                    chip(filter)
                }
            }
            .padding(.horizontal, 2)
            .padding(.vertical, 2)
        }
    }

    private func chip(_ filter: JubilaeenFilter) -> some View {
        let isSelected = selection == filter
        return Button {
            selection = filter
        } label: {
            HStack(spacing: Theme.Spacing.s2) {
                Text(filter.label)
                    .font(Theme.Fonts.bodyStrong)
                Text(verbatim: "\(counts[filter] ?? 0)")
                    .font(Theme.Fonts.caption.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(
                        isSelected ? Theme.Colors.brandContrast.opacity(0.85) : Theme.Colors.inkFaint
                    )
            }
            .padding(.horizontal, Theme.Spacing.s4)
            .frame(minHeight: Theme.Size.touchTarget)
            .foregroundStyle(isSelected ? Theme.Colors.brandContrast : Theme.Colors.inkSoft)
            .background(isSelected ? Theme.Colors.brand : Theme.Colors.bgSunken)
            .clipShape(Capsule())
        }
        .buttonStyle(RSMPressableButtonStyle())
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
