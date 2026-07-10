import Foundation

/// Detail-ViewModel eines Termins: eigene Zu-/Absage (optimistisch, mit
/// Rollback + Fehler-Alert) und Trainer-Anwesenheit (GET/PUT attendance).
@MainActor
final class EventDetailViewModel: ObservableObject {

    @Published private(set) var event: Event
    @Published private(set) var isSavingRsvp = false
    /// Absage-Kommentar-Bereich (aufgeklappt nach Tipp auf „Absagen“).
    @Published var isDeclineExpanded = false
    @Published var declineComment = ""
    /// Fehler aus RSVP/Anwesenheit — die View zeigt daraus einen Alert.
    @Published var errorMessage: String?
    @Published private(set) var attendanceByMember: [String: Attendance] = [:]
    @Published private(set) var isLoadingAttendance = false

    let myMemberId: String
    /// Anwesenheit erfassen dürfen Coach und höher, inkl. guest_coach
    /// (Spec: PUT /events/{eventId}/attendance).
    let canMarkAttendance: Bool
    let teamsById: [String: Team]
    let membersById: [String: ClubMember]

    private let api: APIClient
    private let clubId: String
    private let onEventUpdated: (Event) -> Void
    private var hasLoadedAttendance = false

    init(
        event: Event,
        api: APIClient,
        clubId: String,
        myMemberId: String,
        clubRole: ClubRole?,
        teamsById: [String: Team],
        membersById: [String: ClubMember],
        onEventUpdated: @escaping (Event) -> Void
    ) {
        self.event = event
        self.api = api
        self.clubId = clubId
        self.myMemberId = myMemberId
        self.teamsById = teamsById
        self.membersById = membersById
        self.onEventUpdated = onEventUpdated
        self.canMarkAttendance = clubRole.map {
            [.owner, .admin, .coach, .guestCoach].contains($0)
        } ?? false

        if let mine = event.rsvps.first(where: { $0.memberId == myMemberId }),
           mine.status == .declined {
            declineComment = mine.comment ?? ""
        }
    }

    // MARK: - Ableitungen

    var myRsvp: EventRsvp? {
        event.rsvps.first { $0.memberId == myMemberId }
    }

    var counts: EventResponseCounts {
        EventsLogic.counts(event: event, teamsById: teamsById, membersById: membersById)
    }

    var participants: [EventParticipant] {
        EventsLogic.participants(event: event, teamsById: teamsById, membersById: membersById)
    }

    var eventTeams: [Team] {
        event.teamIds.compactMap { teamsById[$0] }
    }

    // MARK: - Eigene Rückmeldung (PUT rsvp, optimistisch)

    /// Zusage/Vielleicht senden sofort; „Absagen“ klappt erst den
    /// Kommentar-Bereich auf (Kommentar bei Absage, dann `sendDecline`).
    func selectStatus(_ status: RsvpStatus) async {
        if status == .declined {
            isDeclineExpanded = true
            return
        }
        isDeclineExpanded = false
        await putRsvp(status: status, comment: nil)
    }

    func sendDecline() async {
        let trimmed = declineComment.trimmingCharacters(in: .whitespacesAndNewlines)
        await putRsvp(status: .declined, comment: trimmed.isEmpty ? nil : trimmed)
        if errorMessage == nil { isDeclineExpanded = false }
    }

    private func putRsvp(status: RsvpStatus, comment: String?) async {
        guard !isSavingRsvp, !myMemberId.isEmpty else { return }
        isSavingRsvp = true
        defer { isSavingRsvp = false }

        // Optimistisch: sofort lokal eintragen, bei Fehler zurückrollen.
        let previousRsvps = event.rsvps
        let optimistic = EventRsvp(
            id: myRsvp?.id ?? "optimistic-\(UUID().uuidString)",
            clubId: event.clubId,
            eventId: event.id,
            memberId: myMemberId,
            status: status,
            comment: comment,
            respondedAt: EventsISO.string(from: Date())
        )
        replaceRsvp(optimistic)

        do {
            let saved = try await api.putRsvp(
                eventId: event.id,
                EventRsvpUpsert(memberId: myMemberId, status: status, comment: comment)
            )
            replaceRsvp(saved)
        } catch {
            event.rsvps = previousRsvps
            onEventUpdated(event)
            errorMessage = EventsViewModel.friendlyMessage(error)
        }
    }

    private func replaceRsvp(_ rsvp: EventRsvp) {
        var rsvps = event.rsvps.filter { $0.memberId != rsvp.memberId }
        rsvps.append(rsvp)
        event.rsvps = rsvps
        onEventUpdated(event)
    }

    // MARK: - Anwesenheit (Trainer-Sicht)

    func loadAttendanceIfNeeded() async {
        guard canMarkAttendance, !hasLoadedAttendance else { return }
        hasLoadedAttendance = true
        isLoadingAttendance = true
        defer { isLoadingAttendance = false }
        do {
            let records = try await api.attendance(clubId: clubId, eventId: event.id)
            attendanceByMember = Dictionary(
                records.map { ($0.memberId, $0) },
                uniquingKeysWith: { _, newer in newer }
            )
        } catch {
            hasLoadedAttendance = false // nächster Sheet-Aufruf versucht es erneut
            errorMessage = EventsViewModel.friendlyMessage(error)
        }
    }

    /// Anwesenheits-Status setzen — optimistisch mit Rollback + Alert.
    func setAttendance(memberId: String, status: AttendanceStatus) async {
        let previous = attendanceByMember[memberId]
        attendanceByMember[memberId] = Attendance(
            id: previous?.id ?? "optimistic-\(UUID().uuidString)",
            clubId: event.clubId,
            eventId: event.id,
            memberId: memberId,
            status: status,
            checkedInAt: previous?.checkedInAt
        )
        do {
            let saved = try await api.putAttendance(
                eventId: event.id,
                AttendanceUpsert(memberId: memberId, status: status, checkedInAt: nil)
            )
            attendanceByMember[memberId] = saved
        } catch {
            attendanceByMember[memberId] = previous
            errorMessage = EventsViewModel.friendlyMessage(error)
        }
    }
}
