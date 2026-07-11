import SwiftUI

/// Registry-Einstieg des Check-in-Moduls. Im „Mehr"-Hub ist dieses Feature über
/// `MehrCatalog` als `AnyView(CheckinRootView())` und über den DEBUG-Deeplink
/// `checkin` verdrahtet (Shared-Code, read-only) — deshalb bleibt der Typ
/// `CheckinRootView` als stabiler Aufrufpunkt bestehen und delegiert an die
/// öffentliche Root-View `CheckinView`, in der die eigentliche Umsetzung liegt
/// (Muster wie NewsRootView -> NewsView). Web-Referenz: /(portal)/checkin.
///
/// Nicht enthalten (bewusst, kein Endpoint / außerhalb des Auftrags): das
/// Löschen eines Check-ins (Web ClubCheckins/DeleteCheckinDialog — es gibt in
/// Endpoints.swift/den Contracts keinen deleteCheckin) sowie die Kamera-
/// Scan-Station (Web ScanCheckinCard). Beides ist ein offener Punkt.
struct CheckinRootView: View {
    var body: some View {
        CheckinView()
    }
}
