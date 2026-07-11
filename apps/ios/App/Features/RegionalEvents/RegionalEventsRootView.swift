import SwiftUI

/// Registry-Einstieg des Events-Moduls (überregionale Veranstaltungen;
/// Web-Referenz: /(portal)/events). Stabiler Aufrufpunkt für den „Mehr“-Hub
/// (`MehrCatalog` → `AnyView(RegionalEventsRootView())`) und den DEBUG-Deeplink
/// (`MehrDeepLink.events`) — deshalb bleibt der Typ als Einhäng-Punkt bestehen
/// und delegiert an die öffentliche Root-View `RegionalEventsView`, in der die
/// eigentliche Umsetzung (Leseliste über `APIClient.listRegionalEvents`) liegt.
struct RegionalEventsRootView: View {
    var body: some View {
        RegionalEventsView()
    }
}
