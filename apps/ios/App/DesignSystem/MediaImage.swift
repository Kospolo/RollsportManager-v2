import SwiftUI
#if canImport(UIKit)
import UIKit
#else
// macOS: AppKit statt UIKit. Die hier benutzten UIKit-Namen
// (UIImage/UIScreen/UIAccessibility) liefert AppMac/MacPlatformShims.swift.
import AppKit
#endif

// ============================================================================
// Gemeinsamer Bild-Loader für die auth-pflichtigen Medien des Dev-Stacks.
//
// WICHTIG: GET /media/{key} verlangt IMMER ein Bearer-Token (RLS + PRO-Gate)
// — ein nacktes `AsyncImage(url:)` funktioniert deshalb NICHT (es setzt keinen
// Authorization-Header und bekäme 404/401). Alle Bilder (Galerie-Kacheln,
// Avatare aus `avatar_key`) laufen daher über `MediaImage` + `MediaImageStore`.
//
// Der Store hält geladene `UIImage`s im Speicher (NSCache, ~40 MB / 120 Bilder)
// und dedupliziert parallele Anfragen desselben Keys, damit ein Grid mit
// mehrfach sichtbaren Keys nur einmal lädt.
// ============================================================================

/// Prozessweiter In-Memory-Cache + Request-Dedup für Medien-Bytes → `UIImage`.
/// `@MainActor`, weil `MediaImage` (SwiftUI) hier hereinruft und die
/// In-Flight-Task-Map ohne zusätzliche Synchronisation konsistent bleibt.
@MainActor
final class MediaImageStore {
    static let shared = MediaImageStore()

    private let cache: NSCache<NSString, UIImage> = {
        let c = NSCache<NSString, UIImage>()
        c.countLimit = 120
        c.totalCostLimit = 40 * 1024 * 1024 // ~40 MB dekodierte Pixel
        return c
    }()

    /// Laufende Ladevorgänge je Key — mehrere Views auf denselben Key teilen
    /// sich eine Task (kein doppelter Netzwerk-Roundtrip).
    private var inFlight: [String: _Concurrency.Task<UIImage, Error>] = [:]

    private init() {}

    /// Bereits dekodiertes Bild aus dem Cache (synchron, für Sofort-Anzeige
    /// ohne Flackern beim Wiedererscheinen einer Zelle).
    func cached(_ key: String) -> UIImage? {
        cache.object(forKey: key as NSString)
    }

    /// Lädt das Bild zu `key` über den auth-tragenden `APIClient`. Ergebnis
    /// wird gecacht; parallele Aufrufe desselben Keys teilen sich die Task.
    func image(forKey key: String, api: APIClient) async throws -> UIImage {
        if let hit = cache.object(forKey: key as NSString) { return hit }
        if let running = inFlight[key] { return try await running.value }

        let task = _Concurrency.Task<UIImage, Error> {
            let data = try await api.mediaBytes(key: key)
            guard let image = UIImage(data: data) else {
                throw APIError.decoding(underlying: MediaImageError.notAnImage)
            }
            return image
        }
        inFlight[key] = task
        defer { inFlight[key] = nil }

        let image = try await task.value
        let cost = image.cgImage.map { $0.bytesPerRow * $0.height } ?? 0
        cache.setObject(image, forKey: key as NSString, cost: cost)
        return image
    }
}

enum MediaImageError: Error { case notAnImage }

/// Ladezustand einer `MediaImage`-Zelle.
private enum MediaImagePhase: Equatable {
    case idle
    case loading
    case loaded(UIImage)
    case failed

    static func == (lhs: MediaImagePhase, rhs: MediaImagePhase) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.loading, .loading), (.failed, .failed): return true
        case let (.loaded(a), .loaded(b)): return a === b
        default: return false
        }
    }
}

/// Auth-tragende Bild-Ansicht. Reicht das `storageKey` an `MediaImageStore`
/// und zeigt Platzhalter (Skeleton) beim Laden bzw. ein Fehler-Icon, wenn der
/// Key nicht (mehr) sichtbar ist. Für Galerie-Kacheln UND Avatare nutzbar —
/// Form (Kreis/Rechteck) macht der Aufrufer per `.clipShape`.
///
/// `contentMode` default `.fill` (Kacheln/Avatare randlos füllen). `key == nil`
/// ⇒ direkt Platzhalter (z. B. Mitglied ohne `avatar_key`).
struct MediaImage: View {
    let key: String?
    var contentMode: ContentMode = .fill
    /// Optionales SF-Symbol für den Platzhalter (z. B. „person.fill" bei Avataren).
    var placeholderSystemImage: String = "photo"

    @EnvironmentObject private var session: SessionStore
    @State private var phase: MediaImagePhase = .idle

    var body: some View {
        content
            .task(id: key) { await load() }
    }

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .loaded(let image):
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: contentMode)
        case .failed:
            placeholder(systemImage: "exclamationmark.triangle", tint: Theme.Colors.inkFaint)
        case .idle, .loading:
            placeholder(systemImage: placeholderSystemImage, tint: Theme.Colors.inkFaint)
                .overlay {
                    if phase == .loading {
                        ProgressView().tint(Theme.Colors.inkFaint)
                    }
                }
        }
    }

    private func placeholder(systemImage: String, tint: Color) -> some View {
        ZStack {
            Theme.Colors.bgSunken
            Image(systemName: systemImage)
                .font(.system(size: 20, weight: .regular))
                .foregroundStyle(tint)
        }
    }

    private func load() async {
        guard let key, !key.isEmpty else { phase = .idle; return }
        // Sofort-Treffer aus dem Cache: kein Ladezustand, kein Flackern.
        if let hit = MediaImageStore.shared.cached(key) {
            phase = .loaded(hit)
            return
        }
        phase = .loading
        do {
            let image = try await MediaImageStore.shared.image(forKey: key, api: session.api)
            phase = .loaded(image)
        } catch {
            phase = .failed
        }
    }
}
