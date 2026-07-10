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

public enum ExerciseCategory: String, Codable, CaseIterable, Sendable, Equatable {
    case warmup = "warmup"
    case stretching = "stretching"
    case strength = "strength"
    case jump = "jump"
    case spin = "spin"
    case steps = "steps"
    case combination = "combination"
}

public enum FacilityKind: String, Codable, CaseIterable, Sendable, Equatable {
    case hall = "hall"
    case room = "room"
    case outdoor = "outdoor"
    case other = "other"
}

public enum BookingStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case confirmed = "confirmed"
    case pending = "pending"
    case cancelled = "cancelled"
}

public enum EquipmentCondition: String, Codable, CaseIterable, Sendable, Equatable {
    case good = "good"
    case fair = "fair"
    case defect = "defect"
}

public enum ReservationStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case active = "active"
    case returned = "returned"
    case cancelled = "cancelled"
}

public enum Medal: String, Codable, CaseIterable, Sendable, Equatable {
    case gold = "gold"
    case silver = "silver"
    case bronze = "bronze"
}

public enum DutyKind: String, Codable, CaseIterable, Sendable, Equatable {
    case training = "training"
    case helper = "helper"
    case competition = "competition"
    case other = "other"
}

public enum ChatChannelType: String, Codable, CaseIterable, Sendable, Equatable {
    case team = "team"
    case direct = "direct"
}

public enum CheckinMethod: String, Codable, CaseIterable, Sendable, Equatable {
    case qr = "qr"
    case manual = "manual"
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

public struct News: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var authorMemberId: String
    public var title: String
    public var body: String
    public var isPinned: Bool
    public var publishedAt: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case authorMemberId = "author_member_id"
        case title
        case body
        case isPinned = "is_pinned"
        case publishedAt = "published_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        authorMemberId: String,
        title: String,
        body: String,
        isPinned: Bool,
        publishedAt: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.authorMemberId = authorMemberId
        self.title = title
        self.body = body
        self.isPinned = isPinned
        self.publishedAt = publishedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct NewsCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var title: String
    public var body: String
    public var isPinned: Bool?
    /// Format: date-time
    public var publishedAt: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case title
        case body
        case isPinned = "is_pinned"
        case publishedAt = "published_at"
    }

    public init(
        clubId: String,
        title: String,
        body: String,
        isPinned: Bool? = false,
        publishedAt: String? = nil
    ) {
        self.clubId = clubId
        self.title = title
        self.body = body
        self.isPinned = isPinned
        self.publishedAt = publishedAt
    }
}

public struct NewsUpdate: Codable, Equatable, Sendable {
    public var title: String?
    public var body: String?
    public var isPinned: Bool?
    /// Format: date-time
    public var publishedAt: String?

    enum CodingKeys: String, CodingKey {
        case title
        case body
        case isPinned = "is_pinned"
        case publishedAt = "published_at"
    }

    public init(
        title: String? = nil,
        body: String? = nil,
        isPinned: Bool? = nil,
        publishedAt: String? = nil
    ) {
        self.title = title
        self.body = body
        self.isPinned = isPinned
        self.publishedAt = publishedAt
    }
}

public struct Note: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var ownerProfileId: String
    /// Format: uuid
    public var clubId: String?
    public var title: String
    public var body: String
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case ownerProfileId = "owner_profile_id"
        case clubId = "club_id"
        case title
        case body
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        ownerProfileId: String,
        clubId: String? = nil,
        title: String,
        body: String,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.ownerProfileId = ownerProfileId
        self.clubId = clubId
        self.title = title
        self.body = body
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct NoteCreate: Codable, Equatable, Sendable {
    public var title: String
    public var body: String
    /// Format: uuid
    public var clubId: String?

    enum CodingKeys: String, CodingKey {
        case title
        case body
        case clubId = "club_id"
    }

    public init(
        title: String,
        body: String,
        clubId: String? = nil
    ) {
        self.title = title
        self.body = body
        self.clubId = clubId
    }
}

public struct NoteUpdate: Codable, Equatable, Sendable {
    public var title: String?
    public var body: String?
    /// Format: uuid
    public var clubId: String?

    enum CodingKeys: String, CodingKey {
        case title
        case body
        case clubId = "club_id"
    }

    public init(
        title: String? = nil,
        body: String? = nil,
        clubId: String? = nil
    ) {
        self.title = title
        self.body = body
        self.clubId = clubId
    }
}

