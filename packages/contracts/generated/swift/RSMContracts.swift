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
    case rejected = "rejected"
    case active = "active"
    case inactive = "inactive"
    case left = "left"
}

public enum ProfileVisibility: String, Codable, CaseIterable, Sendable, Equatable {
    case `public` = "public"
    case `internal` = "internal"
}

public enum AssignableClubRole: String, Codable, CaseIterable, Sendable, Equatable {
    case admin = "admin"
    case moderator = "moderator"
    case treasurer = "treasurer"
    case coach = "coach"
    case member = "member"
    case guestCoach = "guest_coach"
}

public enum RoutineStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case draft = "draft"
    case ready = "ready"
    case competition = "competition"
    case archived = "archived"
}

public enum CompetitionEntryStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case registered = "registered"
    case confirmed = "confirmed"
    case withdrawn = "withdrawn"
}

public enum Medal: String, Codable, CaseIterable, Sendable, Equatable {
    case gold = "gold"
    case silver = "silver"
    case bronze = "bronze"
}

public enum AttendanceStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case present = "present"
    case late = "late"
    case excused = "excused"
    case absent = "absent"
}

public enum CheckinMethod: String, Codable, CaseIterable, Sendable, Equatable {
    case qr = "qr"
    case manual = "manual"
}

public enum DutyKind: String, Codable, CaseIterable, Sendable, Equatable {
    case training = "training"
    case helper = "helper"
    case competition = "competition"
    case other = "other"
}

public enum RsvpStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case going = "going"
    case declined = "declined"
    case maybe = "maybe"
    case sick = "sick"
}

public enum ReservationStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case active = "active"
    case returned = "returned"
    case cancelled = "cancelled"
}

public enum InvoiceStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case draft = "draft"
    case open = "open"
    case paid = "paid"
    case cancelled = "cancelled"
}

public enum MembershipPeriod: String, Codable, CaseIterable, Sendable, Equatable {
    case monthly = "monthly"
    case quarterly = "quarterly"
    case yearly = "yearly"
    case once = "once"
}

public enum SepaMandateStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case active = "active"
    case revoked = "revoked"
}

public enum GalleryKind: String, Codable, CaseIterable, Sendable, Equatable {
    case photo = "photo"
    case video = "video"
}

public enum ConsentPurpose: String, Codable, CaseIterable, Sendable, Equatable {
    case terms = "terms"
    case privacy = "privacy"
    case photosInternal = "photos_internal"
    case photosPublic = "photos_public"
    case chat = "chat"
    case newsletter = "newsletter"
}

public enum RealConsentPurpose: String, Codable, CaseIterable, Sendable, Equatable {
    case photosInternal = "photos_internal"
    case photosPublic = "photos_public"
    case chat = "chat"
    case newsletter = "newsletter"
}

public enum WaitlistKind: String, Codable, CaseIterable, Sendable, Equatable {
    case facility = "facility"
    case equipment = "equipment"
    case team = "team"
    case event = "event"
}

public enum WaitlistStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case waiting = "waiting"
    case offered = "offered"
    case fulfilled = "fulfilled"
    case cancelled = "cancelled"
}

public enum LedgerCategoryKind: String, Codable, CaseIterable, Sendable, Equatable {
    case income = "income"
    case expense = "expense"
}

public enum ThemePreference: String, Codable, CaseIterable, Sendable, Equatable {
    case light = "light"
    case dark = "dark"
    case auto = "auto"
}

public enum CapabilityLevel: String, Codable, CaseIterable, Sendable, Equatable {
    case none = "none"
    case readOwn = "read_own"
    case readTeam = "read_team"
    case readAll = "read_all"
    case edit = "edit"
    case manage = "manage"
}

public enum CapabilityEnforcement: String, Codable, CaseIterable, Sendable, Equatable {
    case enforced = "enforced"
    case partial = "partial"
    case writeOnly = "write_only"
    case unenforced = "unenforced"
}

public enum PlatformTier: String, Codable, CaseIterable, Sendable, Equatable {
    case basic = "basic"
    case pro = "pro"
    case premium = "premium"
}

public enum PlatformEntitlementStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case trial = "trial"
    case active = "active"
    case pastDue = "past_due"
    case canceled = "canceled"
}

public enum EventType: String, Codable, CaseIterable, Sendable, Equatable {
    case training = "training"
    case competition = "competition"
    case other = "other"
}

public enum EventAudience: String, Codable, CaseIterable, Sendable, Equatable {
    case teams = "teams"
    case club = "club"
}

public enum EventRideStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case offen = "offen"
    case voll = "voll"
    case abgesagt = "abgesagt"
}

public enum EventRideRiderStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case zugesagt = "zugesagt"
    case abgesagt = "abgesagt"
}

public enum CompetitionStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case upcoming = "upcoming"
    case running = "running"
    case done = "done"
    case cancelled = "cancelled"
}

public enum SupportTicketStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case open = "open"
    case inProgress = "in_progress"
    case waitingOnClub = "waiting_on_club"
    case closed = "closed"
}

public enum SupportTicketPriority: String, Codable, CaseIterable, Sendable, Equatable {
    case low = "low"
    case normal = "normal"
    case high = "high"
    case urgent = "urgent"
}

public enum SupportActor: String, Codable, CaseIterable, Sendable, Equatable {
    case club = "club"
    case platform = "platform"
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

public enum ChatChannelType: String, Codable, CaseIterable, Sendable, Equatable {
    case team = "team"
    case direct = "direct"
}

public enum AnniversaryKind: String, Codable, CaseIterable, Sendable, Equatable {
    case membership = "membership"
    case birthday = "birthday"
}

public enum LockerStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case free = "free"
    case assigned = "assigned"
    case broken = "broken"
}

public enum CounterpartyKind: String, Codable, CaseIterable, Sendable, Equatable {
    case person = "person"
    case org = "org"
}

public enum BankTransactionStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case unmatched = "unmatched"
    case matched = "matched"
    case ignored = "ignored"
}

public enum FamilyDiscountKind: String, Codable, CaseIterable, Sendable, Equatable {
    case percent = "percent"
    case fixed = "fixed"
}

public enum DunningLogAction: String, Codable, CaseIterable, Sendable, Equatable {
    case reminder = "reminder"
    case dunning = "dunning"
    case handover = "handover"
}

/// Inline enum of Health.status (hoisted by codegen).
public enum HealthStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case ok = "ok"
}

/// Inline enum of InviteQueued.status (hoisted by codegen).
public enum InviteQueuedStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case queued = "queued"
}

/// Inline enum of EffectiveConsent.state (hoisted by codegen).
public enum EffectiveConsentState: String, Codable, CaseIterable, Sendable, Equatable {
    case valid = "valid"
    case revoked = "revoked"
    case expiredAge16 = "expired_age_16"
}

/// Inline enum of ChildCreate.relation (hoisted by codegen).
public enum ChildCreateRelation: String, Codable, CaseIterable, Sendable, Equatable {
    case parent = "parent"
    case guardian = "guardian"
    case other = "other"
}

/// Inline enum of GuardianshipCreate.relation (hoisted by codegen).
public enum GuardianshipCreateRelation: String, Codable, CaseIterable, Sendable, Equatable {
    case parent = "parent"
    case guardian = "guardian"
    case other = "other"
}

/// Inline enum of Deleted.status (hoisted by codegen).
public enum DeletedStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case deleted = "deleted"
}

/// Inline enum of ClubModuleState.enforcement (hoisted by codegen).
public enum ClubModuleStateEnforcement: String, Codable, CaseIterable, Sendable, Equatable {
    case enforced = "enforced"
    case partial = "partial"
    case menuOnly = "menu_only"
}

/// Inline enum of SmtpTestResponse.mode (hoisted by codegen).
public enum SmtpTestResponseMode: String, Codable, CaseIterable, Sendable, Equatable {
    case sent = "sent"
    case dryRun = "dry-run"
    case error = "error"
}

/// Inline enum of PlatformEntitlementRow.source (hoisted by codegen).
public enum PlatformEntitlementRowSource: String, Codable, CaseIterable, Sendable, Equatable {
    case stripe = "stripe"
    case revenuecat = "revenuecat"
    case manual = "manual"
}

/// Inline enum of PlatformProduct.kind (hoisted by codegen).
public enum PlatformProductKind: String, Codable, CaseIterable, Sendable, Equatable {
    case clubLicense = "club_license"
    case personalPro = "personal_pro"
}

/// Inline enum of PlatformProduct.billing_interval (hoisted by codegen).
public enum PlatformProductBillingInterval: String, Codable, CaseIterable, Sendable, Equatable {
    case month = "month"
    case year = "year"
}

/// Inline enum of PlatformRoutineRow.status (hoisted by codegen).
public enum PlatformRoutineRowStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case draft = "draft"
    case ready = "ready"
    case competition = "competition"
    case archived = "archived"
}

/// Inline enum of PlatformSystemHealth.status (hoisted by codegen).
public enum PlatformSystemHealthStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case ok = "ok"
}

/// Inline enum of PlatformSystem.auth_mode (hoisted by codegen).
public enum PlatformSystemAuthMode: String, Codable, CaseIterable, Sendable, Equatable {
    case dev = "dev"
    case prod = "prod"
}

/// Inline enum of EventRideUpdate.status (hoisted by codegen).
public enum EventRideUpdateStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case offen = "offen"
    case abgesagt = "abgesagt"
}

/// Inline enum of InvoiceUpdate.status (hoisted by codegen).
public enum InvoiceUpdateStatus: String, Codable, CaseIterable, Sendable, Equatable {
    case paid = "paid"
    case cancelled = "cancelled"
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

/// Inline object of SmtpTestResponse.preview (hoisted by codegen).
public struct SmtpTestResponsePreview: Codable, Equatable, Sendable {
    public var subject: String
    public var text: String

    enum CodingKeys: String, CodingKey {
        case subject
        case text
    }

    public init(
        subject: String,
        text: String
    ) {
        self.subject = subject
        self.text = text
    }
}

/// Inline object of PublicRoutine.markers (hoisted by codegen).
public struct PublicRoutineMarkers: Codable, Equatable, Sendable {
    public var timeMs: Int?
    public var label: String
    public var elementCode: String?

    enum CodingKeys: String, CodingKey {
        case timeMs = "time_ms"
        case label
        case elementCode = "element_code"
    }

    public init(
        timeMs: Int? = nil,
        label: String,
        elementCode: String? = nil
    ) {
        self.timeMs = timeMs
        self.label = label
        self.elementCode = elementCode
    }
}

/// Inline object of PublicRoutine.scores (hoisted by codegen).
public struct PublicRoutineScores: Codable, Equatable, Sendable {
    public var scoredOn: String
    public var technicalScore: Double?
    public var componentsScore: Double?
    public var totalScore: Double?
    public var placement: Int?

    enum CodingKeys: String, CodingKey {
        case scoredOn = "scored_on"
        case technicalScore = "technical_score"
        case componentsScore = "components_score"
        case totalScore = "total_score"
        case placement
    }

    public init(
        scoredOn: String,
        technicalScore: Double? = nil,
        componentsScore: Double? = nil,
        totalScore: Double? = nil,
        placement: Int? = nil
    ) {
        self.scoredOn = scoredOn
        self.technicalScore = technicalScore
        self.componentsScore = componentsScore
        self.totalScore = totalScore
        self.placement = placement
    }
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
    public var settings: [String: JSONValue]
    /// Format: uuid
    public var logoAssetId: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case shortName = "short_name"
        case city
        case discipline
        case foundedYear = "founded_year"
        case settings
        case logoAssetId = "logo_asset_id"
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
        settings: [String: JSONValue],
        logoAssetId: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.name = name
        self.shortName = shortName
        self.city = city
        self.discipline = discipline
        self.foundedYear = foundedYear
        self.settings = settings
        self.logoAssetId = logoAssetId
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

public struct ClubJoinCode: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var joinCode: String?
    public var joinCodeExpiresAt: String?
    public var joinCodeRevokedAt: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case joinCode = "join_code"
        case joinCodeExpiresAt = "join_code_expires_at"
        case joinCodeRevokedAt = "join_code_revoked_at"
    }

    public init(
        clubId: String,
        joinCode: String? = nil,
        joinCodeExpiresAt: String? = nil,
        joinCodeRevokedAt: String? = nil
    ) {
        self.clubId = clubId
        self.joinCode = joinCode
        self.joinCodeExpiresAt = joinCodeExpiresAt
        self.joinCodeRevokedAt = joinCodeRevokedAt
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
    public var phone: String?
    public var postalAddress: String?
    public var role: ClubRole
    public var status: MemberStatus
    public var joinedOn: String?
    public var validUntil: String?
    public var avatarUrl: String?
    /// Format: [uuid]
    public var teamIds: [String]
    public var profileMotto: String?
    public var profileFavoriteDiscipline: String?
    public var profileSkatingSince: Int?
    public var profileVisibility: ProfileVisibility?
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
        case phone
        case postalAddress = "postal_address"
        case role
        case status
        case joinedOn = "joined_on"
        case validUntil = "valid_until"
        case avatarUrl = "avatar_url"
        case teamIds = "team_ids"
        case profileMotto = "profile_motto"
        case profileFavoriteDiscipline = "profile_favorite_discipline"
        case profileSkatingSince = "profile_skating_since"
        case profileVisibility = "profile_visibility"
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
        phone: String? = nil,
        postalAddress: String? = nil,
        role: ClubRole,
        status: MemberStatus,
        joinedOn: String? = nil,
        validUntil: String? = nil,
        avatarUrl: String? = nil,
        teamIds: [String],
        profileMotto: String? = nil,
        profileFavoriteDiscipline: String? = nil,
        profileSkatingSince: Int? = nil,
        profileVisibility: ProfileVisibility? = nil,
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
        self.phone = phone
        self.postalAddress = postalAddress
        self.role = role
        self.status = status
        self.joinedOn = joinedOn
        self.validUntil = validUntil
        self.avatarUrl = avatarUrl
        self.teamIds = teamIds
        self.profileMotto = profileMotto
        self.profileFavoriteDiscipline = profileFavoriteDiscipline
        self.profileSkatingSince = profileSkatingSince
        self.profileVisibility = profileVisibility
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct ClubRegistrationResult: Codable, Equatable, Sendable {
    public var club: Club
    public var member: ClubMember
    public var joinCode: String
    public var trialEndsAt: String

    enum CodingKeys: String, CodingKey {
        case club
        case member
        case joinCode = "join_code"
        case trialEndsAt = "trial_ends_at"
    }

    public init(
        club: Club,
        member: ClubMember,
        joinCode: String,
        trialEndsAt: String
    ) {
        self.club = club
        self.member = member
        self.joinCode = joinCode
        self.trialEndsAt = trialEndsAt
    }
}

public struct ClubRegistration: Codable, Equatable, Sendable {
    public var name: String
    public var city: String
    public var shortName: String?
    public var discipline: String?
    public var acceptTerms: Bool
    public var acceptPrivacy: Bool

    enum CodingKeys: String, CodingKey {
        case name
        case city
        case shortName = "short_name"
        case discipline
        case acceptTerms = "accept_terms"
        case acceptPrivacy = "accept_privacy"
    }

    public init(
        name: String,
        city: String,
        shortName: String? = nil,
        discipline: String? = nil,
        acceptTerms: Bool,
        acceptPrivacy: Bool
    ) {
        self.name = name
        self.city = city
        self.shortName = shortName
        self.discipline = discipline
        self.acceptTerms = acceptTerms
        self.acceptPrivacy = acceptPrivacy
    }
}

public struct ClubJoinResult: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var clubName: String
    /// Format: uuid
    public var memberId: String
    public var status: MemberStatus

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case clubName = "club_name"
        case memberId = "member_id"
        case status
    }

