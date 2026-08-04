import Foundation

/// Listen-ViewModel des Medaillen-Features: lädt die Erfolge des Vereins und
/// (best-effort) das Mitglieder-Roster für Namen/Avatare, leitet „Meine
/// Medaillen“ (eigenes Mitglied) und die gefilterte Vereins-Vitrine ab.
///
/// Schreiben (Erfolg vergeben) bleibt serverseitig auf den Trainerstab
/// beschränkt (RLS); `canManage` blendet die Aktion nur kosmetisch ein — ein
/// 403 wird im Sheet als Klartext gezeigt. Web-Referenz: (portal)/medaillen.
@MainActor
final class AchievementsViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var achievements: [MedalAchievement] = []
    @Published private(set) var membersById: [String: ClubMember] = [:]
    @Published var filter: MedalFilter = .all
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt
    /// die Liste durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var currentMemberId: String?
    private var role: ClubRole?
    private var hasLoadedOnce = false

    /// Rollen des Trainerstabs mit Schreibrecht auf Erfolge (gegen den
    /// Dev-Stack verifiziert: owner/admin/coach/guest_coach = 201,
    /// treasurer/member = 403). Nur Sichtbarkeit — die API entscheidet.
    private static let coachRoles: Set<ClubRole> = [.owner, .admin, .coach, .guestCoach]

    // MARK: - Laden

    /// Erststart aus `.task` — SessionStore ist erst im View-Environment
    /// verfügbar, deshalb kommen `api`/`clubId`/Identität hier rein.
    func loadIfNeeded(
        api: APIClient,
        clubId: String,
        currentMemberId: String?,
        role: ClubRole?
    ) async {
        self.api = api
        self.clubId = clubId
        self.currentMemberId = currentMemberId
        self.role = role
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
            // Erfolge sind Pflicht; das Roster (Namen/Avatare) ist Beiwerk —
            // ein RLS-403 auf Mitglieder darf die Vitrine nicht verhindern.
            async let achievementsCall = api.medaillenList(clubId: clubId)
            async let membersCall = api.members(clubId: clubId)

            let loaded = try await achievementsCall
            let members = (try? await membersCall) ?? []

            self.achievements = loaded
            self.membersById = Dictionary(
                members.map { ($0.id, $0) },
                uniquingKeysWith: { _, newer in newer }
            )
            state = .loaded
        } catch {
            let message = Self.friendlyMessage(error)
            if state == .loaded, !showLoadingState {
                refreshErrorMessage = message
            } else {
                state = .error(message)
            }
        }
    }

    // MARK: - Ableitungen

    /// Darf die Rolle Erfolge vergeben (nur Sichtbarkeit der Aktion)?
    var canManage: Bool {
        guard let role else { return false }
        return Self.coachRoles.contains(role)
    }

    /// „Meine Medaillen“ — Erfolge des eingeloggten Mitglieds (server-sortiert,
    /// Reihenfolge bleibt erhalten).
    var mine: [MedalAchievement] {
        guard let currentMemberId else { return [] }
        return achievements.filter { $0.memberId == currentMemberId }
    }

    /// Gefilterte Vereins-Vitrine (Reihenfolge = API-Sortierung achieved_on desc).
    var visibleClubAchievements: [MedalAchievement] {
        achievements.filter { filter.matches($0) }
    }

    /// Mitglieder-Auflösung für die Vereins-Vitrine (Avatar + Name).
    func member(for achievement: MedalAchievement) -> ClubMember? {
        membersById[achievement.memberId]
    }

    /// Für die Vergabe-Auswahl: Mitglieder alphabetisch (Nachname, Vorname).
    var sortedMembers: [ClubMember] {
        membersById.values.sorted { lhs, rhs in
            let byLast = lhs.lastName.localizedCaseInsensitiveCompare(rhs.lastName)
            if byLast != .orderedSame { return byLast == .orderedAscending }
            return lhs.firstName.localizedCaseInsensitiveCompare(rhs.firstName) == .orderedAscending
        }
    }

    /// Neu vergebenen Erfolg (mit echter ID) einfügen; die Ableitungen (mine/
    /// Vitrine) aktualisieren sich. Neuere achieved_on zuerst (wie die API).
    func insert(created achievement: MedalAchievement) {
        if let index = achievements.firstIndex(where: { $0.id == achievement.id }) {
            achievements[index] = achievement
        } else {
            achievements.append(achievement)
            achievements.sort { $0.achievedOn > $1.achievedOn }
        }
    }

    /// Bearbeiteten Erfolg lokal ersetzen; Sortierung (achieved_on desc) halten,
    /// da sich das Datum geändert haben kann.
    func apply(updated achievement: MedalAchievement) {
        guard let index = achievements.firstIndex(where: { $0.id == achievement.id }) else { return }
        achievements[index] = achievement
        achievements.sort { $0.achievedOn > $1.achievedOn }
    }

    /// Gelöschten Erfolg lokal entfernen (die Ableitungen aktualisieren sich).
    func remove(id: String) {
        achievements.removeAll { $0.id == id }
    }

    // MARK: - Helfer

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
