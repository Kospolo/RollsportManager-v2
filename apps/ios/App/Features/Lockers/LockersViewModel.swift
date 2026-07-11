import Foundation

/// Listen-ViewModel der Schließfächer: lädt das Fach-Inventar (`listLockers`)
/// und — best effort, zur Namensauflösung des belegenden Mitglieds — die
/// Mitgliederliste (`members`). Rein lesend in diesem Batch; Zuordnen/Freigeben
/// (LockerAssign/LockerUpdate liegen im Contract bereit) folgen später.
/// Web-Referenz: /(portal)/schliessfaecher.
///
/// Der APIClient kommt IMMER aus dem `SessionStore` (`session.api`) und wird in
/// `loadIfNeeded` hereingereicht — nie selbst gebaut, damit Token-Wechsel/Logout
/// automatisch greifen.
@MainActor
final class LockersViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var lockers: [Locker] = []
    @Published private(set) var membersById: [String: ClubMember] = [:]
    /// Aktiver Status-Filter (Chip-Auswahl).
    @Published var filter: LockerStatusFilter = .all
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt die
    /// Liste durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var hasLoadedOnce = false

    // MARK: - Laden

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
            async let lockersCall = api.listLockers(clubId: clubId)
            // Mitglieder sind Beiwerk (Namensauflösung der Belegung) — ein
            // RLS-403 einer Rolle darf das Fach-Inventar nicht verhindern.
            async let membersCall = api.members(clubId: clubId)

            let loadedLockers = try await lockersCall
            let loadedMembers = (try? await membersCall) ?? []

            self.lockers = loadedLockers.sorted {
                $0.label.localizedStandardCompare($1.label) == .orderedAscending
            }
            self.membersById = Dictionary(
                loadedMembers.map { ($0.id, $0) },
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

    // MARK: - Ableitungen (Status-Filter)

    /// Anzahl je Status (frei/belegt/defekt) über den gesamten Bestand.
    var counts: [LockerStatus: Int] {
        var base: [LockerStatus: Int] = [.free: 0, .assigned: 0, .broken: 0]
        for locker in lockers { base[locker.status, default: 0] += 1 }
        return base
    }

    /// Sichtbare Fächer nach aktivem Filter.
    var visibleLockers: [Locker] {
        lockers.filter { filter.matches($0) }
    }

    /// Chip-Zähler für einen Filterwert.
    func count(for filter: LockerStatusFilter) -> Int {
        switch filter {
        case .all: return lockers.count
        case .status(let status): return counts[status] ?? 0
        }
    }

    // MARK: - Ableitungen (Belegung)

    /// Aufgelöster Name des belegenden Mitglieds — `nil`, wenn nicht belegt.
    /// Bei belegtem Fach ohne auflösbaren Namen (fremdes Mitglied per RLS
    /// nicht geladen) liefert die View den Platzhalter „Unbekanntes Mitglied“.
    func assignedMemberName(for locker: Locker) -> String? {
        guard locker.status == .assigned, let id = locker.assignedMemberId,
              let member = membersById[id] else { return nil }
        let name = "\(member.firstName) \(member.lastName)"
            .trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? nil : name
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
