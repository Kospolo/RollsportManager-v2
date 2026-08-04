import Foundation
import SwiftUI

// ============================================================================
// Trainingsplan — Listen-ViewModel + reine Wochentags-Ableitungen.
//
// Web-Referenz: apps/web/app/(portal)/trainingsplan (Screen + helpers.ts).
// Dieser Batch ist REIN LESEND (Anlegen/Bearbeiten/Löschen kommt später).
//
// Datenquelle: session.api.listTrainingSlots(clubId:) — Slots sind
// server-sortiert (Wochentag + Startzeit). Team-/Trainer:innen-Namen sind
// Anreicherung (best-effort): ein RLS-403 einer Rolle darf den Plan nicht
// verhindern (analog EventsViewModel). Hallen-Namen sind auf iOS nicht
// auflösbar (kein Facilities-Endpoint) — der Freitext-Ort bleibt sichtbar.
// ============================================================================

@MainActor
final class TrainingPlanViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var slots: [TrainingSlot] = []
    @Published private(set) var teamsById: [String: Team] = [:]
    @Published private(set) var membersById: [String: ClubMember] = [:]
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt
    /// Fehler-Screen — die Liste bleibt stehen).
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
            async let slotsCall = api.listTrainingSlots(clubId: clubId)
            // Teams + Roster sind Beiwerk (Team-Pill, Trainer:innen-Name) —
            // ein RLS-403 einer Rolle darf den Plan nicht verhindern.
            async let teamsCall = api.teams(clubId: clubId)
            async let membersCall = api.members(clubId: clubId)

            let slots = try await slotsCall
            let teams = (try? await teamsCall) ?? []
            let members = (try? await membersCall) ?? []

            self.slots = slots
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

    // MARK: - Lokale Mutationen (nach Bearbeiten/Löschen)

    /// Aktualisierten Slot lokal ersetzen (ohne Neu-Laden) — die Wochengruppen
    /// werden daraus abgeleitet und sortieren sich neu.
    func replace(_ slot: TrainingSlot) {
        guard let idx = slots.firstIndex(where: { $0.id == slot.id }) else { return }
        slots[idx] = slot
    }

    /// Gelöschten Slot lokal entfernen (ohne Neu-Laden).
    func remove(id: String) {
        slots.removeAll { $0.id == id }
    }

    // MARK: - Ableitungen

    /// Alle sieben Tage Mo–So (auch leere) — das mobile Wochenraster zeigt die
    /// ganze Woche, damit „Heute“ und trainingsfreie Tage sichtbar bleiben.
    var weekGroups: [TrainingWeekdayGroup] {
        TrainingPlanGrouping.groupByWeekday(slots, includeEmpty: true)
    }

    /// Team-Name für die Karten-Pille — nil ⇒ „Ganzer Verein“.
    func teamName(for teamId: String?) -> String? {
        guard let teamId else { return nil }
        return teamsById[teamId]?.name
    }

    /// Trainer:innen-Name (Vor- + Nachname) — nil, wenn kein:e Trainer:in
    /// gesetzt ist oder das Roster nicht lesbar war.
    func coachName(for memberId: String?) -> String? {
        guard let memberId, let member = membersById[memberId] else { return nil }
        return "\(member.firstName) \(member.lastName)"
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}

// MARK: - Reine Wochentags-Ableitungen (Spiegel von helpers.ts)

/// Ein Wochentag mit seinen Slots (Mo … So). `weekday`: 0 = Montag … 6 =
/// Sonntag (Backend-Konvention, migration 0010) — NICHT `Date`-Wochentage.
struct TrainingWeekdayGroup: Identifiable, Equatable {
    let weekday: Int
    let slots: [TrainingSlot]
    var id: Int { weekday }
}

enum TrainingPlanGrouping {

    /// Anzeige-Reihenfolge Mo … So (deckt sich mit der Backend-Konvention 0..6).
    static let weekdayOrder: [Int] = [0, 1, 2, 3, 4, 5, 6]

    /// Heutiger Backend-Wochentag. `Calendar.weekday` (1 = So … 7 = Sa) →
    /// Backend (0 = Mo … 6 = So): `(weekday + 5) % 7`.
    static func todayWeekday(_ date: Date = Date(), calendar: Calendar = .current) -> Int {
        (calendar.component(.weekday, from: date) + 5) % 7
    }

    /// 'HH:MM:SS' | 'HH:MM' → 'HH:MM' (Sekunden abschneiden).
    static func hhmm(_ time: String) -> String {
        String(time.prefix(5))
    }

    /// Zeitspanne eines Slots als 'HH:MM–HH:MM' (echter Halbgeviertstrich).
    static func timeRange(_ slot: TrainingSlot) -> String {
        "\(hhmm(slot.startsTime))–\(hhmm(slot.endsTime))"
    }

    /// Slots nach Wochentag, dann Startzeit sortieren (Server liefert bereits
    /// sortiert — defensive Ableitung, falls sich das ändert).
    static func sortSlots(_ slots: [TrainingSlot]) -> [TrainingSlot] {
        slots.sorted { a, b in
            a.weekday != b.weekday ? a.weekday < b.weekday : a.startsTime < b.startsTime
        }
    }

    /// Slots je Wochentag gruppieren. `includeEmpty` = true liefert alle sieben
    /// Tage (auch leere) — fürs Wochenraster.
    static func groupByWeekday(_ slots: [TrainingSlot], includeEmpty: Bool) -> [TrainingWeekdayGroup] {
        var byWeekday: [Int: [TrainingSlot]] = [:]
        for slot in sortSlots(slots) {
            byWeekday[slot.weekday, default: []].append(slot)
        }
        return weekdayOrder.compactMap { weekday in
            let daySlots = byWeekday[weekday] ?? []
            guard includeEmpty || !daySlots.isEmpty else { return nil }
            return TrainingWeekdayGroup(weekday: weekday, slots: daySlots)
        }
    }

    /// String-Catalog-Key des Wochentags (0 = Mo … 6 = So).
    static func weekdayLabelKey(_ weekday: Int) -> LocalizedStringKey {
        switch weekday {
        case 0: return "trainingsplan.weekday.mon"
        case 1: return "trainingsplan.weekday.tue"
        case 2: return "trainingsplan.weekday.wed"
        case 3: return "trainingsplan.weekday.thu"
        case 4: return "trainingsplan.weekday.fri"
        case 5: return "trainingsplan.weekday.sat"
        default: return "trainingsplan.weekday.sun"
        }
    }
}
