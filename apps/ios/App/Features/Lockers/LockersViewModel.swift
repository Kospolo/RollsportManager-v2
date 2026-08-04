import Foundation

/// Listen-ViewModel der Schließfächer: lädt das Fach-Inventar (`listLockers`)
/// und — best effort, zur Namensauflösung des belegenden Mitglieds — die
/// Mitgliederliste (`members`). Rein lesend in diesem Batch; Zuordnen/Freigeben
/// (LockerAssign/LockerUpdate liegen im Contract bereit) folgen später.
/// Web-Referenz: /(portal)/schliessfaecher.
///
/// Der APIClient kommt IMMER aus dem `SessionStore` (`session.api`) und wird in
/// `loadIfNeeded` hereingereicht — nie selbst gebaut, damit Token-Wechsel/Logout
/// automatisch greifen.
@MainActor
final class LockersViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case error(String)
        case loaded
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var lockers: [Locker] = []
    @Published private(set) var membersById: [String: ClubMember] = [:]
    /// Mietverträge des Vereins (Beiwerk zur Fach-Liste — ein RLS-403 darf das
    /// Inventar nicht verhindern). Quelle für laufende Miete + Monatssumme.
    @Published private(set) var rentals: [LockerRental] = []
    /// Aktiver Status-Filter (Chip-Auswahl).
    @Published var filter: LockerStatusFilter = .all
    /// Fehler beim Pull-to-Refresh, wenn schon Daten da sind (Alert statt die
    /// Liste durch einen Fehler-Screen zu ersetzen).
    @Published var refreshErrorMessage: String?

    private var api: APIClient?
    private var clubId: String?
    private var hasLoadedOnce = false

    // MARK: - Laden

    func loadIfNeeded(api: APIClient, clubId: String) async {
        self.api = api
        self.clubId = clubId
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
            async let lockersCall = api.listLockers(clubId: clubId)
            // Mitglieder sind Beiwerk (Namensauflösung der Belegung) — ein
            // RLS-403 einer Rolle darf das Fach-Inventar nicht verhindern.
            async let membersCall = api.members(clubId: clubId)
            // Mietverträge ebenso best effort (Geld-Ebene über der Zuordnung).
            async let rentalsCall = api.listLockerRentals(clubId: clubId)

            let loadedLockers = try await lockersCall
            let loadedMembers = (try? await membersCall) ?? []
            self.rentals = (try? await rentalsCall) ?? []

            self.lockers = loadedLockers.sorted {
                $0.label.localizedStandardCompare($1.label) == .orderedAscending
            }
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

    // MARK: - Ableitungen (Status-Filter)

    /// Anzahl je Status (frei/belegt/defekt) über den gesamten Bestand.
    var counts: [LockerStatus: Int] {
        var base: [LockerStatus: Int] = [.free: 0, .assigned: 0, .broken: 0]
        for locker in lockers { base[locker.status, default: 0] += 1 }
        return base
    }

    /// Sichtbare Fächer nach aktivem Filter.
    var visibleLockers: [Locker] {
        lockers.filter { filter.matches($0) }
    }

    /// Chip-Zähler für einen Filterwert.
    func count(for filter: LockerStatusFilter) -> Int {
        switch filter {
        case .all: return lockers.count
        case .status(let status): return counts[status] ?? 0
        }
    }

    // MARK: - Ableitungen (Belegung)

    /// Aufgelöster Name des belegenden Mitglieds — `nil`, wenn nicht belegt.
    /// Bei belegtem Fach ohne auflösbaren Namen (fremdes Mitglied per RLS
    /// nicht geladen) liefert die View den Platzhalter „Unbekanntes Mitglied“.
    func assignedMemberName(for locker: Locker) -> String? {
        guard locker.status == .assigned, let id = locker.assignedMemberId,
              let member = membersById[id] else { return nil }
        let name = "\(member.firstName) \(member.lastName)"
            .trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? nil : name
    }

    // MARK: - Mitglieder-Auswahl (Zuordnung)

    /// Mitglieder alphabetisch für den Zuordnungs-Picker (Nachname, Vorname).
    var sortedMembers: [ClubMember] {
        membersById.values.sorted {
            let a = "\($0.lastName) \($0.firstName)"
            let b = "\($1.lastName) \($1.firstName)"
            return a.localizedStandardCompare(b) == .orderedAscending
        }
    }

    // MARK: - Ableitungen (Miete)

    /// Der laufende Vertrag eines Fachs — `nil` heißt „ich sehe keinen“ (kann
    /// RLS-gekürzt sein), nicht zwingend „es gibt keinen“. Web: activeRentalOf.
    func activeRental(for lockerId: String) -> LockerRental? {
        rentals.first { $0.lockerId == lockerId && $0.status == .aktiv }
    }

    /// Aufgelöster Name des Mieters — `nil`, wenn nicht ladbar.
    func memberName(forId memberId: String?) -> String? {
        guard let memberId, let member = membersById[memberId] else { return nil }
        let name = member.membersFullName.trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? nil : name
    }

    /// Summe der laufenden Mieten je Monat — für die Kopfzeile der Verwaltung.
    /// Verträge OHNE festgelegten Preis werden NICHT als 0 mitgezählt, sondern
    /// separat gemeldet (ehrliche Zahl). Web: monthlyRentalTotal.
    var monthlyRentalTotal: (cents: Int, counted: Int, withoutPrice: Int) {
        var cents = 0, counted = 0, withoutPrice = 0
        for rental in rentals where rental.status == .aktiv {
            guard let price = rental.pricePerMonthCents else { withoutPrice += 1; continue }
            cents += price; counted += 1
        }
        return (cents, counted, withoutPrice)
    }

    // MARK: - Aktionen (Miete schreiben)

    /// Ersetzt/ergänzt einen Vertrag in der lokalen Liste (Wahrheit vom Server).
    private func replaceRental(_ updated: LockerRental) {
        if let idx = rentals.firstIndex(where: { $0.id == updated.id }) {
            rentals[idx] = updated
        } else {
            rentals.append(updated)
        }
    }

    /// Fach vermieten (neuer Vertrag).
    func createRental(_ input: LockerRentalCreate) async throws {
        guard let api else { return }
        replaceRental(try await api.createLockerRental(input))
    }

    /// Bestehenden Vertrag ändern (Preis/Zeitraum/Notiz).
    func updateRental(rentalId: String, _ input: LockerRentalUpdate) async throws {
        guard let api else { return }
        replaceRental(try await api.updateLockerRental(rentalId: rentalId, input))
    }

    /// Miete beenden — Status auf „beendet“/„gekündigt“ + Enddatum.
    func endRental(rentalId: String, status: LockerRentalStatus, endOn: String) async throws {
        guard let api else { return }
        replaceRental(try await api.updateLockerRental(
            rentalId: rentalId,
            LockerRentalUpdate(endOn: endOn, status: status)
        ))
    }

    // MARK: - Aktionen (schreiben)

    /// Ersetzt ein Fach in der Liste durch die Server-Antwort (Wahrheit vom
    /// Server, inkl. abgeleitetem Status).
    private func replace(_ updated: Locker) {
        if let idx = lockers.firstIndex(where: { $0.id == updated.id }) {
            lockers[idx] = updated
        } else {
            lockers.append(updated)
        }
        lockers.sort { $0.label.localizedStandardCompare($1.label) == .orderedAscending }
    }

    /// Fach ändern (Bezeichnung/Ort/Größe/Gebühr/Status/Notiz).
    func update(lockerId: String, _ input: LockerUpdate) async throws {
        guard let api else { return }
        replace(try await api.updateLocker(lockerId: lockerId, input))
    }

    /// Fach einem Mitglied zuordnen.
    func assign(lockerId: String, memberId: String) async throws {
        guard let api else { return }
        replace(try await api.assignLocker(lockerId: lockerId, memberId: memberId))
    }

    /// Zuordnung aufheben (Fach wird frei).
    func release(lockerId: String) async throws {
        guard let api else { return }
        replace(try await api.releaseLocker(lockerId: lockerId))
    }

    /// Fach löschen (aus der Liste entfernen).
    func delete(lockerId: String) async throws {
        guard let api else { return }
        _ = try await api.deleteLocker(lockerId: lockerId)
        lockers.removeAll { $0.id == lockerId }
    }

    static func friendlyMessage(_ error: Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