    public init(
        clubId: String,
        clubName: String,
        memberId: String,
        status: MemberStatus
    ) {
        self.clubId = clubId
        self.clubName = clubName
        self.memberId = memberId
        self.status = status
    }
}

public struct ClubJoinInput: Codable, Equatable, Sendable {
    public var code: String
    public var firstName: String
    public var lastName: String
    public var acceptTerms: Bool
    public var acceptPrivacy: Bool

    enum CodingKeys: String, CodingKey {
        case code
        case firstName = "first_name"
        case lastName = "last_name"
        case acceptTerms = "accept_terms"
        case acceptPrivacy = "accept_privacy"
    }

    public init(
        code: String,
        firstName: String,
        lastName: String,
        acceptTerms: Bool,
        acceptPrivacy: Bool
    ) {
        self.code = code
        self.firstName = firstName
        self.lastName = lastName
        self.acceptTerms = acceptTerms
        self.acceptPrivacy = acceptPrivacy
    }
}

public struct ClubJoinCodeRotated: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var joinCode: String
    public var joinCodeExpiresAt: String?
    public var previousCodeValidUntil: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case joinCode = "join_code"
        case joinCodeExpiresAt = "join_code_expires_at"
        case previousCodeValidUntil = "previous_code_valid_until"
    }

    public init(
        clubId: String,
        joinCode: String,
        joinCodeExpiresAt: String? = nil,
        previousCodeValidUntil: String? = nil
    ) {
        self.clubId = clubId
        self.joinCode = joinCode
        self.joinCodeExpiresAt = joinCodeExpiresAt
        self.previousCodeValidUntil = previousCodeValidUntil
    }
}

public struct ClubJoinCodeRotateInput: Codable, Equatable, Sendable {
    public var expiresInDays: Int?
    public var overlapHours: Int?

    enum CodingKeys: String, CodingKey {
        case expiresInDays = "expires_in_days"
        case overlapHours = "overlap_hours"
    }

    public init(
        expiresInDays: Int? = nil,
        overlapHours: Int? = nil
    ) {
        self.expiresInDays = expiresInDays
        self.overlapHours = overlapHours
    }
}

public struct ClubJoinCodeRevoked: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var joinCodeRevokedAt: String

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case joinCodeRevokedAt = "join_code_revoked_at"
    }

    public init(
        clubId: String,
        joinCodeRevokedAt: String
    ) {
        self.clubId = clubId
        self.joinCodeRevokedAt = joinCodeRevokedAt
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
    public var phone: String?
    public var postalAddress: String?
    public var status: MemberStatus?
    /// Format: date-time
    public var validUntil: String?

    enum CodingKeys: String, CodingKey {
        case firstName = "first_name"
        case lastName = "last_name"
        case email
        case birthDate = "birth_date"
        case phone
        case postalAddress = "postal_address"
        case status
        case validUntil = "valid_until"
    }

    public init(
        firstName: String? = nil,
        lastName: String? = nil,
        email: String? = nil,
        birthDate: String? = nil,
        phone: String? = nil,
        postalAddress: String? = nil,
        status: MemberStatus? = nil,
        validUntil: String? = nil
    ) {
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.birthDate = birthDate
        self.phone = phone
        self.postalAddress = postalAddress
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

public struct ClubMemberSelfProfileUpdate: Codable, Equatable, Sendable {
    public var motto: String?
    public var favoriteDiscipline: String?
    public var skatingSince: Int?
    public var visibility: ProfileVisibility?

    enum CodingKeys: String, CodingKey {
        case motto
        case favoriteDiscipline = "favorite_discipline"
        case skatingSince = "skating_since"
        case visibility
    }

    public init(
        motto: String? = nil,
        favoriteDiscipline: String? = nil,
        skatingSince: Int? = nil,
        visibility: ProfileVisibility? = nil
    ) {
        self.motto = motto
        self.favoriteDiscipline = favoriteDiscipline
        self.skatingSince = skatingSince
        self.visibility = visibility
    }
}

public struct InvitationInfo: Codable, Equatable, Sendable {
    public var clubName: String
    public var role: ClubRole

    enum CodingKeys: String, CodingKey {
        case clubName = "club_name"
        case role
    }

    public init(
        clubName: String,
        role: ClubRole
    ) {
        self.clubName = clubName
        self.role = role
    }
}

public struct InvitationAcceptResult: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var clubName: String
    /// Format: uuid
    public var memberId: String
    public var status: MemberStatus

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case clubName = "club_name"
        case memberId = "member_id"
        case status
    }

    public init(
        clubId: String,
        clubName: String,
        memberId: String,
        status: MemberStatus
    ) {
        self.clubId = clubId
        self.clubName = clubName
        self.memberId = memberId
        self.status = status
    }
}

public struct InvitationAcceptInput: Codable, Equatable, Sendable {
    public var firstName: String
    public var lastName: String
    public var acceptTerms: Bool
    public var acceptPrivacy: Bool

    enum CodingKeys: String, CodingKey {
        case firstName = "first_name"
        case lastName = "last_name"
        case acceptTerms = "accept_terms"
        case acceptPrivacy = "accept_privacy"
    }

    public init(
        firstName: String,
        lastName: String,
        acceptTerms: Bool,
        acceptPrivacy: Bool
    ) {
        self.firstName = firstName
        self.lastName = lastName
        self.acceptTerms = acceptTerms
        self.acceptPrivacy = acceptPrivacy
    }
}

public struct MemberRoleRef: Codable, Equatable, Sendable {
    /// Format: uuid
    public var roleId: String
    public var key: String
    public var nameDe: String
    public var nameEn: String

    enum CodingKeys: String, CodingKey {
        case roleId = "role_id"
        case key
        case nameDe = "name_de"
        case nameEn = "name_en"
    }

    public init(
        roleId: String,
        key: String,
        nameDe: String,
        nameEn: String
    ) {
        self.roleId = roleId
        self.key = key
        self.nameDe = nameDe
        self.nameEn = nameEn
    }
}

public struct MemberDepartmentRef: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    public var name: String
    public var isLead: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case isLead = "is_lead"
    }

    public init(
        id: String,
        name: String,
        isLead: Bool
    ) {
        self.id = id
        self.name = name
        self.isLead = isLead
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
    /// Format: uuid
    public var imageAssetId: String?
    public var audioUrl: String?
    public var imageUrl: String?
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
        case imageAssetId = "image_asset_id"
        case audioUrl = "audio_url"
        case imageUrl = "image_url"
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
        imageAssetId: String? = nil,
        audioUrl: String? = nil,
        imageUrl: String? = nil,
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
        self.imageAssetId = imageAssetId
        self.audioUrl = audioUrl
        self.imageUrl = imageUrl
        self.skaterMemberIds = skaterMemberIds
        self.waveformPeaks = waveformPeaks
        self.createdAt = createdAt
        self.updatedAt = updatedAt
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
    public var placement: Int?
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
        case placement
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
        placement: Int? = nil,
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
        self.placement = placement
        self.note = note
    }
}

public struct MemberProfileCompetition: Codable, Equatable, Sendable {
    public var entries: [CompetitionEntry]
    public var scores: [RoutineScore]

    enum CodingKeys: String, CodingKey {
        case entries
        case scores
    }

    public init(
        entries: [CompetitionEntry],
        scores: [RoutineScore]
    ) {
        self.entries = entries
        self.scores = scores
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

public struct MemberProfileDuty: Codable, Equatable, Sendable {
    public var requirements: [DutyRequirement]
    public var entries: [DutyEntry]

    enum CodingKeys: String, CodingKey {
        case requirements
        case entries
    }

    public init(
        requirements: [DutyRequirement],
        entries: [DutyEntry]
    ) {
        self.requirements = requirements
        self.entries = entries
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
    public var paidVia: String?
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
        case paidVia = "paid_via"
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
        paidVia: String? = nil,
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
        self.paidVia = paidVia
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct MemberFee: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    /// Format: uuid
    public var categoryId: String
    public var customAmountCents: Int?
    public var validFrom: String
    public var validUntil: String?
    public var createdAt: String
    public var updatedAt: String
    public var deletedAt: String?
    public var categoryName: String?
    public var categoryAmountCents: Int?
    public var categoryPeriod: MembershipPeriod?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case categoryId = "category_id"
        case customAmountCents = "custom_amount_cents"
        case validFrom = "valid_from"
        case validUntil = "valid_until"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case deletedAt = "deleted_at"
        case categoryName = "category_name"
        case categoryAmountCents = "category_amount_cents"
        case categoryPeriod = "category_period"
    }

    public init(
        id: String,
        clubId: String,
        memberId: String,
        categoryId: String,
        customAmountCents: Int? = nil,
        validFrom: String,
        validUntil: String? = nil,
        createdAt: String,
        updatedAt: String,
        deletedAt: String? = nil,
        categoryName: String? = nil,
        categoryAmountCents: Int? = nil,
        categoryPeriod: MembershipPeriod? = nil
    ) {
        self.id = id
        self.clubId = clubId
        self.memberId = memberId
        self.categoryId = categoryId
        self.customAmountCents = customAmountCents
        self.validFrom = validFrom
        self.validUntil = validUntil
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
        self.categoryName = categoryName
        self.categoryAmountCents = categoryAmountCents
        self.categoryPeriod = categoryPeriod
    }
}

public struct SepaMandate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    public var mandateReference: String
    public var ibanLast4: String?
    public var accountHolder: String
    public var signedOn: String?
    public var status: SepaMandateStatus
    public var createdAt: String
    public var updatedAt: String
    public var deletedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case mandateReference = "mandate_reference"
        case ibanLast4 = "iban_last4"
        case accountHolder = "account_holder"
        case signedOn = "signed_on"
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case deletedAt = "deleted_at"
    }

    public init(
        id: String,
        clubId: String,
        memberId: String,
        mandateReference: String,
        ibanLast4: String? = nil,
        accountHolder: String,
        signedOn: String? = nil,
        status: SepaMandateStatus,
        createdAt: String,
        updatedAt: String,
        deletedAt: String? = nil
    ) {
        self.id = id
        self.clubId = clubId
        self.memberId = memberId
        self.mandateReference = mandateReference
        self.ibanLast4 = ibanLast4
        self.accountHolder = accountHolder
        self.signedOn = signedOn
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}

public struct Donation: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String?
    public var donorName: String
    public var donorAddress: String?
    public var amountCents: Int?
    public var donationDate: String
    public var receiptNumber: String
    public var purpose: String?
    public var issuedAt: String?
    public var createdAt: String
    public var updatedAt: String
    public var deletedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case donorName = "donor_name"
        case donorAddress = "donor_address"
        case amountCents = "amount_cents"
        case donationDate = "donation_date"
        case receiptNumber = "receipt_number"
        case purpose
        case issuedAt = "issued_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case deletedAt = "deleted_at"
    }

    public init(
        id: String,
        clubId: String,
        memberId: String? = nil,
        donorName: String,
        donorAddress: String? = nil,
        amountCents: Int? = nil,
        donationDate: String,
        receiptNumber: String,
        purpose: String? = nil,
        issuedAt: String? = nil,
        createdAt: String,
        updatedAt: String,
        deletedAt: String? = nil
    ) {
        self.id = id
        self.clubId = clubId
        self.memberId = memberId
        self.donorName = donorName
        self.donorAddress = donorAddress
        self.amountCents = amountCents
        self.donationDate = donationDate
        self.receiptNumber = receiptNumber
        self.purpose = purpose
        self.issuedAt = issuedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}

public struct MemberProfileFinance: Codable, Equatable, Sendable {
    public var invoices: [Invoice]
    public var memberFees: [MemberFee]
    public var sepaMandates: [SepaMandate]
    public var donations: [Donation]

    enum CodingKeys: String, CodingKey {
        case invoices
        case memberFees = "member_fees"
        case sepaMandates = "sepa_mandates"
        case donations
    }

    public init(
        invoices: [Invoice],
        memberFees: [MemberFee],
        sepaMandates: [SepaMandate],
        donations: [Donation]
    ) {
        self.invoices = invoices
        self.memberFees = memberFees
        self.sepaMandates = sepaMandates
        self.donations = donations
    }
}

public struct MemberAssessment: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    /// Format: uuid
    public var authorMemberId: String
    public var body: String
    public var ratingTechnik: Int?
    public var ratingAusdruck: Int?
    public var assessedOn: String
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case authorMemberId = "author_member_id"
        case body
        case ratingTechnik = "rating_technik"
        case ratingAusdruck = "rating_ausdruck"
        case assessedOn = "assessed_on"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        memberId: String,
        authorMemberId: String,
        body: String,
        ratingTechnik: Int? = nil,
        ratingAusdruck: Int? = nil,
        assessedOn: String,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.memberId = memberId
        self.authorMemberId = authorMemberId
        self.body = body
        self.ratingTechnik = ratingTechnik
        self.ratingAusdruck = ratingAusdruck
        self.assessedOn = assessedOn
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct MemberPhoto: Codable, Equatable, Sendable {
    /// Format: uuid
    public var tagId: String
    /// Format: uuid
    public var galleryItemId: String
    /// Format: uuid
    public var memberId: String
    public var album: String?
    public var title: String
    public var kind: GalleryKind
    public var storageKey: String
    public var contentType: String
    public var thumbnailKey: String?
    public var taggedAt: String

    enum CodingKeys: String, CodingKey {
        case tagId = "tag_id"
        case galleryItemId = "gallery_item_id"
        case memberId = "member_id"
        case album
        case title
        case kind
        case storageKey = "storage_key"
        case contentType = "content_type"
        case thumbnailKey = "thumbnail_key"
        case taggedAt = "tagged_at"
    }

    public init(
        tagId: String,
        galleryItemId: String,
        memberId: String,
        album: String? = nil,
        title: String,
        kind: GalleryKind,
        storageKey: String,
        contentType: String,
        thumbnailKey: String? = nil,
        taggedAt: String
    ) {
        self.tagId = tagId
        self.galleryItemId = galleryItemId
        self.memberId = memberId
        self.album = album
        self.title = title
        self.kind = kind
        self.storageKey = storageKey
        self.contentType = contentType
        self.thumbnailKey = thumbnailKey
        self.taggedAt = taggedAt
    }
}

public struct EffectiveConsent: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String?
    /// Format: uuid
    public var subjectProfileId: String?
    public var purpose: ConsentPurpose
    /// Format: uuid
    public var grantedByProfileId: String
    /// Format: uuid
    public var legalDocumentId: String?
    public var policyVersion: String?
    public var recordedAt: String
    public var effective: Bool
    public var recordedGranted: Bool
    public var grantedByGuardian: Bool
    public var state: EffectiveConsentState

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case subjectProfileId = "subject_profile_id"
        case purpose
        case grantedByProfileId = "granted_by_profile_id"
        case legalDocumentId = "legal_document_id"
        case policyVersion = "policy_version"
        case recordedAt = "recorded_at"
        case effective
        case recordedGranted = "recorded_granted"
        case grantedByGuardian = "granted_by_guardian"
        case state
    }

    public init(
        id: String,
        clubId: String,
        memberId: String? = nil,
        subjectProfileId: String? = nil,
        purpose: ConsentPurpose,
        grantedByProfileId: String,
        legalDocumentId: String? = nil,
        policyVersion: String? = nil,
        recordedAt: String,
        effective: Bool,
        recordedGranted: Bool,
        grantedByGuardian: Bool,
        state: EffectiveConsentState
    ) {
        self.id = id
        self.clubId = clubId
        self.memberId = memberId
        self.subjectProfileId = subjectProfileId
        self.purpose = purpose
        self.grantedByProfileId = grantedByProfileId
        self.legalDocumentId = legalDocumentId
        self.policyVersion = policyVersion
        self.recordedAt = recordedAt
        self.effective = effective
        self.recordedGranted = recordedGranted
        self.grantedByGuardian = grantedByGuardian
        self.state = state
    }
}

