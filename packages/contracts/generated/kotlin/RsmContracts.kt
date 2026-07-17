// GENERIERT — NICHT VON HAND AENDERN
//
// Generated from packages/contracts/openapi.json (RollsportManager v2 API v0.2.0).
// Regenerate with: npm run generate   (in packages/contracts)
// Source of truth is the API layer; the spec itself is produced by
// "npm run openapi" in services/api - never edit either by hand.

package de.rollsportmanager.contracts

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

// Timestamps and dates stay String on the wire (ISO 8601 / yyyy-MM-dd),
// UUIDs stay String - convert at the edge, never in the contract types.
// Integers map to Long on purpose (cents, milliseconds).

@Serializable
enum class ClubRole {
    @SerialName("owner") OWNER,
    @SerialName("admin") ADMIN,
    @SerialName("moderator") MODERATOR,
    @SerialName("treasurer") TREASURER,
    @SerialName("coach") COACH,
    @SerialName("member") MEMBER,
    @SerialName("guest_coach") GUEST_COACH;
}

@Serializable
enum class MemberStatus {
    @SerialName("pending") PENDING,
    @SerialName("rejected") REJECTED,
    @SerialName("active") ACTIVE,
    @SerialName("inactive") INACTIVE,
    @SerialName("left") LEFT;
}

@Serializable
enum class ProfileVisibility {
    @SerialName("public") PUBLIC,
    @SerialName("internal") INTERNAL;
}

@Serializable
enum class AssignableClubRole {
    @SerialName("admin") ADMIN,
    @SerialName("moderator") MODERATOR,
    @SerialName("treasurer") TREASURER,
    @SerialName("coach") COACH,
    @SerialName("member") MEMBER,
    @SerialName("guest_coach") GUEST_COACH;
}

@Serializable
enum class RoutineStatus {
    @SerialName("draft") DRAFT,
    @SerialName("ready") READY,
    @SerialName("competition") COMPETITION,
    @SerialName("archived") ARCHIVED;
}

@Serializable
enum class CompetitionEntryStatus {
    @SerialName("registered") REGISTERED,
    @SerialName("confirmed") CONFIRMED,
    @SerialName("withdrawn") WITHDRAWN;
}

@Serializable
enum class Medal {
    @SerialName("gold") GOLD,
    @SerialName("silver") SILVER,
    @SerialName("bronze") BRONZE;
}

@Serializable
enum class AttendanceStatus {
    @SerialName("present") PRESENT,
    @SerialName("late") LATE,
    @SerialName("excused") EXCUSED,
    @SerialName("absent") ABSENT;
}

@Serializable
enum class CheckinMethod {
    @SerialName("qr") QR,
    @SerialName("manual") MANUAL;
}

@Serializable
enum class DutyKind {
    @SerialName("training") TRAINING,
    @SerialName("helper") HELPER,
    @SerialName("competition") COMPETITION,
    @SerialName("other") OTHER;
}

@Serializable
enum class RsvpStatus {
    @SerialName("going") GOING,
    @SerialName("declined") DECLINED,
    @SerialName("maybe") MAYBE,
    @SerialName("sick") SICK;
}

@Serializable
enum class ReservationStatus {
    @SerialName("active") ACTIVE,
    @SerialName("returned") RETURNED,
    @SerialName("cancelled") CANCELLED;
}

@Serializable
enum class InvoiceStatus {
    @SerialName("draft") DRAFT,
    @SerialName("open") OPEN,
    @SerialName("paid") PAID,
    @SerialName("cancelled") CANCELLED;
}

@Serializable
enum class MembershipPeriod {
    @SerialName("monthly") MONTHLY,
    @SerialName("quarterly") QUARTERLY,
    @SerialName("yearly") YEARLY,
    @SerialName("once") ONCE;
}

@Serializable
enum class SepaMandateStatus {
    @SerialName("active") ACTIVE,
    @SerialName("revoked") REVOKED;
}

@Serializable
enum class GalleryKind {
    @SerialName("photo") PHOTO,
    @SerialName("video") VIDEO;
}

@Serializable
enum class ConsentPurpose {
    @SerialName("terms") TERMS,
    @SerialName("privacy") PRIVACY,
    @SerialName("photos_internal") PHOTOS_INTERNAL,
    @SerialName("photos_public") PHOTOS_PUBLIC,
    @SerialName("chat") CHAT,
    @SerialName("newsletter") NEWSLETTER;
}

@Serializable
enum class RealConsentPurpose {
    @SerialName("photos_internal") PHOTOS_INTERNAL,
    @SerialName("photos_public") PHOTOS_PUBLIC,
    @SerialName("chat") CHAT,
    @SerialName("newsletter") NEWSLETTER;
}

@Serializable
enum class WaitlistKind {
    @SerialName("facility") FACILITY,
    @SerialName("equipment") EQUIPMENT,
    @SerialName("team") TEAM,
    @SerialName("event") EVENT;
}

@Serializable
enum class WaitlistStatus {
    @SerialName("waiting") WAITING,
    @SerialName("offered") OFFERED,
    @SerialName("fulfilled") FULFILLED,
    @SerialName("cancelled") CANCELLED;
}

@Serializable
enum class LedgerCategoryKind {
    @SerialName("income") INCOME,
    @SerialName("expense") EXPENSE;
}

@Serializable
enum class ThemePreference {
    @SerialName("light") LIGHT,
    @SerialName("dark") DARK,
    @SerialName("auto") AUTO;
}

@Serializable
enum class CapabilityLevel {
    @SerialName("none") NONE,
    @SerialName("read_own") READ_OWN,
    @SerialName("read_team") READ_TEAM,
    @SerialName("read_all") READ_ALL,
    @SerialName("edit") EDIT,
    @SerialName("manage") MANAGE;
}

@Serializable
enum class CapabilityEnforcement {
    @SerialName("enforced") ENFORCED,
    @SerialName("partial") PARTIAL,
    @SerialName("write_only") WRITE_ONLY,
    @SerialName("unenforced") UNENFORCED;
}

@Serializable
enum class PlatformTier {
    @SerialName("basic") BASIC,
    @SerialName("pro") PRO,
    @SerialName("premium") PREMIUM;
}

@Serializable
enum class PlatformEntitlementStatus {
    @SerialName("trial") TRIAL,
    @SerialName("active") ACTIVE,
    @SerialName("past_due") PAST_DUE,
    @SerialName("canceled") CANCELED;
}

@Serializable
enum class EventType {
    @SerialName("training") TRAINING,
    @SerialName("competition") COMPETITION,
    @SerialName("other") OTHER;
}

@Serializable
enum class EventAudience {
    @SerialName("teams") TEAMS,
    @SerialName("club") CLUB;
}

@Serializable
enum class CompetitionStatus {
    @SerialName("upcoming") UPCOMING,
    @SerialName("running") RUNNING,
    @SerialName("done") DONE,
    @SerialName("cancelled") CANCELLED;
}

@Serializable
enum class SupportTicketStatus {
    @SerialName("open") OPEN,
    @SerialName("in_progress") IN_PROGRESS,
    @SerialName("waiting_on_club") WAITING_ON_CLUB,
    @SerialName("closed") CLOSED;
}

@Serializable
enum class SupportTicketPriority {
    @SerialName("low") LOW,
    @SerialName("normal") NORMAL,
    @SerialName("high") HIGH,
    @SerialName("urgent") URGENT;
}

@Serializable
enum class SupportActor {
    @SerialName("club") CLUB,
    @SerialName("platform") PLATFORM;
}

@Serializable
enum class ExerciseCategory {
    @SerialName("warmup") WARMUP,
    @SerialName("stretching") STRETCHING,
    @SerialName("strength") STRENGTH,
    @SerialName("jump") JUMP,
    @SerialName("spin") SPIN,
    @SerialName("steps") STEPS,
    @SerialName("combination") COMBINATION;
}

@Serializable
enum class FacilityKind {
    @SerialName("hall") HALL,
    @SerialName("room") ROOM,
    @SerialName("outdoor") OUTDOOR,
    @SerialName("other") OTHER;
}

@Serializable
enum class BookingStatus {
    @SerialName("confirmed") CONFIRMED,
    @SerialName("pending") PENDING,
    @SerialName("cancelled") CANCELLED;
}

@Serializable
enum class EquipmentCondition {
    @SerialName("good") GOOD,
    @SerialName("fair") FAIR,
    @SerialName("defect") DEFECT;
}

@Serializable
enum class ChatChannelType {
    @SerialName("team") TEAM,
    @SerialName("direct") DIRECT;
}

@Serializable
enum class AnniversaryKind {
    @SerialName("membership") MEMBERSHIP,
    @SerialName("birthday") BIRTHDAY;
}

@Serializable
enum class LockerStatus {
    @SerialName("free") FREE,
    @SerialName("assigned") ASSIGNED,
    @SerialName("broken") BROKEN;
}

@Serializable
enum class CounterpartyKind {
    @SerialName("person") PERSON,
    @SerialName("org") ORG;
}

@Serializable
enum class BankTransactionStatus {
    @SerialName("unmatched") UNMATCHED,
    @SerialName("matched") MATCHED,
    @SerialName("ignored") IGNORED;
}

@Serializable
enum class FamilyDiscountKind {
    @SerialName("percent") PERCENT,
    @SerialName("fixed") FIXED;
}

@Serializable
enum class DunningLogAction {
    @SerialName("reminder") REMINDER,
    @SerialName("dunning") DUNNING,
    @SerialName("handover") HANDOVER;
}

/** Inline enum of Health.status (hoisted by codegen). */
@Serializable
enum class HealthStatus {
    @SerialName("ok") OK;
}

/** Inline enum of InviteQueued.status (hoisted by codegen). */
@Serializable
enum class InviteQueuedStatus {
    @SerialName("queued") QUEUED;
}