public struct Exercise: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var createdByMemberId: String
    public var name: String
    public var description: String?
    public var category: ExerciseCategory
    public var difficulty: Int?
    public var videoUrl: String?
    public var instructions: String?
    public var durationSeconds: Int?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case createdByMemberId = "created_by_member_id"
        case name
        case description
        case category
        case difficulty
        case videoUrl = "video_url"
        case instructions
        case durationSeconds = "duration_seconds"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        createdByMemberId: String,
        name: String,
        description: String? = nil,
        category: ExerciseCategory,
        difficulty: Int? = nil,
        videoUrl: String? = nil,
        instructions: String? = nil,
        durationSeconds: Int? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.createdByMemberId = createdByMemberId
        self.name = name
        self.description = description
        self.category = category
        self.difficulty = difficulty
        self.videoUrl = videoUrl
        self.instructions = instructions
        self.durationSeconds = durationSeconds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct ExerciseCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var category: ExerciseCategory
    public var difficulty: Int
    public var description: String?
    /// Format: uri
    public var videoUrl: String?
    public var instructions: String?
    public var durationSeconds: Int?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case name
        case category
        case difficulty
        case description
        case videoUrl = "video_url"
        case instructions
        case durationSeconds = "duration_seconds"
    }

    public init(
        clubId: String,
        name: String,
        category: ExerciseCategory,
        difficulty: Int,
        description: String? = nil,
        videoUrl: String? = nil,
        instructions: String? = nil,
        durationSeconds: Int? = nil
    ) {
        self.clubId = clubId
        self.name = name
        self.category = category
        self.difficulty = difficulty
        self.description = description
        self.videoUrl = videoUrl
        self.instructions = instructions
        self.durationSeconds = durationSeconds
    }
}

public struct ExerciseUpdate: Codable, Equatable, Sendable {
    public var name: String?
    public var category: ExerciseCategory?
    public var difficulty: Int?
    public var description: String?
    /// Format: uri
    public var videoUrl: String?
    public var instructions: String?
    public var durationSeconds: Int?

    enum CodingKeys: String, CodingKey {
        case name
        case category
        case difficulty
        case description
        case videoUrl = "video_url"
        case instructions
        case durationSeconds = "duration_seconds"
    }

    public init(
        name: String? = nil,
        category: ExerciseCategory? = nil,
        difficulty: Int? = nil,
        description: String? = nil,
        videoUrl: String? = nil,
        instructions: String? = nil,
        durationSeconds: Int? = nil
    ) {
        self.name = name
        self.category = category
        self.difficulty = difficulty
        self.description = description
        self.videoUrl = videoUrl
        self.instructions = instructions
        self.durationSeconds = durationSeconds
    }
}

public struct Facility: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var kind: FacilityKind
    public var address: String?
    public var capacity: Int?
    public var notes: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case name
        case kind
        case address
        case capacity
        case notes
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        name: String,
        kind: FacilityKind,
        address: String? = nil,
        capacity: Int? = nil,
        notes: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.name = name
        self.kind = kind
        self.address = address
        self.capacity = capacity
        self.notes = notes
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct FacilityCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var kind: FacilityKind?
    public var address: String?
    public var capacity: Int?
    public var notes: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case name
        case kind
        case address
        case capacity
        case notes
    }

    public init(
        clubId: String,
        name: String,
        kind: FacilityKind? = .hall,
        address: String? = nil,
        capacity: Int? = nil,
        notes: String? = nil
    ) {
        self.clubId = clubId
        self.name = name
        self.kind = kind
        self.address = address
        self.capacity = capacity
        self.notes = notes
    }
}

public struct FacilityUpdate: Codable, Equatable, Sendable {
    public var name: String?
    public var kind: FacilityKind?
    public var address: String?
    public var capacity: Int?
    public var notes: String?

    enum CodingKeys: String, CodingKey {
        case name
        case kind
        case address
        case capacity
        case notes
    }

    public init(
        name: String? = nil,
        kind: FacilityKind? = nil,
        address: String? = nil,
        capacity: Int? = nil,
        notes: String? = nil
    ) {
        self.name = name
        self.kind = kind
        self.address = address
        self.capacity = capacity
        self.notes = notes
    }
}