public struct MemberProfile: Codable, Equatable, Sendable {
    public var member: ClubMember
    public var contactVisible: Bool
    public var adminContactVisible: Bool
    public var selfProfileVisible: Bool
    public var joinedOnVisible: Bool
    public var roles: [MemberRoleRef]
    public var departments: [MemberDepartmentRef]
    public var routines: [Routine]?
    public var competition: MemberProfileCompetition?
    public var achievements: [Achievement]?
    public var attendance: [Attendance]?
    public var checkins: [Checkin]?
    public var duty: MemberProfileDuty?
    public var rsvps: [EventRsvp]?
    public var equipment: [EquipmentReservation]?
    public var finance: MemberProfileFinance?
    public var assessments: [MemberAssessment]?
    public var photos: [MemberPhoto]?
    public var consents: [EffectiveConsent]?

    enum CodingKeys: String, CodingKey {
        case member
        case contactVisible = "contact_visible"
        case adminContactVisible = "admin_contact_visible"
        case selfProfileVisible = "self_profile_visible"
        case joinedOnVisible = "joined_on_visible"
        case roles
        case departments
        case routines
        case competition
        case achievements
        case attendance
        case checkins
        case duty
        case rsvps
        case equipment
        case finance
        case assessments
        case photos
        case consents
    }

    public init(
        member: ClubMember,
        contactVisible: Bool,
        adminContactVisible: Bool,
        selfProfileVisible: Bool,
        joinedOnVisible: Bool,
        roles: [MemberRoleRef],
        departments: [MemberDepartmentRef],
        routines: [Routine]? = nil,
        competition: MemberProfileCompetition? = nil,
        achievements: [Achievement]? = nil,
        attendance: [Attendance]? = nil,
        checkins: [Checkin]? = nil,
        duty: MemberProfileDuty? = nil,
        rsvps: [EventRsvp]? = nil,
        equipment: [EquipmentReservation]? = nil,
        finance: MemberProfileFinance? = nil,
        assessments: [MemberAssessment]? = nil,
        photos: [MemberPhoto]? = nil,
        consents: [EffectiveConsent]? = nil
    ) {
        self.member = member
        self.contactVisible = contactVisible
        self.adminContactVisible = adminContactVisible
        self.selfProfileVisible = selfProfileVisible
        self.joinedOnVisible = joinedOnVisible
        self.roles = roles
        self.departments = departments
        self.routines = routines
        self.competition = competition
        self.achievements = achievements
        self.attendance = attendance
        self.checkins = checkins
        self.duty = duty
        self.rsvps = rsvps
        self.equipment = equipment
        self.finance = finance
        self.assessments = assessments
        self.photos = photos
        self.consents = consents
    }
}

public struct ChildCreated: Codable, Equatable, Sendable {
    public var child: ClubMember
    public var guardianship: Guardianship

    enum CodingKeys: String, CodingKey {
        case child
        case guardianship
    }

    public init(
        child: ClubMember,
        guardianship: Guardianship
    ) {
        self.child = child
        self.guardianship = guardianship
    }
}

public struct ChildCreate: Codable, Equatable, Sendable {
    public var firstName: String
    public var lastName: String
    /// Format: date
    public var birthDate: String?
    /// Format: date
    public var joinedOn: String?
    /// Format: uuid
    public var guardianMemberId: String?
    public var relation: ChildCreateRelation?

    enum CodingKeys: String, CodingKey {
        case firstName = "first_name"
        case lastName = "last_name"
        case birthDate = "birth_date"
        case joinedOn = "joined_on"
        case guardianMemberId = "guardian_member_id"
        case relation
    }

    public init(
        firstName: String,
        lastName: String,
        birthDate: String? = nil,
        joinedOn: String? = nil,
        guardianMemberId: String? = nil,
        relation: ChildCreateRelation? = .parent
    ) {
        self.firstName = firstName
        self.lastName = lastName
        self.birthDate = birthDate
        self.joinedOn = joinedOn
        self.guardianMemberId = guardianMemberId
        self.relation = relation
    }
}

public struct GuardianshipCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var childMemberId: String
    /// Format: uuid
    public var guardianMemberId: String?
    public var relation: GuardianshipCreateRelation?

    enum CodingKeys: String, CodingKey {
        case childMemberId = "child_member_id"
        case guardianMemberId = "guardian_member_id"
        case relation
    }

    public init(
        childMemberId: String,
        guardianMemberId: String? = nil,
        relation: GuardianshipCreateRelation? = .parent
    ) {
        self.childMemberId = childMemberId
        self.guardianMemberId = guardianMemberId
        self.relation = relation
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

public struct ConsentDeclare: Codable, Equatable, Sendable {
    /// Format: uuid
    public var memberId: String
    public var purpose: RealConsentPurpose
    public var granted: Bool
    public var policyVersion: String?

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case purpose
        case granted
        case policyVersion = "policy_version"
    }

    public init(
        memberId: String,
        purpose: RealConsentPurpose,
        granted: Bool,
        policyVersion: String? = nil
    ) {
        self.memberId = memberId
        self.purpose = purpose
        self.granted = granted
        self.policyVersion = policyVersion
    }
}

public struct Waitlist: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    public var kind: WaitlistKind
    /// Format: uuid
    public var targetId: String?
    public var note: String?
    public var status: WaitlistStatus
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case memberId = "member_id"
        case kind
        case targetId = "target_id"
        case note
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        memberId: String,
        kind: WaitlistKind,
        targetId: String? = nil,
        note: String? = nil,
        status: WaitlistStatus,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.memberId = memberId
        self.kind = kind
        self.targetId = targetId
        self.note = note
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct WaitlistCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    public var kind: WaitlistKind
    /// Format: uuid
    public var targetId: String?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case memberId = "member_id"
        case kind
        case targetId = "target_id"
        case note
    }

    public init(
        clubId: String,
        memberId: String,
        kind: WaitlistKind,
        targetId: String? = nil,
        note: String? = nil
    ) {
        self.clubId = clubId
        self.memberId = memberId
        self.kind = kind
        self.targetId = targetId
        self.note = note
    }
}

public struct WaitlistUpdate: Codable, Equatable, Sendable {
    public var status: WaitlistStatus?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case status
        case note
    }

    public init(
        status: WaitlistStatus? = nil,
        note: String? = nil
    ) {
        self.status = status
        self.note = note
    }
}

public struct Budget: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var year: Int?
    /// Format: uuid
    public var categoryId: String
    public var plannedCents: Int?
    public var note: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case year
        case categoryId = "category_id"
        case plannedCents = "planned_cents"
        case note
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        year: Int? = nil,
        categoryId: String,
        plannedCents: Int? = nil,
        note: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.year = year
        self.categoryId = categoryId
        self.plannedCents = plannedCents
        self.note = note
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct BudgetCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var year: Int
    /// Format: uuid
    public var categoryId: String
    public var plannedCents: Int?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case year
        case categoryId = "category_id"
        case plannedCents = "planned_cents"
        case note
    }

    public init(
        clubId: String,
        year: Int,
        categoryId: String,
        plannedCents: Int? = nil,
        note: String? = nil
    ) {
        self.clubId = clubId
        self.year = year
        self.categoryId = categoryId
        self.plannedCents = plannedCents
        self.note = note
    }
}

public struct BudgetUpdate: Codable, Equatable, Sendable {
    public var plannedCents: Int?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case plannedCents = "planned_cents"
        case note
    }

    public init(
        plannedCents: Int? = nil,
        note: String? = nil
    ) {
        self.plannedCents = plannedCents
        self.note = note
    }
}

public struct BudgetReportRow: Codable, Equatable, Sendable {
    /// Format: uuid
    public var categoryId: String
    public var categoryName: String?
    public var kind: LedgerCategoryKind
    public var plannedCents: Int?
    public var actualCents: Int?
    public var varianceCents: Int?

    enum CodingKeys: String, CodingKey {
        case categoryId = "category_id"
        case categoryName = "category_name"
        case kind
        case plannedCents = "planned_cents"
        case actualCents = "actual_cents"
        case varianceCents = "variance_cents"
    }

    public init(
        categoryId: String,
        categoryName: String? = nil,
        kind: LedgerCategoryKind,
        plannedCents: Int? = nil,
        actualCents: Int? = nil,
        varianceCents: Int? = nil
    ) {
        self.categoryId = categoryId
        self.categoryName = categoryName
        self.kind = kind
        self.plannedCents = plannedCents
        self.actualCents = actualCents
        self.varianceCents = varianceCents
    }
}

public struct BudgetReport: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var year: Int?
    public var rows: [BudgetReportRow]
    public var plannedTotalCents: Int?
    public var actualTotalCents: Int?
    public var varianceTotalCents: Int?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case year
        case rows
        case plannedTotalCents = "planned_total_cents"
        case actualTotalCents = "actual_total_cents"
        case varianceTotalCents = "variance_total_cents"
    }

    public init(
        clubId: String,
        year: Int? = nil,
        rows: [BudgetReportRow],
        plannedTotalCents: Int? = nil,
        actualTotalCents: Int? = nil,
        varianceTotalCents: Int? = nil
    ) {
        self.clubId = clubId
        self.year = year
        self.rows = rows
        self.plannedTotalCents = plannedTotalCents
        self.actualTotalCents = actualTotalCents
        self.varianceTotalCents = varianceTotalCents
    }
}

public struct MeMembership: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var clubName: String
    public var clubShortName: String?
    public var firstName: String
    public var lastName: String
    public var email: String?
    public var birthDate: String?
    public var phone: String?
    public var postalAddress: String?
    public var role: ClubRole
    public var status: MemberStatus
    public var joinedOn: String?
    public var validUntil: String?
    public var avatarUrl: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case clubName = "club_name"
        case clubShortName = "club_short_name"
        case firstName = "first_name"
        case lastName = "last_name"
        case email
        case birthDate = "birth_date"
        case phone
        case postalAddress = "postal_address"
        case role
        case status
        case joinedOn = "joined_on"
        case validUntil = "valid_until"
        case avatarUrl = "avatar_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        clubName: String,
        clubShortName: String? = nil,
        firstName: String,
        lastName: String,
        email: String? = nil,
        birthDate: String? = nil,
        phone: String? = nil,
        postalAddress: String? = nil,
        role: ClubRole,
        status: MemberStatus,
        joinedOn: String? = nil,
        validUntil: String? = nil,
        avatarUrl: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.clubName = clubName
        self.clubShortName = clubShortName
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.birthDate = birthDate
        self.phone = phone
        self.postalAddress = postalAddress
        self.role = role
        self.status = status
        self.joinedOn = joinedOn
        self.validUntil = validUntil
        self.avatarUrl = avatarUrl
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct Me: Codable, Equatable, Sendable {
    /// Format: uuid
    public var profileId: String
    public var displayName: String?
    public var locale: String
    public var memberships: [MeMembership]

    enum CodingKeys: String, CodingKey {
        case profileId = "profile_id"
        case displayName = "display_name"
        case locale
        case memberships
    }

    public init(
        profileId: String,
        displayName: String? = nil,
        locale: String,
        memberships: [MeMembership]
    ) {
        self.profileId = profileId
        self.displayName = displayName
        self.locale = locale
        self.memberships = memberships
    }
}

public struct MeUpdate: Codable, Equatable, Sendable {
    public var firstName: String?
    public var lastName: String?
    /// Format: email
    public var email: String?
    /// Format: date
    public var birthDate: String?
    public var phone: String?
    public var postalAddress: String?

    enum CodingKeys: String, CodingKey {
        case firstName = "first_name"
        case lastName = "last_name"
        case email
        case birthDate = "birth_date"
        case phone
        case postalAddress = "postal_address"
    }

    public init(
        firstName: String? = nil,
        lastName: String? = nil,
        email: String? = nil,
        birthDate: String? = nil,
        phone: String? = nil,
        postalAddress: String? = nil
    ) {
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.birthDate = birthDate
        self.phone = phone
        self.postalAddress = postalAddress
    }
}

public struct NotificationPrefs: Codable, Equatable, Sendable {
    public var events: Bool?
    public var invoices: Bool?
    public var news: Bool?
    public var chat: Bool?

    enum CodingKeys: String, CodingKey {
        case events
        case invoices
        case news
        case chat
    }

    public init(
        events: Bool? = nil,
        invoices: Bool? = nil,
        news: Bool? = nil,
        chat: Bool? = nil
    ) {
        self.events = events
        self.invoices = invoices
        self.news = news
        self.chat = chat
    }
}

public struct UserPreferences: Codable, Equatable, Sendable {
    /// Format: uuid
    public var profileId: String
    public var locale: String
    public var theme: ThemePreference
    public var notifications: NotificationPrefs
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case profileId = "profile_id"
        case locale
        case theme
        case notifications
        case updatedAt = "updated_at"
    }

    public init(
        profileId: String,
        locale: String,
        theme: ThemePreference,
        notifications: NotificationPrefs,
        updatedAt: String
    ) {
        self.profileId = profileId
        self.locale = locale
        self.theme = theme
        self.notifications = notifications
        self.updatedAt = updatedAt
    }
}

public struct UserPreferencesUpdate: Codable, Equatable, Sendable {
    public var locale: String?
    public var theme: ThemePreference?
    public var notifications: NotificationPrefs?

    enum CodingKeys: String, CodingKey {
        case locale
        case theme
        case notifications
    }

    public init(
        locale: String? = nil,
        theme: ThemePreference? = nil,
        notifications: NotificationPrefs? = nil
    ) {
        self.locale = locale
        self.theme = theme
        self.notifications = notifications
    }
}

public struct ResolvedCapability: Codable, Equatable, Sendable {
    public var capabilityKey: String
    public var labelDe: String
    public var labelEn: String
    public var allowedLevels: [CapabilityLevel]
    public var sort: Int
    public var rank: Int
    public var level: CapabilityLevel
    public var ownerOnly: Bool
    public var enforcement: CapabilityEnforcement

    enum CodingKeys: String, CodingKey {
        case capabilityKey = "capability_key"
        case labelDe = "label_de"
        case labelEn = "label_en"
        case allowedLevels = "allowed_levels"
        case sort
        case rank
        case level
        case ownerOnly = "owner_only"
        case enforcement
    }

    public init(
        capabilityKey: String,
        labelDe: String,
        labelEn: String,
        allowedLevels: [CapabilityLevel],
        sort: Int,
        rank: Int,
        level: CapabilityLevel,
        ownerOnly: Bool,
        enforcement: CapabilityEnforcement
    ) {
        self.capabilityKey = capabilityKey
        self.labelDe = labelDe
        self.labelEn = labelEn
        self.allowedLevels = allowedLevels
        self.sort = sort
        self.rank = rank
        self.level = level
        self.ownerOnly = ownerOnly
        self.enforcement = enforcement
    }
}

public struct CapabilityResolution: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var roleKeys: [String]
    public var isPlatformAdmin: Bool
    public var capabilities: [ResolvedCapability]

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case roleKeys = "role_keys"
        case isPlatformAdmin = "is_platform_admin"
        case capabilities
    }

    public init(
        clubId: String,
        roleKeys: [String],
        isPlatformAdmin: Bool,
        capabilities: [ResolvedCapability]
    ) {
        self.clubId = clubId
        self.roleKeys = roleKeys
        self.isPlatformAdmin = isPlatformAdmin
        self.capabilities = capabilities
    }
}

