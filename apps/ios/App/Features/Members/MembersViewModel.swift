import Foundation
import SwiftUI

/// Zustand + Ladelogik des Features „Mitglieder“.
///
/// Pflicht-Call ist die Vereinsliste (`/clubs/{id}/members`) — Teams,
/// Familienbeziehungen und Rechnungen sind RLS-abhängige Kür und dürfen
/// still fehlen („Beitragsampel wo sichtbar“).
@MainActor
final class MembersViewModel: ObservableObject {

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// Beitragsampel eines Mitglieds — abgeleitet aus den sichtbaren Rechnungen.
    enum FeeStatus: Equatable {
        /// Mindestens eine offene Rechnung; `level` = höchste Mahnstufe.
        case dunning(level: Int)
        /// Rechnungen sichtbar und alle bezahlt.
        case paid
    }

    /// Fehlgeschlagener Rollenwechsel — Grundlage für den Alert im Detail.
    enum RoleChangeFailure: Equatable {
        /// 403 vom Server: „Keine Berechtigung“.
        case forbidden
        /// Alles andere (Transport, 409 Last-Owner, …) mit Klartext.
        case other(String)
    }

    /// Eine Familien-Beziehung aus Sicht des angezeigten Mitglieds.
    struct FamilyLink: Identifiable {
        enum OtherSide { case guardian, child }

        let id: String
        /// Die andere Person der Beziehung.
        let other: ClubMember
        /// Was die andere Person in dieser Beziehung ist.
        let otherIs: OtherSide
        /// Beziehungscode von der API (Seed: „parent“).
        let relation: String
    }

    // MARK: - Published State

    @Published private(set) var state: LoadState = .idle
    @Published var searchText = ""
    @Published var roleFilter: ClubRole?

    @Published private(set) var members: [ClubMember] = []
    @Published private(set) var teams: [Team] = []
    @Published private(set) var guardianships: [Guardianship] = []
    @Published private(set) var invoices: [Invoice] = []

    @Published var roleChangeFailure: RoleChangeFailure?
    @Published private(set) var isChangingRole = false

    // MARK: - Laden

    /// Erstladung über den `.task`-Modifier — lädt nur, wenn noch nichts da ist.
    func loadIfNeeded(api: APIClient, clubId: String) async {
        guard state == .idle else { return }
        await load(api: api, clubId: clubId)
    }

    func load(api: APIClient, clubId: String) async {
        state = .loading

        async let membersCall = api.members(clubId: clubId)
        async let teamsCall = api.teams(clubId: clubId)
        async let guardianshipsCall = api.guardianships(clubId: clubId)
        async let invoicesCall = api.invoices(clubId: clubId)

        do {
            let roster = try await membersCall
            members = roster.sorted { a, b in
                let byLastName = a.lastName.localizedCaseInsensitiveCompare(b.lastName)
                if byLastName != .orderedSame { return byLastName == .orderedAscending }
                return a.firstName.localizedCaseInsensitiveCompare(b.firstName) == .orderedAscending
            }
            state = .loaded
        } catch {
            state = .failed(Self.message(for: error))
        }

        // Kür-Daten: Fehlschläge (RLS, Rolle) bewusst schlucken — die Liste
        // funktioniert auch ohne Team-Namen, Ampel und Familie.
        teams = (try? await teamsCall) ?? []
        guardianships = (try? await guardianshipsCall) ?? []
        invoices = (try? await invoicesCall) ?? []
    }

    // MARK: - Abgeleitete Daten

    var filteredMembers: [ClubMember] {
        members.filter { member in
            if let roleFilter, member.role != roleFilter { return false }
            let query = searchText.trimmingCharacters(in: .whitespaces)
            guard !query.isEmpty else { return true }
            if member.membersFullName.localizedCaseInsensitiveContains(query) { return true }
            if let email = member.email, email.localizedCaseInsensitiveContains(query) { return true }
            return false
        }
    }

    var hasActiveFilter: Bool { roleFilter != nil || !searchText.isEmpty }

    func resetFilters() {
        roleFilter = nil
        searchText = ""
    }

    func member(id: String) -> ClubMember? {
        members.first { $0.id == id }
    }

    /// Team-Namen eines Mitglieds („Sternchen · Minis“) — nil ohne Team
    /// oder wenn `/teams` für die Rolle nicht sichtbar war.
    func teamNames(for member: ClubMember) -> String? {
        let names = member.teamIds.compactMap { teamId in
            teams.first { $0.id == teamId }?.name
        }
        return names.isEmpty ? nil : names.joined(separator: " · ")
    }

    /// Beitragsampel — nil, wenn für dieses Mitglied keine Rechnungen
    /// sichtbar sind (RLS: Mitglieder sehen nur die eigene Familie).
    func feeStatus(for member: ClubMember) -> FeeStatus? {
        let visible = invoices.filter { $0.memberId == member.id }
        let openLevels = visible.filter { $0.status == .open }.map(\.dunningLevel)
        if let worst = openLevels.max() { return .dunning(level: worst) }
        if visible.contains(where: { $0.status == .paid }) { return .paid }
        return nil
    }

    /// Familien-Beziehungen des Mitglieds, aufgelöst gegen die Vereinsliste.
    func familyLinks(of member: ClubMember) -> [FamilyLink] {
        guardianships.compactMap { guardianship in
            if guardianship.guardianMemberId == member.id,
               let child = self.member(id: guardianship.childMemberId) {
                return FamilyLink(
                    id: guardianship.id,
                    other: child,
                    otherIs: .child,
                    relation: guardianship.relation
                )
            }
            if guardianship.childMemberId == member.id,
               let guardian = self.member(id: guardianship.guardianMemberId) {
                return FamilyLink(
                    id: guardianship.id,
                    other: guardian,
                    otherIs: .guardian,
                    relation: guardianship.relation
                )
            }
            return nil
        }
    }

    // MARK: - Rollenwechsel (optimistisch, mit Rollback)

    func changeRole(
        of member: ClubMember,
        to newRole: AssignableClubRole,
        api: APIClient,
        clubId: String
    ) async {
        guard !isChangingRole,
              let index = members.firstIndex(where: { $0.id == member.id }),
              let optimisticRole = ClubRole(rawValue: newRole.rawValue),
              members[index].role != optimisticRole
        else { return }

        let backup = members[index]
        isChangingRole = true
        defer { isChangingRole = false }

        // Sofort zeigen — die Antwort des Servers ersetzt die Zeile danach.
        members[index].role = optimisticRole
        do {
            let updated = try await api.changeMemberRole(
                clubId: clubId,
                memberId: member.id,
                ClubMemberRoleChange(role: newRole)
            )
            if let current = members.firstIndex(where: { $0.id == member.id }) {
                members[current] = updated
            }
        } catch {
            // Rollback: der alte Stand kommt zurück, der Alert erklärt warum.
            if let current = members.firstIndex(where: { $0.id == member.id }) {
                members[current] = backup
            }
            if let apiError = error as? APIError,
               case .problem(let problem) = apiError,
               problem.status == 403 {
                roleChangeFailure = .forbidden
            } else {
                roleChangeFailure = .other(Self.message(for: error))
            }
        }
    }

    // MARK: - Helfer

    private static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