public struct FacilityBooking: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var facilityId: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var bookedByMemberId: String
    /// Format: uuid
    public var teamId: String?
    public var title: String
    public var startsAt: String
    public var endsAt: String
    public var status: BookingStatus
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case facilityId = "facility_id"
        case clubId = "club_id"
        case bookedByMemberId = "booked_by_member_id"
        case teamId = "team_id"
        case title
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        facilityId: String,
        clubId: String,
        bookedByMemberId: String,
        teamId: String? = nil,
        title: String,
        startsAt: String,
        endsAt: String,
        status: BookingStatus,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.facilityId = facilityId
        self.clubId = clubId
        self.bookedByMemberId = bookedByMemberId
        self.teamId = teamId
        self.title = title
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct FacilityBookingCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var facilityId: String
    /// Format: uuid
    public var bookedByMemberId: String
    /// Format: uuid
    public var teamId: String?
    public var title: String
    /// Format: date-time
    public var startsAt: String
    /// Format: date-time
    public var endsAt: String
    public var status: BookingStatus?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case facilityId = "facility_id"
        case bookedByMemberId = "booked_by_member_id"
        case teamId = "team_id"
        case title
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case status
    }

    public init(
        clubId: String,
        facilityId: String,
        bookedByMemberId: String,
        teamId: String? = nil,
        title: String,
        startsAt: String,
        endsAt: String,
        status: BookingStatus? = .confirmed
    ) {
        self.clubId = clubId
        self.facilityId = facilityId
        self.bookedByMemberId = bookedByMemberId
        self.teamId = teamId
        self.title = title
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.status = status
    }
}

public struct FacilityBookingUpdate: Codable, Equatable, Sendable {
    public var title: String?
    /// Format: uuid
    public var teamId: String?
    /// Format: date-time
    public var startsAt: String?
    /// Format: date-time
    public var endsAt: String?
    public var status: BookingStatus?

    enum CodingKeys: String, CodingKey {
        case title
        case teamId = "team_id"
        case startsAt = "starts_at"
        case endsAt = "ends_at"
        case status
    }

    public init(
        title: String? = nil,
        teamId: String? = nil,
        startsAt: String? = nil,
        endsAt: String? = nil,
        status: BookingStatus? = nil
    ) {
        self.title = title
        self.teamId = teamId
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.status = status
    }
}

public struct Equipment: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var category: String?
    public var totalQuantity: Int?
    public var availableQuantity: Int?
    public var condition: EquipmentCondition
    public var notes: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case name
        case category
        case totalQuantity = "total_quantity"
        case availableQuantity = "available_quantity"
        case condition
        case notes
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        name: String,
        category: String? = nil,
        totalQuantity: Int? = nil,
        availableQuantity: Int? = nil,
        condition: EquipmentCondition,
        notes: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.name = name
        self.category = category
        self.totalQuantity = totalQuantity
        self.availableQuantity = availableQuantity
        self.condition = condition
        self.notes = notes
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct EquipmentCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var category: String?
    public var totalQuantity: Int?
    public var availableQuantity: Int?
    public var condition: EquipmentCondition?
    public var notes: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case name
        case category
        case totalQuantity = "total_quantity"
        case availableQuantity = "available_quantity"
        case condition
        case notes
    }

    public init(
        clubId: String,
        name: String,
        category: String? = nil,
        totalQuantity: Int? = 1,
        availableQuantity: Int? = nil,
        condition: EquipmentCondition? = .good,
        notes: String? = nil
    ) {
        self.clubId = clubId
        self.name = name
        self.category = category
        self.totalQuantity = totalQuantity
        self.availableQuantity = availableQuantity
        self.condition = condition
        self.notes = notes
    }
}

public struct EquipmentUpdate: Codable, Equatable, Sendable {
    public var name: String?
    public var category: String?
    public var totalQuantity: Int?
    public var availableQuantity: Int?
    public var condition: EquipmentCondition?
    public var notes: String?

    enum CodingKeys: String, CodingKey {
        case name
        case category
        case totalQuantity = "total_quantity"
        case availableQuantity = "available_quantity"
        case condition
        case notes
    }

    public init(
        name: String? = nil,
        category: String? = nil,
        totalQuantity: Int? = nil,
        availableQuantity: Int? = nil,
        condition: EquipmentCondition? = nil,
        notes: String? = nil
    ) {
        self.name = name
        self.category = category
        self.totalQuantity = totalQuantity
        self.availableQuantity = availableQuantity
        self.condition = condition
        self.notes = notes
    }
}

