import Foundation
import SwiftUI

// ============================================================================
// Termine-Feature: reine Anzeige-/Rechenmodelle (kein Netzwerk, kein State).
// Alle Wire-Typen kommen aus den generierten Contracts — hier liegt nur,
// was die Views zum Gruppieren, Zählen und Beschriften brauchen.
// ============================================================================

// MARK: - Filter (Segmente Alle · Training · Wettkampf · Sonstiges)

enum EventsFilter: String, CaseIterable, Identifiable {
    case all
    case training
    case competition
    case other

    var id: String { rawValue }

    var labelKey: LocalizedStringKey {
        switch self {
        case .all: "events.filter.all"
        case .training: "events.filter.training"
        case .competition: "events.filter.competition"
        case .other: "events.filter.other"
        }
    }

    func matches(_ event: Event) -> Bool {
        switch self {
        case .all: true
        case .training: event.type == .training
        case .competition: event.type == .competition
        case .other: event.type == .other
        }
    }
}

// MARK: - Gruppierung & Auswahl

/// Ein Tag der Terminliste (Section) — Termine bereits nach Startzeit sortiert.
struct EventsDaySection: Identifiable {
    let day: Date
    let events: [Event]

    var id: Date { day }
}

/// Sheet-Auswahl ohne `Identifiable`-Konformanz auf dem Contracts-Typ
/// (Konformanz-Kollisionen zwischen parallelen Feature-Teams vermeiden).
struct EventSelection: Identifiable {
    let event: Event
    var id: String { event.id }
}

// MARK: - Antwort-Zählung

struct EventResponseCounts: Equatable {
    let going: Int
    let declined: Int
    let maybe: Int
    let open: Int
}

/// Teilnehmer-Zeile im Detail: eingeladenes Mitglied + (optionale) Antwort.
struct EventParticipant: Identifiable {
    let memberId: String
    let member: ClubMember?
    let rsvp: EventRsvp?

    var id: String { memberId }

    /// Anzeigename; `nil`, wenn das Mitglied nicht sichtbar/geladen ist.
    var displayName: String? {
        member.map { "\($0.firstName) \($0.lastName)" }
    }
}

enum EventsLogic {

    /// Eingeladene Mitglieder: Läufer + Trainer der verknüpften Teams;
    /// vereinsoffene Termine (keine Teams) zählen alle aktiven Mitglieder.
    static func invitedMemberIds(
        event: Event,
        teamsById: [String: Team],
        membersById: [String: ClubMember]
    ) -> Set<String> {
        if !event.teamIds.isEmpty {
            var ids = Set<String>()
            for teamId in event.teamIds {
                guard let team = teamsById[teamId] else { continue }
                ids.formUnion(team.skaterMemberIds)
                ids.formUnion(team.coachMemberIds)
            }
            return ids
        }
        return Set(membersById.values.filter { $0.status == .active }.map(\.id))
    }

    /// Zusagen / Absagen (inkl. Krank) / Vielleicht / offen.
    static func counts(
        event: Event,
        teamsById: [String: Team],
        membersById: [String: ClubMember]
    ) -> EventResponseCounts {
        var invited = invitedMemberIds(event: event, teamsById: teamsById, membersById: membersById)
        var going = 0
        var declined = 0
        var maybe = 0
        var responded = Set<String>()
        for rsvp in event.rsvps {
            invited.insert(rsvp.memberId)
            guard responded.insert(rsvp.memberId).inserted else { continue }
            switch rsvp.status {
            case .going: going += 1
            case .declined, .sick: declined += 1
            case .maybe: maybe += 1
            }
        }
        let open = invited.subtracting(responded).count
        return EventResponseCounts(going: going, declined: declined, maybe: maybe, open: open)
    }