public struct Capability: Codable, Equatable, Sendable {
    public var key: String
    public var labelDe: String
    public var labelEn: String
    public var allowedLevels: [CapabilityLevel]
    public var sort: Int
    public var ownerOnly: Bool
    public var enforcement: CapabilityEnforcement

    enum CodingKeys: String, CodingKey {
        case key
        case labelDe = "label_de"
        case labelEn = "label_en"
        case allowedLevels = "allowed_levels"
        case sort
        case ownerOnly = "owner_only"
        case enforcement
    }

    public init(
        key: String,
        labelDe: String,
        labelEn: String,
        allowedLevels: [CapabilityLevel],
        sort: Int,
        ownerOnly: Bool,
        enforcement: CapabilityEnforcement
    ) {
        self.key = key
        self.labelDe = labelDe
        self.labelEn = labelEn
        self.allowedLevels = allowedLevels
        self.sort = sort
        self.ownerOnly = ownerOnly
        self.enforcement = enforcement
    }
}

public struct MemberRoleAssignment: Codable, Equatable, Sendable {
    /// Format: uuid
    public var memberId: String
    /// Format: [uuid]
    public var roleIds: [String]

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case roleIds = "role_ids"
    }

    public init(
        memberId: String,
        roleIds: [String]
    ) {
        self.memberId = memberId
        self.roleIds = roleIds
    }
}

public struct ClubRoleDef: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var key: String
    public var nameDe: String
    public var nameEn: String
    public var isSystem: Bool
    public var protected: Bool
    public var sort: Int
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case key
        case nameDe = "name_de"
        case nameEn = "name_en"
        case isSystem = "is_system"
        case protected
        case sort
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        key: String,
        nameDe: String,
        nameEn: String,
        isSystem: Bool,
        protected: Bool,
        sort: Int,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.key = key
        self.nameDe = nameDe
        self.nameEn = nameEn
        self.isSystem = isSystem
        self.protected = protected
        self.sort = sort
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct RolePermission: Codable, Equatable, Sendable {
    public var capabilityKey: String
    public var level: CapabilityLevel

    enum CodingKeys: String, CodingKey {
        case capabilityKey = "capability_key"
        case level
    }

    public init(
        capabilityKey: String,
        level: CapabilityLevel
    ) {
        self.capabilityKey = capabilityKey
        self.level = level
    }
}

public struct ClubRoleDefCreate: Codable, Equatable, Sendable {
    public var key: String
    public var nameDe: String
    public var nameEn: String
    public var sort: Int?

    enum CodingKeys: String, CodingKey {
        case key
        case nameDe = "name_de"
        case nameEn = "name_en"
        case sort
    }

    public init(
        key: String,
        nameDe: String,
        nameEn: String,
        sort: Int? = nil
    ) {
        self.key = key
        self.nameDe = nameDe
        self.nameEn = nameEn
        self.sort = sort
    }
}

public struct ClubRoleDefUpdate: Codable, Equatable, Sendable {
    public var nameDe: String?
    public var nameEn: String?
    public var sort: Int?

    enum CodingKeys: String, CodingKey {
        case nameDe = "name_de"
        case nameEn = "name_en"
        case sort
    }

    public init(
        nameDe: String? = nil,
        nameEn: String? = nil,
        sort: Int? = nil
    ) {
        self.nameDe = nameDe
        self.nameEn = nameEn
        self.sort = sort
    }
}

public struct RolePermissionSet: Codable, Equatable, Sendable {
    public var permissions: [RolePermission]

    enum CodingKeys: String, CodingKey {
        case permissions
    }

    public init(
        permissions: [RolePermission]
    ) {
        self.permissions = permissions
    }
}

public struct MemberRolesSet: Codable, Equatable, Sendable {
    /// Format: [uuid]
    public var roleIds: [String]

    enum CodingKeys: String, CodingKey {
        case roleIds = "role_ids"
    }

    public init(
        roleIds: [String]
    ) {
        self.roleIds = roleIds
    }
}

public struct TeamCoachesSet: Codable, Equatable, Sendable {
    /// Format: [uuid]
    public var memberIds: [String]

    enum CodingKeys: String, CodingKey {
        case memberIds = "member_ids"
    }

    public init(
        memberIds: [String]
    ) {
        self.memberIds = memberIds
    }
}

public struct ClubModuleState: Codable, Equatable, Sendable {
    public var moduleKey: String
    public var labelDe: String
    public var labelEn: String
    public var descDe: String
    public var descEn: String
    public var sort: Int
    public var core: Bool
    public var requiresPro: Bool
    public var enforcement: ClubModuleStateEnforcement?
    public var defaultEnabled: Bool
    public var enabled: Bool
    public var proOk: Bool
    public var available: Bool

    enum CodingKeys: String, CodingKey {
        case moduleKey = "module_key"
        case labelDe = "label_de"
        case labelEn = "label_en"
        case descDe = "desc_de"
        case descEn = "desc_en"
        case sort
        case core
        case requiresPro = "requires_pro"
        case enforcement
        case defaultEnabled = "default_enabled"
        case enabled
        case proOk = "pro_ok"
        case available
    }

    public init(
        moduleKey: String,
        labelDe: String,
        labelEn: String,
        descDe: String,
        descEn: String,
        sort: Int,
        core: Bool,
        requiresPro: Bool,
        enforcement: ClubModuleStateEnforcement? = nil,
        defaultEnabled: Bool,
        enabled: Bool,
        proOk: Bool,
        available: Bool
    ) {
        self.moduleKey = moduleKey
        self.labelDe = labelDe
        self.labelEn = labelEn
        self.descDe = descDe
        self.descEn = descEn
        self.sort = sort
        self.core = core
        self.requiresPro = requiresPro
        self.enforcement = enforcement
        self.defaultEnabled = defaultEnabled
        self.enabled = enabled
        self.proOk = proOk
        self.available = available
    }
}

public struct ClubModuleSet: Codable, Equatable, Sendable {
    public var enabled: Bool

    enum CodingKeys: String, CodingKey {
        case enabled
    }

    public init(
        enabled: Bool
    ) {
        self.enabled = enabled
    }
}

public struct Team: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var ageGroup: String?
    /// Format: uuid
    public var sparteId: String?
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
        case sparteId = "sparte_id"
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
        sparteId: String? = nil,
        skaterMemberIds: [String],
        coachMemberIds: [String],
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.name = name
        self.ageGroup = ageGroup
        self.sparteId = sparteId
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

public struct Sparte: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var icon: String?
    public var farbe: String?
    public var aktiv: Bool
    public var sortierung: Int
    public var eigeneFinanzen: Bool
    /// Format: [uuid]
    public var memberIds: [String]
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case name
        case icon
        case farbe
        case aktiv
        case sortierung
        case eigeneFinanzen = "eigene_finanzen"
        case memberIds = "member_ids"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        name: String,
        icon: String? = nil,
        farbe: String? = nil,
        aktiv: Bool,
        sortierung: Int,
        eigeneFinanzen: Bool,
        memberIds: [String],
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.name = name
        self.icon = icon
        self.farbe = farbe
        self.aktiv = aktiv
        self.sortierung = sortierung
        self.eigeneFinanzen = eigeneFinanzen
        self.memberIds = memberIds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct SparteCreate: Codable, Equatable, Sendable {
    public var name: String
    public var icon: String?
    public var farbe: String?
    public var aktiv: Bool?
    public var sortierung: Int?
    public var eigeneFinanzen: Bool?

    enum CodingKeys: String, CodingKey {
        case name
        case icon
        case farbe
        case aktiv
        case sortierung
        case eigeneFinanzen = "eigene_finanzen"
    }

    public init(
        name: String,
        icon: String? = nil,
        farbe: String? = nil,
        aktiv: Bool? = true,
        sortierung: Int? = 0,
        eigeneFinanzen: Bool? = false
    ) {
        self.name = name
        self.icon = icon
        self.farbe = farbe
        self.aktiv = aktiv
        self.sortierung = sortierung
        self.eigeneFinanzen = eigeneFinanzen
    }
}

public struct SparteUpdate: Codable, Equatable, Sendable {
    public var name: String?
    public var icon: String?
    public var farbe: String?
    public var aktiv: Bool?
    public var sortierung: Int?
    public var eigeneFinanzen: Bool?

    enum CodingKeys: String, CodingKey {
        case name
        case icon
        case farbe
        case aktiv
        case sortierung
        case eigeneFinanzen = "eigene_finanzen"
    }

    public init(
        name: String? = nil,
        icon: String? = nil,
        farbe: String? = nil,
        aktiv: Bool? = nil,
        sortierung: Int? = nil,
        eigeneFinanzen: Bool? = nil
    ) {
        self.name = name
        self.icon = icon
        self.farbe = farbe
        self.aktiv = aktiv
        self.sortierung = sortierung
        self.eigeneFinanzen = eigeneFinanzen
    }
}

public struct SparteMembersSet: Codable, Equatable, Sendable {
    /// Format: [uuid]
    public var memberIds: [String]?

    enum CodingKeys: String, CodingKey {
        case memberIds = "member_ids"
    }

    public init(
        memberIds: [String]? = []
    ) {
        self.memberIds = memberIds
    }
}

public struct TeamSparteSet: Codable, Equatable, Sendable {
    /// Format: uuid
    public var sparteId: String?

    enum CodingKeys: String, CodingKey {
        case sparteId = "sparte_id"
    }

    public init(
        sparteId: String? = nil
    ) {
        self.sparteId = sparteId
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
    /// Format: uuid
    public var logoAssetId: String?
    public var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case shortName = "short_name"
        case city
        case discipline
        case memberCount = "member_count"
        case logoAssetId = "logo_asset_id"
        case createdAt = "created_at"
    }

    public init(
        id: String,
        name: String,
        shortName: String? = nil,
        city: String? = nil,
        discipline: String? = nil,
        memberCount: Int? = nil,
        logoAssetId: String? = nil,
        createdAt: String
    ) {
        self.id = id
        self.name = name
        self.shortName = shortName
        self.city = city
        self.discipline = discipline
        self.memberCount = memberCount
        self.logoAssetId = logoAssetId
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

public struct PlatformSmtp: Codable, Equatable, Sendable {
    public var host: String
    public var port: Int?
    public var user: String
    public var from: String
    public var secure: Bool
    public var passwordSet: Bool

    enum CodingKeys: String, CodingKey {
        case host
        case port
        case user
        case from
        case secure
        case passwordSet = "password_set"
    }

    public init(
        host: String,
        port: Int? = nil,
        user: String,
        from: String,
        secure: Bool,
        passwordSet: Bool
    ) {
        self.host = host
        self.port = port
        self.user = user
        self.from = from
        self.secure = secure
        self.passwordSet = passwordSet
    }
}

public struct PlatformLegal: Codable, Equatable, Sendable {
    public var impressum: String
    public var datenschutz: String
    public var agb: String

    enum CodingKeys: String, CodingKey {
        case impressum
        case datenschutz
        case agb
    }

    public init(
        impressum: String,
        datenschutz: String,
        agb: String
    ) {
        self.impressum = impressum
        self.datenschutz = datenschutz
        self.agb = agb
    }
}

public struct PlatformContent: Codable, Equatable, Sendable {
    public var websiteTitle: String
    public var websiteSubtitle: String
    public var seoTitle: String
    public var seoDescription: String
    public var seoKeywords: String

    enum CodingKeys: String, CodingKey {
        case websiteTitle = "website_title"
        case websiteSubtitle = "website_subtitle"
        case seoTitle = "seo_title"
        case seoDescription = "seo_description"
        case seoKeywords = "seo_keywords"
    }

    public init(
        websiteTitle: String,
        websiteSubtitle: String,
        seoTitle: String,
        seoDescription: String,
        seoKeywords: String
    ) {
        self.websiteTitle = websiteTitle
        self.websiteSubtitle = websiteSubtitle
        self.seoTitle = seoTitle
        self.seoDescription = seoDescription
        self.seoKeywords = seoKeywords
    }
}

public struct PlatformSettings: Codable, Equatable, Sendable {
    public var smtp: PlatformSmtp
    public var legal: PlatformLegal
    public var content: PlatformContent
    public var featureFlags: [String: JSONValue]
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case smtp
        case legal
        case content
        case featureFlags = "feature_flags"
        case updatedAt = "updated_at"
    }

    public init(
        smtp: PlatformSmtp,
        legal: PlatformLegal,
        content: PlatformContent,
        featureFlags: [String: JSONValue],
        updatedAt: String
    ) {
        self.smtp = smtp
        self.legal = legal
        self.content = content
        self.featureFlags = featureFlags
        self.updatedAt = updatedAt
    }
}

public struct PlatformSmtpPatch: Codable, Equatable, Sendable {
    public var host: String?
    public var port: Int?
    public var user: String?
    public var from: String?
    public var secure: Bool?
    public var password: String?

    enum CodingKeys: String, CodingKey {
        case host
        case port
        case user
        case from
        case secure
        case password
    }

    public init(
        host: String? = nil,
        port: Int? = nil,
        user: String? = nil,
        from: String? = nil,
        secure: Bool? = nil,
        password: String? = nil
    ) {
        self.host = host
        self.port = port
        self.user = user
        self.from = from
        self.secure = secure
        self.password = password
    }
}

public struct PlatformLegalPatch: Codable, Equatable, Sendable {
    public var impressum: String?
    public var datenschutz: String?
    public var agb: String?

    enum CodingKeys: String, CodingKey {
        case impressum
        case datenschutz
        case agb
    }

    public init(
        impressum: String? = nil,
        datenschutz: String? = nil,
        agb: String? = nil
    ) {
        self.impressum = impressum
        self.datenschutz = datenschutz
        self.agb = agb
    }
}

public struct PlatformContentPatch: Codable, Equatable, Sendable {
    public var websiteTitle: String?
    public var websiteSubtitle: String?
    public var seoTitle: String?
    public var seoDescription: String?
    public var seoKeywords: String?

    enum CodingKeys: String, CodingKey {
        case websiteTitle = "website_title"
        case websiteSubtitle = "website_subtitle"
        case seoTitle = "seo_title"
        case seoDescription = "seo_description"
        case seoKeywords = "seo_keywords"
    }

    public init(
        websiteTitle: String? = nil,
        websiteSubtitle: String? = nil,
        seoTitle: String? = nil,
        seoDescription: String? = nil,
        seoKeywords: String? = nil
    ) {
        self.websiteTitle = websiteTitle
        self.websiteSubtitle = websiteSubtitle
        self.seoTitle = seoTitle
        self.seoDescription = seoDescription
        self.seoKeywords = seoKeywords
    }
}

public struct PlatformSettingsPatch: Codable, Equatable, Sendable {
    public var smtp: PlatformSmtpPatch?
    public var legal: PlatformLegalPatch?
    public var content: PlatformContentPatch?
    public var featureFlags: [String: JSONValue]?

    enum CodingKeys: String, CodingKey {
        case smtp
        case legal
        case content
        case featureFlags = "feature_flags"
    }

    public init(
        smtp: PlatformSmtpPatch? = nil,
        legal: PlatformLegalPatch? = nil,
        content: PlatformContentPatch? = nil,
        featureFlags: [String: JSONValue]? = nil
    ) {
        self.smtp = smtp
        self.legal = legal
        self.content = content
        self.featureFlags = featureFlags
    }
}

public struct SmtpTestResponse: Codable, Equatable, Sendable {
    public var ok: Bool
    public var mode: SmtpTestResponseMode
    public var detail: String
    public var messageId: String?
    public var preview: SmtpTestResponsePreview?

    enum CodingKeys: String, CodingKey {
        case ok
        case mode
        case detail
        case messageId = "message_id"
        case preview
    }

