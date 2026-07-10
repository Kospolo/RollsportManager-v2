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
    @SerialName("active") ACTIVE,
    @SerialName("inactive") INACTIVE,
    @SerialName("left") LEFT;
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
enum class EventType {
    @SerialName("training") TRAINING,
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
enum class AttendanceStatus {
    @SerialName("present") PRESENT,
    @SerialName("late") LATE,
    @SerialName("excused") EXCUSED,
    @SerialName("absent") ABSENT;
}

@Serializable
enum class RoutineStatus {
    @SerialName("draft") DRAFT,
    @SerialName("ready") READY,
    @SerialName("competition") COMPETITION,
    @SerialName("archived") ARCHIVED;
}

@Serializable
enum class CompetitionStatus {
    @SerialName("upcoming") UPCOMING,
    @SerialName("running") RUNNING,
    @SerialName("done") DONE,
    @SerialName("cancelled") CANCELLED;
}

@Serializable
enum class CompetitionEntryStatus {
    @SerialName("registered") REGISTERED,
    @SerialName("confirmed") CONFIRMED,
    @SerialName("withdrawn") WITHDRAWN;
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
enum class ReservationStatus {
    @SerialName("active") ACTIVE,
    @SerialName("returned") RETURNED,
    @SerialName("cancelled") CANCELLED;
}

@Serializable
enum class Medal {
    @SerialName("gold") GOLD,
    @SerialName("silver") SILVER,
    @SerialName("bronze") BRONZE;
}

@Serializable
enum class DutyKind {
    @SerialName("training") TRAINING,
    @SerialName("helper") HELPER,
    @SerialName("competition") COMPETITION,
    @SerialName("other") OTHER;
}

@Serializable
enum class ChatChannelType {
    @SerialName("team") TEAM,
    @SerialName("direct") DIRECT;
}

@Serializable
enum class CheckinMethod {
    @SerialName("qr") QR,
    @SerialName("manual") MANUAL;
}

@Serializable
enum class GalleryKind {
    @SerialName("photo") PHOTO,
    @SerialName("video") VIDEO;
}

@Serializable
enum class InvoiceStatus {
    @SerialName("draft") DRAFT,
    @SerialName("open") OPEN,
    @SerialName("paid") PAID,
    @SerialName("cancelled") CANCELLED;
}

@Serializable
enum class CounterpartyKind {
    @SerialName("person") PERSON,
    @SerialName("org") ORG;
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

/** Inline enum of Deleted.status (hoisted by codegen). */
@Serializable
enum class DeletedStatus {
    @SerialName("deleted") DELETED;
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
    @SerialName("join_code") val joinCode: String?,
    val settings: JsonObject,
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
    val role: ClubRole,
    val status: MemberStatus,
    @SerialName("joined_on") val joinedOn: String?,
    @SerialName("valid_until") val validUntil: String?,
    @SerialName("team_ids") val teamIds: List<String>,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
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
    val status: MemberStatus? = null,
    @SerialName("valid_until") val validUntil: String? = null
)

@Serializable
data class ClubMemberRoleChange(
    val role: AssignableClubRole
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
data class Deleted(
    val status: DeletedStatus,
    val id: String
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
    @SerialName("team_ids") val teamIds: List<String>? = emptyList()
)

@Serializable
data class EventRsvpUpsert(
    @SerialName("member_id") val memberId: String,
    val status: RsvpStatus,
    val comment: String? = null
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
data class AttendanceUpsert(
    @SerialName("member_id") val memberId: String,
    val status: AttendanceStatus,
    @SerialName("checked_in_at") val checkedInAt: String? = null
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
    @SerialName("skater_member_ids") val skaterMemberIds: List<String>,
    @SerialName("waveform_peaks") val waveformPeaks: List<Double>?,
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
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
    val note: String?
)

@Serializable
data class RoutineScoreCreate(
    @SerialName("scored_on") val scoredOn: String,
    @SerialName("scoring_system") val scoringSystem: String? = "rollart",
    @SerialName("technical_score") val technicalScore: Double? = null,
    @SerialName("components_score") val componentsScore: Double? = null,
    @SerialName("total_score") val totalScore: Double? = null,
    @SerialName("competition_id") val competitionId: String? = null,
    val note: String? = null
)

@Serializable
data class CompetitionEntry(
    val id: String,
    @SerialName("member_id") val memberId: String,
    @SerialName("routine_id") val routineId: String?,
    val status: CompetitionEntryStatus
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
    @SerialName("created_at") val createdAt: String,
    @SerialName("updated_at") val updatedAt: String
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
    @SerialName("invoice_id") val invoiceId: String?,
    @SerialName("reverses_entry_id") val reversesEntryId: String?,
    @SerialName("created_at") val createdAt: String
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
data class Entitlement(
    val id: String,
    @SerialName("subject_type") val subjectType: EntitlementSubjectType,
    @SerialName("subject_id") val subjectId: String,
    val entitlement: String,
    val source: EntitlementSource,
    @SerialName("product_id") val productId: String?,
    @SerialName("valid_until") val validUntil: String?
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
