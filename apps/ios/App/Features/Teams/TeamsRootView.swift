import SwiftUI

/// Registry-Einstieg des LESENDEN Team-Bereichs (Web-Referenz: /(portal)/teams).
/// Stabiler Aufrufpunkt für den „Mehr"-Hub (`MehrCatalog`) — sichtbar für JEDES
/// Mitglied. Die Team-VERWALTUNG (Anlegen/Kader pflegen) bleibt davon getrennt
/// in der Verwaltung (`AdminTeamsView`, is_club_admin).
struct TeamsRootView: View {
    var body: some View {
        TeamsView()
    }
}
