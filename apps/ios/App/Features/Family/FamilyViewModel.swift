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

    /// True, sobald geladen wurde und weder Kinder noch Bezugspersonen bestehen.
    var isEmpty: Bool { children.isEmpty && guardians.isEmpty }

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
