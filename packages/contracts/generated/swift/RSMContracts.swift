// GENERIERT — NICHT VON HAND AENDERN
//
// Generated from packages/contracts/openapi.json (RollsportManager v2 API v0.2.0).
// Regenerate with: npm run generate   (in packages/contracts)
// Source of truth is the API layer; the spec itself is produced by
// "npm run openapi" in services/api - never edit either by hand.

import Foundation

// Timestamps and dates stay String on the wire (ISO 8601 / yyyy-MM-dd),
// UUIDs stay String - decode without custom strategies, convert at the edge.

/// Minimal JSON value for free-form columns (e.g. club settings JSONB).
public enum JSONValue: Codable, Equatable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}

public enum ClubRole: String, Codable, CaseIterable, Sendable, Equatable {
    case owner = "owner"
    case admin = "admin"
    case moderator = "moderator"
    case treasurer = "treasurer"
    case coach = "coach"
    case member = "member"
    case guestCoach = "guest_coach"
}

public enum MemberStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case pending = "pending"
    case active = "active"
    case inactive = "inactive"
    case left = "left"
}

public enum AssignableClubRole: String, Codable, CaseIterable, Sendable, Equatable {
    case admin = "admin"
    case moderator = "moderator"
    case treasurer = "treasurer"
    case coach = "coach"
    case member = "member"
    case guestCoach = "guest_coach"
}

public enum EventType: String, Codable, CaseIterable, Sendable, Equatable {
    case training = "training"
    case competition = "competition"
    case other = "other"
}

public enum RsvpStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case going = "going"
    case declined = "declined"
    case maybe = "maybe"
    case sick = "sick"
}

public enum AttendanceStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case present = "present"
    case late = "late"
    case excused = "excused"
    case absent = "absent"
}

public enum RoutineStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case draft = "draft"
    case ready = "ready"
    case competition = "competition"
    case archived = "archived"
}

public enum CompetitionStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case upcoming = "upcoming"
    case running = "running"
    case done = "done"
    case cancelled = "cancelled"
}

public enum CompetitionEntryStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case registered = "registered"
    case confirmed = "confirmed"
    case withdrawn = "withdrawn"
}

public enum InvoiceStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case draft = "draft"
    case open = "open"
    case paid = "paid"
    case cancelled = "cancelled"
}

public enum CounterpartyKind: String, Codable, CaseIterable, Sendable, Equatable {
    case person = "person"
    case org = "org"
}

/// Inline enum of Health.status (hoisted by codegen).
public enum HealthStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case ok = "ok"
}

/// Inline enum of InviteQueued.status (hoisted by codegen).
public enum InviteQueuedStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case queued = "queued"
}

/// Inline enum of Deleted.status (hoisted by codegen).
public enum DeletedStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case deleted = "deleted"
}

/// Inline enum of Entitlement.subject_type (hoisted by codegen).
public enum EntitlementSubjectType: String, Codable, CaseIterable, Sendable, Equatable {
    case club = "club"
    case profile = "profile"
}

/// Inline enum of Entitlement.source (hoisted by codegen).
public enum EntitlementSource: String, Codable, CaseIterable, Sendable, Equatable {
    case stripe = "stripe"
    case revenuecat = "revenuecat"
    case manual = "manual"
}

/// Inline enum of Product.kind (hoisted by codegen).
public enum ProductKind: String, Codable, CaseIterable, Sendable, Equatable {
    case clubLicense = "club_license"
    case personalPro = "personal_pro"
}

/// Inline enum of Product.billing_interval (hoisted by codegen).
public enum ProductBillingInterval: String, Codable, CaseIterable, Sendable, Equatable {
    case month = "month"
    case year = "year"
}

/// Inline enum of DunningAction.action (hoisted by codegen).
public enum DunningActionAction: String, Codable, CaseIterable, Sendable, Equatable {
    case auto = "auto"
    case pendingApproval = "pending_approval"
    case none = "none"
}

/// Inline object of DunningRunResult.summary (hoisted by codegen).
public struct DunningRunResultSummary: Codable, Equatable, Sendable {
    public var auto: Int
    public var pendingApproval: Int
    public var none: Int

    enum CodingKeys: String, CodingKey {
        case auto
        case pendingApproval = "pending_approval"
        case none
    }

