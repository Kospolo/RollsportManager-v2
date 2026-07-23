import Foundation

/// ViewModel des Check-in-Features (QR-Ersatz nativ). Lädt die Check-ins des
/// Vereins (RLS-scoped: Mitglied sieht die eigenen, Trainerstab die des ganzen
/// Vereins), dazu — best effort — die Termine (Terminauswahl) und für den
/// Trainerstab die Mitgliederliste (Namensauflösung + „Mitglied einchecken").
///
/// Loading/Error/Loaded mit Retry (Erst-Laden). Pull-to-Refresh meldet Fehler
/// nur als Alert, statt die schon geladene Liste durch einen Fehler-Screen zu
/// ersetzen. Ein erfolgreicher Check-in wird direkt einsortiert, damit
/// Historie, Kennzahlen und der „heute schon eingecheckt"-Hinweis sofort stimmen.
@MainActor
final class CheckinViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var checkins: [Checkin] = []
    @Published private(set) var events: [Event] = []
    @Published private(set) var membersById: [String: ClubMember] = [:]
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt
    /// Fehler-Screen).
    @Published var refreshErrorMessage: String?

    private(set) var myMemberId: String = ""
    private(set) var myDisplayName: String = ""
    private(set) var myClubId: String = ""
    private(set) var isTrainer: Bool = false

    private var api: APIClient?
    private var clubId: String?
    private var hasLoadedOnce = false

    /// Trainer-Sichtbarkeit exakt wie im Web (permissions.ts `TRAINER_ROLES`):
    /// owner/admin/moderator/coach. `guest_coach` ist serverseitig erlaubt,
    /// wird in der Web-UX aber ausgeblendet — die verbindliche Durchsetzung
    /// bleibt am Server (403 → Hinweis). Selbst-Einchecken kann ohnehin jede
    /// Rolle, das steht unabhängig von diesem Flag.
    private static let trainerRoles: Set<ClubRole> = [.owner, .admin, .moderator, .coach]

    // MARK: - Laden

    /// Erststart aus `.task` — SessionStore ist erst im View-Environment
    /// verfügbar, deshalb kommen API/Verein/Profil hier rein.
    func loadIfNeeded(session: SessionStore) async {
        api = session.api
        clubId = session.clubId
        myClubId = session.clubId
        if let profile = session.session?.profile {
            myMemberId = profile.memberId ?? ""
            myDisplayName = profile.displayName
            isTrainer = profile.clubRole.map { Self.trainerRoles.contains($0) } ?? false
        }
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
            // Check-ins sind Pflicht; Termine sind Beiwerk (die Auswahl bietet
            // immer „Ohne Termin"), ein Fehler dort darf die Liste nicht
            // verhindern.
            async let checkinsCall = api.listCheckins(clubId: clubId)
            async let eventsCall = api.events(clubId: clubId)

            let loadedCheckins = try await checkinsCall
            let loadedEvents = (try? await eventsCall) ?? []

            // Mitglieder nur für den Trainerstab (Namen + „Mitglied
            // einchecken") — best effort, damit ein RLS-Fehler die
            // Vereins-Historie nicht kippt.
            var members: [ClubMember] = []
            if isTrainer {
                members = (try? await api.members(clubId: clubId)) ?? []
            }

            checkins = CheckinLogic.sortedDescending(loadedCheckins)
            events = loadedEvents
            membersById = Dictionary(members.map { ($0.id, $0) }, uniquingKeysWith: { _, newer in newer })
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

    /// Meine Check-ins (clientseitig gefiltert, wie Web über `memberId`).
    var myCheckins: [Checkin] {
        checkins.filter { $0.memberId == myMemberId }
    }

    /// Alle Check-ins des Vereins (Trainer-Historie) — bereits absteigend sortiert.
    var clubCheckins: [Checkin] { checkins }

    var checkedInToday: Bool {
        CheckinLogic.hasCheckinToday(myCheckins, now: Date())
    }

    var stats: CheckinLogic.Stats {
        CheckinLogic.stats(clubCheckins, now: Date())
    }

    var defaultEventId: String {
        CheckinLogic.defaultEventId(events, now: Date())
    }

    var todayEvents: [Event] {
        let now = Date()
        return CheckinLogic.selectableEvents(events, now: now)
            .filter { CheckinLogic.isSameDay($0.startsAt, as: now) }
    }

    var upcomingEvents: [Event] {
        let now = Date()
        return CheckinLogic.selectableEvents(events, now: now)
            .filter { !CheckinLogic.isSameDay($0.startsAt, as: now) }
    }

    /// Aktive Mitglieder alphabetisch (für „Mitglied einchecken", wie Web).
    var activeMembersSorted: [ClubMember] {
        membersById.values
            .filter { $0.status == .active }
            .sorted { lhs, rhs in
                Self.fullName(lhs).localizedCaseInsensitiveCompare(Self.fullName(rhs)) == .orderedAscending
            }
    }

    // MARK: - Auflösung

    func memberName(for memberId: String) -> String {
        guard let member = membersById[memberId] else {
            return String(localized: "checkin.unknownMember")
        }
        let name = Self.fullName(member)
        return name.isEmpty ? String(localized: "checkin.unknownMember") : name
    }

    /// Termin-Titel oder `nil`, wenn der Check-in ohne Termin erfasst wurde.
    func eventTitle(for eventId: String?) -> String? {
        guard let eventId, !eventId.isEmpty else { return nil }
        return eventsById[eventId]?.title ?? String(localized: "checkin.unknownEvent")
    }

    private var eventsById: [String: Event] {
        Dictionary(events.map { ($0.id, $0) }, uniquingKeysWith: { _, newer in newer })
    }

    static func fullName(_ member: ClubMember) -> String {
        "\(member.firstName) \(member.lastName)".trimmingCharacters(in: .whitespaces)
    }

    // MARK: - Erfassen

    /// Check-in erfassen (`method = .manual`, wie Web-Selbst-/Trainer-Einchecken;
    /// `checkedInAt` setzt der Server auf jetzt). Erfolg wird direkt einsortiert.
    /// Fehler (inkl. 403) wirft der Aufrufer aus und übersetzt ihn in einen Hinweis.
    func submitCheckin(memberId: String, eventId: String?) async throws {
        guard let api else { return }
        let normalizedEventId = (eventId?.isEmpty == false) ? eventId : nil
        let input = CheckinCreate(
            clubId: myClubId,
            memberId: memberId,
            eventId: normalizedEventId,
            method: .manual
        )
        let created = try await api.createCheckin(input)
        insert(created)
    }

    private func insert(_ checkin: Checkin) {
        if let index = checkins.firstIndex(where: { $0.id == checkin.id }) {
            checkins[index] = checkin
        } else {
            checkins.append(checkin)
        }
        checkins = CheckinLogic.sortedDescending(checkins)
    }

    /// Reine Fehler-Übersetzung ohne Actor-State — `nonisolated`, damit sie
    /// auch aus dem synchronen View-Kontext (checkinErrorText) aufrufbar ist.
    nonisolated static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
