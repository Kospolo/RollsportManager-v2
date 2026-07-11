import Foundation

/// Listen-ViewModel der Übungsbibliothek: lädt die Übungen des Vereins und —
/// best effort für die Autorennamen — die Mitgliederliste. Die komplette Liste
/// wird EINMAL geladen (ohne Server-Kategorie-Filter), die Kategorie-Auswahl
/// filtert danach clientseitig — so bleiben die Chip-Zähler stabil und der
/// Wechsel ist ohne Netz-Roundtrip sofort sichtbar (1:1 wie im Web).
///
/// Rein lesend: Anlegen/Bearbeiten/Löschen bietet die iOS-API
/// (`Endpoints.swift`) derzeit nicht an (nur `listExercises`).
@MainActor
final class ExercisesViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var exercises: [Exercise] = []
    @Published private(set) var membersById: [String: ClubMember] = [:]
    /// `nil` ⇒ „Alle“; sonst die gewählte Kategorie.
    @Published var selectedCategory: ExerciseCategory?
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt
    /// die Liste durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var hasLoadedOnce = false

    // MARK: - Laden

    /// Erststart aus `.task` — SessionStore ist erst im View-Environment
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
            async let exercisesCall = api.listExercises(clubId: clubId)
            // Mitglieder sind Beiwerk (Autorennamen) — ein RLS-403 einer Rolle
            // darf die Übungsliste nicht verhindern.
            async let membersCall = api.members(clubId: clubId)

            let loaded = try await exercisesCall
            let members = (try? await membersCall) ?? []

            self.exercises = loaded
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

    /// Sichtbare Übungen nach aktuellem Kategorie-Filter.
    var visibleExercises: [Exercise] {
        guard let selectedCategory else { return exercises }
        return exercises.filter { $0.category == selectedCategory }
    }

    var totalCount: Int { exercises.count }

    /// Anzahl Übungen je Kategorie (für die Chip-Zähler).
    func count(for category: ExerciseCategory) -> Int {
        exercises.reduce(into: 0) { partial, exercise in
            if exercise.category == category { partial += 1 }
        }
    }

    /// Aufgelöster Autorenname (Vor- + Nachname) oder `nil`, wenn das Mitglied
    /// nicht (mehr) lesbar ist — die View zeigt dann „Unbekannt“.
    func authorName(for exercise: Exercise) -> String? {
        guard let member = membersById[exercise.createdByMemberId] else { return nil }
        let name = "\(member.firstName) \(member.lastName)"
            .trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? nil : name
    }

    // MARK: - Helfer

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
