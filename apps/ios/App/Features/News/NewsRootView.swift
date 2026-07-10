import SwiftUI

/// Registry-Einstieg des News-Features. Im „Mehr“-Hub ist dieses Feature über
/// `MehrCatalog` als `AnyView(NewsRootView())` verdrahtet (Shared-Code, für das
/// News-Team read-only) — deshalb bleibt der Typ `NewsRootView` als stabiler
/// Aufrufpunkt bestehen und delegiert an die öffentliche Root-View `NewsView`,
/// in der die eigentliche Umsetzung liegt. Web-Referenz: /(portal)/news.
struct NewsRootView: View {
    var body: some View {
        NewsView()
    }
}
