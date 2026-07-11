import Foundation
import SwiftUI

/// Zustand + Ladelogik der Mitglieder-Verwaltung.
///
/// Pflicht-Call ist die Vereinsliste (`/clubs/{id}/members`). Teams (für die
/// Team-Spalte) und Rechnungen (für die Beitragsampel) sind RLS-abhängige Kür
/// und dürfen still fehlen. Schreibpfade (Stammdaten/Rolle) liegen im
/// `AdminMemberEditViewModel`; erfolgreiche Änderungen fließen über
/// `apply(updated:)` zurück in die Liste.
@MainActor
final class AdminMembersViewModel: ObservableObject {

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// Beitragsampel eines Mitglieds — abgeleitet aus den sichtbaren Rechnungen.
    enum FeeStatus: Equatable {
        case dunning(level: Int)
        case paid
    }

    // MARK: - Published State

    @Published private(set) var state: LoadState = .idle
    @Published var searchText = ""
    @Published var roleFilter: AdminMembersRoleFilter = .all
    @Published var statusFilter: AdminMembersStatusFilter = .all

    @Published private(set) var members: [ClubMember] = []
    @Published private(set) var teams: [Team] = []
    @Published private(set) var invoices: [Invoice] = []
    /// `false`, wenn `/teams` für die Rolle nicht sichtbar war (Spalte bleibt leer).
    @Published private(set) var teamsAvailable = false

    // MARK: - Laden

    func loadIfNeeded(api: APIClient, clubId: String) async {
        guard state == .idle else { return }
        await load(api: api, clubId: clubId)
    }

    func load(api: APIClient, clubId: String) async {
        state = .loading

        async let membersCall = api.members(clubId: clubId)
        async let teamsCall = api.teams(clubId: clubId)
        async let invoicesCall = api.invoices(clubId: clubId)

        do {
            members = Self.sorted(try await membersCall)
            state = .loaded
        } catch {
            state = .failed(Self.message(for: error))
        }

        // Kür-Daten: Fehlschläge (RLS, Rolle) bewusst schlucken.
        if let loadedTeams = try? await teamsCall {
            teams = loadedTeams
            teamsAvailable = true
        } else {
            teams = []
            teamsAvailable = false
        }
        invoices = (try? await invoicesCall) ?? []
    }

    // MARK: - Abgeleitete Daten

    var filteredMembers: [ClubMember] {
        searched.filter { roleFilter.matches($0) && statusFilter.matches($0) }
    }

    /// Suche über Name + E-Mail (Grundmenge für Filter und Chip-Zähler).
    private var searched: [ClubMember] {
        let needle = searchText.trimmingCharacters(in: .whitespaces)
        guard !needle.isEmpty else { return members }
        return members.filter { member in
            if member.adminMembersDisplayName.localizedCaseInsensitiveContains(needle) { return true }
            if let email = member.email, email.localizedCaseInsensitiveContains(needle) { return true }
            return false
        }
    }

    var hasActiveFilter: Bool {
        roleFilter != .all || statusFilter != .all || !searchText.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func resetFilters() {
        roleFilter = .all
        statusFilter = .all
        searchText = ""
    }

    /// Rollen-Chip-Zähler folgen der aktiven Status-Auswahl (kombiniert, wie Web).
    func roleCount(_ filter: AdminMembersRoleFilter) -> Int {
        searched.filter { statusFilter.matches($0) && filter.matches($0) }.count
    }

    /// Status-Chip-Zähler folgen der aktiven Rollen-Auswahl.
    func statusCount(_ filter: AdminMembersStatusFilter) -> Int {
        searched.filter { roleFilter.matches($0) && filter.matches($0) }.count
    }

    func member(id: String) -> ClubMember? {
        members.first { $0.id == id }
    }

    /// Team-Namen eines Mitglieds („Sternchen · Minis“) — nil ohne Team oder
    /// wenn `/teams` für die Rolle nicht sichtbar war.
    func teamNames(for member: ClubMember) -> String? {
        let names = member.teamIds.compactMap { id in teams.first { $0.id == id }?.name }
        return names.isEmpty ? nil : names.joined(separator: " · ")
    }

    /// Beitragsampel — nil, wenn für dieses Mitglied keine Rechnungen sichtbar
    /// sind (RLS: Mitglieder sehen nur die eigene Familie).
    func feeStatus(for member: ClubMember) -> FeeStatus? {
        let visible = invoices.filter { $0.memberId == member.id }
        let openLevels = visible.filter { $0.status == .open }.map(\.dunningLevel)
        if let worst = openLevels.max() { return .dunning(level: worst) }
        if visible.contains(where: { $0.status == .paid }) { return .paid }
        return nil
    }

    // MARK: - Rückfluss aus dem Bearbeiten-Sheet

    /// Ersetzt das geänderte Mitglied und hält die Sortierung stabil
    /// (Nachname kann sich geändert haben).
    func apply(updated member: ClubMember) {
        guard let index = members.firstIndex(where: { $0.id == member.id }) else { return }
        members[index] = member
        members = Self.sorted(members)
    }

    // MARK: - Helfer

    private static func sorted(_ list: [ClubMember]) -> [ClubMember] {
        list.sorted { a, b in
            let byLast = a.lastName.localizedCaseInsensitiveCompare(b.lastName)
            if byLast != .orderedSame { return byLast == .orderedAscending }
            return a.firstName.localizedCaseInsensitiveCompare(b.firstName) == .orderedAscending
        }
    }

    private static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
