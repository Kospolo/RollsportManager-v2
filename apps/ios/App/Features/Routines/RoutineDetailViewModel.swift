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
    /// Läuft gerade ein Marker-POST (Button disabled + Spinner).
    @Published private(set) var isAddingMarker = false
    /// Fehler beim Marker-Anlegen (403 „Keine Berechtigung“ o. Ä.) — Alert.
    @Published var markerError: String?

    func loadIfNeeded(api: APIClient, routineId: String, clubId: String) async {
        if case .loaded = state { return }
        await load(api: api, routineId: routineId, clubId: clubId)
    }

    /// Marker an der aktuellen Abspielposition setzen und den vom Server
    /// zurückgegebenen (mit echter ID) optimistisch in die sortierte
    /// Marker-Liste einschieben. 403 → `markerError` (Alert), Liste unverändert.
    func addMarker(api: APIClient, routineId: String, atMs: Double) async {
        guard case .loaded(var details) = state, !isAddingMarker else { return }
        isAddingMarker = true
        defer { isAddingMarker = false }
        let create = RoutineMarkerCreate(
            timeMs: max(0, Int(atMs.rounded())),
            label: NSLocalizedString("marker.defaultLabel", comment: "Standard-Label neuer Marker")
        )
        do {
            let marker = try await api.addRoutineMarker(routineId: routineId, create)
            details.markers.append(marker)
            details.markers.sort { ($0.timeMs ?? 0) < ($1.timeMs ?? 0) }
            state = .loaded(details)
        } catch {
            markerError = error.isForbiddenAPIError
                ? NSLocalizedString("marker.error.forbidden", comment: "403 beim Marker-Anlegen")
                : RoutinesViewModel.message(for: error)
        }
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