    public init(
        ok: Bool,
        mode: SmtpTestResponseMode,
        detail: String,
        messageId: String? = nil,
        preview: SmtpTestResponsePreview? = nil
    ) {
        self.ok = ok
        self.mode = mode
        self.detail = detail
        self.messageId = messageId
        self.preview = preview
    }
}

public struct SmtpTestRequest: Codable, Equatable, Sendable {
    /// Format: email
    public var recipient: String
    public var dryRun: Bool?

    enum CodingKeys: String, CodingKey {
        case recipient
        case dryRun = "dry_run"
    }

    public init(
        recipient: String,
        dryRun: Bool? = nil
    ) {
        self.recipient = recipient
        self.dryRun = dryRun
    }
}

public struct PlatformEntitlementRow: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var clubName: String
    public var shortName: String?
    public var memberCount: Int?
    /// Format: uuid
    public var entitlementId: String?
    public var tier: String?
    public var status: String?
    public var source: PlatformEntitlementRowSource?
    public var providerRef: String?
    public var validUntil: String?
    public var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case clubName = "club_name"
        case shortName = "short_name"
        case memberCount = "member_count"
        case entitlementId = "entitlement_id"
        case tier
        case status
        case source
        case providerRef = "provider_ref"
        case validUntil = "valid_until"
        case updatedAt = "updated_at"
    }

    public init(
        clubId: String,
        clubName: String,
        shortName: String? = nil,
        memberCount: Int? = nil,
        entitlementId: String? = nil,
        tier: String? = nil,
        status: String? = nil,
        source: PlatformEntitlementRowSource? = nil,
        providerRef: String? = nil,
        validUntil: String? = nil,
        updatedAt: String? = nil
    ) {
        self.clubId = clubId
        self.clubName = clubName
        self.shortName = shortName
        self.memberCount = memberCount
        self.entitlementId = entitlementId
        self.tier = tier
        self.status = status
        self.source = source
        self.providerRef = providerRef
        self.validUntil = validUntil
        self.updatedAt = updatedAt
    }
}

public struct PlatformEntitlementPatch: Codable, Equatable, Sendable {
    public var tier: PlatformTier
    public var status: PlatformEntitlementStatus
    /// Format: date-time
    public var validUntil: String?
    public var trialDays: Int?
    public var reason: String?

    enum CodingKeys: String, CodingKey {
        case tier
        case status
        case validUntil = "valid_until"
        case trialDays = "trial_days"
        case reason
    }

    public init(
        tier: PlatformTier,
        status: PlatformEntitlementStatus,
        validUntil: String? = nil,
        trialDays: Int? = nil,
        reason: String? = nil
    ) {
        self.tier = tier
        self.status = status
        self.validUntil = validUntil
        self.trialDays = trialDays
        self.reason = reason
    }
}

public struct PlatformPaymentEvent: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    public var provider: String
    public var eventId: String
    public var eventType: String?
    public var status: String
    public var error: String?
    public var receivedAt: String
    public var processedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case provider
        case eventId = "event_id"
        case eventType = "event_type"
        case status
        case error
        case receivedAt = "received_at"
        case processedAt = "processed_at"
    }

    public init(
        id: String,
        provider: String,
        eventId: String,
        eventType: String? = nil,
        status: String,
        error: String? = nil,
        receivedAt: String,
        processedAt: String? = nil
    ) {
        self.id = id
        self.provider = provider
        self.eventId = eventId
        self.eventType = eventType
        self.status = status
        self.error = error
        self.receivedAt = receivedAt
        self.processedAt = processedAt
    }
}

public struct PlatformSubscriptionSummary: Codable, Equatable, Sendable {
    public var active: Int?
    public var trial: Int?
    public var pastDue: Int?
    public var canceled: Int?
    public var licensedClubs: Int?

    enum CodingKeys: String, CodingKey {
        case active
        case trial
        case pastDue = "past_due"
        case canceled
        case licensedClubs = "licensed_clubs"
    }

    public init(
        active: Int? = nil,
        trial: Int? = nil,
        pastDue: Int? = nil,
        canceled: Int? = nil,
        licensedClubs: Int? = nil
    ) {
        self.active = active
        self.trial = trial
        self.pastDue = pastDue
        self.canceled = canceled
        self.licensedClubs = licensedClubs
    }
}

public struct PlatformPaymentsPage: Codable, Equatable, Sendable {
    public var total: Int?
    public var limit: Int?
    public var offset: Int?

    enum CodingKeys: String, CodingKey {
        case total
        case limit
        case offset
    }

    public init(
        total: Int? = nil,
        limit: Int? = nil,
        offset: Int? = nil
    ) {
        self.total = total
        self.limit = limit
        self.offset = offset
    }
}

public struct PlatformPayments: Codable, Equatable, Sendable {
    public var events: [PlatformPaymentEvent]
    public var subscriptionSummary: PlatformSubscriptionSummary
    public var page: PlatformPaymentsPage

    enum CodingKeys: String, CodingKey {
        case events
        case subscriptionSummary = "subscription_summary"
        case page
    }

    public init(
        events: [PlatformPaymentEvent],
        subscriptionSummary: PlatformSubscriptionSummary,
        page: PlatformPaymentsPage
    ) {
        self.events = events
        self.subscriptionSummary = subscriptionSummary
        self.page = page
    }
}

public struct PlatformProduct: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    public var code: String
    public var kind: PlatformProductKind
    public var name: String
    public var description: String?
    public var priceCents: Int?
    public var currency: String
    public var billingInterval: PlatformProductBillingInterval
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
        kind: PlatformProductKind,
        name: String,
        description: String? = nil,
        priceCents: Int? = nil,
        currency: String,
        billingInterval: PlatformProductBillingInterval,
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

public struct PlatformProductPatch: Codable, Equatable, Sendable {
    public var priceCents: Int?
    public var active: Bool?
    public var name: String?
    public var description: String?

    enum CodingKeys: String, CodingKey {
        case priceCents = "price_cents"
        case active
        case name
        case description
    }

    public init(
        priceCents: Int? = nil,
        active: Bool? = nil,
        name: String? = nil,
        description: String? = nil
    ) {
        self.priceCents = priceCents
        self.active = active
        self.name = name
        self.description = description
    }
}

public struct PlatformRoutineRow: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var clubName: String
    public var title: String
    public var status: PlatformRoutineRowStatus
    public var category: String?
    public var musicTitle: String?
    public var musicArtist: String?
    public var musicDurationMs: Int?
    /// Format: uuid
    public var audioAssetId: String?
    public var audioMimeType: String?
    public var audioSizeBytes: Int?
    public var skaterCount: Int?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case clubName = "club_name"
        case title
        case status
        case category
        case musicTitle = "music_title"
        case musicArtist = "music_artist"
        case musicDurationMs = "music_duration_ms"
        case audioAssetId = "audio_asset_id"
        case audioMimeType = "audio_mime_type"
        case audioSizeBytes = "audio_size_bytes"
        case skaterCount = "skater_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        clubName: String,
        title: String,
        status: PlatformRoutineRowStatus,
        category: String? = nil,
        musicTitle: String? = nil,
        musicArtist: String? = nil,
        musicDurationMs: Int? = nil,
        audioAssetId: String? = nil,
        audioMimeType: String? = nil,
        audioSizeBytes: Int? = nil,
        skaterCount: Int? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.clubName = clubName
        self.title = title
        self.status = status
        self.category = category
        self.musicTitle = musicTitle
        self.musicArtist = musicArtist
        self.musicDurationMs = musicDurationMs
        self.audioAssetId = audioAssetId
        self.audioMimeType = audioMimeType
        self.audioSizeBytes = audioSizeBytes
        self.skaterCount = skaterCount
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct PlatformSystemDb: Codable, Equatable, Sendable {
    public var clubs: Int?
    public var users: Int?
    public var members: Int?
    public var activeEntitlements: Int?
    public var webhookEvents: Int?
    public var sizeBytes: Int?
    public var sizePretty: String

    enum CodingKeys: String, CodingKey {
        case clubs
        case users
        case members
        case activeEntitlements = "active_entitlements"
        case webhookEvents = "webhook_events"
        case sizeBytes = "size_bytes"
        case sizePretty = "size_pretty"
    }

    public init(
        clubs: Int? = nil,
        users: Int? = nil,
        members: Int? = nil,
        activeEntitlements: Int? = nil,
        webhookEvents: Int? = nil,
        sizeBytes: Int? = nil,
        sizePretty: String
    ) {
        self.clubs = clubs
        self.users = users
        self.members = members
        self.activeEntitlements = activeEntitlements
        self.webhookEvents = webhookEvents
        self.sizeBytes = sizeBytes
        self.sizePretty = sizePretty
    }
}

public struct PlatformSystemMigrations: Codable, Equatable, Sendable {
    public var count: Int?
    public var latest: String?
    public var list: [String]

    enum CodingKeys: String, CodingKey {
        case count
        case latest
        case list
    }

    public init(
        count: Int? = nil,
        latest: String? = nil,
        list: [String]
    ) {
        self.count = count
        self.latest = latest
        self.list = list
    }
}

public struct PlatformSystemHealth: Codable, Equatable, Sendable {
    public var status: PlatformSystemHealthStatus
    public var dbTime: String

    enum CodingKeys: String, CodingKey {
        case status
        case dbTime = "db_time"
    }

    public init(
        status: PlatformSystemHealthStatus,
        dbTime: String
    ) {
        self.status = status
        self.dbTime = dbTime
    }
}

public struct PlatformSystem: Codable, Equatable, Sendable {
    public var appVersion: String
    public var authMode: PlatformSystemAuthMode
    public var db: PlatformSystemDb
    public var migrations: PlatformSystemMigrations
    public var health: PlatformSystemHealth

    enum CodingKeys: String, CodingKey {
        case appVersion = "app_version"
        case authMode = "auth_mode"
        case db
        case migrations
        case health
    }

    public init(
        appVersion: String,
        authMode: PlatformSystemAuthMode,
        db: PlatformSystemDb,
        migrations: PlatformSystemMigrations,
        health: PlatformSystemHealth
    ) {
        self.appVersion = appVersion
        self.authMode = authMode
        self.db = db
        self.migrations = migrations
        self.health = health
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
    public var audience: EventAudience
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
        case audience
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
        audience: EventAudience,
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
        self.audience = audience
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
    public var audience: EventAudience?
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
        case audience
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
        audience: EventAudience? = .teams,
        teamIds: [String]? = []
    ) {
        self.clubId = clubId
        self.type = type
        self.title = title
        self.note = note
        self.location = location
        self.startsAt = startsAt
        self.endsAt = endsAt
        self.audience = audience
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

public struct EventRideRider: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var rideId: String
    /// Format: uuid
    public var memberId: String
    public var memberFirstName: String
    public var memberLastName: String
    /// Format: uuid
    public var angemeldetVonProfileId: String?
    public var status: EventRideRiderStatus
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case rideId = "ride_id"
        case memberId = "member_id"
        case memberFirstName = "member_first_name"
        case memberLastName = "member_last_name"
        case angemeldetVonProfileId = "angemeldet_von_profile_id"
        case status
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        rideId: String,
        memberId: String,
        memberFirstName: String,
        memberLastName: String,
        angemeldetVonProfileId: String? = nil,
        status: EventRideRiderStatus,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.rideId = rideId
        self.memberId = memberId
        self.memberFirstName = memberFirstName
        self.memberLastName = memberLastName
        self.angemeldetVonProfileId = angemeldetVonProfileId
        self.status = status
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct EventRide: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var eventId: String
    /// Format: uuid
    public var driverMemberId: String
    public var driverFirstName: String
    public var driverLastName: String
    public var abfahrtsort: String
    public var abfahrtszeit: String
    public var plaetzeGesamt: Int
    public var plaetzeFrei: Int
    public var notiz: String?
    public var status: EventRideStatus
    public var rueckrufnummer: String?
    public var kontaktSichtbar: Bool
    public var riders: [EventRideRider]
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case eventId = "event_id"
        case driverMemberId = "driver_member_id"
        case driverFirstName = "driver_first_name"
        case driverLastName = "driver_last_name"
        case abfahrtsort
        case abfahrtszeit
        case plaetzeGesamt = "plaetze_gesamt"
        case plaetzeFrei = "plaetze_frei"
        case notiz
        case status
        case rueckrufnummer
        case kontaktSichtbar = "kontakt_sichtbar"
        case riders
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        eventId: String,
        driverMemberId: String,
        driverFirstName: String,
        driverLastName: String,
        abfahrtsort: String,
        abfahrtszeit: String,
        plaetzeGesamt: Int,
        plaetzeFrei: Int,
        notiz: String? = nil,
        status: EventRideStatus,
        rueckrufnummer: String? = nil,
        kontaktSichtbar: Bool,
        riders: [EventRideRider],
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.eventId = eventId
        self.driverMemberId = driverMemberId
        self.driverFirstName = driverFirstName
        self.driverLastName = driverLastName
        self.abfahrtsort = abfahrtsort
        self.abfahrtszeit = abfahrtszeit
        self.plaetzeGesamt = plaetzeGesamt
        self.plaetzeFrei = plaetzeFrei
        self.notiz = notiz
        self.status = status
        self.rueckrufnummer = rueckrufnummer
        self.kontaktSichtbar = kontaktSichtbar
        self.riders = riders
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct EventRideCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var driverMemberId: String?
    public var abfahrtsort: String
    /// Format: date-time
    public var abfahrtszeit: String
    public var plaetzeGesamt: Int
    public var notiz: String?
    public var rueckrufnummer: String?

    enum CodingKeys: String, CodingKey {
        case driverMemberId = "driver_member_id"
        case abfahrtsort
        case abfahrtszeit
        case plaetzeGesamt = "plaetze_gesamt"
        case notiz
        case rueckrufnummer
    }

    public init(
        driverMemberId: String? = nil,
        abfahrtsort: String,
        abfahrtszeit: String,
        plaetzeGesamt: Int,
        notiz: String? = nil,
        rueckrufnummer: String? = nil
    ) {
        self.driverMemberId = driverMemberId
        self.abfahrtsort = abfahrtsort
        self.abfahrtszeit = abfahrtszeit
        self.plaetzeGesamt = plaetzeGesamt
        self.notiz = notiz
        self.rueckrufnummer = rueckrufnummer
    }
}

public struct EventRideUpdate: Codable, Equatable, Sendable {
    public var abfahrtsort: String?
    /// Format: date-time
    public var abfahrtszeit: String?
    public var plaetzeGesamt: Int?
    public var notiz: String?
    public var rueckrufnummer: String?
    public var status: EventRideUpdateStatus?

    enum CodingKeys: String, CodingKey {
        case abfahrtsort
        case abfahrtszeit
        case plaetzeGesamt = "plaetze_gesamt"
        case notiz
        case rueckrufnummer
        case status
    }

    public init(
        abfahrtsort: String? = nil,
        abfahrtszeit: String? = nil,
        plaetzeGesamt: Int? = nil,
        notiz: String? = nil,
        rueckrufnummer: String? = nil,
        status: EventRideUpdateStatus? = nil
    ) {
        self.abfahrtsort = abfahrtsort
        self.abfahrtszeit = abfahrtszeit
        self.plaetzeGesamt = plaetzeGesamt
        self.notiz = notiz
        self.rueckrufnummer = rueckrufnummer
        self.status = status
    }
}

public struct EventRideRiderCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var memberId: String

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
    }

    public init(
        memberId: String
    ) {
        self.memberId = memberId
    }
}

public struct EventRideRiderUpdate: Codable, Equatable, Sendable {
    public var status: EventRideRiderStatus