public struct EquipmentReservation: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var equipmentId: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var reservedByMemberId: String
    public var quantity: Int?
    public var fromAt: String
    public var toAt: String
    public var status: ReservationStatus
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case equipmentId = "equipment_id"
        case clubId = "club_id"
        case reservedByMemberId = "reserved_by_member_id"
        case quantity
        case fromAt = "from_at"
        case toAt = "to_at"
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        equipmentId: String,
        clubId: String,
        reservedByMemberId: String,
        quantity: Int? = nil,
        fromAt: String,
        toAt: String,
        status: ReservationStatus,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.equipmentId = equipmentId
        self.clubId = clubId
        self.reservedByMemberId = reservedByMemberId
        self.quantity = quantity
        self.fromAt = fromAt
        self.toAt = toAt
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct EquipmentReservationCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var equipmentId: String
    /// Format: uuid
    public var reservedByMemberId: String
    public var quantity: Int?
    /// Format: date-time
    public var fromAt: String
    /// Format: date-time
    public var toAt: String
    public var status: ReservationStatus?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case equipmentId = "equipment_id"
        case reservedByMemberId = "reserved_by_member_id"
        case quantity
        case fromAt = "from_at"
        case toAt = "to_at"
        case status
    }

    public init(
        clubId: String,
        equipmentId: String,
        reservedByMemberId: String,
        quantity: Int? = 1,
        fromAt: String,
        toAt: String,
        status: ReservationStatus? = .active
    ) {
        self.clubId = clubId
        self.equipmentId = equipmentId
        self.reservedByMemberId = reservedByMemberId
        self.quantity = quantity
        self.fromAt = fromAt
        self.toAt = toAt
        self.status = status
    }
}

public struct EquipmentReservationUpdate: Codable, Equatable, Sendable {
    public var quantity: Int?
    /// Format: date-time
    public var fromAt: String?
    /// Format: date-time
    public var toAt: String?
    public var status: ReservationStatus?

    enum CodingKeys: String, CodingKey {
        case quantity
        case fromAt = "from_at"
        case toAt = "to_at"
        case status
    }

    public init(
        quantity: Int? = nil,
        fromAt: String? = nil,
        toAt: String? = nil,
        status: ReservationStatus? = nil
    ) {
        self.quantity = quantity
        self.fromAt = fromAt
        self.toAt = toAt
        self.status = status
    }
}

public struct Achievement: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    public var title: String
    public var competitionName: String?
    public var placement: Int?
    public var medal: Medal
    public var achievedOn: String
    public var note: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case title
        case competitionName = "competition_name"
        case placement
        case medal
        case achievedOn = "achieved_on"
        case note
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        memberId: String,
        title: String,
        competitionName: String? = nil,
        placement: Int? = nil,
        medal: Medal,
        achievedOn: String,
        note: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.memberId = memberId
        self.title = title
        self.competitionName = competitionName
        self.placement = placement
        self.medal = medal
        self.achievedOn = achievedOn
        self.note = note
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct AchievementCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    public var title: String
    public var competitionName: String?
    public var placement: Int?
    public var medal: Medal?
    /// Format: date
    public var achievedOn: String
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case memberId = "member_id"
        case title
        case competitionName = "competition_name"
        case placement
        case medal
        case achievedOn = "achieved_on"
        case note
    }

    public init(
        clubId: String,
        memberId: String,
        title: String,
        competitionName: String? = nil,
        placement: Int? = nil,
        medal: Medal? = nil,
        achievedOn: String,
        note: String? = nil
    ) {
        self.clubId = clubId
        self.memberId = memberId
        self.title = title
        self.competitionName = competitionName
        self.placement = placement
        self.medal = medal
        self.achievedOn = achievedOn
        self.note = note
    }
}

public struct AchievementUpdate: Codable, Equatable, Sendable {
    public var title: String?
    public var competitionName: String?
    public var placement: Int?
    public var medal: Medal?
    /// Format: date
    public var achievedOn: String?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case title
        case competitionName = "competition_name"
        case placement
        case medal
        case achievedOn = "achieved_on"
        case note
    }

    public init(
        title: String? = nil,
        competitionName: String? = nil,
        placement: Int? = nil,
        medal: Medal? = nil,
        achievedOn: String? = nil,
        note: String? = nil
    ) {
        self.title = title
        self.competitionName = competitionName
        self.placement = placement
        self.medal = medal
        self.achievedOn = achievedOn
        self.note = note
    }
}

