import Foundation
import SwiftUI

// ============================================================================
// Zustand des LESENDEN Team-Bereichs (Web-Referenz: /(portal)/teams +
// teams/[id]/TeamDetail.tsx).
//
// Pflicht-Calls sind Teams UND Mitglieder — ohne die Mitglieder gäbe es keinen
// Kader mit Namen. Die Sparten sind ANREICHERUNG (Badge im Detail-Kopf): ein
// Fehlschlag darf den Bereich nicht kippen, dann fehlt eben das Badge.
//
// RECHTE: keine. Lesen darf jedes Mitglied; die Staffelung passiert
// serverseitig (redigierte Roster-Zeilen). Es wird hier NICHTS nachgefiltert.
// Vorbild-Aufbau: SpartenViewModel.
// ============================================================================

@MainActor
final class TeamsViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    /// Aufgelöster Kader eines Teams (Trainerstab + Läufer:innen, je in der
    /// Reihenfolge des Servers, Namen aus der Vereinsliste aufgelöst).
    struct Roster: Equatable {
        var coaches: [ClubMember] = []
        var skaters: [ClubMember] = []

        var isEmpty: Bool { coaches.isEmpty && skaters.isEmpty }
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var teams: [Team] = []
    @Published private(set) var members: [ClubMember] = []
    /// Sparte je Sparte-ID (Anreicherung; leer, wenn der Call fehlschlug).
    @Published private(set) var spartenById: [String: Sparte] = [:]
    /// Fehler beim Pull-to-Refresh — Alert statt Fehler-Screen, solange Daten stehen.
    @Published var alertMessage: String?

    private var api: APIClient?
    private var clubId: String?
    /// Mitglieds-ID der angemeldeten Person — markiert „Mein Team".
    private var myMemberId: String?
    private var hasLoadedOnce = false

    private var membersById: [String: ClubMember] = [:]

    // MARK: - Laden

    func loadIfNeeded(api: APIClient, clubId: String, myMemberId: String?) async {
        self.api = api
        self.clubId = clubId
        self.myMemberId = myMemberId
        guard !hasLoadedOnce else { return }
        hasLoadedOnce = true
        await load(showLoadingState: true)
    }

    func retry() async { await load(showLoadingState: true) }

    func refresh() async { await load(showLoadingState: false) }

    private func load(showLoadingState: Bool) async {
        guard let api, let clubId else { return }
        if showLoadingState { state = .loading }
        do {
            async let teamsCall = api.listTeams(clubId: clubId)
            async let membersCall = api.listMembers(clubId: clubId)
            // Sparten sind Beiwerk (Badge im Kopf) — ein Fehlschlag fällt still weg.
            async let spartenCall = api.listSparten(clubId: clubId)

            let loadedTeams = try await teamsCall
            let loadedMembers = try await membersCall
            let loadedSparten = (try? await spartenCall) ?? []

            teams = loadedTeams.sorted {
                $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
            }
            members = loadedMembers
            membersById = Dictionary(uniqueKeysWithValues: loadedMembers.map { ($0.id, $0) })
            spartenById = Dictionary(loadedSparten.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
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

    // MARK: - Ableitungen

    func team(id: String) -> Team? { teams.first { $0.id == id } }

    /// Kader eines Teams — unbekannte IDs (z. B. ausgetretene Personen, die die
    /// Vereinsliste nicht mehr enthält) fallen weg, statt Platzhalter zu erfinden.
    func roster(of team: Team) -> Roster {
        Roster(
            coaches: team.coachMemberIds.compactMap { membersById[$0] },
            skaters: team.skaterMemberIds.compactMap { membersById[$0] }
        )
    }

    /// Sparte des Teams (Migration 0064: höchstens EINE) — `nil`, wenn keine
    /// gesetzt ist oder die Sparten-Liste nicht geladen werden konnte.
    func sparte(of team: Team) -> Sparte? {
        guard let sparteId = team.sparteId else { return nil }
        return spartenById[sparteId]
    }

    /// „Mein Team": die angemeldete Person steht als Läufer:in ODER im
    /// Trainerstab auf dem Kader.
    func isMine(_ team: Team) -> Bool {
        guard let myMemberId else { return false }
        return team.skaterMemberIds.contains(myMemberId) || team.coachMemberIds.contains(myMemberId)
    }

    /// Meine Teams zuerst, danach alphabetisch (der Server sortiert nicht).
    var sortedTeams: [Team] {
        teams.sorted { a, b in
            let mineA = isMine(a), mineB = isMine(b)
            if mineA != mineB { return mineA }
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
    }

    /// Anzeigename eines Mitglieds (Vor- + Nachname, sauber getrimmt).
    static func fullName(_ member: ClubMember) -> String {
        "\(member.firstName) \(member.lastName)".trimmingCharacters(in: .whitespaces)
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
