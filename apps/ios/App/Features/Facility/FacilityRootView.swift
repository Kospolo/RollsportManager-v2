import SwiftUI

/// Registry-Einstieg des Belegungsplan-Moduls. Im „Mehr“-Hub ist dieses Feature
/// über `MehrCatalog`/Deeplink `belegung` als `FacilityRootView()` verdrahtet
/// (Shared-Code, für andere Teams read-only) — deshalb bleibt der Typ
/// `FacilityRootView` als stabiler Aufrufpunkt bestehen und delegiert an die
/// öffentliche Root-View `FacilitiesView`, in der die native Umsetzung liegt
/// (Hallen/Räume via `listFacilities`, Buchungen via `listFacilityBookings` /
/// `createBooking`). Web-Referenz: /(portal)/belegungsplan.
struct FacilityRootView: View {
    var body: some View {
        FacilitiesView()
    }
}
