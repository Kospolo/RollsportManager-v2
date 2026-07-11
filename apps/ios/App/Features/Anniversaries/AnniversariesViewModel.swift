import Foundation

/// ViewModel der Jubiläen: lädt die server-aggregierte Liste
/// (`Anniversary`: Geburtstag/Vereins-Jubiläum, `years` + `daysUntil`, bereits
/// nach Nähe sortiert) über `APIClient.getAnniversaries(clubId:)`.
///
/// Rein lesend, für alle Mitglieder sichtbar — das Scoping bleibt serverseitig
/// (RLS). `@MainActor`, mit klaren Zuständen Loading/Error/Loaded und Retry.
/// Web-Referenz: `(portal)/jubilaeen`.
@MainActor
final class AnniversariesViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded([Anniversary])
    }

    @Published private(set) var state: State = .loading
    /// Fehler beim Pull-to-Refresh, wenn schon Daten stehen (Alert statt den
    /// Inhalt durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var hasLoadedOnce = false

    // MARK: - Laden

    /// Erststart aus `.task` — SessionStore ist erst im View-Environment
    /// verfügbar, deshalb kommen `api`/`clubId` hier herein.
    func loadIfNeeded(api: APIClient, clubId: String) async {
        self.api = api
        self.clubId = clubId
        guard !hasLoadedOnce else { return }
        hasLoadedOnce = true
        await load(showLoadingState: true)
    }

    func retry() async { await load(showLoadingState: true) }

    /// Pull-to-Refresh: kein Lade-Screen, Fehler nur als Alert.
    func refresh() async { await load(showLoadingState: false) }

    private func load(showLoadingState: Bool) async {
        guard let api, let clubId else { return }
        if showLoadingState { state = .loading }
        do {
            let items = try await api.getAnniversaries(clubId: clubId)
            state = .loaded(items)
        } catch {
            let message = (error as? APIError)?.errorDescription ?? error.localizedDescription
            if case .loaded = state, !showLoadingState {
                refreshErrorMessage = message
            } else {
                state = .error(message)
            }
        }
    }
}
