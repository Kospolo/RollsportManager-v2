import SwiftUI

/// Freundliche Upgrade-Karte für die PRO-Module (Galerie & Dokumente), wenn der
/// Verein keine aktive PRO/Premium-Lizenz hat (Entitlement `pro == false` oder
/// ein 402 `club_pro_required` aus der Liste). Ersetzt die Inhalte — kein
/// technischer Fehler, sondern ein klarer Weg: „Diese Funktion gehört zu PRO".
///
/// Bewusst OHNE Kaufaktion in der App: der Erwerb läuft über die Vereins-
/// Verwaltung (Web/Rechnung), nicht über In-App-Purchase. Die Karte informiert
/// und verweist darauf — sie schaltet nichts frei.
struct RSMProGateCard: View {
    /// Titelzeile, z. B. „Galerie ist ein PRO-Modul".
    let title: LocalizedStringKey
    /// Ein bis zwei Sätze, was das Modul bietet.
    let message: LocalizedStringKey
    var systemImage: String = "sparkles"

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                HStack(spacing: Theme.Spacing.s3) {
                    Image(systemName: systemImage)
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(Theme.Colors.honeyDeep)
                        .frame(width: 44, height: 44)
                        .background(Theme.Colors.honeySoft)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                        .accessibilityHidden(true)
                    Text("pro.badge")
                        .font(Theme.Fonts.eyebrow)
                        .tracking(Theme.Fonts.eyebrowTracking)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Colors.honeyDeep)
                        .padding(.horizontal, Theme.Spacing.s2)
                        .padding(.vertical, 3)
                        .background(Theme.Colors.honeySoft)
                        .clipShape(Capsule())
                    Spacer(minLength: 0)
                }

                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    Text(title)
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                    Text(message)
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Label("pro.gate.hint", systemImage: "info.circle")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
