import Foundation

/// Listen-ViewModel der Ausrüstung: lädt das Inventar (`listEquipment`), die
/// Reservierungen (`listReservations`) und — best effort, für die Mitglieder-
/// Auswahl im Reservieren-Sheet und die Namensauflösung — die Mitgliederliste.
/// „Meine Reservierungen“ wird clientseitig über `reservedByMemberId` gefiltert
/// (der Endpunkt kennt keinen member-Filter). Web-Referenz: /(portal)/ausruestung.
@MainActor
final class EquipmentViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var equipment: [Equipment] = []
    @Published private(set) var reservations: [EquipmentReservation] = []
    @Published private(set) var membersById: [String: ClubMember] = [:]
    /// Aktive Kategorie (Chip-Auswahl).
    @Published var filter: EquipmentCategoryFilter = .all
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt
    /// die Liste durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var clubRole: ClubRole?
    private var hasLoadedOnce = false

    /// Das angemeldete Mitglied (für „Meine Reservierungen“ und die Vorbelegung
    /// im Sheet). Kommt aus `SessionStore.session?.profile`.
    private(set) var currentMemberId = ""
    private(set) var currentMemberName = ""

    /// „Für ein Mitglied reservieren“ ist Trainerstab vorbehalten (Web:
    /// `permissions(user).isTrainer`). Alle anderen buchen fest auf sich selbst;
    /// die verbindliche Durchsetzung bleibt serverseitig.
    private static let managerRoles: Set<ClubRole> = [.owner, .admin, .moderator, .coach, .guestCoach]

    var canSelectMember: Bool {
        guard let clubRole else { return false }
        return Self.managerRoles.contains(clubRole)
    }

    // MARK: - Laden

    func loadIfNeeded(
        api: APIClient,
        clubId: String,
        memberId: String,
        memberName: String,
        clubRole: ClubRole?
    ) async {
        self.api = api
        self.clubId = clubId
        self.currentMemberId = memberId
        self.currentMemberName = memberName
        self.clubRole = clubRole
        guard !hasLoadedOnce else { return }
        hasLoadedOnce = true
        await load(showLoadingState: true)
    }

    func retry() async { await load(showLoadingState: true) }

    /// Pull-to-Refresh und Aktualisierung nach einer Reservierung: kein
    /// Lade-Screen, Fehler nur als Alert. Der Server rechnet die verfügbare
    /// Menge neu — deshalb genügt Neu-Laden statt lokaler Bestandslogik.
    func refresh() async { await load(showLoadingState: false) }

    private func load(showLoadingState: Bool) async {
        guard let api, let clubId else { return }
        if showLoadingState { state = .loading }
        do {
            async let equipmentCall = api.listEquipment(clubId: clubId)
            async let reservationsCall = api.listReservations(clubId: clubId)
            // Mitglieder sind Beiwerk (Namen + Trainer-Auswahl) — ein RLS-403
            // einer Rolle darf Inventar/Reservierungen nicht verhindern.
            async let membersCall = api.members(clubId: clubId)

            let loadedEquipment = try await equipmentCall
            let loadedReservations = try await reservationsCall
            let loadedMembers = (try? await membersCall) ?? []

            self.equipment = loadedEquipment.sorted {
                $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
            }
            self.reservations = loadedReservations
            self.membersById = Dictionary(
                loadedMembers.map { ($0.id, $0) },
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

    // MARK: - Ableitungen (Kategorie-Filter)

    /// Sortierte, eindeutige Kategorien (nur nicht-leere).
    var categories: [String] {
        var set = Set<String>()
        for item in equipment {
            if let category = item.category, !category.isEmpty { set.insert(category) }
        }
        return set.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    var hasUncategorized: Bool {
        equipment.contains { ($0.category ?? "").isEmpty }
    }

    /// Chips erst ab zwei Gruppen zeigen (wie im Web).
    var showFilter: Bool {
        categories.count + (hasUncategorized ? 1 : 0) >= 2
    }

    var visibleEquipment: [Equipment] {
        guard showFilter else { return equipment }
        switch filter {
        case .all:
            return equipment
        case .uncategorized:
            return equipment.filter { ($0.category ?? "").isEmpty }
        case .category(let category):
            return equipment.filter { $0.category == category }
        }
    }

    func count(for filter: EquipmentCategoryFilter) -> Int {
        switch filter {
        case .all:
            return equipment.count
        case .uncategorized:
            return equipment.filter { ($0.category ?? "").isEmpty }.count
        case .category(let category):
            return equipment.filter { $0.category == category }.count
        }
    }

    // MARK: - Ableitungen (Reservierungen)

    /// Ausleihen des angemeldeten Mitglieds — aktiv zuerst, danach nach Beginn
    /// absteigend (identische Ordnung wie die Web-Referenz).
    var myReservations: [EquipmentReservation] {
        reservations
            .filter { $0.reservedByMemberId == currentMemberId }
            .sorted { a, b in
                let byStatus = EquipmentDisplay.statusWeight(a.status) - EquipmentDisplay.statusWeight(b.status)
                return byStatus != 0 ? byStatus < 0 : a.fromAt > b.fromAt
            }
    }

    /// Aktive Mitglieder für die Trainer-Auswahl im Sheet, alphabetisch.
    var selectableMembers: [ClubMember] {
        membersById.values
            .filter { $0.status == .active }
            .sorted { memberName($0).localizedCaseInsensitiveCompare(memberName($1)) == .orderedAscending }
    }

    func memberName(_ member: ClubMember) -> String {
        let name = "\(member.firstName) \(member.lastName)".trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? String(localized: "ausruestung.res.unknownItem") : name
    }

    /// Aufgelöster Name des reservierten Gegenstands (oder Platzhalter).
    func equipmentName(for equipmentId: String) -> String {
        equipment.first { $0.id == equipmentId }?.name
            ?? String(localized: "ausruestung.res.unknownItem")
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
