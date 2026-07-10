import Foundation
import SwiftUI

/// Formular-State für „Neuer Termin“. Baut aus Datum + Beginn/Ende volle
/// ISO-8601-`date-time`-Strings (der Server verlangt `date-time`, siehe
/// EventsViewModel), validiert im Klartext und postet `EventCreate`.
/// Erfolg: erzeugter `Event` (mit echter ID) fließt via `onCreated` zurück
/// in die Liste; 403 (Rolle ohne Recht) bleibt als Alert im Sheet stehen.
@MainActor
final class NewEventViewModel: ObservableObject {

    /// Feldbezogene Validierungshinweise (Klartext unter dem jeweiligen Feld).
    struct FieldErrors: Equatable {
        var title: LocalizedStringKey?
        var location: LocalizedStringKey?
        var end: LocalizedStringKey?
        var teams: LocalizedStringKey?

        var isEmpty: Bool {
            title == nil && location == nil && end == nil && teams == nil
        }
    }

    // MARK: - Eingaben

    @Published var title = ""
    @Published var type: EventType = .training
    @Published var day = Calendar.current.startOfDay(for: Date())
    @Published var startTime = NewEventViewModel.defaultTime(hour: 17, minute: 0)
    @Published var endTime = NewEventViewModel.defaultTime(hour: 18, minute: 30)
    @Published var location = ""
    @Published var selectedTeamIds: Set<String> = []
    @Published var note = ""

    // MARK: - Zustand

    @Published private(set) var isSaving = false
    @Published var fieldErrors = FieldErrors()
    /// Fehler beim Absenden (403 „Keine Berechtigung“ oder Transportfehler).
    @Published var submitError: String?

    /// Wählbare Teams des Vereins (aus der Liste durchgereicht); leer =
    /// keine Teams lesbar/vorhanden → Team-Auswahl ist dann nicht Pflicht.
    let teams: [Team]

    private let api: APIClient
    private let clubId: String
    private let onCreated: (Event) -> Void

    init(
        api: APIClient,
        clubId: String,
        teams: [Team],
        onCreated: @escaping (Event) -> Void
    ) {
        self.api = api
        self.clubId = clubId
        self.teams = teams.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        self.onCreated = onCreated
#if DEBUG
        applyDevPrefillIfNeeded()
#endif
    }

#if DEBUG
    /// NUR DEBUG/Smoke-Test: füllt das Formular aus Launch-Argumenten
    /// (`-devPrefillEvent YES`, optional `-devEventTitle …`, `-devEventType
    /// competition`, `-devEventDayOffset 4`), damit ein Screenshot das
    /// ausgefüllte Sheet zeigt und der Auto-Submit einen echten POST fahren
    /// kann. Ohne das Flag passiert nichts.
    private func applyDevPrefillIfNeeded() {
        let defaults = UserDefaults.standard
        guard defaults.bool(forKey: "devPrefillEvent") else { return }
        title = defaults.string(forKey: "devEventTitle") ?? "iOS Testtermin Kürgruppe"
        location = defaults.string(forKey: "devEventLocation") ?? "Rundsporthalle Neckarsulm"
        note = "Automatisierter iOS-Smoke-Test"
        if let rawType = defaults.string(forKey: "devEventType"),
           let parsed = EventType(rawValue: rawType) {
            type = parsed
        }
        let offset = defaults.object(forKey: "devEventDayOffset") != nil
            ? defaults.integer(forKey: "devEventDayOffset")
            : 4
        if let future = Calendar.current.date(byAdding: .day, value: offset, to: Date()) {
            day = Calendar.current.startOfDay(for: future)
        }
        if let firstTeam = teams.first {
            selectedTeamIds = [firstTeam.id]
        }
    }
#endif

    // MARK: - Team-Auswahl

    func toggleTeam(_ teamId: String) {
        if selectedTeamIds.contains(teamId) {
            selectedTeamIds.remove(teamId)
        } else {
            selectedTeamIds.insert(teamId)
        }
        fieldErrors.teams = nil
    }

    func isTeamSelected(_ teamId: String) -> Bool {
        selectedTeamIds.contains(teamId)
    }

    // MARK: - Absenden

    /// Validiert und postet. Gibt bei Erfolg `true` zurück (View schließt das
    /// Sheet); bei Validierungs- oder 403-Fehlern `false` (Sheet bleibt offen).
    func submit() async -> Bool {
        guard !isSaving else { return false }

        var errors = FieldErrors()
        if title.trimmed.isEmpty { errors.title = "newEvent.error.titleRequired" }
        if location.trimmed.isEmpty { errors.location = "newEvent.error.locationRequired" }
        if endTime <= startTime { errors.end = "newEvent.error.endBeforeStart" }
        // Team-Pflicht nur, wenn überhaupt Teams wählbar sind (Web-Verhalten).
        if !teams.isEmpty && selectedTeamIds.isEmpty { errors.teams = "newEvent.error.teamsRequired" }
        fieldErrors = errors
        guard errors.isEmpty else { return false }

        let create = EventCreate(
            clubId: clubId,
            type: type,
            title: title.trimmed,
            note: note.trimmed.isEmpty ? nil : note.trimmed,
            location: location.trimmed,
            startsAt: EventsISO.string(from: combine(day: day, time: startTime)),
            endsAt: EventsISO.string(from: combine(day: day, time: endTime)),
            // Reihenfolge stabil halten (Set → sortiertes Array).
            teamIds: teams
                .map(\.id)
                .filter { selectedTeamIds.contains($0) }
        )

        isSaving = true
        defer { isSaving = false }
        do {
            let created = try await api.createEvent(create)
            onCreated(created)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("newEvent.error.forbidden", comment: "403 beim Anlegen")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }

    // MARK: - Helfer

    /// Kalendertag aus `day` + Uhrzeit aus `time` zu einem Zeitpunkt fügen.
    private func combine(day: Date, time: Date) -> Date {
        let calendar = Calendar.current
        let d = calendar.dateComponents([.year, .month, .day], from: day)
        let t = calendar.dateComponents([.hour, .minute], from: time)
        var merged = DateComponents()
        merged.year = d.year
        merged.month = d.month
        merged.day = d.day
        merged.hour = t.hour
        merged.minute = t.minute
        return calendar.date(from: merged) ?? day
    }

    private static func defaultTime(hour: Int, minute: Int) -> Date {
        let calendar = Calendar.current
        return calendar.date(
            bySettingHour: hour,
            minute: minute,
            second: 0,
            of: Date()
        ) ?? Date()
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