    public init(
        auto: Int,
        pendingApproval: Int,
        none: Int
    ) {
        self.auto = auto
        self.pendingApproval = pendingApproval
        self.none = none
    }
}

public struct Health: Codable, Equatable, Sendable {
    public var status: HealthStatus
    public var service: String
    public var time: String

    enum CodingKeys: String, CodingKey {
        case status
        case service
        case time
    }

    public init(
        status: HealthStatus,
        service: String,
        time: String
    ) {
        self.status = status
        self.service = service
        self.time = time
    }
}

public struct Club: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    public var name: String
    public var shortName: String?
    public var city: String?
    public var discipline: String?
    public var foundedYear: Int?
    public var joinCode: String?
    public var settings: [String: JSONValue]
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case shortName = "short_name"
        case city
        case discipline
        case foundedYear = "founded_year"
        case joinCode = "join_code"
        case settings
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        name: String,
        shortName: String? = nil,
        city: String? = nil,
        discipline: String? = nil,
        foundedYear: Int? = nil,
        joinCode: String? = nil,
        settings: [String: JSONValue],
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.name = name
        self.shortName = shortName
        self.city = city
        self.discipline = discipline
        self.foundedYear = foundedYear
        self.joinCode = joinCode
        self.settings = settings
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct Problem: Codable, Equatable, Sendable {
    public var type: String
    public var title: String
    public var status: Int
    public var detail: String?
    public var instance: String?
    public var requestId: String?

    enum CodingKeys: String, CodingKey {
        case type
        case title
        case status
        case detail
        case instance
        case requestId = "request_id"
    }

    public init(
        type: String,
        title: String,
        status: Int,
        detail: String? = nil,
        instance: String? = nil,
        requestId: String? = nil
    ) {
        self.type = type
        self.title = title
        self.status = status
        self.detail = detail
        self.instance = instance
        self.requestId = requestId
    }
}

public struct ClubUpdate: Codable, Equatable, Sendable {
    public var name: String?
    public var shortName: String?
    public var city: String?
    public var discipline: String?
    public var settings: [String: JSONValue]?

    enum CodingKeys: String, CodingKey {
        case name
        case shortName = "short_name"
        case city
        case discipline
        case settings
    }

    public init(
        name: String? = nil,
        shortName: String? = nil,
        city: String? = nil,
        discipline: String? = nil,
        settings: [String: JSONValue]? = nil
    ) {
        self.name = name
        self.shortName = shortName
        self.city = city
        self.discipline = discipline
        self.settings = settings
    }
}

public struct ClubMember: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var profileId: String?
    public var firstName: String
    public var lastName: String
    public var email: String?
    public var birthDate: String?
    public var role: ClubRole
    public var status: MemberStatus
    public var joinedOn: String?
    public var validUntil: String?
    /// Format: [uuid]
    public var teamIds: [String]
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case profileId = "profile_id"
        case firstName = "first_name"
        case lastName = "last_name"
        case email
        case birthDate = "birth_date"
        case role
        case status
        case joinedOn = "joined_on"
        case validUntil = "valid_until"
        case teamIds = "team_ids"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        profileId: String? = nil,
        firstName: String,
        lastName: String,
        email: String? = nil,
        birthDate: String? = nil,
        role: ClubRole,
        status: MemberStatus,
        joinedOn: String? = nil,
        validUntil: String? = nil,
        teamIds: [String],
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.profileId = profileId
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.birthDate = birthDate
        self.role = role
        self.status = status
        self.joinedOn = joinedOn
        self.validUntil = validUntil
        self.teamIds = teamIds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct ClubMemberCreate: Codable, Equatable, Sendable {
    public var firstName: String
    public var lastName: String
    /// Format: email
    public var email: String?
    /// Format: date
    public var birthDate: String?
    public var role: AssignableClubRole?
    /// Format: date
    public var joinedOn: String?
    /// Format: date-time
    public var validUntil: String?

    enum CodingKeys: String, CodingKey {
        case firstName = "first_name"
        case lastName = "last_name"
        case email
        case birthDate = "birth_date"
        case role
        case joinedOn = "joined_on"
        case validUntil = "valid_until"
    }

    public init(
        firstName: String,
        lastName: String,
        email: String? = nil,
        birthDate: String? = nil,
        role: AssignableClubRole? = nil,
        joinedOn: String? = nil,
        validUntil: String? = nil
    ) {
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.birthDate = birthDate
        self.role = role
        self.joinedOn = joinedOn
        self.validUntil = validUntil
    }
}

