import SwiftUI

/// Registry-Einhängepunkt des Pflichtstunden-Moduls. Im „Mehr“-Hub ist das
/// Feature über `MehrCatalog` als `AnyView(DutyHoursRootView())` verdrahtet
/// (Shared-Code, für das Pflichtstunden-Team read-only) — deshalb bleibt der
/// Typ `DutyHoursRootView` als stabiler Aufrufpunkt bestehen und delegiert an
/// die öffentliche Root-View `DutyHoursView`, in der die eigentliche Umsetzung
/// liegt (Soll aus `listDutyRequirements`, Ist aus `listDutyEntries`, Erfassen
/// via `createDutyEntry`). Web-Referenz: /(portal)/pflichtstunden.
struct DutyHoursRootView: View {
    var body: some View {
        DutyHoursView()
    }
}