public struct TrainingSlot: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var teamId: String?
    public var weekday: Weekday
    public var startsTime: String
    public var endsTime: String
    /// Format: uuid
    public var facilityId: String?
    public var location: String?
    /// Format: uuid
    public var coachMemberId: String?
    public var note: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case teamId = "team_id"
        case weekday
        case startsTime = "starts_time"
        case endsTime = "ends_time"
        case facilityId = "facility_id"
        case location
        case coachMemberId = "coach_member_id"
        case note
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        teamId: String? = nil,
        weekday: Weekday,
        startsTime: String,
        endsTime: String,
        facilityId: String? = nil,
        location: String? = nil,
        coachMemberId: String? = nil,
        note: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.teamId = teamId
        self.weekday = weekday
        self.startsTime = startsTime
        self.endsTime = endsTime
        self.facilityId = facilityId
        self.location = location
        self.coachMemberId = coachMemberId
        self.note = note
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct TrainingSlotCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var weekday: Weekday
    public var startsTime: String
    public var endsTime: String
    /// Format: uuid
    public var teamId: String?
    /// Format: uuid
    public var facilityId: String?
    public var location: String?
    /// Format: uuid
    public var coachMemberId: String?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case weekday
        case startsTime = "starts_time"
        case endsTime = "ends_time"
        case teamId = "team_id"
        case facilityId = "facility_id"
        case location
        case coachMemberId = "coach_member_id"
        case note
    }

    public init(
        clubId: String,
        weekday: Weekday,
        startsTime: String,
        endsTime: String,
        teamId: String? = nil,
        facilityId: String? = nil,
        location: String? = nil,
        coachMemberId: String? = nil,
        note: String? = nil
    ) {
        self.clubId = clubId
        self.weekday = weekday
        self.startsTime = startsTime
        self.endsTime = endsTime
        self.teamId = teamId
        self.facilityId = facilityId
        self.location = location
        self.coachMemberId = coachMemberId
        self.note = note
    }
}

public struct TrainingSlotUpdate: Codable, Equatable, Sendable {
    public var weekday: Weekday?
    public var startsTime: String?
    public var endsTime: String?
    /// Format: uuid
    public var teamId: String?
    /// Format: uuid
    public var facilityId: String?
    public var location: String?
    /// Format: uuid
    public var coachMemberId: String?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case weekday
        case startsTime = "starts_time"
        case endsTime = "ends_time"
        case teamId = "team_id"
        case facilityId = "facility_id"
        case location
        case coachMemberId = "coach_member_id"
        case note
    }

    public init(
        weekday: Weekday? = nil,
        startsTime: String? = nil,
        endsTime: String? = nil,
        teamId: String? = nil,
        facilityId: String? = nil,
        location: String? = nil,
        coachMemberId: String? = nil,
        note: String? = nil
    ) {
        self.weekday = weekday
        self.startsTime = startsTime
        self.endsTime = endsTime
        self.teamId = teamId
        self.facilityId = facilityId
        self.location = location
        self.coachMemberId = coachMemberId
        self.note = note
    }
}

public struct DutyRequirement: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var teamId: String?
    /// Format: uuid
    public var memberId: String?
    public var seasonLabel: String
    public var requiredHours: Double?
    public var periodStart: String
    public var periodEnd: String
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case teamId = "team_id"
        case memberId = "member_id"
        case seasonLabel = "season_label"
        case requiredHours = "required_hours"
        case periodStart = "period_start"
        case periodEnd = "period_end"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        teamId: String? = nil,
        memberId: String? = nil,
        seasonLabel: String,
        requiredHours: Double? = nil,
        periodStart: String,
        periodEnd: String,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.teamId = teamId
        self.memberId = memberId
        self.seasonLabel = seasonLabel
        self.requiredHours = requiredHours
        self.periodStart = periodStart
        self.periodEnd = periodEnd
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct DutyRequirementCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var seasonLabel: String
    public var requiredHours: Double
    /// Format: date
    public var periodStart: String
    /// Format: date
    public var periodEnd: String
    /// Format: uuid
    public var teamId: String?
    /// Format: uuid
    public var memberId: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case seasonLabel = "season_label"
        case requiredHours = "required_hours"
        case periodStart = "period_start"
        case periodEnd = "period_end"
        case teamId = "team_id"
        case memberId = "member_id"
    }

    public init(
        clubId: String,
        seasonLabel: String,
        requiredHours: Double,
        periodStart: String,
        periodEnd: String,
        teamId: String? = nil,
        memberId: String? = nil
    ) {
        self.clubId = clubId
        self.seasonLabel = seasonLabel
        self.requiredHours = requiredHours
        self.periodStart = periodStart
        self.periodEnd = periodEnd
        self.teamId = teamId
        self.memberId = memberId
    }
}

public struct DutyRequirementUpdate: Codable, Equatable, Sendable {
    public var seasonLabel: String?
    public var requiredHours: Double?
    /// Format: date
    public var periodStart: String?
    /// Format: date
    public var periodEnd: String?
    /// Format: uuid
    public var teamId: String?
    /// Format: uuid
    public var memberId: String?