public struct InviteQueued: Codable, Equatable, Sendable {
    public var status: InviteQueuedStatus
    public var email: String

    enum CodingKeys: String, CodingKey {
        case status
        case email
    }

    public init(
        status: InviteQueuedStatus,
        email: String
    ) {
        self.status = status
        self.email = email
    }
}

public struct ClubMemberInvite: Codable, Equatable, Sendable {
    /// Format: email
    public var email: String
    public var role: AssignableClubRole?

    enum CodingKeys: String, CodingKey {
        case email
        case role
    }

    public init(
        email: String,
        role: AssignableClubRole? = nil
    ) {
        self.email = email
        self.role = role
    }
}

public struct Guardianship: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var guardianMemberId: String
    /// Format: uuid
    public var childMemberId: String
    public var relation: String
    public var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case guardianMemberId = "guardian_member_id"
        case childMemberId = "child_member_id"
        case relation
        case createdAt = "created_at"
    }

    public init(
        id: String,
        clubId: String,
        guardianMemberId: String,
        childMemberId: String,
        relation: String,
        createdAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.guardianMemberId = guardianMemberId
        self.childMemberId = childMemberId
        self.relation = relation
        self.createdAt = createdAt
    }
}

public struct ClubMemberUpdate: Codable, Equatable, Sendable {
    public var firstName: String?
    public var lastName: String?
    /// Format: email
    public var email: String?
    /// Format: date
    public var birthDate: String?
    public var status: MemberStatus?
    /// Format: date-time
    public var validUntil: String?

    enum CodingKeys: String, CodingKey {
        case firstName = "first_name"
        case lastName = "last_name"
        case email
        case birthDate = "birth_date"
        case status
        case validUntil = "valid_until"
    }

    public init(
        firstName: String? = nil,
        lastName: String? = nil,
        email: String? = nil,
        birthDate: String? = nil,
        status: MemberStatus? = nil,
        validUntil: String? = nil
    ) {
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.birthDate = birthDate
        self.status = status
        self.validUntil = validUntil
    }
}

public struct ClubMemberRoleChange: Codable, Equatable, Sendable {
    public var role: AssignableClubRole

    enum CodingKeys: String, CodingKey {
        case role
    }

    public init(
        role: AssignableClubRole
    ) {
        self.role = role
    }
}

public struct Team: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var ageGroup: String?
    /// Format: [uuid]
    public var skaterMemberIds: [String]
    /// Format: [uuid]
    public var coachMemberIds: [String]
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case name
        case ageGroup = "age_group"
        case skaterMemberIds = "skater_member_ids"
        case coachMemberIds = "coach_member_ids"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        name: String,
        ageGroup: String? = nil,
        skaterMemberIds: [String],
        coachMemberIds: [String],
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.name = name
        self.ageGroup = ageGroup
        self.skaterMemberIds = skaterMemberIds
        self.coachMemberIds = coachMemberIds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct TeamCreate: Codable, Equatable, Sendable {
    public var name: String
    public var ageGroup: String?

    enum CodingKeys: String, CodingKey {
        case name
        case ageGroup = "age_group"
    }

    public init(
        name: String,
        ageGroup: String? = nil
    ) {
        self.name = name
        self.ageGroup = ageGroup
    }
}

public struct TeamUpdate: Codable, Equatable, Sendable {
    public var name: String?
    public var ageGroup: String?

    enum CodingKeys: String, CodingKey {
        case name
        case ageGroup = "age_group"
    }

    public init(
        name: String? = nil,
        ageGroup: String? = nil
    ) {
        self.name = name
        self.ageGroup = ageGroup
    }
}

public struct Deleted: Codable, Equatable, Sendable {
    public var status: DeletedStatus
    /// Format: uuid
    public var id: String

    enum CodingKeys: String, CodingKey {
        case status
        case id
    }

    public init(
        status: DeletedStatus,
        id: String
    ) {
        self.status = status
        self.id = id
    }
}

public struct TeamMembersSet: Codable, Equatable, Sendable {
    /// Format: [uuid]
    public var skaterMemberIds: [String]?
    /// Format: [uuid]
    public var coachMemberIds: [String]?

