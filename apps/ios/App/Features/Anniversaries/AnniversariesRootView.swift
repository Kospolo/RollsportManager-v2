import SwiftUI

/// Registry-Einstieg des Jubiläen-Moduls (Web-Referenz: /(portal)/jubilaeen).
/// Stabiler Aufrufpunkt für den „Mehr“-Hub (`MehrCatalog`) und den
/// DEBUG-Deeplink (`MehrDeepLink.anniversaries`).
///
/// Die echte Umsetzung liegt in `AnniversariesView` (öffentliche Root-View des
/// Features). Dieser Adapter delegiert nur — so bleibt die READ-ONLY-Registry
/// (`MehrCatalog` → `AnniversariesRootView()`) unverändert und das Modul ist
/// voll umgesetzt: kommende Jubiläen aus `APIClient.getAnniversaries(clubId:)`.
struct AnniversariesRootView: View {
    var body: some View {
        AnniversariesView()
    }
}
