import Foundation

/// ViewModel der Auswertung: lädt das aggregierte Kennzahlen-Objekt
/// (`ReportSummary`) über `APIClient.getReportsSummary(clubId:)`.
///
/// Sichtbarkeit ist kosmetisch, die Durchsetzung bleibt serverseitig
/// (`requireClubRole(COACH_ROLES)`): Nur Trainerstab/Vereinsleitung sehen das
/// Dashboard. Rollen ohne Recht (`member`/`treasurer`/`guest_coach`) bekommen
/// gar keinen Netzabruf, sondern direkt den freundlichen Kein-Zugriff-Hinweis;
/// ein trotzdem auftretendes RFC-7807-`Problem` mit `status == 403` landet
/// ebenfalls dort. Rein lesend. Web-Referenz: `(portal)/auswertung`.
@MainActor
final class ReportsViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        /// Rolle darf die Auswertung nicht sehen (oder Server-403).
        case noAccess
        case error(String)
        case loaded(ReportSummary)
    }

    @Published private(set) var state: State = .loading
    /// Fehler beim Pull-to-Refresh, wenn schon Daten stehen (Alert statt den
    /// Inhalt durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var role: ClubRole?
    private var hasLoadedOnce = false

    /// Rollen mit Lesezugriff auf die Auswertung — deckungsgleich mit der
    /// Web-Sichtbarkeit (`isTrainer || isClubAdmin`): owner/admin/moderator/
    /// coach. `guest_coach` ist team-/zeitgebunden und bleibt hier außen vor
    /// (der Server ließe ihn zu, die Web-UX blendet ihn aber aus).
    private static let reportRoles: Set<ClubRole> = [.owner, .admin, .moderator, .coach]

    // MARK: - Laden

    /// Erststart aus `.task` — SessionStore ist erst im View-Environment
    /// verfügbar, deshalb kommen `api`/`clubId`/Rolle hier herein.
    func loadIfNeeded(api: APIClient, clubId: String, role: ClubRole?) async {
        self.api = api
        self.clubId = clubId
        self.role = role
        guard !hasLoadedOnce else { return }
        hasLoadedOnce = true
        await load(showLoadingState: true)
    }

    func retry() async { await load(showLoadingState: true) }

    /// Pull-to-Refresh: kein Lade-Screen, Fehler nur als Alert.
    func refresh() async { await load(showLoadingState: false) }

    /// Darf die aktuelle Rolle die Auswertung überhaupt sehen?
    var isAllowed: Bool {
        guard let role else { return false }
        return Self.reportRoles.contains(role)
    }

    private func load(showLoadingState: Bool) async {
        guard let api, let clubId else { return }
        // Rechte-Gate zuerst — ohne Recht kein Netzabruf, direkt der Hinweis.
        guard isAllowed else {
            state = .noAccess
            return
        }
        if showLoadingState { state = .loading }
        do {
            let summary = try await api.getReportsSummary(clubId: clubId)
            state = .loaded(summary)
        } catch {
            let message = Self.friendlyMessage(error)
            if error.isForbiddenAPIError {
                state = .noAccess
            } else if case .loaded = state, !showLoadingState {
                refreshErrorMessage = message
            } else {
                state = .error(message)
            }
        }
    }

    // MARK: - Helfer

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