    enum CodingKeys: String, CodingKey {
        case skaterMemberIds = "skater_member_ids"
        case coachMemberIds = "coach_member_ids"
    }

    public init(
        skaterMemberIds: [String]? = [],
        coachMemberIds: [String]? = []
    ) {
        self.skaterMemberIds = skaterMemberIds
        self.coachMemberIds = coachMemberIds
    }
}

public struct PlatformClub: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    public var name: String
    public var shortName: String?
    public var city: String?
    public var discipline: String?
    public var memberCount: Int?
    public var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case shortName = "short_name"
        case city
        case discipline
        case memberCount = "member_count"
        case createdAt = "created_at"
    }

    public init(
        id: String,
        name: String,
        shortName: String? = nil,
        city: String? = nil,
        discipline: String? = nil,
        memberCount: Int? = nil,
        createdAt: String
    ) {
        self.id = id
        self.name = name
        self.shortName = shortName
        self.city = city
        self.discipline = discipline
        self.memberCount = memberCount
        self.createdAt = createdAt
    }
}

public struct PlatformUser: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    public var displayName: String?
    public var locale: String
    public var clubCount: Int?
    public var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case locale
        case clubCount = "club_count"
        case createdAt = "created_at"
    }

    public init(
        id: String,
        displayName: String? = nil,
        locale: String,
        clubCount: Int? = nil,
        createdAt: String
    ) {
        self.id = id
        self.displayName = displayName
        self.locale = locale
        self.clubCount = clubCount
        self.createdAt = createdAt
    }
}

public struct PlatformStats: Codable, Equatable, Sendable {
    public var clubs: Int?
    public var users: Int?
    public var members: Int?
    public var activeMembers: Int?
    public var teams: Int?
    public var events: Int?
    public var openInvoices: Int?

    enum CodingKeys: String, CodingKey {
        case clubs
        case users
        case members
        case activeMembers = "active_members"
        case teams
        case events
        case openInvoices = "open_invoices"
    }

    public init(
        clubs: Int? = nil,
        users: Int? = nil,
        members: Int? = nil,
        activeMembers: Int? = nil,
        teams: Int? = nil,
        events: Int? = nil,
        openInvoices: Int? = nil
    ) {
        self.clubs = clubs
        self.users = users
        self.members = members
        self.activeMembers = activeMembers
        self.teams = teams
        self.events = events
        self.openInvoices = openInvoices
    }
}

public struct EventRsvp: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var eventId: String
    /// Format: uuid
    public var memberId: String
    public var status: RsvpStatus
    public var comment: String?
    public var respondedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case eventId = "event_id"
        case memberId = "member_id"
        case status
        case comment
        case respondedAt = "responded_at"
    }

    public init(
        id: String,
        clubId: String,
        eventId: String,
        memberId: String,
        status: RsvpStatus,
        comment: String? = nil,
        respondedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.eventId = eventId
        self.memberId = memberId
        self.status = status
        self.comment = comment
        self.respondedAt = respondedAt
    }
}

public struct Event: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var type: EventType
    public var title: String
    public var note: String?
    public var location: String?
    public var startsAt: String
    public var endsAt: String
    /// Format: uuid
    public var competitionId: String?
    /// Format: [uuid]
    public var teamIds: [String]
    public var rsvps: [EventRsvp]
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case type
        case title
        case note
        case location
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case competitionId = "competition_id"
        case teamIds = "team_ids"
        case rsvps
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        type: EventType,
        title: String,
        note: String? = nil,
        location: String? = nil,
        startsAt: String,
        endsAt: String,
        competitionId: String? = nil,
        teamIds: [String],
        rsvps: [EventRsvp],
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.type = type
        self.title = title
        self.note = note
        self.location = location
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.competitionId = competitionId
        self.teamIds = teamIds
        self.rsvps = rsvps
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct EventCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var type: EventType?
    public var title: String
    public var note: String?
    public var location: String?
    /// Format: date-time
    public var startsAt: String
    /// Format: date-time
    public var endsAt: String
    /// Format: [uuid]
    public var teamIds: [String]?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case type
        case title
        case note
        case location
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case teamIds = "team_ids"
    }

    public init(
        clubId: String,
        type: EventType? = .training,
        title: String,
        note: String? = nil,
        location: String? = nil,
        startsAt: String,
        endsAt: String,
        teamIds: [String]? = []
    ) {
        self.clubId = clubId
        self.type = type
        self.title = title
        self.note = note
        self.location = location
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.teamIds = teamIds
    }
}

