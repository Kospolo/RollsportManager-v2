import SwiftUI

/// Registry-Einhängepunkt des Schließfächer-Moduls
/// (Web-Referenz: /(portal)/schliessfaecher). Stabiler Aufrufpunkt für den
/// „Mehr“-Hub (`MehrCatalog` → `LockersRootView()`) und den DEBUG-Deeplink
/// (`MehrDeepLink.lockers`) — der Typname bleibt stabil.
///
/// Die eigentliche Umsetzung liegt in der öffentlichen Root-View `LockersView`
/// (Muster: EquipmentRootView → EquipmentView). Leseliste via
/// `api.listLockers(clubId:)`; Zuweisen/Freigeben (LockerAssign/LockerUpdate)
/// folgen in einem späteren Batch.
struct LockersRootView: View {
    var body: some View {
        LockersView()
    }
}
