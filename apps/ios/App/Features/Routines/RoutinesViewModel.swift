import Foundation

/// Zeile der Küren-Liste: Kür + aufgelöste Läufer:innen + letzte RollArt-Wertung.
struct RoutineListItem: Identifiable {
    let routine: Routine
    let skaters: [ClubMember]
    /// Letzte Gesamtwertung (nach `scored_on`) und Delta zur vorherigen.
    let lastTotal: Double?
    let delta: Double?

    var id: String { routine.id }

    /// "Lina Sommer & Jonas Brandt" — Reihenfolge wie `skater_member_ids`.
    var skaterNames: String {
        skaters.map { "\($0.firstName) \($0.lastName)" }.joined(separator: " & ")
    }
}

/// Lädt die Küren-Liste: Küren + Mitglieder parallel, danach die Wertungen
/// je Kür in einer Task-Group. Loading/Error/Loaded mit Retry (Konvention).
@MainActor
final class RoutinesViewModel: ObservableObject {

    enum State {
        case loading
        case error(String)
        case loaded([RoutineListItem])
    }

    @Published private(set) var state: State = .loading

    /// Erststart/Tab-Wechsel: nur laden, wenn noch nichts da ist.
    func loadIfNeeded(api: APIClient, clubId: String) async {
        if case .loaded = state { return }
        await load(api: api, clubId: clubId)
    }

    func load(api: APIClient, clubId: String) async {
        state = .loading
        do {
            async let routinesCall = api.routines(clubId: clubId)
            async let membersCall = api.members(clubId: clubId)
            let (routines, members) = try await (routinesCall, membersCall)
            let scoresById = await Self.scoresByRoutine(api: api, routineIds: routines.map(\.id))
            let membersById = Dictionary(uniqueKeysWithValues: members.map { ($0.id, $0) })

            let items = routines
                .map { routine -> RoutineListItem in
                    let sorted = (scoresById[routine.id] ?? [])
                        .compactMap { score in score.totalScore.map { (score.scoredOn, $0) } }
                        .sorted { $0.0 < $1.0 }
                    let last = sorted.last?.1
                    let previous = sorted.dropLast().last?.1
                    return RoutineListItem(
                        routine: routine,
                        skaters: routine.skaterMemberIds.compactMap { membersById[$0] },
                        lastTotal: last,
                        delta: last.flatMap { l in previous.map { l - $0 } }
                    )
                }
                .sorted {
                    ($0.routine.status.sortRank, $0.routine.title)
                        < ($1.routine.status.sortRank, $1.routine.title)
                }
            state = .loaded(items)
        } catch {
            state = .error(Self.message(for: error))
        }
    }

    /// Wertungen je Kür parallel laden — der Ausfall EINER Kür kippt die Liste
    /// nicht (die Karte zeigt dann „Noch keine Wertung“).
    /// Hinweis (Contract-Lücke, gemeldet): die Listen-Antwort von /routines
    /// trägt keinen letzten Score, daher N Einzel-Calls.
    private static func scoresByRoutine(
        api: APIClient,
        routineIds: [String]
    ) async -> [String: [RoutineScore]] {
        await withTaskGroup(of: (String, [RoutineScore])?.self) { group in
            for id in routineIds {
                group.addTask {
                    guard let scores = try? await api.routineScores(routineId: id) else { return nil }
                    return (id, scores)
                }
            }
            var result: [String: [RoutineScore]] = [:]
            for await pair in group {
                if let (id, scores) = pair { result[id] = scores }
            }
            return result
        }
    }

    /// APIError liefert fertige RFC-7807-Texte; alles andere via localizedDescription.
    static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