public struct EventRsvpUpsert: Codable, Equatable, Sendable {
    /// Format: uuid
    public var memberId: String
    public var status: RsvpStatus
    public var comment: String?

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case status
        case comment
    }

    public init(
        memberId: String,
        status: RsvpStatus,
        comment: String? = nil
    ) {
        self.memberId = memberId
        self.status = status
        self.comment = comment
    }
}

public struct Attendance: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var eventId: String
    /// Format: uuid
    public var memberId: String
    public var status: AttendanceStatus
    public var checkedInAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case eventId = "event_id"
        case memberId = "member_id"
        case status
        case checkedInAt = "checked_in_at"
    }

    public init(
        id: String,
        clubId: String,
        eventId: String,
        memberId: String,
        status: AttendanceStatus,
        checkedInAt: String? = nil
    ) {
        self.id = id
        self.clubId = clubId
        self.eventId = eventId
        self.memberId = memberId
        self.status = status
        self.checkedInAt = checkedInAt
    }
}

public struct AttendanceUpsert: Codable, Equatable, Sendable {
    /// Format: uuid
    public var memberId: String
    public var status: AttendanceStatus
    /// Format: date-time
    public var checkedInAt: String?

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case status
        case checkedInAt = "checked_in_at"
    }

    public init(
        memberId: String,
        status: AttendanceStatus,
        checkedInAt: String? = nil
    ) {
        self.memberId = memberId
        self.status = status
        self.checkedInAt = checkedInAt
    }
}

public struct Routine: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var teamId: String?
    public var title: String
    public var status: RoutineStatus
    public var category: String?
    public var musicTitle: String?
    public var musicArtist: String?
    public var musicBpm: Int?
    public var musicDurationMs: Int?
    /// Format: uuid
    public var audioAssetId: String?
    /// Format: [uuid]
    public var skaterMemberIds: [String]
    public var waveformPeaks: [Double]?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case teamId = "team_id"
        case title
        case status
        case category
        case musicTitle = "music_title"
        case musicArtist = "music_artist"
        case musicBpm = "music_bpm"
        case musicDurationMs = "music_duration_ms"
        case audioAssetId = "audio_asset_id"
        case skaterMemberIds = "skater_member_ids"
        case waveformPeaks = "waveform_peaks"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        teamId: String? = nil,
        title: String,
        status: RoutineStatus,
        category: String? = nil,
        musicTitle: String? = nil,
        musicArtist: String? = nil,
        musicBpm: Int? = nil,
        musicDurationMs: Int? = nil,
        audioAssetId: String? = nil,
        skaterMemberIds: [String],
        waveformPeaks: [Double]? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.teamId = teamId
        self.title = title
        self.status = status
        self.category = category
        self.musicTitle = musicTitle
        self.musicArtist = musicArtist
        self.musicBpm = musicBpm
        self.musicDurationMs = musicDurationMs
        self.audioAssetId = audioAssetId
        self.skaterMemberIds = skaterMemberIds
        self.waveformPeaks = waveformPeaks
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct RoutineCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var title: String
    /// Format: uuid
    public var teamId: String?
    public var category: String?
    public var musicTitle: String?
    public var musicArtist: String?
    public var musicBpm: Int?
    public var musicDurationMs: Int?
    /// Format: [uuid]
    public var skaterMemberIds: [String]?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case title
        case teamId = "team_id"
        case category
        case musicTitle = "music_title"
        case musicArtist = "music_artist"
        case musicBpm = "music_bpm"
        case musicDurationMs = "music_duration_ms"
        case skaterMemberIds = "skater_member_ids"
    }

    public init(
        clubId: String,
        title: String,
        teamId: String? = nil,
        category: String? = nil,
        musicTitle: String? = nil,
        musicArtist: String? = nil,
        musicBpm: Int? = nil,
        musicDurationMs: Int? = nil,
        skaterMemberIds: [String]? = []
    ) {
        self.clubId = clubId
        self.title = title
        self.teamId = teamId
        self.category = category
        self.musicTitle = musicTitle
        self.musicArtist = musicArtist
        self.musicBpm = musicBpm
        self.musicDurationMs = musicDurationMs
        self.skaterMemberIds = skaterMemberIds
    }
}