    enum CodingKeys: String, CodingKey {
        case status
    }

    public init(
        status: EventRideRiderStatus
    ) {
        self.status = status
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

public struct RoutineScoreCreate: Codable, Equatable, Sendable {
    /// Format: date
    public var scoredOn: String
    public var scoringSystem: String?
    public var technicalScore: Double?
    public var componentsScore: Double?
    public var totalScore: Double?
    /// Format: uuid
    public var competitionId: String?
    public var placement: Int?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case scoredOn = "scored_on"
        case scoringSystem = "scoring_system"
        case technicalScore = "technical_score"
        case componentsScore = "components_score"
        case totalScore = "total_score"
        case competitionId = "competition_id"
        case placement
        case note
    }

    public init(
        scoredOn: String,
        scoringSystem: String? = "rollart",
        technicalScore: Double? = nil,
        componentsScore: Double? = nil,
        totalScore: Double? = nil,
        competitionId: String? = nil,
        placement: Int? = nil,
        note: String? = nil
    ) {
        self.scoredOn = scoredOn
        self.scoringSystem = scoringSystem
        self.technicalScore = technicalScore
        self.componentsScore = componentsScore
        self.totalScore = totalScore
        self.competitionId = competitionId
        self.placement = placement
        self.note = note
    }
}

public struct RoutineShareCreated: Codable, Equatable, Sendable {
    public var token: String
    public var url: String
    public var expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case token
        case url
        case expiresAt = "expires_at"
    }

    public init(
        token: String,
        url: String,
        expiresAt: String? = nil
    ) {
        self.token = token
        self.url = url
        self.expiresAt = expiresAt
    }
}

public struct RoutineShareCreate: Codable, Equatable, Sendable {
    /// Format: date-time
    public var expiresAt: String?

    enum CodingKeys: String, CodingKey {
        case expiresAt = "expires_at"
    }

    public init(
        expiresAt: String? = nil
    ) {
        self.expiresAt = expiresAt
    }
}

public struct RoutineShareRevoked: Codable, Equatable, Sendable {
    public var revoked: Bool

    enum CodingKeys: String, CodingKey {
        case revoked
    }

    public init(
        revoked: Bool
    ) {
        self.revoked = revoked
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

public struct CompetitionStandingRow: Codable, Equatable, Sendable {
    public var category: String
    public var rank: Int?
    /// Format: uuid
    public var entryId: String
    /// Format: uuid
    public var memberId: String
    public var firstName: String?
    public var lastName: String?
    /// Format: uuid
    public var routineId: String
    public var routineTitle: String
    public var technicalScore: Double?
    public var componentsScore: Double?
    public var totalScore: Double?
    public var placement: Int?
    public var delta: Double?

    enum CodingKeys: String, CodingKey {
        case category
        case rank
        case entryId = "entry_id"
        case memberId = "member_id"
        case firstName = "first_name"
        case lastName = "last_name"
        case routineId = "routine_id"
        case routineTitle = "routine_title"
        case technicalScore = "technical_score"
        case componentsScore = "components_score"
        case totalScore = "total_score"
        case placement
        case delta
    }

    public init(
        category: String,
        rank: Int? = nil,
        entryId: String,
        memberId: String,
        firstName: String? = nil,
        lastName: String? = nil,
        routineId: String,
        routineTitle: String,
        technicalScore: Double? = nil,
        componentsScore: Double? = nil,
        totalScore: Double? = nil,
        placement: Int? = nil,
        delta: Double? = nil
    ) {
        self.category = category
        self.rank = rank
        self.entryId = entryId
        self.memberId = memberId
        self.firstName = firstName
        self.lastName = lastName
        self.routineId = routineId
        self.routineTitle = routineTitle
        self.technicalScore = technicalScore
        self.componentsScore = componentsScore
        self.totalScore = totalScore
        self.placement = placement
        self.delta = delta
    }
}

public struct CompetitionStandings: Codable, Equatable, Sendable {
    /// Format: uuid
    public var competitionId: String
    public var name: String
    public var rows: [CompetitionStandingRow]

    enum CodingKeys: String, CodingKey {
        case competitionId = "competition_id"
        case name
        case rows
    }

    public init(
        competitionId: String,
        name: String,
        rows: [CompetitionStandingRow]
    ) {
        self.competitionId = competitionId
        self.name = name
        self.rows = rows
    }
}

public struct PublicRoutine: Codable, Equatable, Sendable {
    public var title: String
    public var discipline: String?
    public var clubName: String
    public var musicTitle: String?
    public var musicArtist: String?
    public var musicBpm: Int?
    public var musicDurationMs: Int?
    public var markers: [PublicRoutineMarkers]
    public var scores: [PublicRoutineScores]

    enum CodingKeys: String, CodingKey {
        case title
        case discipline
        case clubName = "club_name"
        case musicTitle = "music_title"
        case musicArtist = "music_artist"
        case musicBpm = "music_bpm"
        case musicDurationMs = "music_duration_ms"
        case markers
        case scores
    }

    public init(
        title: String,
        discipline: String? = nil,
        clubName: String,
        musicTitle: String? = nil,
        musicArtist: String? = nil,
        musicBpm: Int? = nil,
        musicDurationMs: Int? = nil,
        markers: [PublicRoutineMarkers],
        scores: [PublicRoutineScores]
    ) {
        self.title = title
        self.discipline = discipline
        self.clubName = clubName
        self.musicTitle = musicTitle
        self.musicArtist = musicArtist
        self.musicBpm = musicBpm
        self.musicDurationMs = musicDurationMs
        self.markers = markers
        self.scores = scores
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

public struct MemberAssessmentCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    public var body: String
    public var ratingTechnik: Int?
    public var ratingAusdruck: Int?
    /// Format: date
    public var assessedOn: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case memberId = "member_id"
        case body
        case ratingTechnik = "rating_technik"
        case ratingAusdruck = "rating_ausdruck"
        case assessedOn = "assessed_on"
    }

    public init(
        clubId: String,
        memberId: String,
        body: String,
        ratingTechnik: Int? = nil,
        ratingAusdruck: Int? = nil,
        assessedOn: String? = nil
    ) {
        self.clubId = clubId
        self.memberId = memberId
        self.body = body
        self.ratingTechnik = ratingTechnik
        self.ratingAusdruck = ratingAusdruck
        self.assessedOn = assessedOn
    }
}

public struct MemberAssessmentUpdate: Codable, Equatable, Sendable {
    public var body: String?
    public var ratingTechnik: Int?
    public var ratingAusdruck: Int?
    /// Format: date
    public var assessedOn: String?

    enum CodingKeys: String, CodingKey {
        case body
        case ratingTechnik = "rating_technik"
        case ratingAusdruck = "rating_ausdruck"
        case assessedOn = "assessed_on"
    }

    public init(
        body: String? = nil,
        ratingTechnik: Int? = nil,
        ratingAusdruck: Int? = nil,
        assessedOn: String? = nil
    ) {
        self.body = body
        self.ratingTechnik = ratingTechnik
        self.ratingAusdruck = ratingAusdruck
        self.assessedOn = assessedOn
    }
}

public struct SupportTicket: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var clubName: String?
    /// Format: uuid
    public var createdByMemberId: String
    public var createdByName: String?
    public var subject: String
    public var status: SupportTicketStatus
    public var priority: SupportTicketPriority
    public var lastReplyAt: String?
    public var lastReplyBy: SupportActor
    public var messageCount: Int
    public var closedAt: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case clubName = "club_name"
        case createdByMemberId = "created_by_member_id"
        case createdByName = "created_by_name"
        case subject
        case status
        case priority
        case lastReplyAt = "last_reply_at"
        case lastReplyBy = "last_reply_by"
        case messageCount = "message_count"
        case closedAt = "closed_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        clubName: String? = nil,
        createdByMemberId: String,
        createdByName: String? = nil,
        subject: String,
        status: SupportTicketStatus,
        priority: SupportTicketPriority,
        lastReplyAt: String? = nil,
        lastReplyBy: SupportActor,
        messageCount: Int,
        closedAt: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.clubName = clubName
        self.createdByMemberId = createdByMemberId
        self.createdByName = createdByName
        self.subject = subject
        self.status = status
        self.priority = priority
        self.lastReplyAt = lastReplyAt
        self.lastReplyBy = lastReplyBy
        self.messageCount = messageCount
        self.closedAt = closedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct SupportMessage: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var ticketId: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var authorProfileId: String
    public var authorName: String?
    public var authorKind: SupportActor
    public var body: String
    public var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case ticketId = "ticket_id"
        case clubId = "club_id"
        case authorProfileId = "author_profile_id"
        case authorName = "author_name"
        case authorKind = "author_kind"
        case body
        case createdAt = "created_at"
    }

    public init(
        id: String,
        ticketId: String,
        clubId: String,
        authorProfileId: String,
        authorName: String? = nil,
        authorKind: SupportActor,
        body: String,
        createdAt: String
    ) {
        self.id = id
        self.ticketId = ticketId
        self.clubId = clubId
        self.authorProfileId = authorProfileId
        self.authorName = authorName
        self.authorKind = authorKind
        self.body = body
        self.createdAt = createdAt
    }
}

public struct SupportTicketDetail: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var clubName: String?
    /// Format: uuid
    public var createdByMemberId: String
    public var createdByName: String?
    public var subject: String
    public var status: SupportTicketStatus
    public var priority: SupportTicketPriority
    public var lastReplyAt: String?
    public var lastReplyBy: SupportActor
    public var messageCount: Int
    public var closedAt: String?
    public var createdAt: String
    public var updatedAt: String
    public var messages: [SupportMessage]

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case clubName = "club_name"
        case createdByMemberId = "created_by_member_id"
        case createdByName = "created_by_name"
        case subject
        case status
        case priority
        case lastReplyAt = "last_reply_at"
        case lastReplyBy = "last_reply_by"
        case messageCount = "message_count"
        case closedAt = "closed_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case messages
    }

    public init(
        id: String,
        clubId: String,
        clubName: String? = nil,
        createdByMemberId: String,
        createdByName: String? = nil,
        subject: String,
        status: SupportTicketStatus,
        priority: SupportTicketPriority,
        lastReplyAt: String? = nil,
        lastReplyBy: SupportActor,
        messageCount: Int,
        closedAt: String? = nil,
        createdAt: String,
        updatedAt: String,
        messages: [SupportMessage]
    ) {
        self.id = id
        self.clubId = clubId
        self.clubName = clubName
        self.createdByMemberId = createdByMemberId
        self.createdByName = createdByName
        self.subject = subject
        self.status = status
        self.priority = priority
        self.lastReplyAt = lastReplyAt
        self.lastReplyBy = lastReplyBy
        self.messageCount = messageCount
        self.closedAt = closedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.messages = messages
    }
}

public struct SupportTicketCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var subject: String
    public var body: String

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case subject
        case body
    }

    public init(
        clubId: String,
        subject: String,
        body: String
    ) {
        self.clubId = clubId
        self.subject = subject
        self.body = body
    }
}

public struct SupportMessageCreate: Codable, Equatable, Sendable {
    public var body: String

    enum CodingKeys: String, CodingKey {
        case body
    }

    public init(
        body: String
    ) {
        self.body = body
    }
}

public struct SupportTicketUpdate: Codable, Equatable, Sendable {
    public var status: SupportTicketStatus?
    public var priority: SupportTicketPriority?

    enum CodingKeys: String, CodingKey {
        case status
        case priority
    }

    public init(
        status: SupportTicketStatus? = nil,
        priority: SupportTicketPriority? = nil
    ) {
        self.status = status
        self.priority = priority
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

public struct GalleryItem: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var album: String?
    public var title: String
    public var kind: GalleryKind
    public var storageKey: String
    public var contentType: String
    public var sizeBytes: Int?
    public var thumbnailKey: String?
    /// Format: uuid
    public var uploadedByMemberId: String
    public var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case album
        case title
        case kind
        case storageKey = "storage_key"
        case contentType = "content_type"
        case sizeBytes = "size_bytes"
        case thumbnailKey = "thumbnail_key"
        case uploadedByMemberId = "uploaded_by_member_id"
        case createdAt = "created_at"
    }

    public init(
        id: String,
        clubId: String,
        album: String? = nil,
        title: String,
        kind: GalleryKind,
        storageKey: String,
        contentType: String,
        sizeBytes: Int? = nil,
        thumbnailKey: String? = nil,
        uploadedByMemberId: String,
        createdAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.album = album
        self.title = title
        self.kind = kind
        self.storageKey = storageKey
        self.contentType = contentType
        self.sizeBytes = sizeBytes
        self.thumbnailKey = thumbnailKey
        self.uploadedByMemberId = uploadedByMemberId
        self.createdAt = createdAt
    }
}

public struct GalleryItemCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var title: String
    public var kind: GalleryKind
    public var storageKey: String
    public var contentType: String
    public var sizeBytes: Int
    public var album: String?
    public var thumbnailKey: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case title
        case kind
        case storageKey = "storage_key"
        case contentType = "content_type"
        case sizeBytes = "size_bytes"
        case album
        case thumbnailKey = "thumbnail_key"
    }

    public init(
        clubId: String,
        title: String,
        kind: GalleryKind,
        storageKey: String,
        contentType: String,
        sizeBytes: Int,
        album: String? = nil,
        thumbnailKey: String? = nil
    ) {
        self.clubId = clubId
        self.title = title
        self.kind = kind
        self.storageKey = storageKey
        self.contentType = contentType
        self.sizeBytes = sizeBytes
        self.album = album
        self.thumbnailKey = thumbnailKey
    }
}

public struct PhotoTag: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var galleryItemId: String
    /// Format: uuid
    public var memberId: String
    /// Format: uuid
    public var taggedByMemberId: String
    public var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case galleryItemId = "gallery_item_id"
        case memberId = "member_id"
        case taggedByMemberId = "tagged_by_member_id"
        case createdAt = "created_at"
    }

    public init(
        id: String,
        clubId: String,
        galleryItemId: String,
        memberId: String,
        taggedByMemberId: String,
        createdAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.galleryItemId = galleryItemId
        self.memberId = memberId
        self.taggedByMemberId = taggedByMemberId
        self.createdAt = createdAt
    }
}

public struct PhotoTagCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var galleryItemId: String
    /// Format: uuid
    public var memberId: String

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case galleryItemId = "gallery_item_id"
        case memberId = "member_id"
    }

    public init(
        clubId: String,
        galleryItemId: String,
        memberId: String
    ) {
        self.clubId = clubId
        self.galleryItemId = galleryItemId
        self.memberId = memberId
    }
}

