import Foundation
import SwiftUI

// ============================================================================
// Listen-ViewModel der Teams-Verwaltung (Verwaltung › Teams).
//
// Web-Referenz-UX: apps/web/app/(portal)/verwaltung/teams (TeamsClient +
// derive.ts). Lädt Teams UND Mitglieder des Vereins — die Mitglieder brauchen
// wir für Kader-Namen/-Zählungen und den Kader-Editor. Schreibrechte spiegeln
// nur die Menüführung (is_club_admin); die verbindliche Prüfung bleibt
// serverseitig (403 → Alert, kein lokaler Schein).
// ============================================================================

/// Team-Rolle einer Person im Kader-Editor (VOLL-Replace-Basis).
/// Eigener, präfixierter Typ, damit es keine Kollision mit parallelen
/// Feature-Teams gibt.
enum AdminTeamRole: Hashable {
    case none
    case coach
    case skater
}

/// Kader eines Teams, getrennt nach Trainerstab und Sportler:innen.
struct AdminTeamRoster: Equatable {
    var coaches: [ClubMember]
    var skaters: [ClubMember]
}

@MainActor
final class AdminTeamsViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var teams: [Team] = []
    @Published private(set) var members: [ClubMember] = []
    /// Fehler bei Pull-to-Refresh oder beim Löschen (Alert statt Fehler-Screen,
    /// solange schon Daten stehen).
    @Published var alertMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var clubRole: ClubRole?
    private var hasLoadedOnce = false

    // MARK: - Rechte (nur Menüführung — Server bleibt Autorität)

    /// is_club_admin = moderator/admin/owner. Nur diese Rollen dürfen Teams
    /// verwalten; sonst blenden wir die Aktionen aus (Server verweigert 403).
    var canManage: Bool {
        permissions(clubRole).isClubAdmin
    }

    // MARK: - Laden

    /// Erststart aus `.task` — SessionStore ist erst im View-Environment
    /// verfügbar, deshalb kommen `api`/`clubId`/`clubRole` hier rein.
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
            async let teamsCall = api.teams(clubId: clubId)
            // Mitglieder sind Beiwerk (Namen/Kader) — ein RLS-403 darf die
            // Team-Liste nicht verhindern.
            async let membersCall = api.members(clubId: clubId)

            let teams = try await teamsCall
            let members = (try? await membersCall) ?? []

            self.teams = Self.sortTeams(teams)
            self.members = Self.sortMembers(members)
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

    // MARK: - Mutationen (optimistischer Einschub nach Server-Antwort)

    /// Neu angelegtes oder umbenanntes Team einsortieren (gleiche ID ersetzt).
    func upsert(_ team: Team) {
        if let index = teams.firstIndex(where: { $0.id == team.id }) {
            teams[index] = team
        } else {
            teams.append(team)
        }
        teams = Self.sortTeams(teams)
    }

    /// Team nach erfolgreichem Löschen aus der Liste nehmen.
    func remove(teamId: String) {
        teams.removeAll { $0.id == teamId }
    }

    /// (Soft-)Löschen mit Server-Aufruf. Gibt bei Erfolg `true` zurück; 403/
    /// Transportfehler landen als `alertMessage`. Der Aufruf startet
    /// ausschließlich über die explizite Bestätigung in der View.
    func delete(_ team: Team) async -> Bool {
        guard let api, let clubId else { return false }
        do {
            let deleted = try await api.deleteTeam(clubId: clubId, teamId: team.id)
            remove(teamId: deleted.id.isEmpty ? team.id : deleted.id)
            return true
        } catch {
            alertMessage = error.isForbiddenAPIError
                ? NSLocalizedString("teams.error.forbidden", comment: "403 beim Löschen")
                : Self.friendlyMessage(error)
            return false
        }
    }

    // MARK: - Ableitungen (reine Funktionen über die geladenen Arrays)

    /// Aktueller Kader eines Teams. Roster-Herleitung 1:1 wie die Web-Referenz
    /// (derive.ts): Trainer:in, wenn in `coach_member_ids`; Sportler:in, wenn in
    /// `skater_member_ids` ODER das Team in den `team_ids` der Person steht — und
    /// NICHT bereits Trainer:in (bei Überschneidung gewinnt coach, wie serverseitig).
    func roster(of team: Team) -> AdminTeamRoster {
        let coachSet = Set(team.coachMemberIds)
        let skaterSet = Set(team.skaterMemberIds)
        var coaches: [ClubMember] = []
        var skaters: [ClubMember] = []
        for member in members {
            if coachSet.contains(member.id) {
                coaches.append(member)
            } else if skaterSet.contains(member.id) || member.teamIds.contains(team.id) {
                skaters.append(member)
            }
        }
        return AdminTeamRoster(coaches: Self.sortMembers(coaches), skaters: Self.sortMembers(skaters))
    }

    /// Startbelegung des Kader-Editors: memberId → Team-Rolle.
    func initialRoles(of team: Team) -> [String: AdminTeamRole] {
        let current = roster(of: team)
        var roles: [String: AdminTeamRole] = [:]
        for coach in current.coaches { roles[coach.id] = .coach }
        for skater in current.skaters { roles[skater.id] = .skater }
        return roles
    }

    // MARK: - Helfer

    static func fullName(_ member: ClubMember) -> String {
        "\(member.firstName) \(member.lastName)".trimmingCharacters(in: .whitespaces)
    }

    static func sortTeams(_ list: [Team]) -> [Team] {
        list.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    static func sortMembers(_ list: [ClubMember]) -> [ClubMember] {
        list.sorted {
            let byLast = $0.lastName.localizedCaseInsensitiveCompare($1.lastName)
            if byLast != .orderedSame { return byLast == .orderedAscending }
            return $0.firstName.localizedCaseInsensitiveCompare($1.firstName) == .orderedAscending
        }
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
