// GENERIERT — NICHT VON HAND AENDERN
//
// Generated from packages/contracts/openapi.json (RollsportManager v2 API v0.1.0).
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
enum class InvoiceStatus {
    @SerialName("draft") DRAFT,
    @SerialName("open") OPEN,
    @SerialName("paid") PAID,
    @SerialName("cancelled") CANCELLED;
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
data class ClubMemberRoleChange(
    val role: AssignableClubRole
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
