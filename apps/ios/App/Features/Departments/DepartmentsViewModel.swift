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
    /// Fehler bei einer Aktion (Löschen) — Alert statt Fehler-Screen, solange
    /// schon Daten stehen.
    @Published var actionError: String?
    /// Abteilungs-ID, die gerade eine Mutation durchläuft (Buttons sperren).
    @Published private(set) var busyId: String?

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
            departments = Self.sorted(list)
            state = .loaded
        } catch {
            state = .failed(Self.message(for: error))
        }
    }

    /// Club-Mitglieder als Array (Pool für Leitungs-/Mitglieder-Auswahl),
    /// nach Nachname/Vorname sortiert.
    var allMembers: [ClubMember] {
        membersById.values.sorted { a, b in
            let byLast = a.lastName.localizedCaseInsensitiveCompare(b.lastName)
            if byLast != .orderedSame { return byLast == .orderedAscending }
            return a.firstName.localizedCaseInsensitiveCompare(b.firstName) == .orderedAscending
        }
    }

    // MARK: - Mutationen (optimistischer Ersatz nach Server-Antwort)

    /// Neu angelegte oder bearbeitete Abteilung einsortieren (gleiche ID ersetzt).
    func upsert(_ department: Department) {
        if let index = departments.firstIndex(where: { $0.id == department.id }) {
            departments[index] = department
        } else {
            departments.append(department)
        }
        departments = Self.sorted(departments)
    }

    /// Abteilung löschen. Der Aufruf startet ausschließlich über die explizite
    /// Bestätigung in der View (kein Auto-Confirm). 403/Fehler landen als
    /// `actionError`; die Liste bleibt unverändert.
    @discardableResult
    func delete(_ department: Department, api: APIClient) async -> Bool {
        guard busyId == nil else { return false }
        busyId = department.id
        defer { busyId = nil }
        do {
            let deleted = try await api.deleteDepartment(departmentId: department.id)
            let removedId = deleted.id.isEmpty ? department.id : deleted.id
            departments.removeAll { $0.id == removedId }
            return true
        } catch {
            actionError = error.isForbiddenAPIError
                ? "Dazu fehlt dir die Berechtigung."
                : Self.message(for: error)
            return false
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

    /// Sortierung: `sort_order` aufsteigend, dann Name (case-insensitive).
    static func sorted(_ list: [Department]) -> [Department] {
        list.sorted { a, b in
            if a.sortOrder != b.sortOrder { return a.sortOrder < b.sortOrder }
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
    }
}
