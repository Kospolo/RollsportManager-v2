import Foundation

/// Laufzeit-Konfiguration der App (Basis-URLs).
///
/// DEBUG-Builds sprechen den lokalen Dev-Stack (`scripts/dev-stack.sh up`) auf
/// 127.0.0.1 an; RELEASE-Builds die LIVE-API `https://api.rollsportmanager.de`
/// (self-contained Auth, AUTH_MODE=selfhosted). Der Name „DevConfig" bleibt aus
/// Aufrufer-Kompatibilitaet; „Dev" heisst hier nur „nicht fest verdrahtet".
enum DevConfig {
    /// Default-Basis-URL der API: lokal in DEBUG, live in RELEASE.
#if DEBUG
    static let defaultBaseURL = URL(string: "http://127.0.0.1:3022")!
    /// Origin der Web-App fuer relative Kür-Share-Links (QR/Kopieren/Teilen).
    static let webBaseURL = URL(string: "http://localhost:3021")!
#else
    static let defaultBaseURL = URL(string: "https://api.rollsportmanager.de")!
    static let webBaseURL = URL(string: "https://app.rollsportmanager.de")!
#endif

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
