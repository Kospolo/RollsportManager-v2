import SwiftUI

/// Registry-Einhängepunkt des Wartelisten-Moduls
/// (Web-Referenz: /(portal)/wartelisten). Stabiler Aufrufpunkt für den
/// „Mehr“-Hub (`MehrCatalog` → `WaitlistsRootView()`) und den DEBUG-Deeplink
/// (`MehrDeepLink.waitlists`). Der Typname bleibt der stabile Einhängepunkt;
/// die native Umsetzung lebt in `WaitlistsView`.
struct WaitlistsRootView: View {
    var body: some View {
        WaitlistsView()
    }
}
