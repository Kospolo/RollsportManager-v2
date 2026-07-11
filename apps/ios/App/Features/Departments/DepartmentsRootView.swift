import SwiftUI

/// Registry-Einstieg des Abteilungen-Moduls (Web-Referenz:
/// /(portal)/abteilungen). Stabiler Aufrufpunkt für den „Mehr“-Hub
/// (`MehrCatalog`) und den DEBUG-Deeplink (`MehrDeepLink.departments`).
/// Native Umsetzung: rendert `DepartmentsView` (Karten-Liste + Detail mit
/// Mitgliedern der Abteilung) auf Basis von
/// `APIClient.listDepartments(clubId:)` + `listMembers(clubId:)`.
struct DepartmentsRootView: View {
    var body: some View {
        DepartmentsView()
    }
}
