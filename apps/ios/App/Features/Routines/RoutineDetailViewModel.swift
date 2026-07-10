import Foundation

/// Lädt die Detail-Daten einer Kür: Marker + Wertungen (Pflicht) und die
/// Wettkampf-Namen (Beiwerk — ein Ausfall kippt das Detail nicht, die
/// Verlaufszeilen zeigen dann einen generischen Namen).
@MainActor
final class RoutineDetailViewModel: ObservableObject {

    struct Details {
        /// Nach `time_ms` sortiert.
        var markers: [RoutineMarker]
        /// Nach `scored_on` sortiert, nur Einträge mit `total_score`.
        var scores: [RoutineScore]
        /// competition_id → Name.
        var competitionNames: [String: String]
    }

    enum State {
        case loading
        case error(String)
        case loaded(Details)
    }

    @Published private(set) var state: State = .loading

    func loadIfNeeded(api: APIClient, routineId: String, clubId: String) async {
        if case .loaded = state { return }
        await load(api: api, routineId: routineId, clubId: clubId)
    }

    func load(api: APIClient, routineId: String, clubId: String) async {
        state = .loading
        do {
            async let markersCall = api.routineMarkers(routineId: routineId)
            async let scoresCall = api.routineScores(routineId: routineId)
            async let competitionsCall = api.competitions(clubId: clubId)

            let (markers, scores) = try await (markersCall, scoresCall)
            let competitions = (try? await competitionsCall) ?? []

            state = .loaded(Details(
                markers: markers.sorted { ($0.timeMs ?? 0) < ($1.timeMs ?? 0) },
                scores: scores
                    .filter { $0.totalScore != nil }
                    .sorted { $0.scoredOn < $1.scoredOn },
                competitionNames: Dictionary(
                    uniqueKeysWithValues: competitions.map { ($0.id, $0.name) }
                )
            ))
        } catch {
            state = .error(RoutinesViewModel.message(for: error))
        }
    }
}