/** Inline enum of EffectiveConsent.state (hoisted by codegen). */
@Serializable
enum class EffectiveConsentState {
    @SerialName("valid") VALID,
    @SerialName("revoked") REVOKED,
    @SerialName("expired_age_16") EXPIRED_AGE_16;
}

/** Inline enum of ChildCreate.relation (hoisted by codegen). */
@Serializable
enum class ChildCreateRelation {
    @SerialName("parent") PARENT,
    @SerialName("guardian") GUARDIAN,
    @SerialName("other") OTHER;
}

/** Inline enum of GuardianshipCreate.relation (hoisted by codegen). */
@Serializable
enum class GuardianshipCreateRelation {
    @SerialName("parent") PARENT,
    @SerialName("guardian") GUARDIAN,
    @SerialName("other") OTHER;
}

/** Inline enum of Deleted.status (hoisted by codegen). */
@Serializable
enum class DeletedStatus {
    @SerialName("deleted") DELETED;
}

/** Inline enum of ClubModuleState.enforcement (hoisted by codegen). */
@Serializable
enum class ClubModuleStateEnforcement {
    @SerialName("enforced") ENFORCED,
    @SerialName("partial") PARTIAL,
    @SerialName("menu_only") MENU_ONLY;
}

/** Inline enum of SmtpTestResponse.mode (hoisted by codegen). */
@Serializable
enum class SmtpTestResponseMode {
    @SerialName("sent") SENT,
    @SerialName("dry-run") DRY_RUN,
    @SerialName("error") ERROR;
}

/** Inline enum of PlatformEntitlementRow.source (hoisted by codegen). */
@Serializable
enum class PlatformEntitlementRowSource {
    @SerialName("stripe") STRIPE,
    @SerialName("revenuecat") REVENUECAT,
    @SerialName("manual") MANUAL;
}

/** Inline enum of PlatformProduct.kind (hoisted by codegen). */
@Serializable
enum class PlatformProductKind {
    @SerialName("club_license") CLUB_LICENSE,
    @SerialName("personal_pro") PERSONAL_PRO;
}

/** Inline enum of PlatformProduct.billing_interval (hoisted by codegen). */
@Serializable
enum class PlatformProductBillingInterval {
    @SerialName("month") MONTH,
    @SerialName("year") YEAR;
}

/** Inline enum of PlatformRoutineRow.status (hoisted by codegen). */
@Serializable
enum class PlatformRoutineRowStatus {
    @SerialName("draft") DRAFT,
    @SerialName("ready") READY,
    @SerialName("competition") COMPETITION,
    @SerialName("archived") ARCHIVED;
}

/** Inline enum of PlatformSystemHealth.status (hoisted by codegen). */
@Serializable
enum class PlatformSystemHealthStatus {
    @SerialName("ok") OK;
}

/** Inline enum of PlatformSystem.auth_mode (hoisted by codegen). */
@Serializable
enum class PlatformSystemAuthMode {
    @SerialName("dev") DEV,
    @SerialName("prod") PROD;
}

/** Inline enum of InvoiceUpdate.status (hoisted by codegen). */
@Serializable
enum class InvoiceUpdateStatus {
    @SerialName("paid") PAID,
    @SerialName("cancelled") CANCELLED;
}

/** Inline enum of Entitlement.subject_type (hoisted by codegen). */
@Serializable
enum class EntitlementSubjectType {
    @SerialName("club") CLUB,
    @SerialName("profile") PROFILE;
}

/** Inline enum of Entitlement.source (hoisted by codegen). */
@Serializable
enum class EntitlementSource {
    @SerialName("stripe") STRIPE,
    @SerialName("revenuecat") REVENUECAT,
    @SerialName("manual") MANUAL;
}

/** Inline enum of Product.kind (hoisted by codegen). */
@Serializable
enum class ProductKind {
    @SerialName("club_license") CLUB_LICENSE,
    @SerialName("personal_pro") PERSONAL_PRO;
}

/** Inline enum of Product.billing_interval (hoisted by codegen). */
@Serializable
enum class ProductBillingInterval {
    @SerialName("month") MONTH,
    @SerialName("year") YEAR;
}

/** Inline enum of DunningAction.action (hoisted by codegen). */
@Serializable
enum class DunningActionAction {
    @SerialName("auto") AUTO,
    @SerialName("pending_approval") PENDING_APPROVAL,
    @SerialName("none") NONE;
}

/** Inline object of SmtpTestResponse.preview (hoisted by codegen). */
@Serializable
data class SmtpTestResponsePreview(
    val subject: String,
    val text: String
)

/** Inline object of PublicRoutine.markers (hoisted by codegen). */
@Serializable
data class PublicRoutineMarkers(
    @SerialName("time_ms") val timeMs: Long?,
    val label: String,
    @SerialName("element_code") val elementCode: String?
)

/** Inline object of PublicRoutine.scores (hoisted by codegen). */
@Serializable
data class PublicRoutineScores(
    @SerialName("scored_on") val scoredOn: String,
    @SerialName("technical_score") val technicalScore: Double?,
    @SerialName("components_score") val componentsScore: Double?,
    @SerialName("total_score") val totalScore: Double?,
    val placement: Long?
)

/** Inline object of DunningRunResult.summary (hoisted by codegen). */
@Serializable
data class DunningRunResultSummary(
    val auto: Long,
    @SerialName("pending_approval") val pendingApproval: Long,
    val none: Long
)

@Serializable
data class Health(
    val status: HealthStatus,
    val service: String,
    val time: String
)