public struct RoutineMarker: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var routineId: String
    public var timeMs: Int?
    public var label: String
    public var elementCode: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case routineId = "routine_id"
        case timeMs = "time_ms"
        case label
        case elementCode = "element_code"
    }

    public init(
        id: String,
        clubId: String,
        routineId: String,
        timeMs: Int? = nil,
        label: String,
        elementCode: String? = nil
    ) {
        self.id = id
        self.clubId = clubId
        self.routineId = routineId
        self.timeMs = timeMs
        self.label = label
        self.elementCode = elementCode
    }
}

public struct RoutineMarkerCreate: Codable, Equatable, Sendable {
    public var timeMs: Int
    public var label: String
    public var elementCode: String?

    enum CodingKeys: String, CodingKey {
        case timeMs = "time_ms"
        case label
        case elementCode = "element_code"
    }

    public init(
        timeMs: Int,
        label: String,
        elementCode: String? = nil
    ) {
        self.timeMs = timeMs
        self.label = label
        self.elementCode = elementCode
    }
}

public struct RoutineScore: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var routineId: String
    /// Format: uuid
    public var competitionId: String?
    public var scoredOn: String
    public var scoringSystem: String
    public var technicalScore: Double?
    public var componentsScore: Double?
    public var totalScore: Double?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case routineId = "routine_id"
        case competitionId = "competition_id"
        case scoredOn = "scored_on"
        case scoringSystem = "scoring_system"
        case technicalScore = "technical_score"
        case componentsScore = "components_score"
        case totalScore = "total_score"
        case note
    }

    public init(
        id: String,
        clubId: String,
        routineId: String,
        competitionId: String? = nil,
        scoredOn: String,
        scoringSystem: String,
        technicalScore: Double? = nil,
        componentsScore: Double? = nil,
        totalScore: Double? = nil,
        note: String? = nil
    ) {
        self.id = id
        self.clubId = clubId
        self.routineId = routineId
        self.competitionId = competitionId
        self.scoredOn = scoredOn
        self.scoringSystem = scoringSystem
        self.technicalScore = technicalScore
        self.componentsScore = componentsScore
        self.totalScore = totalScore
        self.note = note
    }
}

public struct RoutineScoreCreate: Codable, Equatable, Sendable {
    /// Format: date
    public var scoredOn: String
    public var scoringSystem: String?
    public var technicalScore: Double?
    public var componentsScore: Double?
    public var totalScore: Double?
    /// Format: uuid
    public var competitionId: String?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case scoredOn = "scored_on"
        case scoringSystem = "scoring_system"
        case technicalScore = "technical_score"
        case componentsScore = "components_score"
        case totalScore = "total_score"
        case competitionId = "competition_id"
        case note
    }

    public init(
        scoredOn: String,
        scoringSystem: String? = "rollart",
        technicalScore: Double? = nil,
        componentsScore: Double? = nil,
        totalScore: Double? = nil,
        competitionId: String? = nil,
        note: String? = nil
    ) {
        self.scoredOn = scoredOn
        self.scoringSystem = scoringSystem
        self.technicalScore = technicalScore
        self.componentsScore = componentsScore
        self.totalScore = totalScore
        self.competitionId = competitionId
        self.note = note
    }
}

public struct CompetitionEntry: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var memberId: String
    /// Format: uuid
    public var routineId: String?
    public var status: CompetitionEntryStatus

    enum CodingKeys: String, CodingKey {
        case id
        case memberId = "member_id"
        case routineId = "routine_id"
        case status
    }

    public init(
        id: String,
        memberId: String,
        routineId: String? = nil,
        status: CompetitionEntryStatus
    ) {
        self.id = id
        self.memberId = memberId
        self.routineId = routineId
        self.status = status
    }
}

