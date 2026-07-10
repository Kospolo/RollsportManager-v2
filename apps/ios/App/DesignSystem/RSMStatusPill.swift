import SwiftUI

/// Farbwelt eines Status-Chips: Tint-Hintergrund + dunkler Text.
/// Regel „Status nie nur über Farbe“: der Chip trägt IMMER ein Wort.
enum RSMStatusKind {
    case neutral
    case brand
    case info
    case success
    case warn
    case danger
    /// Honig ist EXKLUSIV für Musik/Küren — nie im Mahnwesen verwenden.
    case honey

    var background: Color {
        switch self {
        case .neutral: Theme.Colors.bgSunken
        case .brand: Theme.Colors.brandSoft
        case .info: Theme.Colors.infoSoft
        case .success: Theme.Colors.successSoft
        case .warn: Theme.Colors.warnSoft
        case .danger: Theme.Colors.dangerSoft
        case .honey: Theme.Colors.honeySoft
        }
    }

    var foreground: Color {
        switch self {
        case .neutral: Theme.Colors.inkSoft
        case .brand: Theme.Colors.brandInk
        case .info: Theme.Colors.info
        case .success: Theme.Colors.success
        case .warn: Theme.Colors.warn
        case .danger: Theme.Colors.danger
        case .honey: Theme.Colors.honeyDeep
        }
    }
}

/// Pill-Chip mit Wort + Tint — Grundbaustein für Status, Rollen, Mahnstufen.
struct RSMStatusPill: View {
    let text: LocalizedStringKey
    var kind: RSMStatusKind = .neutral

    var body: some View {
        Text(text)
            .font(Theme.Fonts.caption.weight(.semibold))
            .foregroundStyle(kind.foreground)
            .padding(.horizontal, Theme.Spacing.s3)
            .padding(.vertical, Theme.Spacing.s1)
            .background(kind.background)
            .clipShape(Capsule())
    }
}

extension RSMStatusPill {
    /// Mahnstufen-Ampel (vierstufige Treppe, Design-System §3.6):
    /// 0 Offen (neutral) → 1 Erinnerung (Info/Petrol, NICHT Honig) →
    /// 2 1. Mahnung (warn) → 3+ 2. Mahnung/Übergabe (danger).
    /// Eskalationsfarbe nur am Badge — nie ganze Zeilen einfärben.
    static func dunning(level: Int) -> RSMStatusPill {
        switch level {
        case ..<1: RSMStatusPill(text: "status.dunning.0", kind: .neutral)
        case 1: RSMStatusPill(text: "status.dunning.1", kind: .info)
        case 2: RSMStatusPill(text: "status.dunning.2", kind: .warn)
        default: RSMStatusPill(text: "status.dunning.3", kind: .danger)
        }
    }
}
