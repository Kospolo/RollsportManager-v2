import SwiftUI

// ============================================================================
// Mitglieder-Verwaltung — Lokalisierungs-/Ableitungs-Helfer.
//
// Web-Referenz: apps/web/app/(portal)/verwaltung/mitglieder (i18n.ts + derive.ts).
// Alle Typen/Keys tragen bewusst das „Admin…“-/„mitglieder.“-Präfix, damit die
// vier parallel arbeitenden Verwaltungs-Teams sich nicht ins Gehege kommen.
// ============================================================================

extension ClubMember {
    /// Anzeigename „Vorname Nachname“ — eigener Name (Kollisionsschutz zum
    /// `membersFullName` des Mitglieder-Features).
    var adminMembersDisplayName: String { "\(firstName) \(lastName)" }
}

// MARK: - Rollen-Filter (gruppiert wie im Web-Hub)

/// Filter-Facetten der Rollenspalte. `board` fasst owner + admin zusammen
/// (Vorstand), damit die Chips der Web-Referenz entsprechen.
enum AdminMembersRoleFilter: String, CaseIterable, Identifiable {
    case all, board, moderator, treasurer, coach, member, guest

    var id: String { rawValue }

    func matches(_ member: ClubMember) -> Bool {
        switch self {
        case .all: return true
        case .board: return member.role == .owner || member.role == .admin
        case .moderator: return member.role == .moderator
        case .treasurer: return member.role == .treasurer
        case .coach: return member.role == .coach
        case .member: return member.role == .member
        case .guest: return member.role == .guestCoach
        }
    }

    var labelKey: LocalizedStringKey {
        switch self {
        case .all: "mitglieder.filter.role.all"
        case .board: "mitglieder.filter.role.board"
        case .moderator: "mitglieder.filter.role.moderator"
        case .treasurer: "mitglieder.filter.role.treasurer"
        case .coach: "mitglieder.filter.role.coach"
        case .member: "mitglieder.filter.role.member"
        case .guest: "mitglieder.filter.role.guest"
        }
    }
}

// MARK: - Status-Filter

enum AdminMembersStatusFilter: String, CaseIterable, Identifiable {
    case all, active, inactive, pending

    var id: String { rawValue }

    func matches(_ member: ClubMember) -> Bool {
        switch self {
        case .all: return true
        case .active: return member.status == .active
        case .inactive: return member.status == .inactive
        case .pending: return member.status == .pending
        }
    }

    var labelKey: LocalizedStringKey {
        switch self {
        case .all: "mitglieder.filter.status.all"
        case .active: "mitglieder.filter.status.active"
        case .inactive: "mitglieder.filter.status.inactive"
        case .pending: "mitglieder.filter.status.pending"
        }
    }
}

// MARK: - Labels & Töne

enum AdminMembersL10n {

    /// Rollen-Beschriftung (eigene „mitglieder.role.*“-Keys, wortgleich zur
    /// Web-Referenz — inkl. Kassenwart/Gasttrainer).
    static func roleKey(_ role: ClubRole) -> LocalizedStringKey {
        switch role {
        case .owner: "mitglieder.role.owner"
        case .admin: "mitglieder.role.admin"
        case .moderator: "mitglieder.role.moderator"
        case .treasurer: "mitglieder.role.treasurer"
        case .coach: "mitglieder.role.coach"
        case .member: "mitglieder.role.member"
        case .guestCoach: "mitglieder.role.guest"
        }
    }

    static func roleKey(_ role: AssignableClubRole) -> LocalizedStringKey {
        switch role {
        case .admin: "mitglieder.role.admin"
        case .moderator: "mitglieder.role.moderator"
        case .treasurer: "mitglieder.role.treasurer"
        case .coach: "mitglieder.role.coach"
        case .member: "mitglieder.role.member"
        case .guestCoach: "mitglieder.role.guest"
        }
    }

    /// Rollen-Ton (Chip): Vorstand = Beere, Stab = Info/Erfolg, Rest neutral.
    static func roleKind(_ role: ClubRole) -> RSMStatusKind {
        switch role {
        case .owner: .brand
        case .admin, .moderator, .treasurer: .info
        case .coach: .success
        case .member, .guestCoach: .neutral
        }
    }

    static func statusKey(_ status: MemberStatus) -> LocalizedStringKey {
        switch status {
        case .active: "mitglieder.status.active"
        case .inactive: "mitglieder.status.inactive"
        case .pending: "mitglieder.status.pending"
        case .rejected: "mitglieder.status.rejected"
        case .left: "mitglieder.status.left"
        }
    }

    static func statusKind(_ status: MemberStatus) -> RSMStatusKind {
        switch status {
        case .active: .success
        case .pending: .info
        case .rejected: .danger
        case .inactive, .left: .neutral
        }
    }
}

// MARK: - Datum (Contracts liefern Datumswerte als String)

enum AdminMembersFormat {
    /// Leitungsformat `yyyy-MM-dd` (bzw. ISO-Datetime, deren Tag-Präfix wir lesen).
    static let wireDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter
    }()

    /// „2016-04-01(T…)“ → `Date` (nur der Tag zählt); nil wenn unparsebar.
    static func date(from wire: String) -> Date? {
        wireDay.date(from: String(wire.prefix(10)))
    }

    /// `Date` → Leitungs-Tag `yyyy-MM-dd`.
    static func wire(from date: Date) -> String {
        wireDay.string(from: date)
    }

    /// Leitungs-Datum → lokalisierter Kurztext; Unparsebares roh durchreichen.
    static func short(_ wire: String) -> String {
        guard let date = date(from: wire) else { return wire }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
