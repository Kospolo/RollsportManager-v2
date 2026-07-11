import Foundation

/// Detail-ViewModel eines Wettkampfs: lädt das serverseitig aggregierte
/// Ergebnis-Tableau (`getCompetitionStandings`) — Startliste UND Live-Rangliste
/// in einem, je Kategorie gruppiert, mit Rang und Delta zur Vorwertung. Die
/// Zeilen sind bereits `order by category, rank, last_name`. `canScore` spiegelt
/// die Server-Guard (Trainerstab); das eigentliche Schreiben macht das ScorePad.
@MainActor
final class CompetitionDetailViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var standings: CompetitionStandings?
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt
    /// Fehler-Screen).
    @Published var refreshErrorMessage: String?

    let competitionId: String
    /// Trainerstab darf Wertungen erfassen (member/guest sehen lesend).
    let canScore: Bool

    private var api: APIClient?
    private var hasLoadedOnce = false

    init(competitionId: String, clubRole: ClubRole?) {
        self.competitionId = competitionId
        self.canScore = WettkampfRoles.canScore(clubRole)
    }

    // MARK: - Ableitungen

    var rows: [CompetitionStandingRow] { standings?.rows ?? [] }
    var groups: [WettkampfStandingsGroup] { WettkampfStandings.groups(rows) }
    var hasAnyScore: Bool { WettkampfStandings.hasAnyScore(rows) }
    var isFinal: Bool { WettkampfStandings.isFinal(rows) }

    // MARK: - Laden

    func loadIfNeeded(api: APIClient) async {
        self.api = api
        guard !hasLoadedOnce else { return }
        hasLoadedOnce = true
        await load(showLoadingState: true)
    }

    func retry() async { await load(showLoadingState: true) }

    /// Nach einer erfassten Wertung: Rangliste ohne Lade-Screen nachziehen.
    func refresh() async { await load(showLoadingState: false) }

    private func load(showLoadingState: Bool) async {
        guard let api else { return }
        if showLoadingState { state = .loading }
        do {
            standings = try await api.getCompetitionStandings(competitionId: competitionId)
            state = .loaded
        } catch {
            let message = CompetitionsViewModel.friendlyMessage(error)
            if state == .loaded, !showLoadingState {
                refreshErrorMessage = message
            } else {
                state = .error(message)
            }
        }
    }
}
