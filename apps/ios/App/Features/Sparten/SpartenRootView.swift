import SwiftUI

/// Registry-Einstieg des Sparten-Moduls (Web-Referenz: /(portal)/sparten).
/// Stabiler Aufrufpunkt für den „Mehr"-Hub (`MehrCatalog`). Native Umsetzung:
/// rendert `SpartenView` (Karten-Liste + Anlegen/Bearbeiten/(De-)Aktivieren/
/// Löschen für Berechtigte) auf Basis von `APIClient.listSparten(clubId:)`.
struct SpartenRootView: View {
    var body: some View {
        SpartenView()
    }
}
