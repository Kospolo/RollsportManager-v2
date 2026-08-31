import Foundation

/// Lädt und hält die Dashboard-Daten (Loading/Error/Loaded) und kümmert
/// sich ums Aufgaben-Abhaken — optimistisch mit Rollback.
///
/// Der APIClient kommt IMMER aus dem SessionStore (`session.api`) und wird
/// pro Aufruf hereingereicht — so greifen Token-Wechsel/Logout automatisch.
@MainActor
final class DashboardViewModel: ObservableObject {
    @Published private(set) var state: DashboardLoadState = .loading
    /// Trial-/Lizenz-Hinweis (nil = Abo aktiv oder unbekannt).
    @Published private(set) var trialBanner: TrialBanner?
    /// Fehler beim Abhaken einer Aufgabe (der Haken springt dann zurück).
    @Published var taskError: String?
    /// Fehler beim Pull-to-Refresh, wenn schon Daten auf dem Schirm sind —
    /// die bleiben stehen, der Fehler kommt als Banner.
    @Published var refreshError: String?
    /// Aufgaben, deren PATCH gerade läuft (Zeile gesperrt, Spinner).
    @Published private(set) var pendingTaskIds: Set<String> = []

    /// Wie weit „demnächst“ reicht (Kalendertage ab heute 0:00).
    static let upcomingWindowDays = 14

    private var hasLoaded = false

    // MARK: - Laden

    /// Erstes Laden beim Erscheinen — lädt genau einmal (`.task` feuert
    /// bei Tab-Wechseln erneut).
    func loadIfNeeded(api: APIClient, clubId: String) async {
        guard !hasLoaded else { return }
        hasLoaded = true
        state = .loading
        await load(api: api, clubId: clubId, keepContentOnError: false)
    }

    /// Pull-to-Refresh: lädt still neu; bei Fehlern bleiben die alten
    /// Daten stehen (nur Banner).
    func refresh(api: APIClient, clubId: String) async {
        await load(api: api, clubId: clubId, keepContentOnError: true)
    }

    /// Retry-Button im Fehlerzustand.
    func retry(api: APIClient, clubId: String) async {
        state = .loading
        await load(api: api, clubId: clubId, keepContentOnError: false)
    }

    private func load(api: APIClient, clubId: String, keepContentOnError: Bool) async {
        refreshError = nil
        let now = Date()
        let calendar = Calendar.current
        let windowStart = calendar.startOfDay(for: now)
        let windowEnd = calendar.date(
            byAdding: .day, value: Self.upcomingWindowDays, to: windowStart
        ) ?? windowStart

        do {
            // Alle fünf Quellen parallel — das Dashboard ist ein Sammelblick.
            async let members = api.members(clubId: clubId)
            async let events = api.events(
                clubId: clubId,
                // Volles date-time — die API lehnt reines yyyy-MM-dd mit 400 ab.
                from: DashboardFormat.apiDateTime(windowStart),
                to: DashboardFormat.apiDateTime(windowEnd)
            )
            async let competitions = api.competitions(clubId: clubId)
            async let invoices = api.invoices(clubId: clubId)
            async let tasks = api.tasks(clubId: clubId)

            let (loadedMembers, loadedEvents, loadedCompetitions, loadedInvoices, loadedTasks) =
                try await (members, events, competitions, invoices, tasks)

            state = .loaded(
                DashboardData(
                    members: loadedMembers,
                    events: loadedEvents,
                    competitions: loadedCompetitions,
                    invoices: loadedInvoices,
                    tasks: loadedTasks,
                    now: now
                )
            )
            // Trial-/Lizenz-Status best effort — ein RLS-403 darf das Dashboard
            // NICHT kippen. Bezahlung läuft bewusst NICHT in-App (Apple-IAP),
            // der Banner informiert nur.
            await loadTrialBanner(api: api, clubId: clubId)
        } catch {
            let message = (error as? APIError)?.errorDescription ?? error.localizedDescription
            if keepContentOnError, case .loaded = state {
                refreshError = message
            } else {
                state = .error(message)
            }
        }
    }

    // MARK: - Trial-/Lizenz-Status

    private func loadTrialBanner(api: APIClient, clubId: String) async {
        guard let ents = try? await api.entitlements(clubId: clubId),
              let lic = ents.first(where: { $0.entitlement == "club_license" }) else {
            trialBanner = nil; return
        }
        let status = lic.status ?? "active"
        let until = lic.validUntil.flatMap(Self.parseServerDate)
        let expired = until.map { $0 < Date() } ?? false
        if status == "trial", let until, !expired {
            let days = max(0, Calendar.current.dateComponents([.day], from: Date(), to: until).day ?? 0)
            trialBanner = .init(kind: .trial(daysLeft: days))
        } else if expired || (status != "active" && status != "trial") {
            trialBanner = .init(kind: .expired)
        } else {
            trialBanner = nil
        }
    }

    /// Server-Datum tolerant parsen: ISO-8601 (mit Zeit) oder reines yyyy-MM-dd.
    private static func parseServerDate(_ raw: String) -> Date? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: raw) { return d }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) { return d }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"
        return f.date(from: String(raw.prefix(10)))
    }

    // MARK: - Aufgaben abhaken (optimistisch mit Rollback)

    func toggleTask(_ task: Task, api: APIClient) async {
        guard
            !pendingTaskIds.contains(task.id),
            case .loaded(var data) = state,
            let index = data.tasks.firstIndex(where: { $0.id == task.id })
        else { return }

        let newDone = !data.tasks[index].done
        pendingTaskIds.insert(task.id)
        taskError = nil
        defer { pendingTaskIds.remove(task.id) }

        // Optimistisch: Haken sofort setzen, Reihenfolge NICHT neu sortieren
        // (kein Springen unterm Finger).
        data.tasks[index].done = newDone
        state = .loaded(data)

        do {
            let updated = try await api.setTaskDone(taskId: task.id, done: newDone)
            if case .loaded(var current) = state,
               let currentIndex = current.tasks.firstIndex(where: { $0.id == task.id }) {
                current.tasks[currentIndex] = updated
                state = .loaded(current)
            }
        } catch {
            // Rollback: Haken zurück, Fehler in Klartext (z. B. 403 für member).
            if case .loaded(var current) = state,
               let currentIndex = current.tasks.firstIndex(where: { $0.id == task.id }) {
                current.tasks[currentIndex].done = !newDone
                state = .loaded(current)
            }
            taskError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}

/// Trial-/Lizenz-Hinweis fürs Dashboard. Rein informativ — Kauf läuft im Web.
struct TrialBanner: Equatable {
    enum Kind: Equatable {
        case trial(daysLeft: Int)
        case expired
    }
    let kind: Kind
}
