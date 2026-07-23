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
                // EINE ZEILE, IMMER. Ein Betrag darf nicht mitten in der Zahl
                // umbrechen — im Budget stand bei STANDARD-Schrift woertlich
                // „12.800,0" / „0 €" untereinander, und „–22.434," / „50 €".
                // Das ist nicht nur haesslich, es ist falsch lesbar: die
                // erste Zeile sieht fuer sich genommen wie ein gueltiger,
                // kleinerer Betrag aus. Lieber skalieren als zerreissen.
                .lineLimit(1)
                .minimumScaleFactor(0.6)

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

extension RSMKpiTile {
    /// Spalten fuer ein KPI-Raster. Ab Accessibility-Schriftgroesse EINE Spalte.
    ///
    /// Zwei halbe Kacheln sind bei AX-Groessen rund 142 pt breit — darin passt
    /// weder „ANWESENHEITSQUOTE" noch ein vierstelliger Betrag. Die Kachel
    /// muesste dann entweder kuerzen (Information weg) oder die Zahl klein
    /// rechnen (`minimumScaleFactor` — genau das, was Dynamic Type verhindern
    /// soll). Volle Breite loest beides auf einmal: die Zahl bleibt gross UND
    /// ganz. Der Preis ist Scrollen, und das ist bei AX-Schrift ohnehin der
    /// Normalfall.
    static func columns(for size: DynamicTypeSize, spacing: CGFloat = Theme.Spacing.s3) -> [GridItem] {
        let count = size.isAccessibilitySize ? 1 : 2
        return Array(repeating: GridItem(.flexible(), spacing: spacing), count: count)
    }
}