@Serializable
data class Club(
    val id: String,
    val name: String,
    @SerialName("short_name") val shortName: String?,
    val city: String?,
    val discipline: String?,
    @SerialName("founded_year") val foundedYear: Long?,
    val settings: JsonObject,
    @SerialName("logo_asset_id") val logoAssetId: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class Problem(
    val type: String,
    val title: String,
    val status: Long,
    val detail: String? = null,
    val instance: String? = null,
    @SerialName("request_id") val requestId: String? = null
)

@Serializable
data class ClubJoinCode(
    @SerialName("club_id") val clubId: String,
    @SerialName("join_code") val joinCode: String?,
    @SerialName("join_code_expires_at") val joinCodeExpiresAt: String?,
    @SerialName("join_code_revoked_at") val joinCodeRevokedAt: String?
)

@Serializable
data class ClubUpdate(
    val name: String? = null,
    @SerialName("short_name") val shortName: String? = null,
    val city: String? = null,
    val discipline: String? = null,
    val settings: JsonObject? = null
)

@Serializable
data class ClubMember(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("profile_id") val profileId: String?,
    @SerialName("first_name") val firstName: String,
    @SerialName("last_name") val lastName: String,
    val email: String?,
    @SerialName("birth_date") val birthDate: String?,
    val phone: String?,
    @SerialName("postal_address") val postalAddress: String?,
    val role: ClubRole,
    val status: MemberStatus,
    @SerialName("joined_on") val joinedOn: String?,
    @SerialName("valid_until") val validUntil: String?,
    @SerialName("avatar_url") val avatarUrl: String?,
    @SerialName("team_ids") val teamIds: List<String>,
    @SerialName("profile_motto") val profileMotto: String?,
    @SerialName("profile_favorite_discipline") val profileFavoriteDiscipline: String?,
    @SerialName("profile_skating_since") val profileSkatingSince: Long?,
    @SerialName("profile_visibility") val profileVisibility: ProfileVisibility? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class ClubRegistrationResult(
    val club: Club,
    val member: ClubMember,
    @SerialName("join_code") val joinCode: String,
    @SerialName("trial_ends_at") val trialEndsAt: String
)

@Serializable
data class ClubRegistration(
    val name: String,
    val city: String,
    @SerialName("short_name") val shortName: String? = null,
    val discipline: String? = null,
    @SerialName("accept_terms") val acceptTerms: Boolean,
    @SerialName("accept_privacy") val acceptPrivacy: Boolean
)

@Serializable
data class ClubJoinResult(
    @SerialName("club_id") val clubId: String,
    @SerialName("club_name") val clubName: String,
    @SerialName("member_id") val memberId: String,
    val status: MemberStatus
)

@Serializable
data class ClubJoinInput(
    val code: String,
    @SerialName("first_name") val firstName: String,
    @SerialName("last_name") val lastName: String,
    @SerialName("accept_terms") val acceptTerms: Boolean,
    @SerialName("accept_privacy") val acceptPrivacy: Boolean
)

@Serializable
data class ClubJoinCodeRotated(
    @SerialName("club_id") val clubId: String,
    @SerialName("join_code") val joinCode: String,
    @SerialName("join_code_expires_at") val joinCodeExpiresAt: String?,
    @SerialName("previous_code_valid_until") val previousCodeValidUntil: String?
)

@Serializable
data class ClubJoinCodeRotateInput(
    @SerialName("expires_in_days") val expiresInDays: Long? = null,
    @SerialName("overlap_hours") val overlapHours: Long? = null
)

@Serializable
data class ClubJoinCodeRevoked(
    @SerialName("club_id") val clubId: String,
    @SerialName("join_code_revoked_at") val joinCodeRevokedAt: String
)

@Serializable
data class ClubMemberCreate(
    @SerialName("first_name") val firstName: String,
    @SerialName("last_name") val lastName: String,
    val email: String? = null,
    @SerialName("birth_date") val birthDate: String? = null,
    val role: AssignableClubRole? = null,
    @SerialName("joined_on") val joinedOn: String? = null,
    @SerialName("valid_until") val validUntil: String? = null
)

@Serializable
data class InviteQueued(
    val status: InviteQueuedStatus,
    val email: String
)

@Serializable
data class ClubMemberInvite(
    val email: String,
    val role: AssignableClubRole? = null
)

@Serializable
data class Guardianship(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("guardian_member_id") val guardianMemberId: String,
    @SerialName("child_member_id") val childMemberId: String,
    val relation: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class ClubMemberUpdate(
    @SerialName("first_name") val firstName: String? = null,
    @SerialName("last_name") val lastName: String? = null,
    val email: String? = null,
    @SerialName("birth_date") val birthDate: String? = null,
    val phone: String? = null,
    @SerialName("postal_address") val postalAddress: String? = null,
    val status: MemberStatus? = null,
    @SerialName("valid_until") val validUntil: String? = null
)

@Serializable
data class ClubMemberRoleChange(
    val role: AssignableClubRole
)

@Serializable
data class ClubMemberSelfProfileUpdate(
    val motto: String? = null,
    @SerialName("favorite_discipline") val favoriteDiscipline: String? = null,
    @SerialName("skating_since") val skatingSince: Long? = null,
    val visibility: ProfileVisibility? = null
)

@Serializable
data class MemberRoleRef(
    @SerialName("role_id") val roleId: String,
    val key: String,
    @SerialName("name_de") val nameDe: String,
    @SerialName("name_en") val nameEn: String
)

@Serializable
data class MemberDepartmentRef(
    val id: String,
    val name: String,
    @SerialName("is_lead") val isLead: Boolean
)

@Serializable
data class Routine(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("team_id") val teamId: String?,
    val title: String,
    val status: RoutineStatus,
    val category: String?,
    @SerialName("music_title") val musicTitle: String?,
    @SerialName("music_artist") val musicArtist: String?,
    @SerialName("music_bpm") val musicBpm: Long?,
    @SerialName("music_duration_ms") val musicDurationMs: Long?,
    @SerialName("audio_asset_id") val audioAssetId: String?,
    @SerialName("image_asset_id") val imageAssetId: String?,
    @SerialName("audio_url") val audioUrl: String?,
    @SerialName("image_url") val imageUrl: String?,
    @SerialName("skater_member_ids") val skaterMemberIds: List<String>,
    @SerialName("waveform_peaks") val waveformPeaks: List<Double>?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class CompetitionEntry(
    val id: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("routine_id") val routineId: String?,
    val status: CompetitionEntryStatus
)

@Serializable
data class RoutineScore(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("routine_id") val routineId: String,
    @SerialName("competition_id") val competitionId: String?,
    @SerialName("scored_on") val scoredOn: String,
    @SerialName("scoring_system") val scoringSystem: String,
    @SerialName("technical_score") val technicalScore: Double?,
    @SerialName("components_score") val componentsScore: Double?,
    @SerialName("total_score") val totalScore: Double?,
    val placement: Long?,
    val note: String?
)

@Serializable
data class MemberProfileCompetition(
    val entries: List<CompetitionEntry>,
    val scores: List<RoutineScore>
)

@Serializable
data class Achievement(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    val title: String,
    @SerialName("competition_name") val competitionName: String?,
    val placement: Long?,
    val medal: Medal,
    @SerialName("achieved_on") val achievedOn: String,
    val note: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class Attendance(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("event_id") val eventId: String,
    @SerialName("member_id") val memberId: String,
    val status: AttendanceStatus,
    @SerialName("checked_in_at") val checkedInAt: String?
)

@Serializable
data class Checkin(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("event_id") val eventId: String?,
    val method: CheckinMethod,
    @SerialName("checked_in_at") val checkedInAt: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class DutyRequirement(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("team_id") val teamId: String?,
    @SerialName("member_id") val memberId: String?,
    @SerialName("season_label") val seasonLabel: String,
    @SerialName("required_hours") val requiredHours: Double?,
    @SerialName("period_start") val periodStart: String,
    @SerialName("period_end") val periodEnd: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class DutyEntry(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    val hours: Double?,
    @SerialName("activity_date") val activityDate: String,
    val kind: DutyKind,
    val note: String?,
    val approved: Boolean,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class MemberProfileDuty(
    val requirements: List<DutyRequirement>,
    val entries: List<DutyEntry>
)

@Serializable
data class EventRsvp(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("event_id") val eventId: String,
    @SerialName("member_id") val memberId: String,
    val status: RsvpStatus,
    val comment: String?,
    @SerialName("responded_at") val respondedAt: String
)

@Serializable
data class EquipmentReservation(
    val id: String,
    @SerialName("equipment_id") val equipmentId: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("reserved_by_member_id") val reservedByMemberId: String,
    val quantity: Long?,
    @SerialName("from_at") val fromAt: String,
    @SerialName("to_at") val toAt: String,
    val status: ReservationStatus,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class Invoice(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    val number: String,
    val title: String,
    @SerialName("amount_cents") val amountCents: Long?,
    val currency: String,
    val status: InvoiceStatus,
    @SerialName("dunning_level") val dunningLevel: Long,
    @SerialName("issued_on") val issuedOn: String?,
    @SerialName("due_on") val dueOn: String?,
    @SerialName("paid_at") val paidAt: String?,
    @SerialName("paid_via") val paidVia: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class MemberFee(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("category_id") val categoryId: String,
    @SerialName("custom_amount_cents") val customAmountCents: Long?,
    @SerialName("valid_from") val validFrom: String,
    @SerialName("valid_until") val validUntil: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("deleted_at") val deletedAt: String?,
    @SerialName("category_name") val categoryName: String? = null,
    @SerialName("category_amount_cents") val categoryAmountCents: Long? = null,
    @SerialName("category_period") val categoryPeriod: MembershipPeriod? = null
)

@Serializable
data class SepaMandate(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("mandate_reference") val mandateReference: String,
    @SerialName("iban_last4") val ibanLast4: String?,
    @SerialName("account_holder") val accountHolder: String,
    @SerialName("signed_on") val signedOn: String?,
    val status: SepaMandateStatus,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("deleted_at") val deletedAt: String?
)

@Serializable
data class Donation(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String?,
    @SerialName("donor_name") val donorName: String,
    @SerialName("donor_address") val donorAddress: String?,
    @SerialName("amount_cents") val amountCents: Long?,
    @SerialName("donation_date") val donationDate: String,
    @SerialName("receipt_number") val receiptNumber: String,
    val purpose: String?,
    @SerialName("issued_at") val issuedAt: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("deleted_at") val deletedAt: String?
)

@Serializable
data class MemberProfileFinance(
    val invoices: List<Invoice>,
    @SerialName("member_fees") val memberFees: List<MemberFee>,
    @SerialName("sepa_mandates") val sepaMandates: List<SepaMandate>,
    val donations: List<Donation>
)

@Serializable
data class MemberAssessment(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("author_member_id") val authorMemberId: String,
    val body: String,
    @SerialName("rating_technik") val ratingTechnik: Long?,
    @SerialName("rating_ausdruck") val ratingAusdruck: Long?,
    @SerialName("assessed_on") val assessedOn: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class MemberPhoto(
    @SerialName("tag_id") val tagId: String,
    @SerialName("gallery_item_id") val galleryItemId: String,
    @SerialName("member_id") val memberId: String,
    val album: String?,
    val title: String,
    val kind: GalleryKind,
    @SerialName("storage_key") val storageKey: String,
    @SerialName("content_type") val contentType: String,
    @SerialName("thumbnail_key") val thumbnailKey: String?,
    @SerialName("tagged_at") val taggedAt: String
)

@Serializable
data class EffectiveConsent(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String?,
    @SerialName("subject_profile_id") val subjectProfileId: String?,
    val purpose: ConsentPurpose,
    @SerialName("granted_by_profile_id") val grantedByProfileId: String,
    @SerialName("legal_document_id") val legalDocumentId: String?,
    @SerialName("policy_version") val policyVersion: String?,
    @SerialName("recorded_at") val recordedAt: String,
    val effective: Boolean,
    @SerialName("recorded_granted") val recordedGranted: Boolean,
    @SerialName("granted_by_guardian") val grantedByGuardian: Boolean,
    val state: EffectiveConsentState
)

@Serializable
data class MemberProfile(
    val member: ClubMember,
    @SerialName("contact_visible") val contactVisible: Boolean,
    @SerialName("admin_contact_visible") val adminContactVisible: Boolean,
    @SerialName("self_profile_visible") val selfProfileVisible: Boolean,
    @SerialName("joined_on_visible") val joinedOnVisible: Boolean,
    val roles: List<MemberRoleRef>,
    val departments: List<MemberDepartmentRef>,
    val routines: List<Routine>?,
    val competition: MemberProfileCompetition? = null,
    val achievements: List<Achievement>?,
    val attendance: List<Attendance>?,
    val checkins: List<Checkin>?,
    val duty: MemberProfileDuty? = null,
    val rsvps: List<EventRsvp>?,
    val equipment: List<EquipmentReservation>?,
    val finance: MemberProfileFinance? = null,
    val assessments: List<MemberAssessment>?,
    val photos: List<MemberPhoto>?,
    val consents: List<EffectiveConsent>?
)

@Serializable
data class ChildCreated(
    val child: ClubMember,
    val guardianship: Guardianship
)

@Serializable
data class ChildCreate(
    @SerialName("first_name") val firstName: String,
    @SerialName("last_name") val lastName: String,
    @SerialName("birth_date") val birthDate: String? = null,
    @SerialName("joined_on") val joinedOn: String? = null,
    @SerialName("guardian_member_id") val guardianMemberId: String? = null,
    val relation: ChildCreateRelation? = ChildCreateRelation.PARENT
)

@Serializable
data class GuardianshipCreate(
    @SerialName("child_member_id") val childMemberId: String,
    @SerialName("guardian_member_id") val guardianMemberId: String? = null,
    val relation: GuardianshipCreateRelation? = GuardianshipCreateRelation.PARENT
)

@Serializable
data class Deleted(
    val status: DeletedStatus,
    val id: String
)

@Serializable
data class ConsentDeclare(
    @SerialName("member_id") val memberId: String,
    val purpose: RealConsentPurpose,
    val granted: Boolean,
    @SerialName("policy_version") val policyVersion: String? = null
)

@Serializable
data class Waitlist(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    val kind: WaitlistKind,
    @SerialName("target_id") val targetId: String?,
    val note: String?,
    val status: WaitlistStatus,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class WaitlistCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    val kind: WaitlistKind,
    @SerialName("target_id") val targetId: String? = null,
    val note: String? = null
)

@Serializable
data class WaitlistUpdate(
    val status: WaitlistStatus? = null,
    val note: String? = null
)

@Serializable
data class Budget(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val year: Long?,
    @SerialName("category_id") val categoryId: String,
    @SerialName("planned_cents") val plannedCents: Long?,
    val note: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class BudgetCreate(
    @SerialName("club_id") val clubId: String,
    val year: Long,
    @SerialName("category_id") val categoryId: String,
    @SerialName("planned_cents") val plannedCents: Long?,
    val note: String? = null
)

@Serializable
data class BudgetUpdate(
    @SerialName("planned_cents") val plannedCents: Long? = null,
    val note: String? = null
)

@Serializable
data class BudgetReportRow(
    @SerialName("category_id") val categoryId: String,
    @SerialName("category_name") val categoryName: String?,
    val kind: LedgerCategoryKind,
    @SerialName("planned_cents") val plannedCents: Long?,
    @SerialName("actual_cents") val actualCents: Long?,
    @SerialName("variance_cents") val varianceCents: Long?
)

@Serializable
data class BudgetReport(
    @SerialName("club_id") val clubId: String,
    val year: Long?,
    val rows: List<BudgetReportRow>,
    @SerialName("planned_total_cents") val plannedTotalCents: Long?,
    @SerialName("actual_total_cents") val actualTotalCents: Long?,
    @SerialName("variance_total_cents") val varianceTotalCents: Long?
)

@Serializable
data class MeMembership(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("club_name") val clubName: String,
    @SerialName("club_short_name") val clubShortName: String?,
    @SerialName("first_name") val firstName: String,
    @SerialName("last_name") val lastName: String,
    val email: String?,
    @SerialName("birth_date") val birthDate: String?,
    val phone: String?,
    @SerialName("postal_address") val postalAddress: String?,
    val role: ClubRole,
    val status: MemberStatus,
    @SerialName("joined_on") val joinedOn: String?,
    @SerialName("valid_until") val validUntil: String?,
    @SerialName("avatar_url") val avatarUrl: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class Me(
    @SerialName("profile_id") val profileId: String,
    @SerialName("display_name") val displayName: String?,
    val locale: String,
    val memberships: List<MeMembership>
)

@Serializable
data class MeUpdate(
    @SerialName("first_name") val firstName: String? = null,
    @SerialName("last_name") val lastName: String? = null,
    val email: String? = null,
    @SerialName("birth_date") val birthDate: String? = null,
    val phone: String? = null,
    @SerialName("postal_address") val postalAddress: String? = null
)

@Serializable
data class NotificationPrefs(
    val events: Boolean? = null,
    val invoices: Boolean? = null,
    val news: Boolean? = null,
    val chat: Boolean? = null
)

@Serializable
data class UserPreferences(
    @SerialName("profile_id") val profileId: String,
    val locale: String,
    val theme: ThemePreference,
    val notifications: NotificationPrefs,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class UserPreferencesUpdate(
    val locale: String? = null,
    val theme: ThemePreference? = null,
    val notifications: NotificationPrefs? = null
)

@Serializable
data class ResolvedCapability(
    @SerialName("capability_key") val capabilityKey: String,
    @SerialName("label_de") val labelDe: String,
    @SerialName("label_en") val labelEn: String,
    @SerialName("allowed_levels") val allowedLevels: List<CapabilityLevel>,
    val sort: Long,
    val rank: Long,
    val level: CapabilityLevel,
    @SerialName("owner_only") val ownerOnly: Boolean,
    val enforcement: CapabilityEnforcement
)

@Serializable
data class CapabilityResolution(
    @SerialName("club_id") val clubId: String,
    @SerialName("role_keys") val roleKeys: List<String>,
    @SerialName("is_platform_admin") val isPlatformAdmin: Boolean,
    val capabilities: List<ResolvedCapability>
)

@Serializable
data class Capability(
    val key: String,
    @SerialName("label_de") val labelDe: String,
    @SerialName("label_en") val labelEn: String,
    @SerialName("allowed_levels") val allowedLevels: List<CapabilityLevel>,
    val sort: Long,
    @SerialName("owner_only") val ownerOnly: Boolean,
    val enforcement: CapabilityEnforcement
)

@Serializable
data class MemberRoleAssignment(
    @SerialName("member_id") val memberId: String,
    @SerialName("role_ids") val roleIds: List<String>
)

@Serializable
data class ClubRoleDef(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val key: String,
    @SerialName("name_de") val nameDe: String,
    @SerialName("name_en") val nameEn: String,
    @SerialName("is_system") val isSystem: Boolean,
    val protected: Boolean,
    val sort: Long,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class RolePermission(
    @SerialName("capability_key") val capabilityKey: String,
    val level: CapabilityLevel
)

@Serializable
data class ClubRoleDefCreate(
    val key: String,
    @SerialName("name_de") val nameDe: String,
    @SerialName("name_en") val nameEn: String,
    val sort: Long? = null
)

@Serializable
data class ClubRoleDefUpdate(
    @SerialName("name_de") val nameDe: String? = null,
    @SerialName("name_en") val nameEn: String? = null,
    val sort: Long? = null
)

@Serializable
data class RolePermissionSet(
    val permissions: List<RolePermission>
)

@Serializable
data class MemberRolesSet(
    @SerialName("role_ids") val roleIds: List<String>
)

@Serializable
data class TeamCoachesSet(
    @SerialName("member_ids") val memberIds: List<String>
)

@Serializable
data class ClubModuleState(
    @SerialName("module_key") val moduleKey: String,
    @SerialName("label_de") val labelDe: String,
    @SerialName("label_en") val labelEn: String,
    @SerialName("desc_de") val descDe: String,
    @SerialName("desc_en") val descEn: String,
    val sort: Long,
    val core: Boolean,
    @SerialName("requires_pro") val requiresPro: Boolean,
    val enforcement: ClubModuleStateEnforcement?,
    val enabled: Boolean,
    @SerialName("pro_ok") val proOk: Boolean,
    val available: Boolean
)

@Serializable
data class ClubModuleSet(
    val enabled: Boolean
)

@Serializable
data class Team(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val name: String,
    @SerialName("age_group") val ageGroup: String?,
    @SerialName("skater_member_ids") val skaterMemberIds: List<String>,
    @SerialName("coach_member_ids") val coachMemberIds: List<String>,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class TeamCreate(
    val name: String,
    @SerialName("age_group") val ageGroup: String? = null
)

@Serializable
data class TeamUpdate(
    val name: String? = null,
    @SerialName("age_group") val ageGroup: String? = null
)

@Serializable
data class TeamMembersSet(
    @SerialName("skater_member_ids") val skaterMemberIds: List<String>? = emptyList(),
    @SerialName("coach_member_ids") val coachMemberIds: List<String>? = emptyList()
)

@Serializable
data class PlatformClub(
    val id: String,
    val name: String,
    @SerialName("short_name") val shortName: String?,
    val city: String?,
    val discipline: String?,
    @SerialName("member_count") val memberCount: Long?,
    @SerialName("logo_asset_id") val logoAssetId: String?,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class PlatformUser(
    val id: String,
    @SerialName("display_name") val displayName: String?,
    val locale: String,
    @SerialName("club_count") val clubCount: Long?,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class PlatformStats(
    val clubs: Long?,
    val users: Long?,
    val members: Long?,
    @SerialName("active_members") val activeMembers: Long?,
    val teams: Long?,
    val events: Long?,
    @SerialName("open_invoices") val openInvoices: Long?
)

@Serializable
data class PlatformSmtp(
    val host: String,
    val port: Long?,
    val user: String,
    val from: String,
    val secure: Boolean,
    @SerialName("password_set") val passwordSet: Boolean
)

@Serializable
data class PlatformLegal(
    val impressum: String,
    val datenschutz: String,
    val agb: String
)

@Serializable
data class PlatformContent(
    @SerialName("website_title") val websiteTitle: String,
    @SerialName("website_subtitle") val websiteSubtitle: String,
    @SerialName("seo_title") val seoTitle: String,
    @SerialName("seo_description") val seoDescription: String,
    @SerialName("seo_keywords") val seoKeywords: String
)

@Serializable
data class PlatformSettings(
    val smtp: PlatformSmtp,
    val legal: PlatformLegal,
    val content: PlatformContent,
    @SerialName("feature_flags") val featureFlags: JsonObject,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class PlatformSmtpPatch(
    val host: String? = null,
    val port: Long? = null,
    val user: String? = null,
    val from: String? = null,
    val secure: Boolean? = null,
    val password: String? = null
)

@Serializable
data class PlatformLegalPatch(
    val impressum: String? = null,
    val datenschutz: String? = null,
    val agb: String? = null
)

@Serializable
data class PlatformContentPatch(
    @SerialName("website_title") val websiteTitle: String? = null,
    @SerialName("website_subtitle") val websiteSubtitle: String? = null,
    @SerialName("seo_title") val seoTitle: String? = null,
    @SerialName("seo_description") val seoDescription: String? = null,
    @SerialName("seo_keywords") val seoKeywords: String? = null
)

@Serializable
data class PlatformSettingsPatch(
    val smtp: PlatformSmtpPatch? = null,
    val legal: PlatformLegalPatch? = null,
    val content: PlatformContentPatch? = null,
    @SerialName("feature_flags") val featureFlags: JsonObject? = null
)

@Serializable
data class SmtpTestResponse(
    val ok: Boolean,
    val mode: SmtpTestResponseMode,
    val detail: String,
    @SerialName("message_id") val messageId: String? = null,
    val preview: SmtpTestResponsePreview? = null
)

@Serializable
data class SmtpTestRequest(
    val recipient: String,
    @SerialName("dry_run") val dryRun: Boolean? = null
)

@Serializable
data class PlatformEntitlementRow(
    @SerialName("club_id") val clubId: String,
    @SerialName("club_name") val clubName: String,
    @SerialName("short_name") val shortName: String?,
    @SerialName("member_count") val memberCount: Long?,
    @SerialName("entitlement_id") val entitlementId: String?,
    val tier: String?,
    val status: String?,
    val source: PlatformEntitlementRowSource?,
    @SerialName("provider_ref") val providerRef: String?,
    @SerialName("valid_until") val validUntil: String?,
    @SerialName("updated_at") val updatedAt: String?
)

@Serializable
data class PlatformEntitlementPatch(
    val tier: PlatformTier,
    val status: PlatformEntitlementStatus,
    @SerialName("valid_until") val validUntil: String? = null,
    @SerialName("trial_days") val trialDays: Long? = null,
    val reason: String? = null
)

@Serializable
data class PlatformPaymentEvent(
    val id: String,
    val provider: String,
    @SerialName("event_id") val eventId: String,
    @SerialName("event_type") val eventType: String?,
    val status: String,
    val error: String?,
    @SerialName("received_at") val receivedAt: String,
    @SerialName("processed_at") val processedAt: String?
)

@Serializable
data class PlatformSubscriptionSummary(
    val active: Long?,
    val trial: Long?,
    @SerialName("past_due") val pastDue: Long?,
    val canceled: Long?,
    @SerialName("licensed_clubs") val licensedClubs: Long?
)

@Serializable
data class PlatformPaymentsPage(
    val total: Long?,
    val limit: Long?,
    val offset: Long?
)

@Serializable
data class PlatformPayments(
    val events: List<PlatformPaymentEvent>,
    @SerialName("subscription_summary") val subscriptionSummary: PlatformSubscriptionSummary,
    val page: PlatformPaymentsPage
)

@Serializable
data class PlatformProduct(
    val id: String,
    val code: String,
    val kind: PlatformProductKind,
    val name: String,
    val description: String?,
    @SerialName("price_cents") val priceCents: Long?,
    val currency: String,
    @SerialName("billing_interval") val billingInterval: PlatformProductBillingInterval,
    @SerialName("max_members") val maxMembers: Long?,
    val active: Boolean,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class PlatformProductPatch(
    @SerialName("price_cents") val priceCents: Long? = null,
    val active: Boolean? = null,
    val name: String? = null,
    val description: String? = null
)

@Serializable
data class PlatformRoutineRow(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("club_name") val clubName: String,
    val title: String,
    val status: PlatformRoutineRowStatus,
    val category: String?,
    @SerialName("music_title") val musicTitle: String?,
    @SerialName("music_artist") val musicArtist: String?,
    @SerialName("music_duration_ms") val musicDurationMs: Long?,
    @SerialName("audio_asset_id") val audioAssetId: String?,
    @SerialName("audio_mime_type") val audioMimeType: String?,
    @SerialName("audio_size_bytes") val audioSizeBytes: Long?,
    @SerialName("skater_count") val skaterCount: Long?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class PlatformSystemDb(
    val clubs: Long?,
    val users: Long?,
    val members: Long?,
    @SerialName("active_entitlements") val activeEntitlements: Long?,
    @SerialName("webhook_events") val webhookEvents: Long?,
    @SerialName("size_bytes") val sizeBytes: Long?,
    @SerialName("size_pretty") val sizePretty: String
)

@Serializable
data class PlatformSystemMigrations(
    val count: Long?,
    val latest: String?,
    val list: List<String>
)

@Serializable
data class PlatformSystemHealth(
    val status: PlatformSystemHealthStatus,
    @SerialName("db_time") val dbTime: String
)

@Serializable
data class PlatformSystem(
    @SerialName("app_version") val appVersion: String,
    @SerialName("auth_mode") val authMode: PlatformSystemAuthMode,
    val db: PlatformSystemDb,
    val migrations: PlatformSystemMigrations,
    val health: PlatformSystemHealth
)

@Serializable
data class Event(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val type: EventType,
    val title: String,
    val note: String?,
    val location: String?,
    @SerialName("starts_at") val startsAt: String,
    @SerialName("ends_at") val endsAt: String,
    @SerialName("competition_id") val competitionId: String?,
    val audience: EventAudience,
    @SerialName("team_ids") val teamIds: List<String>,
    val rsvps: List<EventRsvp>,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class EventCreate(
    @SerialName("club_id") val clubId: String,
    val type: EventType? = EventType.TRAINING,
    val title: String,
    val note: String? = null,
    val location: String? = null,
    @SerialName("starts_at") val startsAt: String,
    @SerialName("ends_at") val endsAt: String,
    val audience: EventAudience? = EventAudience.TEAMS,
    @SerialName("team_ids") val teamIds: List<String>? = emptyList()
)

@Serializable
data class EventRsvpUpsert(
    @SerialName("member_id") val memberId: String,
    val status: RsvpStatus,
    val comment: String? = null
)

@Serializable
data class AttendanceUpsert(
    @SerialName("member_id") val memberId: String,
    val status: AttendanceStatus,
    @SerialName("checked_in_at") val checkedInAt: String? = null
)

@Serializable
data class RoutineCreate(
    @SerialName("club_id") val clubId: String,
    val title: String,
    @SerialName("team_id") val teamId: String? = null,
    val category: String? = null,
    @SerialName("music_title") val musicTitle: String? = null,
    @SerialName("music_artist") val musicArtist: String? = null,
    @SerialName("music_bpm") val musicBpm: Long? = null,
    @SerialName("music_duration_ms") val musicDurationMs: Long? = null,
    @SerialName("skater_member_ids") val skaterMemberIds: List<String>? = emptyList()
)

@Serializable
data class RoutineMarker(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("routine_id") val routineId: String,
    @SerialName("time_ms") val timeMs: Long?,
    val label: String,
    @SerialName("element_code") val elementCode: String?
)

@Serializable
data class RoutineMarkerCreate(
    @SerialName("time_ms") val timeMs: Long,
    val label: String,
    @SerialName("element_code") val elementCode: String? = null
)

@Serializable
data class RoutineScoreCreate(
    @SerialName("scored_on") val scoredOn: String,
    @SerialName("scoring_system") val scoringSystem: String? = "rollart",
    @SerialName("technical_score") val technicalScore: Double? = null,
    @SerialName("components_score") val componentsScore: Double? = null,
    @SerialName("total_score") val totalScore: Double? = null,
    @SerialName("competition_id") val competitionId: String? = null,
    val placement: Long? = null,
    val note: String? = null
)

@Serializable
data class RoutineShareCreated(
    val token: String,
    val url: String,
    @SerialName("expires_at") val expiresAt: String?
)

@Serializable
data class RoutineShareCreate(
    @SerialName("expires_at") val expiresAt: String? = null
)

@Serializable
data class RoutineShareRevoked(
    val revoked: Boolean
)

@Serializable
data class Competition(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val name: String,
    val location: String?,
    @SerialName("starts_at") val startsAt: String,
    @SerialName("ends_at") val endsAt: String,
    @SerialName("registration_deadline") val registrationDeadline: String?,
    val status: CompetitionStatus,
    val entries: List<CompetitionEntry>,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class CompetitionStandingRow(
    val category: String,
    val rank: Long?,
    @SerialName("entry_id") val entryId: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("first_name") val firstName: String?,
    @SerialName("last_name") val lastName: String?,
    @SerialName("routine_id") val routineId: String,
    @SerialName("routine_title") val routineTitle: String,
    @SerialName("technical_score") val technicalScore: Double?,
    @SerialName("components_score") val componentsScore: Double?,
    @SerialName("total_score") val totalScore: Double?,
    val placement: Long?,
    val delta: Double?
)

@Serializable
data class CompetitionStandings(
    @SerialName("competition_id") val competitionId: String,
    val name: String,
    val rows: List<CompetitionStandingRow>
)

@Serializable
data class PublicRoutine(
    val title: String,
    val discipline: String?,
    @SerialName("club_name") val clubName: String,
    @SerialName("music_title") val musicTitle: String?,
    @SerialName("music_artist") val musicArtist: String?,
    @SerialName("music_bpm") val musicBpm: Long?,
    @SerialName("music_duration_ms") val musicDurationMs: Long?,
    val markers: List<PublicRoutineMarkers>,
    val scores: List<PublicRoutineScores>
)

@Serializable
data class Task(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val title: String,
    val done: Boolean,
    @SerialName("due_on") val dueOn: String?,
    @SerialName("assignee_member_id") val assigneeMemberId: String?,
    @SerialName("competition_id") val competitionId: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class TaskUpdate(
    val done: Boolean
)

@Serializable
data class News(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("author_member_id") val authorMemberId: String,
    val title: String,
    val body: String,
    @SerialName("is_pinned") val isPinned: Boolean,
    @SerialName("published_at") val publishedAt: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class NewsCreate(
    @SerialName("club_id") val clubId: String,
    val title: String,
    val body: String,
    @SerialName("is_pinned") val isPinned: Boolean? = false,
    @SerialName("published_at") val publishedAt: String? = null
)

@Serializable
data class NewsUpdate(
    val title: String? = null,
    val body: String? = null,
    @SerialName("is_pinned") val isPinned: Boolean? = null,
    @SerialName("published_at") val publishedAt: String? = null
)

@Serializable
data class Note(
    val id: String,
    @SerialName("owner_profile_id") val ownerProfileId: String,
    @SerialName("club_id") val clubId: String?,
    val title: String,
    val body: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class NoteCreate(
    val title: String,
    val body: String,
    @SerialName("club_id") val clubId: String? = null
)

@Serializable
data class NoteUpdate(
    val title: String? = null,
    val body: String? = null,
    @SerialName("club_id") val clubId: String? = null
)

@Serializable
data class MemberAssessmentCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    val body: String,
    @SerialName("rating_technik") val ratingTechnik: Long? = null,
    @SerialName("rating_ausdruck") val ratingAusdruck: Long? = null,
    @SerialName("assessed_on") val assessedOn: String? = null
)

@Serializable
data class MemberAssessmentUpdate(
    val body: String? = null,
    @SerialName("rating_technik") val ratingTechnik: Long? = null,
    @SerialName("rating_ausdruck") val ratingAusdruck: Long? = null,
    @SerialName("assessed_on") val assessedOn: String? = null
)

@Serializable
data class SupportTicket(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("club_name") val clubName: String?,
    @SerialName("created_by_member_id") val createdByMemberId: String,
    @SerialName("created_by_name") val createdByName: String?,
    val subject: String,
    val status: SupportTicketStatus,
    val priority: SupportTicketPriority,
    @SerialName("last_reply_at") val lastReplyAt: String?,
    @SerialName("last_reply_by") val lastReplyBy: SupportActor,
    @SerialName("message_count") val messageCount: Long,
    @SerialName("closed_at") val closedAt: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class SupportMessage(
    val id: String,
    @SerialName("ticket_id") val ticketId: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("author_profile_id") val authorProfileId: String,
    @SerialName("author_name") val authorName: String?,
    @SerialName("author_kind") val authorKind: SupportActor,
    val body: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class SupportTicketDetail(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("club_name") val clubName: String?,
    @SerialName("created_by_member_id") val createdByMemberId: String,
    @SerialName("created_by_name") val createdByName: String?,
    val subject: String,
    val status: SupportTicketStatus,
    val priority: SupportTicketPriority,
    @SerialName("last_reply_at") val lastReplyAt: String?,
    @SerialName("last_reply_by") val lastReplyBy: SupportActor,
    @SerialName("message_count") val messageCount: Long,
    @SerialName("closed_at") val closedAt: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    val messages: List<SupportMessage>
)

@Serializable
data class SupportTicketCreate(
    @SerialName("club_id") val clubId: String,
    val subject: String,
    val body: String
)

@Serializable
data class SupportMessageCreate(
    val body: String
)

@Serializable
data class SupportTicketUpdate(
    val status: SupportTicketStatus? = null,
    val priority: SupportTicketPriority? = null
)

@Serializable
data class Exercise(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("created_by_member_id") val createdByMemberId: String,
    val name: String,
    val description: String?,
    val category: ExerciseCategory,
    val difficulty: Long?,
    @SerialName("video_url") val videoUrl: String?,
    val instructions: String?,
    @SerialName("duration_seconds") val durationSeconds: Long?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class ExerciseCreate(
    @SerialName("club_id") val clubId: String,
    val name: String,
    val category: ExerciseCategory,
    val difficulty: Long,
    val description: String? = null,
    @SerialName("video_url") val videoUrl: String? = null,
    val instructions: String? = null,
    @SerialName("duration_seconds") val durationSeconds: Long? = null
)

@Serializable
data class ExerciseUpdate(
    val name: String? = null,
    val category: ExerciseCategory? = null,
    val difficulty: Long? = null,
    val description: String? = null,
    @SerialName("video_url") val videoUrl: String? = null,
    val instructions: String? = null,
    @SerialName("duration_seconds") val durationSeconds: Long? = null
)

@Serializable
data class Facility(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val name: String,
    val kind: FacilityKind,
    val address: String?,
    val capacity: Long?,
    val notes: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class FacilityCreate(
    @SerialName("club_id") val clubId: String,
    val name: String,
    val kind: FacilityKind? = FacilityKind.HALL,
    val address: String? = null,
    val capacity: Long? = null,
    val notes: String? = null
)

@Serializable
data class FacilityUpdate(
    val name: String? = null,
    val kind: FacilityKind? = null,
    val address: String? = null,
    val capacity: Long? = null,
    val notes: String? = null
)

@Serializable
data class FacilityBooking(
    val id: String,
    @SerialName("facility_id") val facilityId: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("booked_by_member_id") val bookedByMemberId: String,
    @SerialName("team_id") val teamId: String?,
    val title: String,
    @SerialName("starts_at") val startsAt: String,
    @SerialName("ends_at") val endsAt: String,
    val status: BookingStatus,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class FacilityBookingCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("facility_id") val facilityId: String,
    @SerialName("booked_by_member_id") val bookedByMemberId: String,
    @SerialName("team_id") val teamId: String? = null,
    val title: String,
    @SerialName("starts_at") val startsAt: String,
    @SerialName("ends_at") val endsAt: String,
    val status: BookingStatus? = BookingStatus.CONFIRMED
)

@Serializable
data class FacilityBookingUpdate(
    val title: String? = null,
    @SerialName("team_id") val teamId: String? = null,
    @SerialName("starts_at") val startsAt: String? = null,
    @SerialName("ends_at") val endsAt: String? = null,
    val status: BookingStatus? = null
)

@Serializable
data class Equipment(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val name: String,
    val category: String?,
    @SerialName("total_quantity") val totalQuantity: Long?,
    @SerialName("available_quantity") val availableQuantity: Long?,
    val condition: EquipmentCondition,
    val notes: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class EquipmentCreate(
    @SerialName("club_id") val clubId: String,
    val name: String,
    val category: String? = null,
    @SerialName("total_quantity") val totalQuantity: Long? = 1L,
    @SerialName("available_quantity") val availableQuantity: Long? = null,
    val condition: EquipmentCondition? = EquipmentCondition.GOOD,
    val notes: String? = null
)

@Serializable
data class EquipmentUpdate(
    val name: String? = null,
    val category: String? = null,
    @SerialName("total_quantity") val totalQuantity: Long? = null,
    @SerialName("available_quantity") val availableQuantity: Long? = null,
    val condition: EquipmentCondition? = null,
    val notes: String? = null
)

@Serializable
data class EquipmentReservationCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("equipment_id") val equipmentId: String,
    @SerialName("reserved_by_member_id") val reservedByMemberId: String,
    val quantity: Long? = 1L,
    @SerialName("from_at") val fromAt: String,
    @SerialName("to_at") val toAt: String,
    val status: ReservationStatus? = ReservationStatus.ACTIVE
)

@Serializable
data class EquipmentReservationUpdate(
    val quantity: Long? = null,
    @SerialName("from_at") val fromAt: String? = null,
    @SerialName("to_at") val toAt: String? = null,
    val status: ReservationStatus? = null
)

@Serializable
data class AchievementCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    val title: String,
    @SerialName("competition_name") val competitionName: String? = null,
    val placement: Long? = null,
    val medal: Medal? = null,
    @SerialName("achieved_on") val achievedOn: String,
    val note: String? = null
)

@Serializable
data class AchievementUpdate(
    val title: String? = null,
    @SerialName("competition_name") val competitionName: String? = null,
    val placement: Long? = null,
    val medal: Medal? = null,
    @SerialName("achieved_on") val achievedOn: String? = null,
    val note: String? = null
)

@Serializable
data class TrainingSlot(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("team_id") val teamId: String?,
    val weekday: Weekday,
    @SerialName("starts_time") val startsTime: String,
    @SerialName("ends_time") val endsTime: String,
    @SerialName("facility_id") val facilityId: String?,
    val location: String?,
    @SerialName("coach_member_id") val coachMemberId: String?,
    val note: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class TrainingSlotCreate(
    @SerialName("club_id") val clubId: String,
    val weekday: Weekday,
    @SerialName("starts_time") val startsTime: String,
    @SerialName("ends_time") val endsTime: String,
    @SerialName("team_id") val teamId: String? = null,
    @SerialName("facility_id") val facilityId: String? = null,
    val location: String? = null,
    @SerialName("coach_member_id") val coachMemberId: String? = null,
    val note: String? = null
)

@Serializable
data class TrainingSlotUpdate(
    val weekday: Weekday? = null,
    @SerialName("starts_time") val startsTime: String? = null,
    @SerialName("ends_time") val endsTime: String? = null,
    @SerialName("team_id") val teamId: String? = null,
    @SerialName("facility_id") val facilityId: String? = null,
    val location: String? = null,
    @SerialName("coach_member_id") val coachMemberId: String? = null,
    val note: String? = null
)

@Serializable
data class DutyRequirementCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("season_label") val seasonLabel: String,
    @SerialName("required_hours") val requiredHours: Double,
    @SerialName("period_start") val periodStart: String,
    @SerialName("period_end") val periodEnd: String,
    @SerialName("team_id") val teamId: String? = null,
    @SerialName("member_id") val memberId: String? = null
)

@Serializable
data class DutyRequirementUpdate(
    @SerialName("season_label") val seasonLabel: String? = null,
    @SerialName("required_hours") val requiredHours: Double? = null,
    @SerialName("period_start") val periodStart: String? = null,
    @SerialName("period_end") val periodEnd: String? = null,
    @SerialName("team_id") val teamId: String? = null,
    @SerialName("member_id") val memberId: String? = null
)

@Serializable
data class DutyEntryCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    val hours: Double,
    @SerialName("activity_date") val activityDate: String,
    val kind: DutyKind? = DutyKind.TRAINING,
    val note: String? = null,
    val approved: Boolean? = false
)

@Serializable
data class DutyEntryUpdate(
    val hours: Double? = null,
    @SerialName("activity_date") val activityDate: String? = null,
    val kind: DutyKind? = null,
    val note: String? = null,
    val approved: Boolean? = null
)

@Serializable
data class ChatChannel(
    @SerialName("channel_type") val channelType: ChatChannelType,
    @SerialName("team_id") val teamId: String?,
    @SerialName("team_name") val teamName: String?,
    @SerialName("peer_member_id") val peerMemberId: String?,
    @SerialName("peer_name") val peerName: String?,
    @SerialName("last_message_id") val lastMessageId: String?,
    @SerialName("last_body") val lastBody: String?,
    @SerialName("last_image_url") val lastImageUrl: String?,
    @SerialName("last_sender_member_id") val lastSenderMemberId: String?,
    @SerialName("last_message_at") val lastMessageAt: String?
)

@Serializable
data class ChatMessage(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("channel_type") val channelType: ChatChannelType,
    @SerialName("team_id") val teamId: String?,
    @SerialName("sender_member_id") val senderMemberId: String,
    @SerialName("recipient_member_id") val recipientMemberId: String?,
    val body: String?,
    @SerialName("image_url") val imageUrl: String?,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class ChatMessageCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("channel_type") val channelType: ChatChannelType,
    @SerialName("team_id") val teamId: String? = null,
    @SerialName("recipient_member_id") val recipientMemberId: String? = null,
    val body: String? = null,
    @SerialName("image_url") val imageUrl: String? = null
)

@Serializable
data class CheckinCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("event_id") val eventId: String? = null,
    val method: CheckinMethod? = CheckinMethod.QR,
    @SerialName("checked_in_at") val checkedInAt: String? = null
)

@Serializable
data class RegionalEvent(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val title: String,
    @SerialName("host_org") val hostOrg: String?,
    val discipline: String?,
    val location: String?,
    @SerialName("starts_on") val startsOn: String,
    @SerialName("ends_on") val endsOn: String?,
    @SerialName("registration_url") val registrationUrl: String?,
    val description: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class RegionalEventCreate(
    @SerialName("club_id") val clubId: String,
    val title: String,
    @SerialName("starts_on") val startsOn: String,
    @SerialName("ends_on") val endsOn: String? = null,
    @SerialName("host_org") val hostOrg: String? = null,
    val discipline: String? = null,
    val location: String? = null,
    @SerialName("registration_url") val registrationUrl: String? = null,
    val description: String? = null
)

@Serializable
data class RegionalEventUpdate(
    val title: String? = null,
    @SerialName("starts_on") val startsOn: String? = null,
    @SerialName("ends_on") val endsOn: String? = null,
    @SerialName("host_org") val hostOrg: String? = null,
    val discipline: String? = null,
    val location: String? = null,
    @SerialName("registration_url") val registrationUrl: String? = null,
    val description: String? = null
)

@Serializable
data class GalleryItem(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val album: String?,
    val title: String,
    val kind: GalleryKind,
    @SerialName("storage_key") val storageKey: String,
    @SerialName("content_type") val contentType: String,
    @SerialName("size_bytes") val sizeBytes: Long?,
    @SerialName("thumbnail_key") val thumbnailKey: String?,
    @SerialName("uploaded_by_member_id") val uploadedByMemberId: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class GalleryItemCreate(
    @SerialName("club_id") val clubId: String,
    val title: String,
    val kind: GalleryKind,
    @SerialName("storage_key") val storageKey: String,
    @SerialName("content_type") val contentType: String,
    @SerialName("size_bytes") val sizeBytes: Long,
    val album: String? = null,
    @SerialName("thumbnail_key") val thumbnailKey: String? = null
)

@Serializable
data class PhotoTag(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("gallery_item_id") val galleryItemId: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("tagged_by_member_id") val taggedByMemberId: String,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class PhotoTagCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("gallery_item_id") val galleryItemId: String,
    @SerialName("member_id") val memberId: String
)

@Serializable
data class Document(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val title: String,
    val category: String,
    @SerialName("storage_key") val storageKey: String,
    @SerialName("content_type") val contentType: String,
    @SerialName("size_bytes") val sizeBytes: Long?,
    @SerialName("uploaded_by_member_id") val uploadedByMemberId: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class DocumentCreate(
    @SerialName("club_id") val clubId: String,
    val title: String,
    @SerialName("storage_key") val storageKey: String,
    @SerialName("content_type") val contentType: String,
    @SerialName("size_bytes") val sizeBytes: Long,
    val category: String? = "allgemein"
)

@Serializable
data class ReportRoleCount(
    val role: ClubRole,
    val count: Long?
)

@Serializable
data class ReportTeamCount(
    @SerialName("team_id") val teamId: String,
    @SerialName("team_name") val teamName: String,
    @SerialName("member_count") val memberCount: Long?
)

@Serializable
data class ReportMedalCounts(
    val gold: Long?,
    val silver: Long?,
    val bronze: Long?
)

@Serializable
data class ReportUpcomingEvent(
    val id: String,
    val title: String,
    val type: EventType,
    @SerialName("starts_at") val startsAt: String
)

@Serializable
data class ReportSummary(
    @SerialName("club_id") val clubId: String,
    @SerialName("members_total") val membersTotal: Long?,
    @SerialName("members_active") val membersActive: Long?,
    @SerialName("members_by_role") val membersByRole: List<ReportRoleCount>,
    @SerialName("members_by_team") val membersByTeam: List<ReportTeamCount>,
    @SerialName("attendance_rate") val attendanceRate: Double?,
    @SerialName("open_invoices_total_cents") val openInvoicesTotalCents: Long?,
    @SerialName("open_invoices_count") val openInvoicesCount: Long?,
    val medals: ReportMedalCounts,
    @SerialName("upcoming_events_count") val upcomingEventsCount: Long?,
    @SerialName("upcoming_events") val upcomingEvents: List<ReportUpcomingEvent>
)

@Serializable
data class AnnualCategoryRow(
    @SerialName("category_id") val categoryId: String?,
    @SerialName("category_name") val categoryName: String?,
    val kind: LedgerCategoryKind,
    @SerialName("amount_cents") val amountCents: Long?
)

@Serializable
data class AnnualYearTotals(
    val year: Long?,
    @SerialName("income_cents") val incomeCents: Long?,
    @SerialName("expense_cents") val expenseCents: Long?,
    @SerialName("net_cents") val netCents: Long?
)

@Serializable
data class AnnualReport(
    @SerialName("club_id") val clubId: String,
    val year: Long?,
    @SerialName("income_cents") val incomeCents: Long?,
    @SerialName("expense_cents") val expenseCents: Long?,
    @SerialName("net_cents") val netCents: Long?,
    @SerialName("by_category") val byCategory: List<AnnualCategoryRow>,
    @SerialName("prev_year") val prevYear: AnnualYearTotals,
    @SerialName("net_delta_cents") val netDeltaCents: Long?,
    @SerialName("donations_total_cents") val donationsTotalCents: Long?,
    @SerialName("donations_count") val donationsCount: Long?,
    @SerialName("open_items_count") val openItemsCount: Long?,
    @SerialName("open_items_total_cents") val openItemsTotalCents: Long?
)

@Serializable
data class Anniversary(
    @SerialName("member_id") val memberId: String,
    @SerialName("member_name") val memberName: String,
    val kind: AnniversaryKind,
    val date: String,
    val years: Long?,
    @SerialName("days_until") val daysUntil: Long
)

@Serializable
data class Department(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val name: String,
    val description: String?,
    @SerialName("lead_member_id") val leadMemberId: String?,
    @SerialName("sort_order") val sortOrder: Long,
    @SerialName("member_ids") val memberIds: List<String>,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class DepartmentCreate(
    @SerialName("club_id") val clubId: String,
    val name: String,
    val description: String? = null,
    @SerialName("lead_member_id") val leadMemberId: String? = null,
    @SerialName("sort_order") val sortOrder: Long? = 0L
)

@Serializable
data class DepartmentUpdate(
    val name: String? = null,
    val description: String? = null,
    @SerialName("lead_member_id") val leadMemberId: String? = null,
    @SerialName("sort_order") val sortOrder: Long? = null
)

@Serializable
data class DepartmentMembersSet(
    @SerialName("member_ids") val memberIds: List<String>? = emptyList()
)

@Serializable
data class Locker(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val label: String,
    val location: String?,
    val status: LockerStatus,
    @SerialName("assigned_member_id") val assignedMemberId: String?,
    val note: String?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class LockerCreate(
    @SerialName("club_id") val clubId: String,
    val label: String,
    val location: String? = null,
    val status: LockerStatus? = LockerStatus.FREE,
    @SerialName("assigned_member_id") val assignedMemberId: String? = null,
    val note: String? = null
)

@Serializable
data class LockerUpdate(
    val label: String? = null,
    val location: String? = null,
    val status: LockerStatus? = null,
    @SerialName("assigned_member_id") val assignedMemberId: String? = null,
    val note: String? = null
)

@Serializable
data class LockerAssign(
    @SerialName("member_id") val memberId: String
)

@Serializable
data class InvoiceCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    val title: String,
    @SerialName("amount_cents") val amountCents: Long,
    @SerialName("due_on") val dueOn: String? = null,
    val issue: Boolean? = false
)

@Serializable
data class InvoiceUpdate(
    val status: InvoiceUpdateStatus,
    @SerialName("paid_via") val paidVia: String? = null,
    @SerialName("post_to_ledger") val postToLedger: Boolean? = true,
    @SerialName("ledger_category_id") val ledgerCategoryId: String? = null
)

@Serializable
data class LedgerEntry(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("entry_on") val entryOn: String,
    val description: String,
    @SerialName("counterparty_kind") val counterpartyKind: CounterpartyKind,
    @SerialName("counterparty_member_id") val counterpartyMemberId: String?,
    @SerialName("counterparty_name") val counterpartyName: String?,
    @SerialName("amount_cents") val amountCents: Long?,
    val currency: String,
    val category: String?,
    @SerialName("category_id") val categoryId: String?,
    @SerialName("category_name") val categoryName: String? = null,
    @SerialName("category_kind") val categoryKind: LedgerCategoryKind? = null,
    @SerialName("invoice_id") val invoiceId: String?,
    @SerialName("reverses_entry_id") val reversesEntryId: String?,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class LedgerEntryCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("entry_on") val entryOn: String,
    val description: String,
    @SerialName("counterparty_kind") val counterpartyKind: CounterpartyKind,
    @SerialName("counterparty_member_id") val counterpartyMemberId: String? = null,
    @SerialName("counterparty_name") val counterpartyName: String? = null,
    @SerialName("amount_cents") val amountCents: Long,
    val category: String? = null,
    @SerialName("category_id") val categoryId: String? = null,
    @SerialName("invoice_id") val invoiceId: String? = null
)

@Serializable
data class LedgerCategory(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val name: String,
    val kind: LedgerCategoryKind,
    @SerialName("sort_order") val sortOrder: Long?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("deleted_at") val deletedAt: String?
)

@Serializable
data class LedgerCategoryCreate(
    @SerialName("club_id") val clubId: String,
    val name: String,
    val kind: LedgerCategoryKind,
    @SerialName("sort_order") val sortOrder: Long? = 0L
)

@Serializable
data class LedgerReverse(
    val description: String? = null
)

@Serializable
data class BankTransaction(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("booked_on") val bookedOn: String,
    @SerialName("amount_cents") val amountCents: Long?,
    val purpose: String?,
    val counterparty: String?,
    @SerialName("matched_invoice_id") val matchedInvoiceId: String?,
    @SerialName("matched_ledger_entry_id") val matchedLedgerEntryId: String?,
    val status: BankTransactionStatus,
    @SerialName("imported_at") val importedAt: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("deleted_at") val deletedAt: String?
)

@Serializable
data class BankTransactionCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("booked_on") val bookedOn: String,
    @SerialName("amount_cents") val amountCents: Long,
    val purpose: String? = null,
    val counterparty: String? = null
)

@Serializable
data class BankTransactionImportRow(
    @SerialName("booked_on") val bookedOn: String,
    @SerialName("amount_cents") val amountCents: Long,
    val purpose: String? = null,
    val counterparty: String? = null
)

@Serializable
data class BankTransactionImport(
    @SerialName("club_id") val clubId: String,
    val rows: List<BankTransactionImportRow>
)

@Serializable
data class BankTransactionMatch(
    @SerialName("invoice_id") val invoiceId: String,
    @SerialName("post_to_ledger") val postToLedger: Boolean? = true,
    @SerialName("ledger_category_id") val ledgerCategoryId: String? = null
)

@Serializable
data class BankTransactionIgnore(
    val note: String? = null
)

@Serializable
data class DonationCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String? = null,
    @SerialName("donor_name") val donorName: String,
    @SerialName("donor_address") val donorAddress: String? = null,
    @SerialName("amount_cents") val amountCents: Long,
    @SerialName("donation_date") val donationDate: String,
    val purpose: String? = null
)

@Serializable
data class DonationUpdate(
    @SerialName("donor_name") val donorName: String? = null,
    @SerialName("donor_address") val donorAddress: String? = null,
    @SerialName("amount_cents") val amountCents: Long? = null,
    @SerialName("donation_date") val donationDate: String? = null,
    val purpose: String? = null,
    val issue: Boolean? = null
)

@Serializable
data class DonationReceipt(
    @SerialName("donation_id") val donationId: String,
    @SerialName("receipt_number") val receiptNumber: String,
    @SerialName("club_name") val clubName: String,
    @SerialName("donor_name") val donorName: String,
    @SerialName("donor_address") val donorAddress: String?,
    @SerialName("amount_cents") val amountCents: Long?,
    @SerialName("amount_eur") val amountEur: String,
    @SerialName("donation_date") val donationDate: String,
    val purpose: String?,
    val issued: Boolean,
    val text: String
)

@Serializable
data class MembershipCategory(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val name: String,
    @SerialName("amount_cents") val amountCents: Long?,
    val period: MembershipPeriod,
    @SerialName("is_active") val isActive: Boolean,
    @SerialName("sort_order") val sortOrder: Long?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("deleted_at") val deletedAt: String?
)

@Serializable
data class MembershipCategoryCreate(
    @SerialName("club_id") val clubId: String,
    val name: String,
    @SerialName("amount_cents") val amountCents: Long,
    val period: MembershipPeriod,
    @SerialName("is_active") val isActive: Boolean? = true,
    @SerialName("sort_order") val sortOrder: Long? = 0L
)

@Serializable
data class MembershipCategoryUpdate(
    val name: String? = null,
    @SerialName("amount_cents") val amountCents: Long? = null,
    val period: MembershipPeriod? = null,
    @SerialName("is_active") val isActive: Boolean? = null,
    @SerialName("sort_order") val sortOrder: Long? = null
)

@Serializable
data class MemberFeeSummaryBucket(
    val period: MembershipPeriod,
    val count: Long?,
    @SerialName("amount_cents") val amountCents: Long?,
    @SerialName("annual_cents") val annualCents: Long?
)

@Serializable
data class MemberFeeSummary(
    @SerialName("club_id") val clubId: String,
    @SerialName("by_period") val byPeriod: List<MemberFeeSummaryBucket>,
    @SerialName("total_annual_cents") val totalAnnualCents: Long?
)

@Serializable
data class MemberFeeCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("category_id") val categoryId: String,
    @SerialName("custom_amount_cents") val customAmountCents: Long? = null,
    @SerialName("valid_from") val validFrom: String,
    @SerialName("valid_until") val validUntil: String? = null
)

@Serializable
data class MemberFeeUpdate(
    @SerialName("category_id") val categoryId: String? = null,
    @SerialName("custom_amount_cents") val customAmountCents: Long? = null,
    @SerialName("valid_from") val validFrom: String? = null,
    @SerialName("valid_until") val validUntil: String? = null
)

@Serializable
data class FamilyDiscount(
    val id: String,
    @SerialName("club_id") val clubId: String,
    val label: String,
    val kind: FamilyDiscountKind,
    @SerialName("value_numeric") val valueNumeric: Double?,
    @SerialName("applies_from_child") val appliesFromChild: Long?,
    @SerialName("is_active") val isActive: Boolean,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("deleted_at") val deletedAt: String?
)

@Serializable
data class FamilyDiscountCreate(
    @SerialName("club_id") val clubId: String,
    val label: String,
    val kind: FamilyDiscountKind,
    @SerialName("value_numeric") val valueNumeric: Double,
    @SerialName("applies_from_child") val appliesFromChild: Long? = 2L,
    @SerialName("is_active") val isActive: Boolean? = true
)

@Serializable
data class FamilyDiscountUpdate(
    val label: String? = null,
    val kind: FamilyDiscountKind? = null,
    @SerialName("value_numeric") val valueNumeric: Double? = null,
    @SerialName("applies_from_child") val appliesFromChild: Long? = null,
    @SerialName("is_active") val isActive: Boolean? = null
)

@Serializable
data class SepaMandateCreate(
    @SerialName("club_id") val clubId: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("mandate_reference") val mandateReference: String,
    @SerialName("iban_last4") val ibanLast4: String? = null,
    @SerialName("account_holder") val accountHolder: String,
    @SerialName("signed_on") val signedOn: String? = null,
    val status: SepaMandateStatus? = SepaMandateStatus.ACTIVE
)

@Serializable
data class SepaMandateUpdate(
    @SerialName("mandate_reference") val mandateReference: String? = null,
    @SerialName("iban_last4") val ibanLast4: String? = null,
    @SerialName("account_holder") val accountHolder: String? = null,
    @SerialName("signed_on") val signedOn: String? = null,
    val status: SepaMandateStatus? = null
)

@Serializable
data class Entitlement(
    val id: String,
    @SerialName("subject_type") val subjectType: EntitlementSubjectType,
    @SerialName("subject_id") val subjectId: String,
    val entitlement: String,
    val source: EntitlementSource,
    @SerialName("product_id") val productId: String?,
    @SerialName("valid_until") val validUntil: String?,
    val tier: String?,
    val status: String?
)

@Serializable
data class Product(
    val id: String,
    val code: String,
    val kind: ProductKind,
    val name: String,
    val description: String?,
    @SerialName("price_cents") val priceCents: Long?,
    val currency: String,
    @SerialName("billing_interval") val billingInterval: ProductBillingInterval,
    @SerialName("max_members") val maxMembers: Long?,
    val active: Boolean,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
)

@Serializable
data class DunningAction(
    @SerialName("invoice_id") val invoiceId: String,
    val number: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("amount_cents") val amountCents: Long,
    @SerialName("days_overdue") val daysOverdue: Long,
    @SerialName("current_level") val currentLevel: Long,
    @SerialName("proposed_stage") val proposedStage: Long,
    @SerialName("proposed_level") val proposedLevel: Long,
    val escalation: Boolean,
    val action: DunningActionAction
)

@Serializable
data class DunningRunResult(
    @SerialName("club_id") val clubId: String,
    @SerialName("dry_run") val dryRun: Boolean,
    @SerialName("as_of") val asOf: String,
    @SerialName("timeline_days") val timelineDays: List<Long>,
    val actions: List<DunningAction>,
    val applied: Long,
    val summary: DunningRunResultSummary
)

@Serializable
data class DunningRunRequest(
    @SerialName("dry_run") val dryRun: Boolean? = true,
    @SerialName("as_of") val asOf: String? = null
)

@Serializable
data class DunningSkip(
    @SerialName("invoice_id") val invoiceId: String,
    val reason: String
)

@Serializable
data class DunningLogEntry(
    val id: String,
    @SerialName("club_id") val clubId: String,
    @SerialName("invoice_id") val invoiceId: String,
    @SerialName("from_stage") val fromStage: Long?,
    @SerialName("to_stage") val toStage: Long?,
    val action: DunningLogAction,
    @SerialName("actor_member_id") val actorMemberId: String?,
    val note: String?,
    @SerialName("created_at") val createdAt: String
)

@Serializable
data class DunningApplyResult(
    @SerialName("club_id") val clubId: String,
    @SerialName("to_stage") val toStage: Long,
    val action: DunningLogAction,
    val applied: Long,
    val skipped: List<DunningSkip>,
    val log: List<DunningLogEntry>
)

@Serializable
data class DunningApplyRequest(
    @SerialName("invoice_ids") val invoiceIds: List<String>,
    @SerialName("to_stage") val toStage: Long,
    @SerialName("approve_escalation") val approveEscalation: Boolean? = false,
    val note: String? = null
)
