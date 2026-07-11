import Foundation

/// Dev-Konfiguration der App.
///
/// Die App spricht AUSSCHLIESSLICH mit dem lokalen Dev-Stack
/// (`scripts/dev-stack.sh up`) — niemals mit rollsportmanager.de oder
/// anderen entfernten Hosts. Der iOS-Simulator erreicht 127.0.0.1 direkt.
enum DevConfig {
    /// Default-Basis-URL des lokalen Hono-API-Stacks.
    static let defaultBaseURL = URL(string: "http://127.0.0.1:3022")!

    /// Origin der lokalen Web-App (dev-stack.sh: `Web: http://localhost:3021`).
    /// Kür-Share-Links sind serverseitig RELATIV (`/wettkampf/kuer/{token}`) —
    /// die native App setzt diesen Origin davor (QR/Kopieren/Teilen). Kein
    /// Prod-Mechanismus; die echte Domain kommt später aus der Konfiguration.
    static let webBaseURL = URL(string: "http://localhost:3021")!

    /// UserDefaults-Schlüssel, um die Basis-URL in Dev-Szenarien zu
    /// übersteuern (z. B. `xcrun simctl launch ... --setenv` Alternativen
    /// oder ein verstecktes Debug-Menü). Kein Prod-Mechanismus.
    static let baseURLDefaultsKey = "rsm.dev.baseURL"

    /// Effektive Basis-URL: Override aus UserDefaults, sonst Default.
    static var baseURL: URL {
        if let raw = UserDefaults.standard.string(forKey: baseURLDefaultsKey),
           let url = URL(string: raw) {
            return url
        }
        return defaultBaseURL
    }

    /// Die eine geseedete Demo-Vereins-ID (RSV Neckarsulm) — identisch zu
    /// `services/api/src/routes/dev-login.ts` (DEV_CLUB_ID). Der Dev-Login
    /// liefert sie zusätzlich im Profil zurück; dieser Wert ist nur Fallback.
    static let seedClubID = "c1ab0000-0000-4000-8000-000000000001"
}
