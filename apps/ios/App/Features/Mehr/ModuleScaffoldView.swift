import SwiftUI

/// Gemeinsamer Platzhalter für die noch nicht nativ umgesetzten „Mehr“-Module
/// (Übungen/Familie/Pflichtstunden/Auswertung). Zeigt den Modul-Titel als
/// große Navigation-Überschrift und einen freundlichen Leerzustand mit dem
/// Hinweis, dass die native Umsetzung folgt.
///
/// Die Feature-Teams ersetzen die jeweilige `…RootView` durch ihre echte
/// Umsetzung; dieser Scaffold verschwindet dann pro Modul. Bewusst zustandslos
/// und ohne Netzwerk-Zugriff — reiner Handoff-Platzhalter.
struct ModuleScaffoldView: View {
    let titleKey: LocalizedStringKey
    let systemImage: String

    var body: some View {
        ScrollView {
            RSMEmptyState(
                systemImage: systemImage,
                title: "module.scaffold.title",
                message: "module.scaffold.message"
            )
            .padding(.top, Theme.Spacing.s7)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
        .navigationTitle(Text(titleKey))
        .navigationBarTitleDisplayMode(.large)
    }
}
