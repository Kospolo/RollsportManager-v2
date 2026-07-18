import SwiftUI

/// KPI-Kachel: Eyebrow → große Display-Zahl (SF Rounded) → Klartext-Caption.
/// Display-Rounded ist den KPI-Zahlen vorbehalten — nie Fließtext.
/// Zahlen laufen tabular (`monospacedDigit`), Pflicht für Beträge/Quoten.
struct RSMKpiTile: View {
    let eyebrow: LocalizedStringKey
    /// Bereits formatierter Wert („24“, „381,00 €“) — Formatierung macht der Screen.
    let value: String
    var caption: LocalizedStringKey?
    /// Akzent für den Wert, z. B. `Theme.Colors.danger` bei Überfälligem.
    var valueColor: Color = Theme.Colors.inkPrimary

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.s1) {
            Text(eyebrow)
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
                // Lieber umbrechen als kürzen — der Eyebrow benennt die Zahl.
                .fixedSize(horizontal: false, vertical: true)
            Text(value)
                .font(Theme.Fonts.display)
                .tracking(Theme.Fonts.displayTracking)
                .monospacedDigit()
                .foregroundStyle(valueColor)
            if let caption {
                Text(caption)
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        // maxHeight: .infinity — in einer HStack ziehen sich beide Kacheln damit
        // auf die Hoehe der hoeheren. Ohne das stehen sie bei grosser Schrift
        // unterschiedlich hoch nebeneinander.
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(Theme.Spacing.s4)
        .background(Theme.Colors.bgCanvas)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}
