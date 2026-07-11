import Foundation
import SwiftUI

/// Zustand + Ladelogik von „Rollen & Rechte“.
///
/// Pflicht-Call ist die Vereinsliste (`/clubs/{id}/members`) — daraus speist
/// sich die Rollen-Schnellzuweisung. Die Rechte-Matrix selbst ist statisch aus
/// `permissions()` abgeleitet und braucht keine Daten.
///
/// Rollenwechsel läuft optimistisch mit Rollback: die Zeile wechselt sofort,
/// die Server-Antwort ersetzt sie; ein Fehler (403 = keine Berechtigung,
/// 409 = letzter Owner, Transport …) rollt zurück und meldet Klartext.
@MainActor
final class RolesViewModel: ObservableObject {

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// Fehlgeschlagener Rollenwechsel — Grundlage für den Alert im Root-View.
    enum RoleChangeFailure: Equatable {
        /// 403 vom Server: „Keine Berechtigung“.
        case forbidden
        /// Alles andere (Transport, 409 letzter Owner, …) mit Klartext.
        case other(String)
    }

    // MARK: - Published State

    @Published private(set) var state: LoadState = .idle
    @Published private(set) var members: [ClubMember] = []
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
        do {
            let roster = try await api.members(clubId: clubId)
            members = rolesSortedByRole(roster)
            state = .loaded
        } catch {
            state = .failed(Self.message(for: error))
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
                role: newRole
            )
            if let current = members.firstIndex(where: { $0.id == member.id }) {
                members[current] = updated
            }
            // Rolle geändert ⇒ Hierarchie-Sortierung auffrischen.
            members = rolesSortedByRole(members)
        } catch {
            // Rollback auf den alten Stand + Klartext-Meldung.
            if let current = members.firstIndex(where: { $0.id == member.id }) {
                members[current] = backup
            }
            roleChangeFailure = error.isForbiddenAPIError
                ? .forbidden
                : .other(Self.message(for: error))
        }
    }

    // MARK: - Helfer

    private static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
