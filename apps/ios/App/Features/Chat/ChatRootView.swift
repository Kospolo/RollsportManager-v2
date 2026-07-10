import SwiftUI

/// Einhängepunkt des Chat-Features im „Mehr"-Hub.
///
/// `MehrCatalog.available` referenziert `ChatRootView()` als
/// NavigationLink-Ziel (analog zu den anderen Modul-Roots). Die eigentliche
/// Umsetzung liegt in der öffentlichen Root-View `ChatView` — dieser dünne
/// Wrapper hält nur die Registry-Referenz stabil.
///
/// Läuft im NavigationStack des Mehr-Tabs; `SessionStore` kommt aus dem
/// Environment. Web-Referenz-UX: apps/web/app/(portal)/chat.
struct ChatRootView: View {
    var body: some View {
        ChatView()
    }
}
