import Foundation
import SwiftUI

/// Formular-State für „Halle buchen“. Legt eine Buchung über `createBooking` an.
/// Self-Service: Nicht-Trainer:innen buchen FEST für das eigene Mitglied
/// (Status „Angefragt“), nur Trainer:innen wählen ein Mitglied und setzen den
/// Status. Die Durchsetzung bleibt serverseitig (RLS + Rollencheck, 403).
/// Überschneidungen sind NICHT DB-erzwungen — nur ein Hinweis.
/// Web-Referenz: belegungsplan/_components/BookingFormSheet.tsx.
@MainActor
final class BookingFormViewModel: ObservableObject {

    struct FieldErrors: Equatable {
        var title: LocalizedStringKey?
        var end: LocalizedStringKey?
        var isEmpty: Bool { title == nil && end == nil }
    }

    // MARK: - Eingaben

    @Published var facilityId: String
    @Published var title = ""
    @Published var memberId: String
    /// "" = kein Team.
    @Published var teamId = ""
    @Published var day = Date()
    @Published var startTime: Date
    @Published var endTime: Date
    @Published var status: BookingStatus

    // MARK: - Zustand

    @Published var fieldErrors = FieldErrors()
    @Published private(set) var isSaving = false
    @Published var submitError: String?

    // MARK: - Kontext (read-only)

    let facilities: [Facility]
    let members: [ClubMember]
    let teams: [Team]
    let isTrainer: Bool

    private let bookings: [FacilityBooking]
    private let clubId: String
    private let currentMemberId: String?
    private let api: APIClient
    private let onCreated: (FacilityBooking) -> Void

    init(
        initialFacilityId: String?,
        facilities: [Facility],
        bookings: [FacilityBooking],
        members: [ClubMember],
        teams: [Team],
        isTrainer: Bool,
        currentMemberId: String?,
        clubId: String,
        api: APIClient,
        onCreated: @escaping (FacilityBooking) -> Void
    ) {
        self.facilities = facilities
        self.bookings = bookings
        self.members = members
        self.teams = teams
        self.isTrainer = isTrainer
        self.currentMemberId = currentMemberId
        self.clubId = clubId
        self.api = api
        self.onCreated = onCreated

        self.facilityId = initialFacilityId ?? facilities.first?.id ?? ""
        self.memberId = currentMemberId ?? ""
        self.status = isTrainer ? .confirmed : .pending
        self.startTime = Self.time(hour: 17, minute: 0)
        self.endTime = Self.time(hour: 18, minute: 30)
    }

    // MARK: - Ableitungen

    private var startsAtIso: String { BelegungISO.string(from: combine(day: day, time: startTime)) }
    private var endsAtIso: String { BelegungISO.string(from: combine(day: day, time: endTime)) }

    /// Bestehende Buchungen derselben Halle, die den gewählten Slot
    /// überschneiden (leer, wenn Ende ≤ Beginn oder keine Halle gewählt).
    var conflicts: [FacilityBooking] {
        guard !facilityId.isEmpty, endTime > startTime else { return [] }
        return BelegungLogic.conflictingBookings(
            bookings,
            facilityId: facilityId,
            startsAt: startsAtIso,
            endsAt: endsAtIso
        )
    }

    var conflictCount: Int { conflicts.count }

    /// Ausgewähltes Mitglied (Trainer:innen-Auswahl) — sonst das eigene.
    var effectiveMemberName: String? {
        let id = isTrainer ? memberId : (currentMemberId ?? "")
        return BelegungDisplay.memberName(members.first { $0.id == id })
    }

    /// Buchbare Teams (bereits upstream nach Rolle gefiltert übergeben).
    var bookableTeamsAvailable: [Team] { teams }

    /// Anzeigename der aktuell gewählten Halle (für das Menu-Label).
    var selectedFacilityName: String {
        facilities.first { $0.id == facilityId }?.name ?? ""
    }

    /// Anzeigename des gewählten Teams — „Kein Team“, wenn keins gewählt.
    var selectedTeamName: String {
        if teamId.isEmpty {
            return NSLocalizedString("belegungsplan.book.team.none", comment: "Kein Team gewählt")
        }
        return teams.first { $0.id == teamId }?.name
            ?? NSLocalizedString("belegungsplan.book.team.none", comment: "Kein Team gewählt")
    }

    // MARK: - Absenden

    /// Validiert und postet. Erfolg → `true` (View schließt das Sheet); bei
    /// Validierungs- oder 403-Fehlern `false` (Sheet bleibt offen).
    func submit() async -> Bool {
        guard !isSaving else { return false }

        var errors = FieldErrors()
        if title.trimmed.isEmpty { errors.title = "belegungsplan.book.error.title" }
        if endTime <= startTime { errors.end = "belegungsplan.book.error.end" }
        fieldErrors = errors
        guard errors.isEmpty else { return false }

        let bookedBy = isTrainer ? memberId : (currentMemberId ?? "")
        guard !facilityId.isEmpty, !bookedBy.isEmpty else { return false }

        let create = FacilityBookingCreate(
            clubId: clubId,
            facilityId: facilityId,
            bookedByMemberId: bookedBy,
            teamId: teamId.isEmpty ? nil : teamId,
            title: title.trimmed,
            startsAt: startsAtIso,
            endsAt: endsAtIso,
            status: isTrainer ? status : .pending
        )

        isSaving = true
        defer { isSaving = false }
        do {
            let created = try await api.createBooking(create)
            onCreated(created)
            return true
        } catch {
            submitError = error.isForbiddenAPIError
                ? NSLocalizedString("belegungsplan.book.forbidden", comment: "403 beim Buchen")
                : ((error as? APIError)?.errorDescription ?? error.localizedDescription)
            return false
        }
    }

    // MARK: - Helfer

    /// Kalendertag aus `day` + Uhrzeit aus `time` zu einem Zeitpunkt fügen.
    private func combine(day: Date, time: Date) -> Date {
        let calendar = Calendar.current
        let d = calendar.dateComponents([.year, .month, .day], from: day)
        let t = calendar.dateComponents([.hour, .minute], from: time)
        var merged = DateComponents()
        merged.year = d.year
        merged.month = d.month
        merged.day = d.day
        merged.hour = t.hour
        merged.minute = t.minute
        return calendar.date(from: merged) ?? day
    }

    private static func time(hour: Int, minute: Int) -> Date {
        Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: Date()) ?? Date()
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
