import Foundation
import SwiftUI

/// Zustand + Ladelogik des Features „Familie“ (Web-Referenz: /(portal)/familie).
///
/// Rein lesend: der Screen zeigt die Familienbeziehungen der eingeloggten
/// Person — „Meine Kinder“ (die Person ist Erziehungsberechtigte:r) und
/// „Eltern & Bezugspersonen“ (die Person ist Kind). Es gibt KEINEN dedizierten
/// Familien-Endpoint; die Ansicht kombiniert `listGuardianships` (Eltern-/Kind-
/// Kanten, RLS-scoped) mit `listMembers` (Stammdaten zum Auflösen der IDs).
/// Team-Namen sind Kür (`teams`) und dürfen still fehlen (RLS/Rolle).
///
/// Alle Typen sind mit „Family…“ präfixiert (Kollisionsschutz Parallel-Teams).
@MainActor
final class FamilyViewModel: ObservableObject {

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    /// Eine aufgelöste Familien-Verknüpfung aus Sicht der eingeloggten Person.
    struct FamilyMember: Identifiable {
        /// Auf welcher Seite die andere Person steht.
        enum Kind { case child, guardian }

        /// Stabile, eindeutige ID der Verknüpfung (= `guardianship.id`).
        let id: String
        let kind: Kind
        /// Die andere Person (Kind bzw. Erziehungsberechtigte:r).
        let member: ClubMember
        /// Beziehungscode von der API (Seed: „parent“).
        let relation: String
        /// Aufgelöste Team-Namen — leer, wenn `/teams` fehlt oder ohne Team.
        let teamNames: [String]
    }

    // MARK: - Published State

    @Published private(set) var state: LoadState = .idle
    /// „Meine Kinder“ — die Person ist Erziehungsberechtigte:r.
    @Published private(set) var children: [FamilyMember] = []
    /// „Eltern & Bezugspersonen“ — die Person ist Kind.
    @Published private(set) var guardians: [FamilyMember] = []

    /// Alle Mitglieder (Stammdaten) — Basis für die Verknüpfungs-Kandidaten.
    @Published private(set) var members: [ClubMember] = []
    /// Eigene Member-ID (zum Ausschließen aus Kandidaten/Kanten).
    private(set) var meId: String = ""
    /// Team-Namen je Team-ID — zum Auflösen der Chips bei lokal ergänzten Kindern.
    private var teamNameById: [String: String] = [:]

    /// True, sobald geladen wurde und weder Kinder noch Bezugspersonen bestehen.
    var isEmpty: Bool { children.isEmpty && guardians.isEmpty }

    /// Verknüpfbare Kandidaten: vereinsverwaltete Mitglieder (Rolle „member“)
    /// OHNE eigenen Zugang (keine E-Mail), die noch nicht mein Kind und nicht
    /// ich selbst sind. Der Server erzwingt die genaue Regel endgültig — dies
    /// ist nur die plausible Vorauswahl (analog Web `linkCandidates`).
    var linkCandidates: [ClubMember] {
        let linkedIds = Set(children.map { $0.member.id })
        return members
            .filter { $0.role == .member
                && ($0.email ?? "").isEmpty
                && $0.id != meId
                && !linkedIds.contains($0.id) }
            .sorted { $0.familyFullName.localizedStandardCompare($1.familyFullName) == .orderedAscending }
    }

    // MARK: - Laden

    /// Erstladung über den `.task`-Modifier — lädt nur, wenn noch nichts da ist.
    func loadIfNeeded(api: APIClient, clubId: String, meId: String) async {
        guard state == .idle else { return }
        await load(api: api, clubId: clubId, meId: meId)
    }

    func load(api: APIClient, clubId: String, meId: String) async {
        state = .loading

        async let guardianshipsCall = api.listGuardianships(clubId: clubId)
        async let membersCall = api.listMembers(clubId: clubId)
        async let teamsCall = api.teams(clubId: clubId)

        do {
            let guardianships = try await guardianshipsCall
            let members = try await membersCall
            // Team-Namen sind Kür: RLS-/Rollen-Fehler bewusst zu „kein Team“.
            let teams = (try? await teamsCall) ?? []

            let memberById = Dictionary(members.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
            let teamNameById = Dictionary(teams.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })

            // Stammdaten für Kandidaten + lokale Ergänzungen vorhalten.
            self.members = members
            self.meId = meId
            self.teamNameById = teamNameById

            func teamNames(_ member: ClubMember) -> [String] {
                member.teamIds.compactMap { teamNameById[$0] }
            }

            // „Meine Kinder“: Kanten, in denen ich Erziehungsberechtigte:r bin.
            children = guardianships
                .filter { $0.guardianMemberId == meId }
                .compactMap { g in
                    guard let child = memberById[g.childMemberId] else { return nil }
                    return FamilyMember(
                        id: g.id, kind: .child, member: child,
                        relation: g.relation, teamNames: teamNames(child)
                    )
                }
                .sorted(by: Self.byName)

            // „Eltern & Bezugspersonen“: Kanten, in denen ich das Kind bin.
            guardians = guardianships
                .filter { $0.childMemberId == meId }
                .compactMap { g in
                    guard let guardian = memberById[g.guardianMemberId] else { return nil }
                    return FamilyMember(
                        id: g.id, kind: .guardian, member: guardian,
                        relation: g.relation, teamNames: teamNames(guardian)
                    )
                }
                .sorted(by: Self.byName)

            state = .loaded
        } catch {
            state = .failed(Self.message(for: error))
        }
    }

    // MARK: - Mutationen (Selfservice)

    /// Team-Namen eines Mitglieds aus dem zuletzt geladenen Team-Verzeichnis.
    private func teamNames(for member: ClubMember) -> [String] {
        member.teamIds.compactMap { teamNameById[$0] }
    }

    /// Frisch angelegtes Kind lokal in die Liste übernehmen (kein Reload-Flash).
    func addCreatedChild(_ created: ChildCreated) {
        if !members.contains(where: { $0.id == created.child.id }) {
            members.append(created.child)
        }
        insertChild(FamilyMember(
            id: created.guardianship.id, kind: .child, member: created.child,
            relation: created.guardianship.relation, teamNames: teamNames(for: created.child)
        ))
    }

    /// Neu verknüpftes, bestehendes Mitglied lokal als Kind übernehmen.
    func addLinkedChild(_ guardianship: Guardianship, member: ClubMember) {
        insertChild(FamilyMember(
            id: guardianship.id, kind: .child, member: member,
            relation: guardianship.relation, teamNames: teamNames(for: member)
        ))
    }

    /// Verknüpfung serverseitig entfernen und die Zeile lokal streichen.
    func deleteGuardianship(id: String, api: APIClient, clubId: String) async throws {
        _ = try await api.deleteGuardianship(clubId: clubId, guardianshipId: id)
        children.removeAll { $0.id == id }
    }

    /// Zeile per guardianshipId einfügen/ersetzen und neu sortieren.
    private func insertChild(_ entry: FamilyMember) {
        var next = children.filter { $0.id != entry.id }
        next.append(entry)
        children = next.sorted(by: Self.byName)
        if state != .loaded { state = .loaded }
    }

    // MARK: - Helfer

    /// Sortierung nach Anzeigename „Vorname Nachname“ (deutsch, ohne Groß-/
    /// Kleinschreibungs-Sprünge) — analog zur Web-Referenz.
    private static func byName(_ a: FamilyMember, _ b: FamilyMember) -> Bool {
        a.member.familyFullName.localizedStandardCompare(b.member.familyFullName) == .orderedAscending
    }

    private static func message(for error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
