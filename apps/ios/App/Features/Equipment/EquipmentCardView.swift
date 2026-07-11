import SwiftUI

/// Inventar-Karte: Kategorie-Chip + Zustands-Badge, Name, optionale Notiz und
/// die Verfügbarkeit (verfügbar/gesamt). „Reservieren“ ist Selbst-Service für
/// jedes Mitglied und nur bei Bestand 0 gesperrt. Web-Referenz:
/// ausruestung/_components/EquipmentCard.tsx.
struct EquipmentCardView: View {
    let equipment: Equipment
    let onReserve: () -> Void

    private var cap: Int? { EquipmentDisplay.availableCap(equipment) }
    private var soldOut: Bool { cap == 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s3) {
            header
            Text(equipment.name)
                .font(Theme.Fonts.h3)
                .foregroundStyle(Theme.Colors.inkPrimary)

            if let notes = equipment.notes, !notes.isEmpty {
                Text(verbatim: notes)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .lineLimit(2)
            }

            Divider().overlay(Theme.Colors.line)

            availability

            RSMSecondaryButton(title: "ausruestung.reserve.cta", action: onReserve)
                .opacity(soldOut ? 0.5 : 1)
                .disabled(soldOut)
                .accessibilityHint(Text("ausruestung.reserve.cta"))
        }
    }

    // MARK: - Kopf (Kategorie + Zustand)

    private var header: some View {
        HStack(alignment: .center, spacing: Theme.Spacing.s2) {
            if let category = equipment.category, !category.isEmpty {
                RSMStatusPill(text: LocalizedStringKey(stringLiteral: category), kind: .brand)
            }
            Spacer(minLength: 0)
            RSMStatusPill(
                text: EquipmentDisplay.conditionLabel(equipment.condition),
                kind: EquipmentDisplay.conditionKind(equipment.condition)
            )
        }
    }

    // MARK: - Verfügbarkeit

    @ViewBuilder
    private var availability: some View {
        if equipment.availableQuantity == nil && equipment.totalQuantity == nil {
            Text("ausruestung.avail.unknown")
                .font(Theme.Fonts.caption)
                .foregroundStyle(Theme.Colors.inkFaint)
        } else {
            let available = equipment.availableQuantity ?? equipment.totalQuantity ?? 0
            let total = equipment.totalQuantity ?? equipment.availableQuantity ?? 0
            HStack(spacing: Theme.Spacing.s2) {
                Text(verbatim: "\(available)/\(total)")
                    .font(Theme.Fonts.monoTable)
                    .monospacedDigit()
                    .foregroundStyle(Theme.Colors.inkPrimary)
                if soldOut {
                    Text("ausruestung.avail.outOfStock")
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .foregroundStyle(Theme.Colors.danger)
                } else {
                    Text("ausruestung.avail.value \(available) \(total)")
                        .font(Theme.Fonts.caption.weight(.semibold))
                        .foregroundStyle(Theme.Colors.inkSoft)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