    enum CodingKeys: String, CodingKey {
        case seasonLabel = "season_label"
        case requiredHours = "required_hours"
        case periodStart = "period_start"
        case periodEnd = "period_end"
        case teamId = "team_id"
        case memberId = "member_id"
    }

    public init(
        seasonLabel: String? = nil,
        requiredHours: Double? = nil,
        periodStart: String? = nil,
        periodEnd: String? = nil,
        teamId: String? = nil,
        memberId: String? = nil
    ) {
        self.seasonLabel = seasonLabel
        self.requiredHours = requiredHours
        self.periodStart = periodStart
        self.periodEnd = periodEnd
        self.teamId = teamId
        self.memberId = memberId
    }
}

public struct DutyEntry: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    public var hours: Double?
    public var activityDate: String
    public var kind: DutyKind
    public var note: String?
    public var approved: Bool
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case hours
        case activityDate = "activity_date"
        case kind
        case note
        case approved
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        memberId: String,
        hours: Double? = nil,
        activityDate: String,
        kind: DutyKind,
        note: String? = nil,
        approved: Bool,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.memberId = memberId
        self.hours = hours
        self.activityDate = activityDate
        self.kind = kind
        self.note = note
        self.approved = approved
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct DutyEntryCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    public var hours: Double
    /// Format: date
    public var activityDate: String
    public var kind: DutyKind?
    public var note: String?
    public var approved: Bool?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case memberId = "member_id"
        case hours
        case activityDate = "activity_date"
        case kind
        case note
        case approved
    }

    public init(
        clubId: String,
        memberId: String,
        hours: Double,
        activityDate: String,
        kind: DutyKind? = .training,
        note: String? = nil,
        approved: Bool? = false
    ) {
        self.clubId = clubId
        self.memberId = memberId
        self.hours = hours
        self.activityDate = activityDate
        self.kind = kind
        self.note = note
        self.approved = approved
    }
}

public struct DutyEntryUpdate: Codable, Equatable, Sendable {
    public var hours: Double?
    /// Format: date
    public var activityDate: String?
    public var kind: DutyKind?
    public var note: String?
    public var approved: Bool?

    enum CodingKeys: String, CodingKey {
        case hours
        case activityDate = "activity_date"
        case kind
        case note
        case approved
    }

    public init(
        hours: Double? = nil,
        activityDate: String? = nil,
        kind: DutyKind? = nil,
        note: String? = nil,
        approved: Bool? = nil
    ) {
        self.hours = hours
        self.activityDate = activityDate
        self.kind = kind
        self.note = note
        self.approved = approved
    }
}

public struct ChatChannel: Codable, Equatable, Sendable {
    public var channelType: ChatChannelType
    /// Format: uuid
    public var teamId: String?
    public var teamName: String?
    /// Format: uuid
    public var peerMemberId: String?
    public var peerName: String?
    /// Format: uuid
    public var lastMessageId: String?
    public var lastBody: String?
    public var lastImageUrl: String?
    /// Format: uuid
    public var lastSenderMemberId: String?
    public var lastMessageAt: String?

    enum CodingKeys: String, CodingKey {
        case channelType = "channel_type"
        case teamId = "team_id"
        case teamName = "team_name"
        case peerMemberId = "peer_member_id"
        case peerName = "peer_name"
        case lastMessageId = "last_message_id"
        case lastBody = "last_body"
        case lastImageUrl = "last_image_url"
        case lastSenderMemberId = "last_sender_member_id"
        case lastMessageAt = "last_message_at"
    }

    public init(
        channelType: ChatChannelType,
        teamId: String? = nil,
        teamName: String? = nil,
        peerMemberId: String? = nil,
        peerName: String? = nil,
        lastMessageId: String? = nil,
        lastBody: String? = nil,
        lastImageUrl: String? = nil,
        lastSenderMemberId: String? = nil,
        lastMessageAt: String? = nil
    ) {
        self.channelType = channelType
        self.teamId = teamId
        self.teamName = teamName
        self.peerMemberId = peerMemberId
        self.peerName = peerName
        self.lastMessageId = lastMessageId
        self.lastBody = lastBody
        self.lastImageUrl = lastImageUrl
        self.lastSenderMemberId = lastSenderMemberId
        self.lastMessageAt = lastMessageAt
    }
}

