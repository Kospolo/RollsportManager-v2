import SwiftUI

/// Registry-Einhängepunkt des Profil-Moduls
/// (Web-Referenz: /(portal)/profil + /(portal)/einstellungen). Stabiler
/// Aufrufpunkt für den „Mehr“-Hub (`MehrCatalog` → `ProfileRootView()`), den
/// DEBUG-Deeplink (`MehrDeepLink.profile`) und das Benutzermenü im Dashboard.
///
/// Native Umsetzung: rendert `ProfileView` — eigenes Profil
/// (`api.getMyProfile()`/`api.updateMyProfile(_:)`) plus Einstellungen
/// (`api.getMyPreferences()`/`api.updateMyPreferences(_:)`) in einem Screen.
/// Der Typname bleibt der stabile Einhängepunkt (Registry/Deeplink/Benutzermenü).
struct ProfileRootView: View {
    var body: some View {
        ProfileView()
    }
}
