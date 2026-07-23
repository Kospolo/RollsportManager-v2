import Foundation

// ============================================================================
// Ein Lade-Modell für ALLE Abschnitte der Betreiber-Konsole.
//
// Die sechs Abschnitte (Überblick, Vereine, Nutzer, Lizenzen, Support, Küren,
// System) unterscheiden sich nur in einem Punkt: welchen Endpoint sie rufen.
// Zustände, Fehlerübersetzung und Wiederholen sind identisch. Sechs fast
// gleiche ViewModels wären sechs Stellen, an denen der 403-Fall abdriftet —
// und genau der ist hier der interessante.
// ============================================================================

/// Ladezustand eines Konsolen-Abschnitts.
enum PlatformLoadState<Value> {
    case loading
    /// Der Server hat den Betreiber-Zugang verweigert (403). Der EINZIGE
    /// verbindliche Zugriffsentscheid — das Client-Gate ist nur Menüführung.
    case forbidden
    case failed(String)
    case loaded(Value)
}

/// Lädt genau einen Betreiber-Abschnitt und hält seinen Zustand.
///
/// Bewusst generisch statt Protokoll-Zoo: `load` bekommt die Abfrage als
/// Closure herein, damit die Views ihren Endpoint selbst benennen.
@MainActor
final class PlatformSectionModel<Value>: ObservableObject {

    @Published private(set) var state: PlatformLoadState<Value> = .loading

    private var hasLoaded = false

    /// Erststart aus `.task` — mehrfaches Erscheinen der View lädt nicht neu.
    func loadIfNeeded(_ fetch: @escaping () async throws -> Value) async {
        guard !hasLoaded else { return }
        await load(fetch)
    }

    /// Neu laden (Wiederholen-Knopf, Pull-to-Refresh).
    func load(_ fetch: @escaping () async throws -> Value) async {
        state = .loading
        do {
            let value = try await fetch()
            hasLoaded = true
            state = .loaded(value)
        } catch {
            // 403 ist hier KEIN Defekt, sondern die Antwort des Servers auf
            // ein Token ohne Betreiber-Claim. Sie verdient einen eigenen
            // Zustand — „Laden fehlgeschlagen" wäre eine Lüge.
            if error.isForbiddenAPIError {
                state = .forbidden
            } else {
                state = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
            }
        }
    }
}
