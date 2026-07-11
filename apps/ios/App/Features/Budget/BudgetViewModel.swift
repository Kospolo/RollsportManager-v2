import Foundation

/// ViewModel der Budgetplanung: lädt den server-aggregierten Soll-Ist-Bericht
/// (`BudgetReport`: Plan vs. Ist je Kategorie inkl. Summen) über
/// `APIClient.getBudgetReport(clubId:year:)` für das gewählte Jahr.
///
/// Rein lesend. Nur `can_manage_finance` (owner/admin/treasurer) — der Gate
/// sitzt in `BudgetRootView`, sodass hier gar nicht erst ein 403 ausgelöst wird;
/// die verbindliche Durchsetzung bleibt serverseitig (RLS + 403). `@MainActor`,
/// klare Zustände Loading/Error/Loaded und Retry. Web-Referenz:
/// `(portal)/finanzen/budget`.
@MainActor
final class BudgetViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded(BudgetReport)
    }

    @Published private(set) var state: State = .loading
    /// Fehler beim Jahreswechsel/Pull-to-Refresh mit bereits stehenden Daten —
    /// als Alert statt den Inhalt durch einen Fehler-Screen zu ersetzen.
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?

    // MARK: - Laden

    /// Erststart bzw. Jahreswechsel. `api`/`clubId` kommen aus dem
    /// SessionStore-Environment (erst in der View verfügbar).
    func load(api: APIClient, clubId: String, year: Int, showLoadingState: Bool = true) async {
        self.api = api
        self.clubId = clubId
        await fetch(year: year, showLoadingState: showLoadingState)
    }

    func retry(year: Int) async { await fetch(year: year, showLoadingState: true) }

    /// Pull-to-Refresh: kein Lade-Screen, Fehler nur als Alert.
    func refresh(year: Int) async { await fetch(year: year, showLoadingState: false) }

    private func fetch(year: Int, showLoadingState: Bool) async {
        guard let api, let clubId else { return }
        if showLoadingState { state = .loading }
        do {
            let report = try await api.getBudgetReport(clubId: clubId, year: year)
            state = .loaded(report)
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