public struct Competition: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var location: String?
    public var startsAt: String
    public var endsAt: String
    public var registrationDeadline: String?
    public var status: CompetitionStatus
    public var entries: [CompetitionEntry]
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case name
        case location
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case registrationDeadline = "registration_deadline"
        case status
        case entries
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        name: String,
        location: String? = nil,
        startsAt: String,
        endsAt: String,
        registrationDeadline: String? = nil,
        status: CompetitionStatus,
        entries: [CompetitionEntry],
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.name = name
        self.location = location
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.registrationDeadline = registrationDeadline
        self.status = status
        self.entries = entries
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct Task: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var title: String
    public var done: Bool
    public var dueOn: String?
    /// Format: uuid
    public var assigneeMemberId: String?
    /// Format: uuid
    public var competitionId: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case title
        case done
        case dueOn = "due_on"
        case assigneeMemberId = "assignee_member_id"
        case competitionId = "competition_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        title: String,
        done: Bool,
        dueOn: String? = nil,
        assigneeMemberId: String? = nil,
        competitionId: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.title = title
        self.done = done
        self.dueOn = dueOn
        self.assigneeMemberId = assigneeMemberId
        self.competitionId = competitionId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct TaskUpdate: Codable, Equatable, Sendable {
    public var done: Bool

    enum CodingKeys: String, CodingKey {
        case done
    }

    public init(
        done: Bool
    ) {
        self.done = done
    }
}

public struct Invoice: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    public var number: String
    public var title: String
    public var amountCents: Int?
    public var currency: String
    public var status: InvoiceStatus
    public var dunningLevel: Int
    public var issuedOn: String?
    public var dueOn: String?
    public var paidAt: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case number
        case title
        case amountCents = "amount_cents"
        case currency
        case status
        case dunningLevel = "dunning_level"
        case issuedOn = "issued_on"
        case dueOn = "due_on"
        case paidAt = "paid_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        memberId: String,
        number: String,
        title: String,
        amountCents: Int? = nil,
        currency: String,
        status: InvoiceStatus,
        dunningLevel: Int,
        issuedOn: String? = nil,
        dueOn: String? = nil,
        paidAt: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.memberId = memberId
        self.number = number
        self.title = title
        self.amountCents = amountCents
        self.currency = currency
        self.status = status
        self.dunningLevel = dunningLevel
        self.issuedOn = issuedOn
        self.dueOn = dueOn
        self.paidAt = paidAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct LedgerEntry: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var entryOn: String
    public var description: String
    public var counterpartyKind: CounterpartyKind
    /// Format: uuid
    public var counterpartyMemberId: String?
    public var counterpartyName: String?
    public var amountCents: Int?
    public var currency: String
    public var category: String?
    /// Format: uuid
    public var invoiceId: String?
    /// Format: uuid
    public var reversesEntryId: String?
    public var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case entryOn = "entry_on"
        case description
        case counterpartyKind = "counterparty_kind"
        case counterpartyMemberId = "counterparty_member_id"
        case counterpartyName = "counterparty_name"
        case amountCents = "amount_cents"
        case currency
        case category
        case invoiceId = "invoice_id"
        case reversesEntryId = "reverses_entry_id"
        case createdAt = "created_at"
    }

    public init(
        id: String,
        clubId: String,
        entryOn: String,
        description: String,
        counterpartyKind: CounterpartyKind,
        counterpartyMemberId: String? = nil,
        counterpartyName: String? = nil,
        amountCents: Int? = nil,
        currency: String,
        category: String? = nil,
        invoiceId: String? = nil,
        reversesEntryId: String? = nil,
        createdAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.entryOn = entryOn
        self.description = description
        self.counterpartyKind = counterpartyKind
        self.counterpartyMemberId = counterpartyMemberId
        self.counterpartyName = counterpartyName
        self.amountCents = amountCents
        self.currency = currency
        self.category = category
        self.invoiceId = invoiceId
        self.reversesEntryId = reversesEntryId
        self.createdAt = createdAt
    }
}

public struct InvoiceCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    public var title: String
    public var amountCents: Int
    /// Format: date
    public var dueOn: String?
    public var issue: Bool?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case memberId = "member_id"
        case title
        case amountCents = "amount_cents"
        case dueOn = "due_on"
        case issue
    }

    public init(
        clubId: String,
        memberId: String,
        title: String,
        amountCents: Int,
        dueOn: String? = nil,
        issue: Bool? = false
    ) {
        self.clubId = clubId
        self.memberId = memberId
        self.title = title
        self.amountCents = amountCents
        self.dueOn = dueOn
        self.issue = issue
    }
}

