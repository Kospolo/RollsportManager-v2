import Foundation

/// Listen-ViewModel des News-Features (Schwarzes Brett): lädt die Vereins-News
/// und — best effort für die Autorennamen — die Mitgliederliste. Die Liste ist
/// serverseitig bereits sortiert (`is_pinned desc, published_at desc nulls
/// last, created_at desc`); wir halten dieselbe Ordnung und sortieren nach
/// einem optimistischen Einschub identisch nach, damit eine neu verfasste
/// Nachricht sofort an der richtigen Stelle landet.
@MainActor
final class NewsViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var items: [News] = []
    @Published private(set) var membersById: [String: ClubMember] = [:]
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt
    /// die Liste durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var clubRole: ClubRole?
    private var hasLoadedOnce = false

    /// Schreibrechte spiegeln die Server-Guard (COACH_ROLES): Trainerstab darf
    /// News anlegen — `treasurer`/`member`/`guest` erhalten serverseitig 403,
    /// deshalb blenden wir die Verfassen-Aktion für sie aus (die Durchsetzung
    /// bleibt am Server). Quelle: services/api/src/lib/guards.ts.
    private static let writeRoles: Set<ClubRole> = [.owner, .admin, .moderator, .coach, .guestCoach]

    var canWrite: Bool {
        guard let clubRole else { return false }
        return Self.writeRoles.contains(clubRole)
    }

    // MARK: - Laden

    /// Erststart aus `.task` — SessionStore ist erst im View-Environment
    /// verfügbar, deshalb kommen `api`/`clubId`/`clubRole` hier rein.
    func loadIfNeeded(api: APIClient, clubId: String, clubRole: ClubRole?) async {
        self.api = api
        self.clubId = clubId
        self.clubRole = clubRole
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
            async let newsCall = api.listNews(clubId: clubId)
            // Mitglieder sind Beiwerk (Autorennamen) — ein RLS-403 einer Rolle
            // darf die News-Liste nicht verhindern.
            async let membersCall = api.members(clubId: clubId)

            let news = try await newsCall
            let members = (try? await membersCall) ?? []

            self.items = Self.sorted(news)
            self.membersById = Dictionary(
                members.map { ($0.id, $0) },
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

    // MARK: - Ableitungen

    var pinned: [News] { items.filter(\.isPinned) }
    var rest: [News] { items.filter { !$0.isPinned } }

    /// Aufgelöster Autorenname (Vor- + Nachname) oder `nil`, wenn das Mitglied
    /// nicht (mehr) lesbar ist — die View zeigt dann „Unbekannt“.
    func authorName(for item: News) -> String? {
        guard let member = membersById[item.authorMemberId] else { return nil }
        let name = "\(member.firstName) \(member.lastName)"
            .trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? nil : name
    }

    /// Neu angelegte Nachricht (mit echter ID) einfügen und neu sortieren —
    /// gleiche ID ersetzt statt zu doppeln.
    func insert(created news: News) {
        if let index = items.firstIndex(where: { $0.id == news.id }) {
            items[index] = news
        } else {
            items.append(news)
        }
        items = Self.sorted(items)
    }

    // MARK: - Helfer

    /// Sortierung 1:1 wie der Server: angepinnt zuerst, dann veröffentlichte
    /// nach `published_at` absteigend (Entwürfe ohne Datum ans Ende), zuletzt
    /// `created_at` absteigend. ISO-8601 gleicher Form sortiert lexikografisch.
    static func sorted(_ list: [News]) -> [News] {
        list.sorted(by: order)
    }

    private static func order(_ a: News, _ b: News) -> Bool {
        if a.isPinned != b.isPinned { return a.isPinned }
        switch (a.publishedAt, b.publishedAt) {
        case let (lhs?, rhs?):
            return lhs != rhs ? lhs > rhs : a.createdAt > b.createdAt
        case (_?, nil):
            return true
        case (nil, _?):
            return false
        case (nil, nil):
            return a.createdAt > b.createdAt
        }
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