public struct ChatMessage: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var channelType: ChatChannelType
    /// Format: uuid
    public var teamId: String?
    /// Format: uuid
    public var senderMemberId: String
    /// Format: uuid
    public var recipientMemberId: String?
    public var body: String?
    public var imageUrl: String?
    public var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case channelType = "channel_type"
        case teamId = "team_id"
        case senderMemberId = "sender_member_id"
        case recipientMemberId = "recipient_member_id"
        case body
        case imageUrl = "image_url"
        case createdAt = "created_at"
    }

    public init(
        id: String,
        clubId: String,
        channelType: ChatChannelType,
        teamId: String? = nil,
        senderMemberId: String,
        recipientMemberId: String? = nil,
        body: String? = nil,
        imageUrl: String? = nil,
        createdAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.channelType = channelType
        self.teamId = teamId
        self.senderMemberId = senderMemberId
        self.recipientMemberId = recipientMemberId
        self.body = body
        self.imageUrl = imageUrl
        self.createdAt = createdAt
    }
}

public struct ChatMessageCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var channelType: ChatChannelType
    /// Format: uuid
    public var teamId: String?
    /// Format: uuid
    public var recipientMemberId: String?
    public var body: String?
    /// Format: uri
    public var imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case channelType = "channel_type"
        case teamId = "team_id"
        case recipientMemberId = "recipient_member_id"
        case body
        case imageUrl = "image_url"
    }

    public init(
        clubId: String,
        channelType: ChatChannelType,
        teamId: String? = nil,
        recipientMemberId: String? = nil,
        body: String? = nil,
        imageUrl: String? = nil
    ) {
        self.clubId = clubId
        self.channelType = channelType
        self.teamId = teamId
        self.recipientMemberId = recipientMemberId
        self.body = body
        self.imageUrl = imageUrl
    }
}

public struct Checkin: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    /// Format: uuid
    public var eventId: String?
    public var method: CheckinMethod
    public var checkedInAt: String
    public var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case eventId = "event_id"
        case method
        case checkedInAt = "checked_in_at"
        case createdAt = "created_at"
    }

    public init(
        id: String,
        clubId: String,
        memberId: String,
        eventId: String? = nil,
        method: CheckinMethod,
        checkedInAt: String,
        createdAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.memberId = memberId
        self.eventId = eventId
        self.method = method
        self.checkedInAt = checkedInAt
        self.createdAt = createdAt
    }
}

public struct CheckinCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    /// Format: uuid
    public var eventId: String?
    public var method: CheckinMethod?
    /// Format: date-time
    public var checkedInAt: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case memberId = "member_id"
        case eventId = "event_id"
        case method
        case checkedInAt = "checked_in_at"
    }

    public init(
        clubId: String,
        memberId: String,
        eventId: String? = nil,
        method: CheckinMethod? = .qr,
        checkedInAt: String? = nil
    ) {
        self.clubId = clubId
        self.memberId = memberId
        self.eventId = eventId
        self.method = method
        self.checkedInAt = checkedInAt
    }
}

public struct RegionalEvent: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var title: String
    public var hostOrg: String?
    public var discipline: String?
    public var location: String?
    public var startsOn: String
    public var endsOn: String?
    public var registrationUrl: String?
    public var description: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case title
        case hostOrg = "host_org"
        case discipline
        case location
        case startsOn = "starts_on"
        case endsOn = "ends_on"
        case registrationUrl = "registration_url"
        case description
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        title: String,
        hostOrg: String? = nil,
        discipline: String? = nil,
        location: String? = nil,
        startsOn: String,
        endsOn: String? = nil,
        registrationUrl: String? = nil,
        description: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.title = title
        self.hostOrg = hostOrg
        self.discipline = discipline
        self.location = location
        self.startsOn = startsOn
        self.endsOn = endsOn
        self.registrationUrl = registrationUrl
        self.description = description
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct RegionalEventCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var title: String
    /// Format: date
    public var startsOn: String
    /// Format: date
    public var endsOn: String?
    public var hostOrg: String?
    public var discipline: String?
    public var location: String?
    /// Format: uri
    public var registrationUrl: String?
    public var description: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case title
        case startsOn = "starts_on"
        case endsOn = "ends_on"
        case hostOrg = "host_org"
        case discipline
        case location
        case registrationUrl = "registration_url"
        case description
    }

    public init(
        clubId: String,
        title: String,
        startsOn: String,
        endsOn: String? = nil,
        hostOrg: String? = nil,
        discipline: String? = nil,
        location: String? = nil,
        registrationUrl: String? = nil,
        description: String? = nil
    ) {
        self.clubId = clubId
        self.title = title
        self.startsOn = startsOn
        self.endsOn = endsOn
        self.hostOrg = hostOrg
        self.discipline = discipline
        self.location = location
        self.registrationUrl = registrationUrl
        self.description = description
    }
}

