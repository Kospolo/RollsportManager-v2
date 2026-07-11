import Foundation

/// Listen-ViewModel des Belegungsplans: lädt die Hallen/Räume des Vereins samt
/// ihren Buchungen und — best effort, nur für Namen/Team-Auswahl — Mitglieder
/// und Teams. Ein RLS-403 auf Mitglieder/Teams darf die Hallen-Liste nicht
/// verhindern (analog `NewsViewModel`). Web-Referenz:
/// apps/web/app/(portal)/belegungsplan/_components/BelegungsplanScreen.tsx.
@MainActor
final class FacilitiesViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    /// Art-Filter der Karten-Liste (`nil` = alle).
    enum KindFilter: Equatable {
        case all
        case kind(FacilityKind)
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var facilities: [Facility] = []
    @Published private(set) var bookings: [FacilityBooking] = []
    @Published private(set) var membersById: [String: ClubMember] = [:]
    @Published private(set) var teams: [Team] = []
    @Published var filter: KindFilter = .all
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt
    /// die Liste durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var currentMemberId: String?
    private var clubRole: ClubRole?
    private var hasLoadedOnce = false

    /// „Trainer:in“ = Trainerstab (COACH_ROLES). Sie dürfen für andere buchen
    /// und den Status setzen; alle anderen buchen fest für sich (Status
    /// „Angefragt“). Die Durchsetzung bleibt serverseitig (RLS + Rollencheck,
    /// 403). Quelle: services/api/src/lib/guards.ts.
    private static let trainerRoles: Set<ClubRole> = [.owner, .admin, .moderator, .coach, .guestCoach]

    var isTrainer: Bool {
        guard let clubRole else { return false }
        return Self.trainerRoles.contains(clubRole)
    }

    // MARK: - Laden

    /// Erststart aus `.task` — SessionStore ist erst im View-Environment
    /// verfügbar, deshalb kommen die Session-Werte hier rein.
    func loadIfNeeded(api: APIClient, clubId: String, memberId: String?, clubRole: ClubRole?) async {
        self.api = api
        self.clubId = clubId
        self.currentMemberId = memberId
        self.clubRole = clubRole
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
            async let facilitiesCall = api.listFacilities(clubId: clubId)
            async let bookingsCall = api.listFacilityBookings(clubId: clubId)
            // Mitglieder (Bucher-Namen, Member-Auswahl) und Teams sind Beiwerk —
            // ein RLS-403 einer Rolle darf die Hallen-Liste nicht verhindern.
            async let membersCall = api.members(clubId: clubId)
            async let teamsCall = api.teams(clubId: clubId)

            let facilities = try await facilitiesCall
            let bookings = try await bookingsCall
            let members = (try? await membersCall) ?? []
            let teams = (try? await teamsCall) ?? []

            self.facilities = facilities.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            self.bookings = bookings
            self.membersById = Dictionary(
                members.map { ($0.id, $0) },
                uniquingKeysWith: { _, newer in newer }
            )
            self.teams = teams
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

    /// Sortierte Mitgliederliste (Nachname, Vorname) für die Trainer:innen-Auswahl.
    var sortedMembers: [ClubMember] {
        membersById.values.sorted {
            let a = "\($0.lastName) \($0.firstName)"
            let b = "\($1.lastName) \($1.firstName)"
            return a.localizedCaseInsensitiveCompare(b) == .orderedAscending
        }
    }

    /// Sichtbare Hallen nach aktivem Art-Filter.
    var visibleFacilities: [Facility] {
        switch filter {
        case .all: facilities
        case .kind(let kind): facilities.filter { $0.kind == kind }
        }
    }

    /// Anzahl Hallen je Art (für die Filter-Chip-Zähler).
    func count(for kind: FacilityKind) -> Int {
        facilities.filter { $0.kind == kind }.count
    }

    /// Buchungen genau dieser Halle (für Detail-Liste + Überschneidungs-Markierung).
    func bookings(for facilityId: String) -> [FacilityBooking] {
        bookings.filter { $0.facilityId == facilityId }
    }

    /// Zahl der kommenden Buchungen dieser Halle (für die Karten-Fußzeile).
    func upcomingCount(for facilityId: String) -> Int {
        BelegungLogic.upcomingBookings(bookings(for: facilityId)).count
    }

    /// Aufgelöster Bucher-Name oder `nil` („Unbekannt“ im View).
    func bookerName(_ booking: FacilityBooking) -> String? {
        BelegungDisplay.memberName(membersById[booking.bookedByMemberId])
    }

    /// Team-Name der Buchung (falls gesetzt und lesbar).
    func teamName(_ teamId: String?) -> String? {
        guard let teamId else { return nil }
        return teams.first { $0.id == teamId }?.name
    }

    /// Teams, aus denen im Buchen-Sheet gewählt werden darf: Trainer:innen alle,
    /// Mitglieder nur die eigenen (Self-Service, Web-Verhalten).
    var bookableTeams: [Team] {
        if isTrainer { return teams }
        guard let currentMemberId, let member = membersById[currentMemberId] else { return [] }
        let own = Set(member.teamIds)
        return teams.filter { own.contains($0.id) }
    }

    var memberId: String? { currentMemberId }

    /// Neu angelegte Buchung (mit echter ID) einfügen — gleiche ID ersetzt.
    func insert(created booking: FacilityBooking) {
        if let index = bookings.firstIndex(where: { $0.id == booking.id }) {
            bookings[index] = booking
        } else {
            bookings.append(booking)
        }
    }

    // MARK: - Helfer

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
