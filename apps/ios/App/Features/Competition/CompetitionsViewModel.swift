import Foundation

/// Listen-ViewModel des Wettkampf-Features: lädt die Wettkämpfe des Vereins
/// (`listCompetitions`) und teilt sie in kommende (angesetzt/läuft, aufsteigend
/// nach Start) und vergangene (beendet, absteigend). Abgesagte werden
/// ausgeblendet. Reine Liste — die Rangliste je Wettkampf lädt das Detail.
@MainActor
final class CompetitionsViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var upcoming: [Competition] = []
    @Published private(set) var past: [Competition] = []
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt die
    /// Liste durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var hasLoadedOnce = false

    var isEmpty: Bool { upcoming.isEmpty && past.isEmpty }

    // MARK: - Laden

    /// Erststart aus `.task` — `SessionStore` ist erst im View-Environment
    /// verfügbar, deshalb kommen `api`/`clubId` hier rein statt in den Init.
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
            let all = try await api.listCompetitions(clubId: clubId)
            // ISO-8601 gleicher Form sortiert lexikografisch = chronologisch.
            upcoming = all
                .filter { $0.status == .upcoming || $0.status == .running }
                .sorted { $0.startsAt < $1.startsAt }
            past = all
                .filter { $0.status == .done }
                .sorted { $0.startsAt > $1.startsAt }
            state = .loaded
        } catch {
            let message = Self.friendlyMessage(error)
            if state == .loaded, !showLoadingState {
                refreshErrorMessage = message
            } else {
                state = .error(message)
            }
        }
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
