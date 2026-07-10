import SwiftUI

/// Ziel-View des Trainingsplan-Features im „Mehr“-Hub (`MehrCatalog` →
/// `TrainingPlanRootView()`). Dünne Hülle um die öffentliche Feature-View
/// `TrainingPlanView`, damit die Integrationsverdrahtung der Mehr-Registry
/// stabil bleibt und das Feature separat exponiert ist.
///
/// Läuft im NavigationStack des Mehr-Tabs; `SessionStore` kommt aus dem
/// Environment. Web-Referenz-UX: apps/web/app/(portal)/trainingsplan.
struct TrainingPlanRootView: View {
    var body: some View {
        TrainingPlanView()
    }
}

/// Gemeinsamer „In Arbeit“-Platzhalter für die noch nicht gebauten
/// Feature-Roots. Feature-Teams ersetzen die jeweilige Root-View; dieser
/// Baustein verschwindet, sobald alle vier Module echt sind.
struct ModulePlaceholderView: View {
    let systemImage: String
    let title: LocalizedStringKey
    let message: LocalizedStringKey

    var body: some View {
        ScrollView {
            RSMCard {
                RSMEmptyState(
                    systemImage: systemImage,
                    title: "placeholder.title",
                    message: message
                )
            }
            .padding(Theme.Spacing.s5)
        }
        .background(Theme.Colors.bgCanvas.ignoresSafeArea())
    }
}
