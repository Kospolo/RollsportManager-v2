import SwiftUI

/// Registry-Einhängepunkt des Ausrüstung-Moduls (Web-Referenz:
/// /(portal)/ausruestung). `MehrCatalog` und die DEBUG-Deeplinks verweisen auf
/// `EquipmentRootView()` — der Typname bleibt stabil. Die eigentliche Umsetzung
/// liegt in der öffentlichen Root-View `EquipmentView` (Muster: NewsRootView →
/// NewsView).
struct EquipmentRootView: View {
    var body: some View {
        EquipmentView()
    }
}
