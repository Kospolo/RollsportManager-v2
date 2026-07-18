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

    /// Sparten-Filter: alle · eine bestimmte Sparte · ausdruecklich ohne Sparte.
    enum SparteFilter: Equatable, Hashable {
        case all
        case sparte(id: String)
        case none
    }

    /// Gruppierung der Liste.
    enum GroupMode: String, CaseIterable, Identifiable {
        case none, team
        var id: String { rawValue }
    }

    /// Eine Gruppe der Liste (bei `groupMode == .none` genau eine, titellos).
    struct MemberGroup: Identifiable {
        let id: String
        /// nil = keine Ueberschrift rendern (ungruppierte Liste).
        let title: String?
        /// true = „Ohne Team" — bekommt einen lokalisierten Titel statt Rohtext.
        let isTeamless: Bool
        let members: [ClubMember]
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
    /// KURATIERT statt „alle sieben Rollen": die Rollen-Chips zeigen nur, was
    /// im Verein wirklich vorkommt (siehe `roleFilterOptions`). Ein Chip, der
    /// garantiert null Treffer liefert, ist kein Filter, sondern Deko.
    @Published var roleFilter: AdminMembersRoleFilter = .all
    /// Sparten-Filter — im iOS-Verzeichnis bisher KOMPLETT gefehlt, obwohl das
    /// Datenmodell (Verein → Sparten → Teams) daran haengt.
    @Published var sparteFilter: SparteFilter = .all
    /// Gruppierung nach Team. Liegt im Toolbar-Menue, NICHT als dritte
    /// Chip-Reihe — vertikaler Platz ist mobil das knappste Gut.
    @Published var groupMode: GroupMode = .none

    @Published private(set) var members: [ClubMember] = []
    @Published private(set) var teams: [Team] = []
    @Published private(set) var sparten: [Sparte] = []
    @Published private(set) var guardianships: [Guardianship] = []
    @Published private(set) var invoices: [Invoice] = []

    @Published var roleChangeFailure: RoleChangeFailure?
    @Published private(set) var isChangingRole = false

    init() {
#if DEBUG
        // Dev-Automation fuer Smoke-Tests: `-devMembersGroup team` startet die
        // Liste gruppiert (nur DEBUG). Gleiches Muster wie `-devTab` in
        // MainTabView — der Gruppierungs-Schalter liegt sonst in einem
        // Toolbar-Menue und ist ohne Tippen nicht beweisbar.
        if UserDefaults.standard.string(forKey: "devMembersGroup") == "team" {
            groupMode = .team
        }
#endif
    }

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
        async let spartenCall = api.listSparten(clubId: clubId)
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
        // funktioniert auch ohne Team-Namen, Sparten, Ampel und Familie.
        // Kommen keine Sparten, verschwindet die Sparten-Chip-Reihe ersatzlos
        // (kein leerer Filter, der nichts filtert).
        teams = (try? await teamsCall) ?? []
        sparten = ((try? await spartenCall) ?? [])
            .filter(\.aktiv)
            .sorted { a, b in
                a.sortierung != b.sortierung
                    ? a.sortierung < b.sortierung
                    : a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
            }
        guardianships = (try? await guardianshipsCall) ?? []
        invoices = (try? await invoicesCall) ?? []
    }

    // MARK: - Abgeleitete Daten

    /// Suchtreffer VOR den Filtern — Grundlage der ehrlichen Chip-Zahlen
    /// (ein Chip zeigt, was sein Antippen liefern wuerde, nicht die Rohzahl).
    var searchedMembers: [ClubMember] {
        let query = searchText.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return members }
        return members.filter { member in
            if member.membersFullName.localizedCaseInsensitiveContains(query) { return true }
            // Das Motto ist durchsuchbar, weil „wer laeuft Kuer?" eine echte
            // Frage ist — das Web sucht genauso im Selbst-Profil.
            if let motto = member.profileMotto,
               motto.localizedCaseInsensitiveContains(query) { return true }
            if let email = member.email, email.localizedCaseInsensitiveContains(query) { return true }
            return false
        }
    }

    /// Rollen- und Sparten-Filter sind ADDITIV — beide greifen nacheinander.
    var filteredMembers: [ClubMember] {
        searchedMembers
            .filter { roleFilter.matches($0) }
            .filter { matchesSparte($0) }
    }

    /// Mitglieder nach Rolle gefiltert (ohne Sparte) — Bezugsmenge der
    /// Sparten-Chips, damit deren Zahlen zum aktiven Rollen-Chip passen.
    private var roleFilteredMembers: [ClubMember] {
        searchedMembers.filter { roleFilter.matches($0) }
    }

    // MARK: - Sparten

    private var sparteIdsByMember: [String: Set<String>] {
        var map: [String: Set<String>] = [:]
        for sparte in sparten {
            for memberId in sparte.memberIds {
                map[memberId, default: []].insert(sparte.id)
            }
        }
        return map
    }

    func matchesSparte(_ member: ClubMember) -> Bool {
        switch sparteFilter {
        case .all: return true
        case .none: return (sparteIdsByMember[member.id]?.isEmpty ?? true)
        case .sparte(let id): return sparteIdsByMember[member.id]?.contains(id) ?? false
        }
    }

    /// Sparten-Chips: „Alle Sparten" · je aktive Sparte · „Ohne Sparte".
    ///
    /// LEER, solange keine einzige Zuordnung existiert. Ein Verein kann Sparten
    /// ANGELEGT haben, ohne sie zu benutzen (so steht es gerade im Seed: zwei
    /// Sparten, null Mitglieder). Dann waere die Reihe eine Zeile aus Nullen —
    /// sie kostet mobil Hoehe und filtert nichts. Sobald die erste Zuordnung da
    /// ist, erscheint sie von selbst.
    var sparteFilterOptions: [(filter: SparteFilter, name: String?, count: Int)] {
        let map = sparteIdsByMember
        guard !sparten.isEmpty, !map.isEmpty else { return [] }
        let base = roleFilteredMembers
        var options: [(SparteFilter, String?, Int)] = [(.all, nil, base.count)]
        for sparte in sparten {
            let count = base.filter { map[$0.id]?.contains(sparte.id) ?? false }.count
            // Eine leere Sparte bleibt als Chip stehen, WENN sie gerade gewaehlt
            // ist — sonst verschwaende der Filter unter dem eigenen Finger.
            guard count > 0 || sparteFilter == .sparte(id: sparte.id) else { continue }
            options.append((.sparte(id: sparte.id), sparte.name, count))
        }
        let without = base.filter { map[$0.id]?.isEmpty ?? true }.count
        if without > 0 || sparteFilter == .none {
            options.append((.none, nil, without))
        }
        return options.map { (filter: $0.0, name: $0.1, count: $0.2) }
    }

    // MARK: - Rollen-Chips (kuratiert)

    /// „Alle" plus die Rollen, die im Verein WIRKLICH besetzt sind. Ein Chip
    /// „Gasttrainer:in" in einem Verein ohne Gasttrainer waere eine Luege ueber
    /// den Verein — und kostet mobil eine Chip-Breite, die wir nicht haben.
    var roleFilterOptions: [(filter: AdminMembersRoleFilter, count: Int)] {
        let base = searchedMembers
        return AdminMembersRoleFilter.allCases.compactMap { filter in
            let count = base.filter { filter.matches($0) }.count
            if filter != .all, count == 0, roleFilter != filter { return nil }
            return (filter: filter, count: count)
        }
    }

    // MARK: - Gruppierung

    /// Die Liste, wie sie gerendert wird: ungruppiert genau eine titellose
    /// Gruppe, nach Team eine Gruppe je Team (Team-Reihenfolge der API) plus
    /// „Ohne Team" am Ende. Mehrfach-Mitgliedschaft zeigt die Person in JEDER
    /// ihrer Gruppen — das ist die Wahrheit, kein Duplikat-Fehler.
    var memberGroups: [MemberGroup] {
        let rows = filteredMembers
        guard groupMode == .team, !teams.isEmpty else {
            return [MemberGroup(id: "all", title: nil, isTeamless: false, members: rows)]
        }
        var groups: [MemberGroup] = teams.compactMap { team in
            let inTeam = rows.filter { $0.teamIds.contains(team.id) }
            guard !inTeam.isEmpty else { return nil }
            return MemberGroup(id: team.id, title: team.name, isTeamless: false, members: inTeam)
        }
        let teamless = rows.filter { member in
            member.teamIds.allSatisfy { id in !teams.contains { $0.id == id } }
        }
        if !teamless.isEmpty {
            groups.append(
                MemberGroup(id: "teamless", title: nil, isTeamless: true, members: teamless)
            )
        }
        return groups
    }

    var hasActiveFilter: Bool {
        roleFilter != .all || sparteFilter != .all
            || !searchText.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func resetFilters() {
        roleFilter = .all
        sparteFilter = .all
        searchText = ""
    }

    func member(id: String) -> ClubMember? {
        members.first { $0.id == id }
    }

    /// Team-Namen eines Mitglieds („Sternchen · Minis“) — nil ohne Team
    /// oder wenn `/teams` für die Rolle nicht sichtbar war.
    func teamNames(for member: ClubMember) -> String? {
        let names = teamNameList(for: member)
        return names.isEmpty ? nil : names.joined(separator: " · ")
    }

    /// Team-Namen als LISTE — die Karte setzt daraus einzelne Badges statt
    /// einer Textzeile mit Trennpunkten.
    func teamNameList(for member: ClubMember) -> [String] {
        member.teamIds.compactMap { teamId in
            teams.first { $0.id == teamId }?.name
        }
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
