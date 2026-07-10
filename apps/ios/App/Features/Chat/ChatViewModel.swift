import Foundation

/// Listen-ViewModel des Chat-Features: lädt meine Kanäle (Team-Kanäle +
/// Direkt-Konversationen, serverseitig nach letzter Aktivität sortiert) und
/// best-effort die Mitgliederliste für die Namensauflösung in Team-Kanälen.
///
/// Rechte sind serverseitig (RLS) — die UI zeigt nur an. Ein RLS-403 der
/// Mitgliederliste darf die Kanäle NICHT verhindern (Namen fallen dann auf
/// einen generischen Platzhalter zurück).
@MainActor
final class ChatViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var channels: [ChatChannel] = []
    /// Fehler beim Pull-to-Refresh, wenn schon Kanäle da sind (Alert statt
    /// die Liste durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    /// member_id → Anzeigename, für Absender in Team-Kanälen + Vorschautexte.
    private(set) var namesById: [String: String] = [:]
    private(set) var myMemberId = ""

    private var api: APIClient?
    private var clubId: String?
    private var hasLoadedOnce = false

    // MARK: - Laden

    /// Erststart aus `.task` — SessionStore ist erst im View-Environment
    /// verfügbar, deshalb kommen `api`/`clubId`/`myMemberId` hier rein.
    func loadIfNeeded(api: APIClient, clubId: String, myMemberId: String) async {
        self.api = api
        self.clubId = clubId
        self.myMemberId = myMemberId
        guard !hasLoadedOnce else { return }
        hasLoadedOnce = true
        await load(showLoadingState: true)
    }

    func retry() async {
        await load(showLoadingState: true)
    }

    /// Pull-to-Refresh: kein Lade-Screen, Fehler nur als Alert.
    func refresh() async {
        await load(showLoadingState: false)
    }

    private func load(showLoadingState: Bool) async {
        guard let api, let clubId else { return }
        if showLoadingState { state = .loading }
        do {
            async let channelsCall = api.listChatChannels(clubId: clubId)
            // Mitglieder sind Beiwerk (Absendernamen) — ein RLS-403 einer
            // Rolle darf die Kanalliste nicht kippen.
            async let membersCall = api.members(clubId: clubId)

            let channels = try await channelsCall
            let members = (try? await membersCall) ?? []

            self.channels = channels
            self.namesById = Dictionary(
                members.map { ($0.id, "\($0.firstName) \($0.lastName)") },
                uniquingKeysWith: { _, newer in newer }
            )
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

    // MARK: - Namensauflösung

    /// Anzeigename eines Mitglieds; `nil`, wenn die Mitgliederliste (RLS) nicht
    /// sichtbar war — die View setzt dann einen generischen Platzhalter.
    func name(for memberId: String?) -> String? {
        guard let memberId, let name = namesById[memberId], !name.isEmpty else { return nil }
        return name
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
