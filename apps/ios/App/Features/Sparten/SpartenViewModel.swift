import Foundation
import SwiftUI

// ============================================================================
// Listen-ViewModel der Sparten-Verwaltung (Web-Referenz: /(portal)/sparten).
//
// Lädt die Sparten UND die Teams des Vereins — die Teams brauchen wir nur für
// die Team-Zahl je Sparte (Kachel). Schreibrechte spiegeln nur die Menüführung
// (can_manage_sparten = owner/admin/treasurer + Plattform-Admin); die
// verbindliche Prüfung bleibt serverseitig (403 → Alert, kein lokaler Schein).
// Vorbild-Aufbau: DepartmentsViewModel + AdminTeamsViewModel.
// ============================================================================

@MainActor
final class SpartenViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var sparten: [Sparte] = []
    /// Team-Zahl je Sparte-ID (nur Zählung; die Teams selbst zeigen wir hier nicht).
    @Published private(set) var teamCountBySparte: [String: Int] = [:]
    /// Fehler bei Refresh/(De)Aktivieren/Löschen — Alert statt Fehler-Screen,
    /// solange schon Daten stehen.
    @Published var alertMessage: String?
    /// Sparte-ID, die gerade eine Mutation durchläuft (Buttons sperren).
    @Published private(set) var busyId: String?

    private var api: APIClient?
    private var clubId: String?
    private var clubRole: ClubRole?
    private var hasLoadedOnce = false

    // MARK: - Rechte (nur Menüführung — Server bleibt Autorität)

    /// can_manage_sparten = owner/admin/treasurer (+ Plattform-Admin). NICHT
    /// moderator/coach/member. Nur diese Rollen sehen die Verwaltungsaktionen.
    var canManage: Bool {
        permissions(clubRole).canManageSparten
    }

    // MARK: - Laden

    func loadIfNeeded(api: APIClient, clubId: String, clubRole: ClubRole?) async {
        self.api = api
        self.clubId = clubId
        self.clubRole = clubRole
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
            async let spartenCall = api.listSparten(clubId: clubId)
            // Teams sind Beiwerk (nur Zählung) — ein RLS-403 darf die
            // Sparten-Liste nicht verhindern.
            async let teamsCall = api.teams(clubId: clubId)

            let sparten = try await spartenCall
            let teams = (try? await teamsCall) ?? []

            self.sparten = Self.sort(sparten)
            self.teamCountBySparte = Self.countTeams(teams)
            state = .loaded
        } catch {
            let message = Self.friendlyMessage(error)
            if state == .loaded, !showLoadingState {
                alertMessage = message
            } else {
                state = .error(message)
            }
        }
    }

    // MARK: - Mutationen (optimistischer Ersatz nach Server-Antwort)

    /// Neu angelegte oder bearbeitete Sparte einsortieren (gleiche ID ersetzt).
    func upsert(_ sparte: Sparte) {
        if let index = sparten.firstIndex(where: { $0.id == sparte.id }) {
            sparten[index] = sparte
        } else {
            sparten.append(sparte)
        }
        sparten = Self.sort(sparten)
    }

    /// (De)aktivieren per PATCH — optimistisch nach Server-Antwort. 403/Fehler
    /// landen als `alertMessage`; die Liste bleibt unverändert.
    func toggleActive(_ sparte: Sparte) async {
        guard let api, let clubId, busyId == nil else { return }
        busyId = sparte.id
        defer { busyId = nil }
        do {
            let updated = try await api.updateSparte(
                clubId: clubId,
                sparteId: sparte.id,
                SparteUpdate(aktiv: !sparte.aktiv)
            )
            upsert(updated)
        } catch {
            alertMessage = friendlyForbidden(error)
        }
    }

    /// (Soft-)Löschen mit Server-Aufruf. Der Aufruf startet ausschließlich über
    /// die explizite Bestätigung in der View (kein Auto-Confirm). 403/Fehler
    /// landen als `alertMessage`.
    @discardableResult
    func delete(_ sparte: Sparte) async -> Bool {
        guard let api, let clubId, busyId == nil else { return false }
        busyId = sparte.id
        defer { busyId = nil }
        do {
            let deleted = try await api.deleteSparte(clubId: clubId, sparteId: sparte.id)
            let removedId = deleted.id.isEmpty ? sparte.id : deleted.id
            sparten.removeAll { $0.id == removedId }
            return true
        } catch {
            alertMessage = friendlyForbidden(error)
            return false
        }
    }

    // MARK: - Ableitungen

    func teamCount(for sparte: Sparte) -> Int { teamCountBySparte[sparte.id] ?? 0 }

    // MARK: - Helfer

    private func friendlyForbidden(_ error: Error) -> String {
        error.isForbiddenAPIError
            ? NSLocalizedString("sparten.error.forbidden", comment: "403 bei Sparten-Aktion")
            : Self.friendlyMessage(error)
    }

    static func sort(_ list: [Sparte]) -> [Sparte] {
        list.sorted { a, b in
            if a.sortierung != b.sortierung { return a.sortierung < b.sortierung }
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
    }

    static func countTeams(_ teams: [Team]) -> [String: Int] {
        var map: [String: Int] = [:]
        for team in teams {
            guard let sparteId = team.sparteId else { continue }
            map[sparteId, default: 0] += 1
        }
        return map
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
