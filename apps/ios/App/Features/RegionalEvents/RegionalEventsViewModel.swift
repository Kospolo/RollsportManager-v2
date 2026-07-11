import Foundation

/// Listen-ViewModel des Events-Features (überregionale Veranstaltungen). Lädt
/// die Vereins-Events rein lesend über `APIClient.listRegionalEvents(clubId:)`.
///
/// Kommende Events stehen oben (frühester zuerst), vergangene gedämpft in einer
/// eigenen Sektion darunter (neueste zuerst) — dieselbe Aufteilung/Ordnung wie
/// die Web-Referenz (events/_components/RegionalEventsScreen.tsx). Schreiben ist
/// hier bewusst kein Thema: Anlegen/Ändern/Löschen liegt beim Trainerstab im
/// Web, die iOS-Sicht ist read-only.
@MainActor
final class RegionalEventsViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var upcoming: [RegionalEvent] = []
    @Published private(set) var past: [RegionalEvent] = []
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt die
    /// Liste durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var hasLoadedOnce = false

    /// Es liegen (kommende oder vergangene) Events vor.
    var hasAnyEvents: Bool { !upcoming.isEmpty || !past.isEmpty }

    // MARK: - Laden

    /// Erststart aus `.task` — `SessionStore` ist erst im View-Environment
    /// verfügbar, deshalb kommen `api`/`clubId` hier rein.
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
            let events = try await api.listRegionalEvents(clubId: clubId)
            apply(events)
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

    // MARK: - Aufteilung/Ordnung

    /// Kommend vs. vergangen aufteilen und wie im Web sortieren: kommende
    /// aufsteigend (frühester zuerst), vergangene absteigend (neueste zuerst).
    /// Der Vergangen-Stichtag wird EINMAL pro Ladevorgang bestimmt.
    private func apply(_ events: [RegionalEvent]) {
        let today = RegionalEventDate.todayIso()
        var up: [RegionalEvent] = []
        var pastList: [RegionalEvent] = []
        for event in events {
            if RegionalEventDate.isPast(event, today: today) {
                pastList.append(event)
            } else {
                up.append(event)
            }
        }
        up.sort { $0.startsOn < $1.startsOn }
        pastList.sort { $0.startsOn > $1.startsOn }
        upcoming = up
        past = pastList
    }

    // MARK: - Helfer

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
