import SwiftUI

/// Registry-Einstieg des Notizen-Moduls (Web-Referenz: /(portal)/notizen).
/// Stabiler Aufrufpunkt für den „Mehr“-Hub (`MehrCatalog`) und den
/// DEBUG-Deeplink (`MehrDeepLink.notes`). Delegiert an die echte Umsetzung
/// `NotesView` (Root-View des Features) — so bleibt die bestehende Registry
/// (`MehrCatalog` → `NotesRootView()`) unverändert.
struct NotesRootView: View {
    var body: some View {
        NotesView()
    }
}
