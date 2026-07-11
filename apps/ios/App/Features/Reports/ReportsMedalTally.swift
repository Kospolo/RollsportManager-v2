import SwiftUI

/// Medaillenspiegel des Vereins als drei Stat-Zellen: metallische Scheibe
/// (Gold/Silber/Bronze) mit großer Mono-Zahl und Klartext-Label. Rein lesend.
///
/// Die Metall-Verläufe sind bewusst fixe, gesättigte Farben (kein Theme-Token):
/// sie sollen in Light wie Dark gleich „metallisch“ wirken — genau wie die
/// Web-Referenz. Die Farbe steht nie allein: jede Zelle trägt ihr Wort.
struct ReportsMedalTally: View {
    let medals: ReportMedalCounts

    private struct Metal: Identifiable {
        let id: String
        let count: Int
        let label: LocalizedStringKey
        let from: Color
        let to: Color
        let ring: Color
    }

    private var metals: [Metal] {
        [
            Metal(
                id: "gold", count: medals.gold ?? 0, label: "auswertung.medals.gold",
                from: Color(red: 0.988, green: 0.914, blue: 0.651),
                to: Color(red: 0.725, green: 0.510, blue: 0.106),
                ring: Color(red: 0.561, green: 0.392, blue: 0.082)
            ),
            Metal(
                id: "silver", count: medals.silver ?? 0, label: "auswertung.medals.silver",
                from: Color(red: 0.953, green: 0.961, blue: 0.976),
                to: Color(red: 0.541, green: 0.580, blue: 0.639),
                ring: Color(red: 0.431, green: 0.471, blue: 0.537)
            ),
            Metal(
                id: "bronze", count: medals.bronze ?? 0, label: "auswertung.medals.bronze",
                from: Color(red: 0.949, green: 0.827, blue: 0.706),
                to: Color(red: 0.612, green: 0.369, blue: 0.180),
                ring: Color(red: 0.486, green: 0.286, blue: 0.133)
            ),
        ]
    }

    private var total: Int { (medals.gold ?? 0) + (medals.silver ?? 0) + (medals.bronze ?? 0) }

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                RSMSectionHeader(eyebrow: "auswertung.medals.eyebrow", title: "auswertung.medals.title")
                if total == 0 {
                    Text("auswertung.medals.empty")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                } else {
                    HStack(spacing: Theme.Spacing.s3) {
                        ForEach(metals) { metal in
                            cell(metal)
                        }
                    }
                }
            }
        }
    }

    private func cell(_ metal: Metal) -> some View {
        VStack(spacing: Theme.Spacing.s2) {
            Circle()
                .fill(
                    RadialGradient(
                        gradient: Gradient(colors: [metal.from, metal.to]),
                        center: UnitPoint(x: 0.36, y: 0.30),
                        startRadius: 0,
                        endRadius: 20
                    )
                )
                .frame(width: 36, height: 36)
                .overlay(Circle().strokeBorder(metal.ring, lineWidth: 1.5))
                .accessibilityHidden(true)
            Text(verbatim: "\(metal.count)")
                .font(Theme.Fonts.mono(size: 22, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.inkPrimary)
            Text(metal.label)
                .font(Theme.Fonts.eyebrow)
                .tracking(Theme.Fonts.eyebrowTracking)
                .textCase(.uppercase)
                .foregroundStyle(Theme.Colors.inkFaint)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Spacing.s4)
        .padding(.horizontal, Theme.Spacing.s2)
        .background(Theme.Colors.bgCanvas)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radius.l, style: .continuous)
                .stroke(Theme.Colors.line, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }
}
