import Foundation
import SwiftUI

/// Zustand + Ladelogik des Features „Abteilungen“ (Web-Referenz:
/// /(portal)/abteilungen). Rein lesend in diesem Batch.
///
/// Pflicht-Call ist die Abteilungsliste (`GET /departments`) — die Mitglieder-
/// Stammdaten (`listMembers`) sind RLS-abhängige Kür zum Auflösen von Leitung
/// und Roster-Namen. Die reine Mitgliederzahl steht ohnehin am `Department`
/// selbst (`memberIds`), funktioniert also auch ohne sichtbare Stammdaten.
@MainActor
final class DepartmentsViewModel: ObservableObject {

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    // MARK: - Published State

    @Published private(set) var state: LoadState = .idle
    @Published private(set) var departments: [Department] = []
    /// Vereinsmitglieder nach ID — zum Auflösen von Leitung + Roster.
    /// Leer, wenn `listMembers` für die Rolle nicht sichtbar war (RLS).
    @Published private(set) var membersById: [String: ClubMember] = [:]

    // MARK: - Laden

    /// Erstladung über den `.task`-Modifier — lädt nur, wenn noch nichts da ist.
    func loadIfNeeded(api: APIClient, clubId: String) async {
        guard state == .idle else { return }
        await load(api: api, clubId: clubId)
    }

    func load(api: APIClient, clubId: String) async {
        state = .loading

        async let departmentsCall = api.listDepartments(clubId: clubId)
        async let membersCall = api.listMembers(clubId: clubId)

        // Stammdaten zuerst best-effort auflösen (RLS: Mitglieder sehen ggf.
        // nur einen Teil). Fehlschlag ⇒ nur Zahlen, keine Namen/Avatare.
        if let roster = try? await membersCall {
            var map: [String: ClubMember] = [:]
            map.reserveCapacity(roster.count)
            for member in roster { map[member.id] = member }
            membersById = map
        }

        do {
            let list = try await departmentsCall
            departments = list.sorted { a, b in
                if a.sortOrder != b.sortOrder { return a.sortOrder < b.sortOrder }
                return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
            }
            state = .loaded
        } catch {
            state = .failed(Self.message(for: error))
        }
    }

    // MARK: - Abgeleitete Daten

    func department(id: String) -> Department? {
        departments.first { $0.id == id }
    }

    /// Aufgelöste Leitung — nil ohne `leadMemberId` oder wenn die Stammdaten
    /// für die Rolle nicht sichtbar waren.
    func lead(for department: Department) -> ClubMember? {
        guard let id = department.leadMemberId else { return nil }
        return membersById[id]
    }

    /// Mitglieder der Abteilung, aufgelöst gegen die Vereinsliste und nach
    /// Nachname/Vorname sortiert. Leer, wenn die Stammdaten nicht sichtbar sind.
    func roster(for department: Department) -> [ClubMember] {
        department.memberIds
            .compactMap { membersById[$0] }
            .sorted { a, b in
                let byLast = a.lastName.localizedCaseInsensitiveCompare(b.lastName)
                if byLast != .orderedSame { return byLast == .orderedAscending }
                return a.firstName.localizedCaseInsensitiveCompare(b.firstName) == .orderedAscending
            }
    }

    // MARK: - Helfer

    private static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