    /// Teilnehmerliste: Eingeladene ∪ alle, die geantwortet haben —
    /// sortiert nach Nachname, Vorname (Unbekannte ans Ende).
    static func participants(
        event: Event,
        teamsById: [String: Team],
        membersById: [String: ClubMember]
    ) -> [EventParticipant] {
        var ids = invitedMemberIds(event: event, teamsById: teamsById, membersById: membersById)
        for rsvp in event.rsvps { ids.insert(rsvp.memberId) }
        let rsvpByMember = Dictionary(
            event.rsvps.map { ($0.memberId, $0) },
            uniquingKeysWith: { _, newer in newer }
        )
        return ids
            .map { id in
                EventParticipant(memberId: id, member: membersById[id], rsvp: rsvpByMember[id])
            }
            .sorted { sortKey($0) < sortKey($1) }
    }

    private static func sortKey(_ participant: EventParticipant) -> String {
        guard let member = participant.member else {
            // Unbekannte stabil ans Ende, untereinander nach ID.
            return "zzz~\(participant.memberId)"
        }
        return "\(member.lastName) \(member.firstName)".lowercased()
    }
}

// MARK: - ISO-8601 (Contracts lassen Timestamps als String auf der Leitung)

enum EventsISO {
    private static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func date(from string: String) -> Date? {
        withFractionalSeconds.date(from: string) ?? plain.date(from: string)
    }

    static func string(from date: Date) -> String {
        plain.string(from: date)
    }
}

// MARK: - Anzeige-Mapping (eigener Namensraum — kollisionsfrei zu anderen Teams)

enum EventsDisplay {

    // Termin-Typ → Pill (Honig bleibt exklusiv Küren/Musik!).
    static func typeLabelKey(_ type: EventType) -> LocalizedStringKey {
        switch type {
        case .training: "events.type.training"
        case .competition: "events.type.competition"
        case .other: "events.type.other"
        }
    }

    static func typePillKind(_ type: EventType) -> RSMStatusKind {
        switch type {
        case .training: .neutral
        case .competition: .brand
        case .other: .info
        }
    }

    // RSVP-Status → Pill (nil = noch offen).
    static func rsvpLabelKey(_ status: RsvpStatus?) -> LocalizedStringKey {
        switch status {
        case .going: "events.status.going"
        case .declined: "events.status.declined"
        case .maybe: "events.status.maybe"
        case .sick: "events.status.sick"
        case nil: "events.status.open"
        }
    }

    static func rsvpPillKind(_ status: RsvpStatus?) -> RSMStatusKind {
        switch status {
        case .going: .success
        case .declined: .danger
        case .maybe: .info
        case .sick: .warn
        case nil: .neutral
        }
    }

    // Anwesenheit → Pill + Icon (Trainer-Sicht).
    static func attendanceLabelKey(_ status: AttendanceStatus) -> LocalizedStringKey {
        switch status {
        case .present: "events.attendance.present"
        case .late: "events.attendance.late"
        case .excused: "events.attendance.excused"
        case .absent: "events.attendance.absent"
        }
    }

    static func attendancePillKind(_ status: AttendanceStatus) -> RSMStatusKind {
        switch status {
        case .present: .success
        case .late: .warn
        case .excused: .info
        case .absent: .danger
        }
    }

    static func attendanceIcon(_ status: AttendanceStatus) -> String {
        switch status {
        case .present: "checkmark.circle"
        case .late: "clock"
        case .excused: "hand.raised"
        case .absent: "xmark.circle"
        }
    }

    /// Uhrzeit (lokalisiert, kurz) aus einem ISO-String — "–" wenn unlesbar.
    static func time(_ iso: String) -> String {
        guard let date = EventsISO.date(from: iso) else { return "–" }
        return date.formatted(date: .omitted, time: .shortened)
    }

    /// Klartext-Zeile zum ResponseBar — trägt die Information (der Balken
    /// selbst ist accessibilityHidden): „3 Zusagen · 1 Absage · 2 offen“.
    static func countsText(_ counts: EventResponseCounts) -> Text {
        var parts: [Text] = [
            Text("events.counts.going \(counts.going)"),
            Text("events.counts.declined \(counts.declined)"),
        ]
        if counts.maybe > 0 {
            parts.append(Text("events.counts.maybe \(counts.maybe)"))
        }
        parts.append(Text("events.counts.open \(counts.open)"))
        return parts.dropFirst().reduce(parts[0]) { $0 + Text(verbatim: " · ") + $1 }
    }
}
