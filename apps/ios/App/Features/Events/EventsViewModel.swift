import Foundation

/// Listen-ViewModel des Termine-Features: lädt Termine, Teams und Mitglieder
/// des Vereins (Teams/Roster best-effort — für Team-Pills und die
/// „offen“-Zählung) und gruppiert die gefilterte Liste nach Tagen.
@MainActor
final class EventsViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var events: [Event] = []
    @Published private(set) var teamsById: [String: Team] = [:]
    @Published private(set) var membersById: [String: ClubMember] = [:]
    @Published var filter: EventsFilter = .all
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt
    /// die Liste durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var hasLoadedOnce = false

    // MARK: - Laden

    /// Erststart aus `.task` — SessionStore ist erst im View-Environment
    /// verfügbar, deshalb kommen `api`/`clubId` hier rein statt in den Init.
    func loadIfNeeded(api: APIClient, clubId: String) async {
        self.api = api
        self.clubId = clubId
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
            // Zeitfenster: ab letzter Woche (Trainer tragen Anwesenheit auch
            // rückwirkend nach), nach vorn offen.
            async let eventsCall = api.events(clubId: clubId, from: Self.fromDateString())
            // Teams + Roster sind Beiwerk (Pills, Namen, „offen“-Zahl) —
            // ein RLS-403 einer Rolle darf die Liste nicht verhindern.
            async let teamsCall = api.teams(clubId: clubId)
            async let membersCall = api.members(clubId: clubId)

            let events = try await eventsCall
            let teams = (try? await teamsCall) ?? []
            let members = (try? await membersCall) ?? []

            self.events = events
            self.teamsById = Dictionary(
                teams.map { ($0.id, $0) },
                uniquingKeysWith: { _, newer in newer }
            )
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

    /// Gefilterte Termine, nach Kalendertag gruppiert, aufsteigend sortiert.
    var sections: [EventsDaySection] {
        let calendar = Calendar.current
        let filtered = events.filter { filter.matches($0) }
        let grouped = Dictionary(grouping: filtered) { event in
            calendar.startOfDay(for: EventsISO.date(from: event.startsAt) ?? .distantPast)
        }
        return grouped.keys.sorted().map { day in
            EventsDaySection(
                day: day,
                // ISO-8601 gleicher Form sortiert lexikografisch korrekt.
                events: grouped[day, default: []].sorted { $0.startsAt < $1.startsAt }
            )
        }
    }

    /// Termin-Update aus dem Detail-Sheet (z. B. neue RSVP) in die Liste mergen.
    func apply(updatedEvent: Event) {
        guard let index = events.firstIndex(where: { $0.id == updatedEvent.id }) else { return }
        events[index] = updatedEvent
    }

    // MARK: - Helfer

    /// `from`-Query als volle ISO-8601-Datetime — der Server lehnt reine
    /// Datumsangaben ab („from: Invalid datetime“, live verifiziert;
    /// der Doc-Kommentar in Endpoints.swift verspricht mehr als die API hält).
    private static func fromDateString() -> String {
        let today = Calendar.current.startOfDay(for: Date())
        let date = Calendar.current.date(byAdding: .day, value: -7, to: today) ?? today
        return EventsISO.string(from: date)
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