public struct RegionalEventUpdate: Codable, Equatable, Sendable {
    public var title: String?
    /// Format: date
    public var startsOn: String?
    /// Format: date
    public var endsOn: String?
    public var hostOrg: String?
    public var discipline: String?
    public var location: String?
    /// Format: uri
    public var registrationUrl: String?
    public var description: String?

    enum CodingKeys: String, CodingKey {
        case title
        case startsOn = "starts_on"
        case endsOn = "ends_on"
        case hostOrg = "host_org"
        case discipline
        case location
        case registrationUrl = "registration_url"
        case description
    }

    public init(
        title: String? = nil,
        startsOn: String? = nil,
        endsOn: String? = nil,
        hostOrg: String? = nil,
        discipline: String? = nil,
        location: String? = nil,
        registrationUrl: String? = nil,
        description: String? = nil
    ) {
        self.title = title
        self.startsOn = startsOn
        self.endsOn = endsOn
        self.hostOrg = hostOrg
        self.discipline = discipline
        self.location = location
        self.registrationUrl = registrationUrl
        self.description = description
    }
}

public struct ReportRoleCount: Codable, Equatable, Sendable {
    public var role: ClubRole
    public var count: Int?

    enum CodingKeys: String, CodingKey {
        case role
        case count
    }

    public init(
        role: ClubRole,
        count: Int? = nil
    ) {
        self.role = role
        self.count = count
    }
}

public struct ReportTeamCount: Codable, Equatable, Sendable {
    /// Format: uuid
    public var teamId: String
    public var teamName: String
    public var memberCount: Int?

    enum CodingKeys: String, CodingKey {
        case teamId = "team_id"
        case teamName = "team_name"
        case memberCount = "member_count"
    }

    public init(
        teamId: String,
        teamName: String,
        memberCount: Int? = nil
    ) {
        self.teamId = teamId
        self.teamName = teamName
        self.memberCount = memberCount
    }
}

public struct ReportMedalCounts: Codable, Equatable, Sendable {
    public var gold: Int?
    public var silver: Int?
    public var bronze: Int?

    enum CodingKeys: String, CodingKey {
        case gold
        case silver
        case bronze
    }

    public init(
        gold: Int? = nil,
        silver: Int? = nil,
        bronze: Int? = nil
    ) {
        self.gold = gold
        self.silver = silver
        self.bronze = bronze
    }
}

public struct ReportUpcomingEvent: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    public var title: String
    public var type: EventType
    public var startsAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case type
        case startsAt = "starts_at"
    }

    public init(
        id: String,
        title: String,
        type: EventType,
        startsAt: String
    ) {
        self.id = id
        self.title = title
        self.type = type
        self.startsAt = startsAt
    }
}

public struct ReportSummary: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var membersTotal: Int?
    public var membersActive: Int?
    public var membersByRole: [ReportRoleCount]
    public var membersByTeam: [ReportTeamCount]
    public var attendanceRate: Double?
    public var openInvoicesTotalCents: Int?
    public var openInvoicesCount: Int?
    public var medals: ReportMedalCounts
    public var upcomingEventsCount: Int?
    public var upcomingEvents: [ReportUpcomingEvent]

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case membersTotal = "members_total"
        case membersActive = "members_active"
        case membersByRole = "members_by_role"
        case membersByTeam = "members_by_team"
        case attendanceRate = "attendance_rate"
        case openInvoicesTotalCents = "open_invoices_total_cents"
        case openInvoicesCount = "open_invoices_count"
        case medals
        case upcomingEventsCount = "upcoming_events_count"
        case upcomingEvents = "upcoming_events"
    }

    public init(
        clubId: String,
        membersTotal: Int? = nil,
        membersActive: Int? = nil,
        membersByRole: [ReportRoleCount],
        membersByTeam: [ReportTeamCount],
        attendanceRate: Double? = nil,
        openInvoicesTotalCents: Int? = nil,
        openInvoicesCount: Int? = nil,
        medals: ReportMedalCounts,
        upcomingEventsCount: Int? = nil,
        upcomingEvents: [ReportUpcomingEvent]
    ) {
        self.clubId = clubId
        self.membersTotal = membersTotal
        self.membersActive = membersActive
        self.membersByRole = membersByRole
        self.membersByTeam = membersByTeam
        self.attendanceRate = attendanceRate
        self.openInvoicesTotalCents = openInvoicesTotalCents
        self.openInvoicesCount = openInvoicesCount
        self.medals = medals
        self.upcomingEventsCount = upcomingEventsCount
        self.upcomingEvents = upcomingEvents
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
