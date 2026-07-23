import SwiftUI

/// „Nicht gebucht" — der ehrliche Zustand eines ZUBUCHBAREN Moduls
/// (Galerie, Dokumente, Notizen). Gegenstueck zur Web-`ModuleNotBookedCard`.
///
/// ### WARUM ES DIESE KARTE GIBT ###
/// Die Durchsetzung sitzt serverseitig (`assertModuleEnabled` → HTTP 403 mit
/// `club_module_disabled` im RFC-7807-`detail`). Was der Server dabei nicht
/// leisten kann, ist eine gute Auskunft: iOS hat diesen Fall bisher gar nicht
/// erkannt und die generische Ladefehler-Karte gezeigt („Galerie konnte nicht
/// geladen werden"). Das liest sich wie ein Defekt — der Verein sucht dann den
/// Fehler bei sich oder meldet einen Bug, obwohl schlicht ein Schalter aus ist.
///
/// ### DIESE KARTE SCHUETZT NICHTS ###
/// Sie erklaert nur. Wer sie umgeht (direkter API-Aufruf), bekommt vom Server
/// weiterhin 403 bzw. keine Zeilen.
///
/// ### ABGRENZUNG ZU `RSMProGateCard` ###
///   402 `club_pro_required`    = nicht LIZENZIERT → der Betreiber schaltet frei.
///   403 `club_module_disabled` = nicht GEBUCHT    → ein Vereins-Admin legt den
///                                Schalter unter Verwaltung › Module um.
/// Zwei Ursachen, zwei Auswege — deshalb zwei Karten. Die Screens pruefen in
/// derselben Reihenfolge wie die API: erst Lizenz, dann Buchung.
struct RSMModuleNotBookedCard: View {
    /// Klartextname des Moduls, z. B. „Galerie" — steht hinter „Nicht gebucht:".
    let moduleName: LocalizedStringKey

    var body: some View {
        RSMCard {
            VStack(alignment: .leading, spacing: Theme.Spacing.s4) {
                HStack(spacing: Theme.Spacing.s3) {
                    Image(systemName: "lock")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .frame(width: 44, height: 44)
                        .background(Theme.Colors.bgSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.m, style: .continuous))
                        .accessibilityHidden(true)
                    Text("module.notBooked.eyebrow")
                        .font(Theme.Fonts.eyebrow)
                        .tracking(Theme.Fonts.eyebrowTracking)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .padding(.horizontal, Theme.Spacing.s2)
                        .padding(.vertical, 3)
                        .background(Theme.Colors.bgSunken)
                        .clipShape(Capsule())
                    Spacer(minLength: 0)
                }

                VStack(alignment: .leading, spacing: Theme.Spacing.s2) {
                    // „Nicht gebucht: Galerie" statt „Galerie ist nicht
                    // gebucht": mit Doppelpunkt bleibt der Satz richtig, egal
                    // ob das Modul im Deutschen Singular oder Plural ist
                    // („Dokumente ist nicht gebucht" waere falsch).
                    Text("module.notBooked.title \(Text(moduleName))")
                        .font(Theme.Fonts.h3)
                        .foregroundStyle(Theme.Colors.inkPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("module.notBooked.body")
                        .font(Theme.Fonts.body)
                        .foregroundStyle(Theme.Colors.inkSoft)
                        .fixedSize(horizontal: false, vertical: true)
                }

                // Der Ausweg. Ohne ihn waere die Karte nur eine Absage.
                Label("module.notBooked.hint", systemImage: "info.circle")
                    .font(Theme.Fonts.caption)
                    .foregroundStyle(Theme.Colors.inkSoft)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