public struct Document: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var title: String
    public var category: String
    public var storageKey: String
    public var contentType: String
    public var sizeBytes: Int?
    /// Format: uuid
    public var uploadedByMemberId: String
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case title
        case category
        case storageKey = "storage_key"
        case contentType = "content_type"
        case sizeBytes = "size_bytes"
        case uploadedByMemberId = "uploaded_by_member_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        title: String,
        category: String,
        storageKey: String,
        contentType: String,
        sizeBytes: Int? = nil,
        uploadedByMemberId: String,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.title = title
        self.category = category
        self.storageKey = storageKey
        self.contentType = contentType
        self.sizeBytes = sizeBytes
        self.uploadedByMemberId = uploadedByMemberId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct DocumentCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var title: String
    public var storageKey: String
    public var contentType: String
    public var sizeBytes: Int
    public var category: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case title
        case storageKey = "storage_key"
        case contentType = "content_type"
        case sizeBytes = "size_bytes"
        case category
    }

    public init(
        clubId: String,
        title: String,
        storageKey: String,
        contentType: String,
        sizeBytes: Int,
        category: String? = "allgemein"
    ) {
        self.clubId = clubId
        self.title = title
        self.storageKey = storageKey
        self.contentType = contentType
        self.sizeBytes = sizeBytes
        self.category = category
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

public struct AnnualCategoryRow: Codable, Equatable, Sendable {
    /// Format: uuid
    public var categoryId: String?
    public var categoryName: String?
    public var kind: LedgerCategoryKind
    public var amountCents: Int?

    enum CodingKeys: String, CodingKey {
        case categoryId = "category_id"
        case categoryName = "category_name"
        case kind
        case amountCents = "amount_cents"
    }

    public init(
        categoryId: String? = nil,
        categoryName: String? = nil,
        kind: LedgerCategoryKind,
        amountCents: Int? = nil
    ) {
        self.categoryId = categoryId
        self.categoryName = categoryName
        self.kind = kind
        self.amountCents = amountCents
    }
}

public struct AnnualYearTotals: Codable, Equatable, Sendable {
    public var year: Int?
    public var incomeCents: Int?
    public var expenseCents: Int?
    public var netCents: Int?

    enum CodingKeys: String, CodingKey {
        case year
        case incomeCents = "income_cents"
        case expenseCents = "expense_cents"
        case netCents = "net_cents"
    }

    public init(
        year: Int? = nil,
        incomeCents: Int? = nil,
        expenseCents: Int? = nil,
        netCents: Int? = nil
    ) {
        self.year = year
        self.incomeCents = incomeCents
        self.expenseCents = expenseCents
        self.netCents = netCents
    }
}

public struct AnnualReport: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var year: Int?
    public var incomeCents: Int?
    public var expenseCents: Int?
    public var netCents: Int?
    public var byCategory: [AnnualCategoryRow]
    public var prevYear: AnnualYearTotals
    public var netDeltaCents: Int?
    public var donationsTotalCents: Int?
    public var donationsCount: Int?
    public var openItemsCount: Int?
    public var openItemsTotalCents: Int?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case year
        case incomeCents = "income_cents"
        case expenseCents = "expense_cents"
        case netCents = "net_cents"
        case byCategory = "by_category"
        case prevYear = "prev_year"
        case netDeltaCents = "net_delta_cents"
        case donationsTotalCents = "donations_total_cents"
        case donationsCount = "donations_count"
        case openItemsCount = "open_items_count"
        case openItemsTotalCents = "open_items_total_cents"
    }

    public init(
        clubId: String,
        year: Int? = nil,
        incomeCents: Int? = nil,
        expenseCents: Int? = nil,
        netCents: Int? = nil,
        byCategory: [AnnualCategoryRow],
        prevYear: AnnualYearTotals,
        netDeltaCents: Int? = nil,
        donationsTotalCents: Int? = nil,
        donationsCount: Int? = nil,
        openItemsCount: Int? = nil,
        openItemsTotalCents: Int? = nil
    ) {
        self.clubId = clubId
        self.year = year
        self.incomeCents = incomeCents
        self.expenseCents = expenseCents
        self.netCents = netCents
        self.byCategory = byCategory
        self.prevYear = prevYear
        self.netDeltaCents = netDeltaCents
        self.donationsTotalCents = donationsTotalCents
        self.donationsCount = donationsCount
        self.openItemsCount = openItemsCount
        self.openItemsTotalCents = openItemsTotalCents
    }
}

public struct Anniversary: Codable, Equatable, Sendable {
    /// Format: uuid
    public var memberId: String
    public var memberName: String
    public var kind: AnniversaryKind
    public var date: String
    public var years: Int?
    public var daysUntil: Int

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
        case memberName = "member_name"
        case kind
        case date
        case years
        case daysUntil = "days_until"
    }

    public init(
        memberId: String,
        memberName: String,
        kind: AnniversaryKind,
        date: String,
        years: Int? = nil,
        daysUntil: Int
    ) {
        self.memberId = memberId
        self.memberName = memberName
        self.kind = kind
        self.date = date
        self.years = years
        self.daysUntil = daysUntil
    }
}

public struct Department: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var description: String?
    /// Format: uuid
    public var leadMemberId: String?
    public var sortOrder: Int
    /// Format: [uuid]
    public var memberIds: [String]
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case name
        case description
        case leadMemberId = "lead_member_id"
        case sortOrder = "sort_order"
        case memberIds = "member_ids"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        name: String,
        description: String? = nil,
        leadMemberId: String? = nil,
        sortOrder: Int,
        memberIds: [String],
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.name = name
        self.description = description
        self.leadMemberId = leadMemberId
        self.sortOrder = sortOrder
        self.memberIds = memberIds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct DepartmentCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var description: String?
    /// Format: uuid
    public var leadMemberId: String?
    public var sortOrder: Int?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case name
        case description
        case leadMemberId = "lead_member_id"
        case sortOrder = "sort_order"
    }

    public init(
        clubId: String,
        name: String,
        description: String? = nil,
        leadMemberId: String? = nil,
        sortOrder: Int? = 0
    ) {
        self.clubId = clubId
        self.name = name
        self.description = description
        self.leadMemberId = leadMemberId
        self.sortOrder = sortOrder
    }
}

public struct DepartmentUpdate: Codable, Equatable, Sendable {
    public var name: String?
    public var description: String?
    /// Format: uuid
    public var leadMemberId: String?
    public var sortOrder: Int?

    enum CodingKeys: String, CodingKey {
        case name
        case description
        case leadMemberId = "lead_member_id"
        case sortOrder = "sort_order"
    }

    public init(
        name: String? = nil,
        description: String? = nil,
        leadMemberId: String? = nil,
        sortOrder: Int? = nil
    ) {
        self.name = name
        self.description = description
        self.leadMemberId = leadMemberId
        self.sortOrder = sortOrder
    }
}

public struct DepartmentMembersSet: Codable, Equatable, Sendable {
    /// Format: [uuid]
    public var memberIds: [String]?

    enum CodingKeys: String, CodingKey {
        case memberIds = "member_ids"
    }

    public init(
        memberIds: [String]? = []
    ) {
        self.memberIds = memberIds
    }
}

public struct Locker: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var label: String
    public var location: String?
    public var status: LockerStatus
    /// Format: uuid
    public var assignedMemberId: String?
    public var note: String?
    public var createdAt: String
    public var updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case label
        case location
        case status
        case assignedMemberId = "assigned_member_id"
        case note
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    public init(
        id: String,
        clubId: String,
        label: String,
        location: String? = nil,
        status: LockerStatus,
        assignedMemberId: String? = nil,
        note: String? = nil,
        createdAt: String,
        updatedAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.label = label
        self.location = location
        self.status = status
        self.assignedMemberId = assignedMemberId
        self.note = note
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct LockerCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var label: String
    public var location: String?
    public var status: LockerStatus?
    /// Format: uuid
    public var assignedMemberId: String?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case label
        case location
        case status
        case assignedMemberId = "assigned_member_id"
        case note
    }

    public init(
        clubId: String,
        label: String,
        location: String? = nil,
        status: LockerStatus? = .free,
        assignedMemberId: String? = nil,
        note: String? = nil
    ) {
        self.clubId = clubId
        self.label = label
        self.location = location
        self.status = status
        self.assignedMemberId = assignedMemberId
        self.note = note
    }
}

public struct LockerUpdate: Codable, Equatable, Sendable {
    public var label: String?
    public var location: String?
    public var status: LockerStatus?
    /// Format: uuid
    public var assignedMemberId: String?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case label
        case location
        case status
        case assignedMemberId = "assigned_member_id"
        case note
    }

    public init(
        label: String? = nil,
        location: String? = nil,
        status: LockerStatus? = nil,
        assignedMemberId: String? = nil,
        note: String? = nil
    ) {
        self.label = label
        self.location = location
        self.status = status
        self.assignedMemberId = assignedMemberId
        self.note = note
    }
}

public struct LockerAssign: Codable, Equatable, Sendable {
    /// Format: uuid
    public var memberId: String

    enum CodingKeys: String, CodingKey {
        case memberId = "member_id"
    }

    public init(
        memberId: String
    ) {
        self.memberId = memberId
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

public struct InvoiceUpdate: Codable, Equatable, Sendable {
    public var status: InvoiceUpdateStatus
    public var paidVia: String?
    public var postToLedger: Bool?
    /// Format: uuid
    public var ledgerCategoryId: String?

    enum CodingKeys: String, CodingKey {
        case status
        case paidVia = "paid_via"
        case postToLedger = "post_to_ledger"
        case ledgerCategoryId = "ledger_category_id"
    }

    public init(
        status: InvoiceUpdateStatus,
        paidVia: String? = nil,
        postToLedger: Bool? = true,
        ledgerCategoryId: String? = nil
    ) {
        self.status = status
        self.paidVia = paidVia
        self.postToLedger = postToLedger
        self.ledgerCategoryId = ledgerCategoryId
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
    public var categoryId: String?
    public var categoryName: String?
    public var categoryKind: LedgerCategoryKind?
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
        case categoryId = "category_id"
        case categoryName = "category_name"
        case categoryKind = "category_kind"
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
        categoryId: String? = nil,
        categoryName: String? = nil,
        categoryKind: LedgerCategoryKind? = nil,
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
        self.categoryId = categoryId
        self.categoryName = categoryName
        self.categoryKind = categoryKind
        self.invoiceId = invoiceId
        self.reversesEntryId = reversesEntryId
        self.createdAt = createdAt
    }
}

public struct LedgerEntryCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: date
    public var entryOn: String
    public var description: String
    public var counterpartyKind: CounterpartyKind
    /// Format: uuid
    public var counterpartyMemberId: String?
    public var counterpartyName: String?
    public var amountCents: Int
    public var category: String?
    /// Format: uuid
    public var categoryId: String?
    /// Format: uuid
    public var invoiceId: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case entryOn = "entry_on"
        case description
        case counterpartyKind = "counterparty_kind"
        case counterpartyMemberId = "counterparty_member_id"
        case counterpartyName = "counterparty_name"
        case amountCents = "amount_cents"
        case category
        case categoryId = "category_id"
        case invoiceId = "invoice_id"
    }

    public init(
        clubId: String,
        entryOn: String,
        description: String,
        counterpartyKind: CounterpartyKind,
        counterpartyMemberId: String? = nil,
        counterpartyName: String? = nil,
        amountCents: Int,
        category: String? = nil,
        categoryId: String? = nil,
        invoiceId: String? = nil
    ) {
        self.clubId = clubId
        self.entryOn = entryOn
        self.description = description
        self.counterpartyKind = counterpartyKind
        self.counterpartyMemberId = counterpartyMemberId
        self.counterpartyName = counterpartyName
        self.amountCents = amountCents
        self.category = category
        self.categoryId = categoryId
        self.invoiceId = invoiceId
    }
}

public struct LedgerCategory: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var kind: LedgerCategoryKind
    public var sortOrder: Int?
    public var createdAt: String
    public var deletedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case name
        case kind
        case sortOrder = "sort_order"
        case createdAt = "created_at"
        case deletedAt = "deleted_at"
    }

    public init(
        id: String,
        clubId: String,
        name: String,
        kind: LedgerCategoryKind,
        sortOrder: Int? = nil,
        createdAt: String,
        deletedAt: String? = nil
    ) {
        self.id = id
        self.clubId = clubId
        self.name = name
        self.kind = kind
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.deletedAt = deletedAt
    }
}

public struct LedgerCategoryCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var kind: LedgerCategoryKind
    public var sortOrder: Int?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case name
        case kind
        case sortOrder = "sort_order"
    }

    public init(
        clubId: String,
        name: String,
        kind: LedgerCategoryKind,
        sortOrder: Int? = 0
    ) {
        self.clubId = clubId
        self.name = name
        self.kind = kind
        self.sortOrder = sortOrder
    }
}

public struct LedgerReverse: Codable, Equatable, Sendable {
    public var description: String?

    enum CodingKeys: String, CodingKey {
        case description
    }

    public init(
        description: String? = nil
    ) {
        self.description = description
    }
}

public struct BankTransaction: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var bookedOn: String
    public var amountCents: Int?
    public var purpose: String?
    public var counterparty: String?
    /// Format: uuid
    public var matchedInvoiceId: String?
    /// Format: uuid
    public var matchedLedgerEntryId: String?
    public var status: BankTransactionStatus
    public var importedAt: String
    public var createdAt: String
    public var updatedAt: String
    public var deletedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case bookedOn = "booked_on"
        case amountCents = "amount_cents"
        case purpose
        case counterparty
        case matchedInvoiceId = "matched_invoice_id"
        case matchedLedgerEntryId = "matched_ledger_entry_id"
        case status
        case importedAt = "imported_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case deletedAt = "deleted_at"
    }

    public init(
        id: String,
        clubId: String,
        bookedOn: String,
        amountCents: Int? = nil,
        purpose: String? = nil,
        counterparty: String? = nil,
        matchedInvoiceId: String? = nil,
        matchedLedgerEntryId: String? = nil,
        status: BankTransactionStatus,
        importedAt: String,
        createdAt: String,
        updatedAt: String,
        deletedAt: String? = nil
    ) {
        self.id = id
        self.clubId = clubId
        self.bookedOn = bookedOn
        self.amountCents = amountCents
        self.purpose = purpose
        self.counterparty = counterparty
        self.matchedInvoiceId = matchedInvoiceId
        self.matchedLedgerEntryId = matchedLedgerEntryId
        self.status = status
        self.importedAt = importedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}

public struct BankTransactionCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: date
    public var bookedOn: String
    public var amountCents: Int
    public var purpose: String?
    public var counterparty: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case bookedOn = "booked_on"
        case amountCents = "amount_cents"
        case purpose
        case counterparty
    }

    public init(
        clubId: String,
        bookedOn: String,
        amountCents: Int,
        purpose: String? = nil,
        counterparty: String? = nil
    ) {
        self.clubId = clubId
        self.bookedOn = bookedOn
        self.amountCents = amountCents
        self.purpose = purpose
        self.counterparty = counterparty
    }
}

public struct BankTransactionImportRow: Codable, Equatable, Sendable {
    /// Format: date
    public var bookedOn: String
    public var amountCents: Int
    public var purpose: String?
    public var counterparty: String?

    enum CodingKeys: String, CodingKey {
        case bookedOn = "booked_on"
        case amountCents = "amount_cents"
        case purpose
        case counterparty
    }

    public init(
        bookedOn: String,
        amountCents: Int,
        purpose: String? = nil,
        counterparty: String? = nil
    ) {
        self.bookedOn = bookedOn
        self.amountCents = amountCents
        self.purpose = purpose
        self.counterparty = counterparty
    }
}

public struct BankTransactionImport: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var rows: [BankTransactionImportRow]

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case rows
    }

    public init(
        clubId: String,
        rows: [BankTransactionImportRow]
    ) {
        self.clubId = clubId
        self.rows = rows
    }
}

public struct BankTransactionMatch: Codable, Equatable, Sendable {
    /// Format: uuid
    public var invoiceId: String
    public var postToLedger: Bool?
    /// Format: uuid
    public var ledgerCategoryId: String?

    enum CodingKeys: String, CodingKey {
        case invoiceId = "invoice_id"
        case postToLedger = "post_to_ledger"
        case ledgerCategoryId = "ledger_category_id"
    }

    public init(
        invoiceId: String,
        postToLedger: Bool? = true,
        ledgerCategoryId: String? = nil
    ) {
        self.invoiceId = invoiceId
        self.postToLedger = postToLedger
        self.ledgerCategoryId = ledgerCategoryId
    }
}

public struct BankTransactionIgnore: Codable, Equatable, Sendable {
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case note
    }

    public init(
        note: String? = nil
    ) {
        self.note = note
    }
}