public struct Entitlement: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    public var subjectType: EntitlementSubjectType
    /// Format: uuid
    public var subjectId: String
    public var entitlement: String
    public var source: EntitlementSource
    /// Format: uuid
    public var productId: String?
    public var validUntil: String?

    enum CodingKeys: String, CodingKey {
        case id
        case subjectType = "subject_type"
        case subjectId = "subject_id"
        case entitlement
        case source
        case productId = "product_id"
        case validUntil = "valid_until"
    }

    public init(
        id: String,
        subjectType: EntitlementSubjectType,
        subjectId: String,
        entitlement: String,
        source: EntitlementSource,
        productId: String? = nil,
        validUntil: String? = nil
    ) {
        self.id = id
        self.subjectType = subjectType
        self.subjectId = subjectId
        self.entitlement = entitlement
        self.source = source
        self.productId = productId
        self.validUntil = validUntil
    }
}

public struct Product: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    public var code: String
    public var kind: ProductKind
    public var name: String
    public var description: String?
    public var priceCents: Int?
    public var currency: String
    public var billingInterval: ProductBillingInterval
    public var maxMembers: Int?
    public var active: Bool
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case code
        case kind
        case name
        case description
        case priceCents = "price_cents"
        case currency
        case billingInterval = "billing_interval"
        case maxMembers = "max_members"
        case active
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        code: String,
        kind: ProductKind,
        name: String,
        description: String? = nil,
        priceCents: Int? = nil,
        currency: String,
        billingInterval: ProductBillingInterval,
        maxMembers: Int? = nil,
        active: Bool,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.code = code
        self.kind = kind
        self.name = name
        self.description = description
        self.priceCents = priceCents
        self.currency = currency
        self.billingInterval = billingInterval
        self.maxMembers = maxMembers
        self.active = active
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct DunningAction: Codable, Equatable, Sendable {
    /// Format: uuid
    public var invoiceId: String
    public var number: String
    /// Format: uuid
    public var memberId: String
    public var amountCents: Int
    public var daysOverdue: Int
    public var currentLevel: Int
    public var proposedStage: Int
    public var proposedLevel: Int
    public var escalation: Bool
    public var action: DunningActionAction

    enum CodingKeys: String, CodingKey {
        case invoiceId = "invoice_id"
        case number
        case memberId = "member_id"
        case amountCents = "amount_cents"
        case daysOverdue = "days_overdue"
        case currentLevel = "current_level"
        case proposedStage = "proposed_stage"
        case proposedLevel = "proposed_level"
        case escalation
        case action
    }

    public init(
        invoiceId: String,
        number: String,
        memberId: String,
        amountCents: Int,
        daysOverdue: Int,
        currentLevel: Int,
        proposedStage: Int,
        proposedLevel: Int,
        escalation: Bool,
        action: DunningActionAction
    ) {
        self.invoiceId = invoiceId
        self.number = number
        self.memberId = memberId
        self.amountCents = amountCents
        self.daysOverdue = daysOverdue
        self.currentLevel = currentLevel
        self.proposedStage = proposedStage
        self.proposedLevel = proposedLevel
        self.escalation = escalation
        self.action = action
    }
}

public struct DunningRunResult: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var dryRun: Bool
    public var asOf: String
    public var timelineDays: [Int]
    public var actions: [DunningAction]
    public var applied: Int
    public var summary: DunningRunResultSummary

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case dryRun = "dry_run"
        case asOf = "as_of"
        case timelineDays = "timeline_days"
        case actions
        case applied
        case summary
    }

    public init(
        clubId: String,
        dryRun: Bool,
        asOf: String,
        timelineDays: [Int],
        actions: [DunningAction],
        applied: Int,
        summary: DunningRunResultSummary
    ) {
        self.clubId = clubId
        self.dryRun = dryRun
        self.asOf = asOf
        self.timelineDays = timelineDays
        self.actions = actions
        self.applied = applied
        self.summary = summary
    }
}

public struct DunningRunRequest: Codable, Equatable, Sendable {
    public var dryRun: Bool?
    /// Format: date
    public var asOf: String?

    enum CodingKeys: String, CodingKey {
        case dryRun = "dry_run"
        case asOf = "as_of"
    }

    public init(
        dryRun: Bool? = true,
        asOf: String? = nil
    ) {
        self.dryRun = dryRun
        self.asOf = asOf
    }
}