public struct DonationCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String?
    public var donorName: String
    public var donorAddress: String?
    public var amountCents: Int
    /// Format: date
    public var donationDate: String
    public var purpose: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case memberId = "member_id"
        case donorName = "donor_name"
        case donorAddress = "donor_address"
        case amountCents = "amount_cents"
        case donationDate = "donation_date"
        case purpose
    }

    public init(
        clubId: String,
        memberId: String? = nil,
        donorName: String,
        donorAddress: String? = nil,
        amountCents: Int,
        donationDate: String,
        purpose: String? = nil
    ) {
        self.clubId = clubId
        self.memberId = memberId
        self.donorName = donorName
        self.donorAddress = donorAddress
        self.amountCents = amountCents
        self.donationDate = donationDate
        self.purpose = purpose
    }
}

public struct DonationUpdate: Codable, Equatable, Sendable {
    public var donorName: String?
    public var donorAddress: String?
    public var amountCents: Int?
    /// Format: date
    public var donationDate: String?
    public var purpose: String?
    public var issue: Bool?

    enum CodingKeys: String, CodingKey {
        case donorName = "donor_name"
        case donorAddress = "donor_address"
        case amountCents = "amount_cents"
        case donationDate = "donation_date"
        case purpose
        case issue
    }

    public init(
        donorName: String? = nil,
        donorAddress: String? = nil,
        amountCents: Int? = nil,
        donationDate: String? = nil,
        purpose: String? = nil,
        issue: Bool? = nil
    ) {
        self.donorName = donorName
        self.donorAddress = donorAddress
        self.amountCents = amountCents
        self.donationDate = donationDate
        self.purpose = purpose
        self.issue = issue
    }
}

public struct DonationReceipt: Codable, Equatable, Sendable {
    /// Format: uuid
    public var donationId: String
    public var receiptNumber: String
    public var clubName: String
    public var donorName: String
    public var donorAddress: String?
    public var amountCents: Int?
    public var amountEur: String
    public var donationDate: String
    public var purpose: String?
    public var issued: Bool
    public var text: String

    enum CodingKeys: String, CodingKey {
        case donationId = "donation_id"
        case receiptNumber = "receipt_number"
        case clubName = "club_name"
        case donorName = "donor_name"
        case donorAddress = "donor_address"
        case amountCents = "amount_cents"
        case amountEur = "amount_eur"
        case donationDate = "donation_date"
        case purpose
        case issued
        case text
    }

    public init(
        donationId: String,
        receiptNumber: String,
        clubName: String,
        donorName: String,
        donorAddress: String? = nil,
        amountCents: Int? = nil,
        amountEur: String,
        donationDate: String,
        purpose: String? = nil,
        issued: Bool,
        text: String
    ) {
        self.donationId = donationId
        self.receiptNumber = receiptNumber
        self.clubName = clubName
        self.donorName = donorName
        self.donorAddress = donorAddress
        self.amountCents = amountCents
        self.amountEur = amountEur
        self.donationDate = donationDate
        self.purpose = purpose
        self.issued = issued
        self.text = text
    }
}

public struct MembershipCategory: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var amountCents: Int?
    public var period: MembershipPeriod
    public var isActive: Bool
    public var sortOrder: Int?
    public var createdAt: String
    public var updatedAt: String
    public var deletedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case name
        case amountCents = "amount_cents"
        case period
        case isActive = "is_active"
        case sortOrder = "sort_order"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case deletedAt = "deleted_at"
    }

    public init(
        id: String,
        clubId: String,
        name: String,
        amountCents: Int? = nil,
        period: MembershipPeriod,
        isActive: Bool,
        sortOrder: Int? = nil,
        createdAt: String,
        updatedAt: String,
        deletedAt: String? = nil
    ) {
        self.id = id
        self.clubId = clubId
        self.name = name
        self.amountCents = amountCents
        self.period = period
        self.isActive = isActive
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}

public struct MembershipCategoryCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var name: String
    public var amountCents: Int
    public var period: MembershipPeriod
    public var isActive: Bool?
    public var sortOrder: Int?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case name
        case amountCents = "amount_cents"
        case period
        case isActive = "is_active"
        case sortOrder = "sort_order"
    }

    public init(
        clubId: String,
        name: String,
        amountCents: Int,
        period: MembershipPeriod,
        isActive: Bool? = true,
        sortOrder: Int? = 0
    ) {
        self.clubId = clubId
        self.name = name
        self.amountCents = amountCents
        self.period = period
        self.isActive = isActive
        self.sortOrder = sortOrder
    }
}

public struct MembershipCategoryUpdate: Codable, Equatable, Sendable {
    public var name: String?
    public var amountCents: Int?
    public var period: MembershipPeriod?
    public var isActive: Bool?
    public var sortOrder: Int?

    enum CodingKeys: String, CodingKey {
        case name
        case amountCents = "amount_cents"
        case period
        case isActive = "is_active"
        case sortOrder = "sort_order"
    }

    public init(
        name: String? = nil,
        amountCents: Int? = nil,
        period: MembershipPeriod? = nil,
        isActive: Bool? = nil,
        sortOrder: Int? = nil
    ) {
        self.name = name
        self.amountCents = amountCents
        self.period = period
        self.isActive = isActive
        self.sortOrder = sortOrder
    }
}

public struct MemberFeeSummaryBucket: Codable, Equatable, Sendable {
    public var period: MembershipPeriod
    public var count: Int?
    public var amountCents: Int?
    public var annualCents: Int?

    enum CodingKeys: String, CodingKey {
        case period
        case count
        case amountCents = "amount_cents"
        case annualCents = "annual_cents"
    }

    public init(
        period: MembershipPeriod,
        count: Int? = nil,
        amountCents: Int? = nil,
        annualCents: Int? = nil
    ) {
        self.period = period
        self.count = count
        self.amountCents = amountCents
        self.annualCents = annualCents
    }
}

public struct MemberFeeSummary: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var byPeriod: [MemberFeeSummaryBucket]
    public var totalAnnualCents: Int?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case byPeriod = "by_period"
        case totalAnnualCents = "total_annual_cents"
    }

    public init(
        clubId: String,
        byPeriod: [MemberFeeSummaryBucket],
        totalAnnualCents: Int? = nil
    ) {
        self.clubId = clubId
        self.byPeriod = byPeriod
        self.totalAnnualCents = totalAnnualCents
    }
}

public struct MemberFeeCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    /// Format: uuid
    public var categoryId: String
    public var customAmountCents: Int?
    /// Format: date
    public var validFrom: String
    /// Format: date
    public var validUntil: String?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case memberId = "member_id"
        case categoryId = "category_id"
        case customAmountCents = "custom_amount_cents"
        case validFrom = "valid_from"
        case validUntil = "valid_until"
    }

    public init(
        clubId: String,
        memberId: String,
        categoryId: String,
        customAmountCents: Int? = nil,
        validFrom: String,
        validUntil: String? = nil
    ) {
        self.clubId = clubId
        self.memberId = memberId
        self.categoryId = categoryId
        self.customAmountCents = customAmountCents
        self.validFrom = validFrom
        self.validUntil = validUntil
    }
}

public struct MemberFeeUpdate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var categoryId: String?
    public var customAmountCents: Int?
    /// Format: date
    public var validFrom: String?
    /// Format: date
    public var validUntil: String?

    enum CodingKeys: String, CodingKey {
        case categoryId = "category_id"
        case customAmountCents = "custom_amount_cents"
        case validFrom = "valid_from"
        case validUntil = "valid_until"
    }

    public init(
        categoryId: String? = nil,
        customAmountCents: Int? = nil,
        validFrom: String? = nil,
        validUntil: String? = nil
    ) {
        self.categoryId = categoryId
        self.customAmountCents = customAmountCents
        self.validFrom = validFrom
        self.validUntil = validUntil
    }
}

public struct FamilyDiscount: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    public var label: String
    public var kind: FamilyDiscountKind
    public var valueNumeric: Double?
    public var appliesFromChild: Int?
    public var isActive: Bool
    public var createdAt: String
    public var updatedAt: String
    public var deletedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case label
        case kind
        case valueNumeric = "value_numeric"
        case appliesFromChild = "applies_from_child"
        case isActive = "is_active"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case deletedAt = "deleted_at"
    }

    public init(
        id: String,
        clubId: String,
        label: String,
        kind: FamilyDiscountKind,
        valueNumeric: Double? = nil,
        appliesFromChild: Int? = nil,
        isActive: Bool,
        createdAt: String,
        updatedAt: String,
        deletedAt: String? = nil
    ) {
        self.id = id
        self.clubId = clubId
        self.label = label
        self.kind = kind
        self.valueNumeric = valueNumeric
        self.appliesFromChild = appliesFromChild
        self.isActive = isActive
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.deletedAt = deletedAt
    }
}

public struct FamilyDiscountCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var label: String
    public var kind: FamilyDiscountKind
    public var valueNumeric: Double
    public var appliesFromChild: Int?
    public var isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case label
        case kind
        case valueNumeric = "value_numeric"
        case appliesFromChild = "applies_from_child"
        case isActive = "is_active"
    }

    public init(
        clubId: String,
        label: String,
        kind: FamilyDiscountKind,
        valueNumeric: Double,
        appliesFromChild: Int? = 2,
        isActive: Bool? = true
    ) {
        self.clubId = clubId
        self.label = label
        self.kind = kind
        self.valueNumeric = valueNumeric
        self.appliesFromChild = appliesFromChild
        self.isActive = isActive
    }
}

public struct FamilyDiscountUpdate: Codable, Equatable, Sendable {
    public var label: String?
    public var kind: FamilyDiscountKind?
    public var valueNumeric: Double?
    public var appliesFromChild: Int?
    public var isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case label
        case kind
        case valueNumeric = "value_numeric"
        case appliesFromChild = "applies_from_child"
        case isActive = "is_active"
    }

    public init(
        label: String? = nil,
        kind: FamilyDiscountKind? = nil,
        valueNumeric: Double? = nil,
        appliesFromChild: Int? = nil,
        isActive: Bool? = nil
    ) {
        self.label = label
        self.kind = kind
        self.valueNumeric = valueNumeric
        self.appliesFromChild = appliesFromChild
        self.isActive = isActive
    }
}

public struct SepaMandateCreate: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var memberId: String
    public var mandateReference: String
    public var ibanLast4: String?
    public var accountHolder: String
    /// Format: date
    public var signedOn: String?
    public var status: SepaMandateStatus?

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case memberId = "member_id"
        case mandateReference = "mandate_reference"
        case ibanLast4 = "iban_last4"
        case accountHolder = "account_holder"
        case signedOn = "signed_on"
        case status
    }

    public init(
        clubId: String,
        memberId: String,
        mandateReference: String,
        ibanLast4: String? = nil,
        accountHolder: String,
        signedOn: String? = nil,
        status: SepaMandateStatus? = .active
    ) {
        self.clubId = clubId
        self.memberId = memberId
        self.mandateReference = mandateReference
        self.ibanLast4 = ibanLast4
        self.accountHolder = accountHolder
        self.signedOn = signedOn
        self.status = status
    }
}

public struct SepaMandateUpdate: Codable, Equatable, Sendable {
    public var mandateReference: String?
    public var ibanLast4: String?
    public var accountHolder: String?
    /// Format: date
    public var signedOn: String?
    public var status: SepaMandateStatus?

    enum CodingKeys: String, CodingKey {
        case mandateReference = "mandate_reference"
        case ibanLast4 = "iban_last4"
        case accountHolder = "account_holder"
        case signedOn = "signed_on"
        case status
    }

    public init(
        mandateReference: String? = nil,
        ibanLast4: String? = nil,
        accountHolder: String? = nil,
        signedOn: String? = nil,
        status: SepaMandateStatus? = nil
    ) {
        self.mandateReference = mandateReference
        self.ibanLast4 = ibanLast4
        self.accountHolder = accountHolder
        self.signedOn = signedOn
        self.status = status
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
    public var tier: String?
    public var status: String?

    enum CodingKeys: String, CodingKey {
        case id
        case subjectType = "subject_type"
        case subjectId = "subject_id"
        case entitlement
        case source
        case productId = "product_id"
        case validUntil = "valid_until"
        case tier
        case status
    }

    public init(
        id: String,
        subjectType: EntitlementSubjectType,
        subjectId: String,
        entitlement: String,
        source: EntitlementSource,
        productId: String? = nil,
        validUntil: String? = nil,
        tier: String? = nil,
        status: String? = nil
    ) {
        self.id = id
        self.subjectType = subjectType
        self.subjectId = subjectId
        self.entitlement = entitlement
        self.source = source
        self.productId = productId
        self.validUntil = validUntil
        self.tier = tier
        self.status = status
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

public struct DunningSkip: Codable, Equatable, Sendable {
    /// Format: uuid
    public var invoiceId: String
    public var reason: String

    enum CodingKeys: String, CodingKey {
        case invoiceId = "invoice_id"
        case reason
    }

    public init(
        invoiceId: String,
        reason: String
    ) {
        self.invoiceId = invoiceId
        self.reason = reason
    }
}

public struct DunningLogEntry: Codable, Equatable, Sendable {
    /// Format: uuid
    public var id: String
    /// Format: uuid
    public var clubId: String
    /// Format: uuid
    public var invoiceId: String
    public var fromStage: Int?
    public var toStage: Int?
    public var action: DunningLogAction
    /// Format: uuid
    public var actorMemberId: String?
    public var note: String?
    public var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case clubId = "club_id"
        case invoiceId = "invoice_id"
        case fromStage = "from_stage"
        case toStage = "to_stage"
        case action
        case actorMemberId = "actor_member_id"
        case note
        case createdAt = "created_at"
    }

    public init(
        id: String,
        clubId: String,
        invoiceId: String,
        fromStage: Int? = nil,
        toStage: Int? = nil,
        action: DunningLogAction,
        actorMemberId: String? = nil,
        note: String? = nil,
        createdAt: String
    ) {
        self.id = id
        self.clubId = clubId
        self.invoiceId = invoiceId
        self.fromStage = fromStage
        self.toStage = toStage
        self.action = action
        self.actorMemberId = actorMemberId
        self.note = note
        self.createdAt = createdAt
    }
}

public struct DunningApplyResult: Codable, Equatable, Sendable {
    /// Format: uuid
    public var clubId: String
    public var toStage: Int
    public var action: DunningLogAction
    public var applied: Int
    public var skipped: [DunningSkip]
    public var log: [DunningLogEntry]

    enum CodingKeys: String, CodingKey {
        case clubId = "club_id"
        case toStage = "to_stage"
        case action
        case applied
        case skipped
        case log
    }

    public init(
        clubId: String,
        toStage: Int,
        action: DunningLogAction,
        applied: Int,
        skipped: [DunningSkip],
        log: [DunningLogEntry]
    ) {
        self.clubId = clubId
        self.toStage = toStage
        self.action = action
        self.applied = applied
        self.skipped = skipped
        self.log = log
    }
}

public struct DunningApplyRequest: Codable, Equatable, Sendable {
    /// Format: [uuid]
    public var invoiceIds: [String]
    public var toStage: Int
    public var approveEscalation: Bool?
    public var note: String?

    enum CodingKeys: String, CodingKey {
        case invoiceIds = "invoice_ids"
        case toStage = "to_stage"
        case approveEscalation = "approve_escalation"
        case note
    }

    public init(
        invoiceIds: [String],
        toStage: Int,
        approveEscalation: Bool? = false,
        note: String? = nil
    ) {
        self.invoiceIds = invoiceIds
        self.toStage = toStage
        self.approveEscalation = approveEscalation
        self.note = note
    }
}
