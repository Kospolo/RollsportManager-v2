// GENERIERT — NICHT VON HAND AENDERN
//
// Generated from packages/contracts/openapi.json (RollsportManager v2 API v0.2.0).
// Regenerate with: npm run generate   (in packages/contracts)
// Source of truth is the API layer; the spec itself is produced by
// "npm run openapi" in services/api - never edit either by hand.

/* eslint-disable */

// Wire format note: all property names are snake_case on purpose - they
// mirror the DB/API wire format 1:1 (Blueprint ADR-E7). Do not camelCase.

export interface Health {
  "status": "ok";
  "service": string;
  "time": string;
}

export interface Club {
  "id": string;
  "name": string;
  "short_name": string | null;
  "city": string | null;
  "discipline": string | null;
  "founded_year": number | null;
  "join_code": string | null;
  "settings": Record<string, unknown>;
  "created_at": string;
  "updated_at": string;
}

export interface Problem {
  "type": string;
  "title": string;
  "status": number;
  "detail"?: string;
  "instance"?: string;
  "request_id"?: string;
}

export interface ClubUpdate {
  "name"?: string;
  "short_name"?: string | null;
  "city"?: string | null;
  "discipline"?: string | null;
  "settings"?: Record<string, unknown>;
}

export type ClubRole = "owner" | "admin" | "moderator" | "treasurer" | "coach" | "member" | "guest_coach";
export const ClubRoleValues: readonly ClubRole[] = ["owner", "admin", "moderator", "treasurer", "coach", "member", "guest_coach"] as const;

export type MemberStatus = "pending" | "active" | "inactive" | "left";
export const MemberStatusValues: readonly MemberStatus[] = ["pending", "active", "inactive", "left"] as const;

export interface ClubMember {
  "id": string;
  "club_id": string;
  "profile_id": string | null;
  "first_name": string;
  "last_name": string;
  "email": string | null;
  "birth_date": string | null;
  "role": ClubRole;
  "status": MemberStatus;
  "joined_on": string | null;
  "valid_until": string | null;
  "team_ids": string[];
  "created_at": string;
  "updated_at": string;
}

export type AssignableClubRole = "admin" | "moderator" | "treasurer" | "coach" | "member" | "guest_coach";
export const AssignableClubRoleValues: readonly AssignableClubRole[] = ["admin", "moderator", "treasurer", "coach", "member", "guest_coach"] as const;

export interface ClubMemberCreate {
  "first_name": string;
  "last_name": string;
  "email"?: string;
  "birth_date"?: string;
  "role"?: AssignableClubRole;
  "joined_on"?: string;
  "valid_until"?: string;
}

export interface InviteQueued {
  "status": "queued";
  "email": string;
}

export interface ClubMemberInvite {
  "email": string;
  "role"?: AssignableClubRole;
}

export interface Guardianship {
  "id": string;
  "club_id": string;
  "guardian_member_id": string;
  "child_member_id": string;
  "relation": string;
  "created_at": string;
}

export interface ClubMemberUpdate {
  "first_name"?: string;
  "last_name"?: string;
  "email"?: string | null;
  "birth_date"?: string | null;
  "status"?: MemberStatus;
  "valid_until"?: string | null;
}

export interface ClubMemberRoleChange {
  "role": AssignableClubRole;
}

export interface Team {
  "id": string;
  "club_id": string;
  "name": string;
  "age_group": string | null;
  "skater_member_ids": string[];
  "coach_member_ids": string[];
  "created_at": string;
  "updated_at": string;
}

export interface TeamCreate {
  "name": string;
  "age_group"?: string;
}

export interface TeamUpdate {
  "name"?: string;
  "age_group"?: string | null;
}

export interface Deleted {
  "status": "deleted";
  "id": string;
}

export interface TeamMembersSet {
  "skater_member_ids"?: string[];
  "coach_member_ids"?: string[];
}

export interface PlatformClub {
  "id": string;
  "name": string;
  "short_name": string | null;
  "city": string | null;
  "discipline": string | null;
  "member_count": number | null;
  "created_at": string;
}

export interface PlatformUser {
  "id": string;
  "display_name": string | null;
  "locale": string;
  "club_count": number | null;
  "created_at": string;
}

export interface PlatformStats {
  "clubs": number | null;
  "users": number | null;
  "members": number | null;
  "active_members": number | null;
  "teams": number | null;
  "events": number | null;
  "open_invoices": number | null;
}

export type EventType = "training" | "competition" | "other";
export const EventTypeValues: readonly EventType[] = ["training", "competition", "other"] as const;

export type RsvpStatus = "going" | "declined" | "maybe" | "sick";
export const RsvpStatusValues: readonly RsvpStatus[] = ["going", "declined", "maybe", "sick"] as const;

export interface EventRsvp {
  "id": string;
  "club_id": string;
  "event_id": string;
  "member_id": string;
  "status": RsvpStatus;
  "comment": string | null;
  "responded_at": string;
}

export interface Event {
  "id": string;
  "club_id": string;
  "type": EventType;
  "title": string;
  "note": string | null;
  "location": string | null;
  "starts_at": string;
  "ends_at": string;
  "competition_id": string | null;
  "team_ids": string[];
  "rsvps": EventRsvp[];
  "created_at": string;
  "updated_at": string;
}

export interface EventCreate {
  "club_id": string;
  "type"?: EventType;
  "title": string;
  "note"?: string;
  "location"?: string;
  "starts_at": string;
  "ends_at": string;
  "team_ids"?: string[];
}

export interface EventRsvpUpsert {
  "member_id": string;
  "status": RsvpStatus;
  "comment"?: string;
}

export type AttendanceStatus = "present" | "late" | "excused" | "absent";
export const AttendanceStatusValues: readonly AttendanceStatus[] = ["present", "late", "excused", "absent"] as const;

export interface Attendance {
  "id": string;
  "club_id": string;
  "event_id": string;
  "member_id": string;
  "status": AttendanceStatus;
  "checked_in_at": string | null;
}

export interface AttendanceUpsert {
  "member_id": string;
  "status": AttendanceStatus;
  "checked_in_at"?: string;
}

export type RoutineStatus = "draft" | "ready" | "competition" | "archived";
export const RoutineStatusValues: readonly RoutineStatus[] = ["draft", "ready", "competition", "archived"] as const;

export interface Routine {
  "id": string;
  "club_id": string;
  "team_id": string | null;
  "title": string;
  "status": RoutineStatus;
  "category": string | null;
  "music_title": string | null;
  "music_artist": string | null;
  "music_bpm": number | null;
  "music_duration_ms": number | null;
  "audio_asset_id": string | null;
  "skater_member_ids": string[];
  "waveform_peaks": number[] | null;
  "created_at": string;
  "updated_at": string;
}

export interface RoutineCreate {
  "club_id": string;
  "title": string;
  "team_id"?: string;
  "category"?: string;
  "music_title"?: string;
  "music_artist"?: string;
  "music_bpm"?: number;
  "music_duration_ms"?: number;
  "skater_member_ids"?: string[];
}

export interface RoutineMarker {
  "id": string;
  "club_id": string;
  "routine_id": string;
  "time_ms": number | null;
  "label": string;
  "element_code": string | null;
}

export interface RoutineMarkerCreate {
  "time_ms": number;
  "label": string;
  "element_code"?: string;
}

export interface RoutineScore {
  "id": string;
  "club_id": string;
  "routine_id": string;
  "competition_id": string | null;
  "scored_on": string;
  "scoring_system": string;
  "technical_score": number | null;
  "components_score": number | null;
  "total_score": number | null;
  "note": string | null;
}

export interface RoutineScoreCreate {
  "scored_on": string;
  "scoring_system"?: string;
  "technical_score"?: number;
  "components_score"?: number;
  "total_score"?: number;
  "competition_id"?: string;
  "note"?: string;
}

export type CompetitionStatus = "upcoming" | "running" | "done" | "cancelled";
export const CompetitionStatusValues: readonly CompetitionStatus[] = ["upcoming", "running", "done", "cancelled"] as const;

export type CompetitionEntryStatus = "registered" | "confirmed" | "withdrawn";
export const CompetitionEntryStatusValues: readonly CompetitionEntryStatus[] = ["registered", "confirmed", "withdrawn"] as const;

export interface CompetitionEntry {
  "id": string;
  "member_id": string;
  "routine_id": string | null;
  "status": CompetitionEntryStatus;
}

export interface Competition {
  "id": string;
  "club_id": string;
  "name": string;
  "location": string | null;
  "starts_at": string;
  "ends_at": string;
  "registration_deadline": string | null;
  "status": CompetitionStatus;
  "entries": CompetitionEntry[];
  "created_at": string;
  "updated_at": string;
}

export interface Task {
  "id": string;
  "club_id": string;
  "title": string;
  "done": boolean;
  "due_on": string | null;
  "assignee_member_id": string | null;
  "competition_id": string | null;
  "created_at": string;
  "updated_at": string;
}

export interface TaskUpdate {
  "done": boolean;
}

export interface News {
  "id": string;
  "club_id": string;
  "author_member_id": string;
  "title": string;
  "body": string;
  "is_pinned": boolean;
  "published_at": string | null;
  "created_at": string;
  "updated_at": string;
}

export interface NewsCreate {
  "club_id": string;
  "title": string;
  "body": string;
  "is_pinned"?: boolean;
  "published_at"?: string;
}

export interface NewsUpdate {
  "title"?: string;
  "body"?: string;
  "is_pinned"?: boolean;
  "published_at"?: string | null;
}

export interface Note {
  "id": string;
  "owner_profile_id": string;
  "club_id": string | null;
  "title": string;
  "body": string;
  "created_at": string;
  "updated_at": string;
}

export interface NoteCreate {
  "title": string;
  "body": string;
  "club_id"?: string;
}

export interface NoteUpdate {
  "title"?: string;
  "body"?: string;
  "club_id"?: string | null;
}

export type ExerciseCategory = "warmup" | "stretching" | "strength" | "jump" | "spin" | "steps" | "combination";
export const ExerciseCategoryValues: readonly ExerciseCategory[] = ["warmup", "stretching", "strength", "jump", "spin", "steps", "combination"] as const;

export interface Exercise {
  "id": string;
  "club_id": string;
  "created_by_member_id": string;
  "name": string;
  "description": string | null;
  "category": ExerciseCategory;
  "difficulty": number | null;
  "video_url": string | null;
  "instructions": string | null;
  "duration_seconds": number | null;
  "created_at": string;
  "updated_at": string;
}

export interface ExerciseCreate {
  "club_id": string;
  "name": string;
  "category": ExerciseCategory;
  "difficulty": number;
  "description"?: string;
  "video_url"?: string;
  "instructions"?: string;
  "duration_seconds"?: number;
}

export interface ExerciseUpdate {
  "name"?: string;
  "category"?: ExerciseCategory;
  "difficulty"?: number;
  "description"?: string | null;
  "video_url"?: string | null;
  "instructions"?: string | null;
  "duration_seconds"?: number | null;
}

export type FacilityKind = "hall" | "room" | "outdoor" | "other";
export const FacilityKindValues: readonly FacilityKind[] = ["hall", "room", "outdoor", "other"] as const;

export interface Facility {
  "id": string;
  "club_id": string;
  "name": string;
  "kind": FacilityKind;
  "address": string | null;
  "capacity": number | null;
  "notes": string | null;
  "created_at": string;
  "updated_at": string;
}

export interface FacilityCreate {
  "club_id": string;
  "name": string;
  "kind"?: FacilityKind;
  "address"?: string;
  "capacity"?: number;
  "notes"?: string;
}

export interface FacilityUpdate {
  "name"?: string;
  "kind"?: FacilityKind;
  "address"?: string | null;
  "capacity"?: number | null;
  "notes"?: string | null;
}

export type BookingStatus = "confirmed" | "pending" | "cancelled";
export const BookingStatusValues: readonly BookingStatus[] = ["confirmed", "pending", "cancelled"] as const;

export interface FacilityBooking {
  "id": string;
  "facility_id": string;
  "club_id": string;
  "booked_by_member_id": string;
  "team_id": string | null;
  "title": string;
  "starts_at": string;
  "ends_at": string;
  "status": BookingStatus;
  "created_at": string;
  "updated_at": string;
}

export interface FacilityBookingCreate {
  "club_id": string;
  "facility_id": string;
  "booked_by_member_id": string;
  "team_id"?: string;
  "title": string;
  "starts_at": string;
  "ends_at": string;
  "status"?: BookingStatus;
}

export interface FacilityBookingUpdate {
  "title"?: string;
  "team_id"?: string | null;
  "starts_at"?: string;
  "ends_at"?: string;
  "status"?: BookingStatus;
}

export type EquipmentCondition = "good" | "fair" | "defect";
export const EquipmentConditionValues: readonly EquipmentCondition[] = ["good", "fair", "defect"] as const;

export interface Equipment {
  "id": string;
  "club_id": string;
  "name": string;
  "category": string | null;
  "total_quantity": number | null;
  "available_quantity": number | null;
  "condition": EquipmentCondition;
  "notes": string | null;
  "created_at": string;
  "updated_at": string;
}

export interface EquipmentCreate {
  "club_id": string;
  "name": string;
  "category"?: string;
  "total_quantity"?: number;
  "available_quantity"?: number;
  "condition"?: EquipmentCondition;
  "notes"?: string;
}

export interface EquipmentUpdate {
  "name"?: string;
  "category"?: string | null;
  "total_quantity"?: number;
  "available_quantity"?: number;
  "condition"?: EquipmentCondition;
  "notes"?: string | null;
}

export type ReservationStatus = "active" | "returned" | "cancelled";
export const ReservationStatusValues: readonly ReservationStatus[] = ["active", "returned", "cancelled"] as const;

export interface EquipmentReservation {
  "id": string;
  "equipment_id": string;
  "club_id": string;
  "reserved_by_member_id": string;
  "quantity": number | null;
  "from_at": string;
  "to_at": string;
  "status": ReservationStatus;
  "created_at": string;
  "updated_at": string;
}

export interface EquipmentReservationCreate {
  "club_id": string;
  "equipment_id": string;
  "reserved_by_member_id": string;
  "quantity"?: number;
  "from_at": string;
  "to_at": string;
  "status"?: ReservationStatus;
}

export interface EquipmentReservationUpdate {
  "quantity"?: number;
  "from_at"?: string;
  "to_at"?: string;
  "status"?: ReservationStatus;
}

export type Medal = "gold" | "silver" | "bronze";
export const MedalValues: readonly Medal[] = ["gold", "silver", "bronze"] as const;

export interface Achievement {
  "id": string;
  "club_id": string;
  "member_id": string;
  "title": string;
  "competition_name": string | null;
  "placement": number | null;
  "medal": Medal;
  "achieved_on": string;
  "note": string | null;
  "created_at": string;
  "updated_at": string;
}

export interface AchievementCreate {
  "club_id": string;
  "member_id": string;
  "title": string;
  "competition_name"?: string;
  "placement"?: number;
  "medal"?: Medal;
  "achieved_on": string;
  "note"?: string;
}

export interface AchievementUpdate {
  "title"?: string;
  "competition_name"?: string | null;
  "placement"?: number | null;
  "medal"?: Medal;
  "achieved_on"?: string;
  "note"?: string | null;
}

export type Weekday = number;

export interface TrainingSlot {
  "id": string;
  "club_id": string;
  "team_id": string | null;
  "weekday": Weekday;
  "starts_time": string;
  "ends_time": string;
  "facility_id": string | null;
  "location": string | null;
  "coach_member_id": string | null;
  "note": string | null;
  "created_at": string;
  "updated_at": string;
}

export interface TrainingSlotCreate {
  "club_id": string;
  "weekday": Weekday;
  "starts_time": string;
  "ends_time": string;
  "team_id"?: string;
  "facility_id"?: string;
  "location"?: string;
  "coach_member_id"?: string;
  "note"?: string;
}

export interface TrainingSlotUpdate {
  "weekday"?: Weekday;
  "starts_time"?: string;
  "ends_time"?: string;
  "team_id"?: string | null;
  "facility_id"?: string | null;
  "location"?: string | null;
  "coach_member_id"?: string | null;
  "note"?: string | null;
}

export interface DutyRequirement {
  "id": string;
  "club_id": string;
  "team_id": string | null;
  "member_id": string | null;
  "season_label": string;
  "required_hours": number | null;
  "period_start": string;
  "period_end": string;
  "created_at": string;
  "updated_at": string;
}

export interface DutyRequirementCreate {
  "club_id": string;
  "season_label": string;
  "required_hours": number;
  "period_start": string;
  "period_end": string;
  "team_id"?: string;
  "member_id"?: string;
}

export interface DutyRequirementUpdate {
  "season_label"?: string;
  "required_hours"?: number;
  "period_start"?: string;
  "period_end"?: string;
  "team_id"?: string | null;
  "member_id"?: string | null;
}

export type DutyKind = "training" | "helper" | "competition" | "other";
export const DutyKindValues: readonly DutyKind[] = ["training", "helper", "competition", "other"] as const;

export interface DutyEntry {
  "id": string;
  "club_id": string;
  "member_id": string;
  "hours": number | null;
  "activity_date": string;
  "kind": DutyKind;
  "note": string | null;
  "approved": boolean;
  "created_at": string;
  "updated_at": string;
}

export interface DutyEntryCreate {
  "club_id": string;
  "member_id": string;
  "hours": number;
  "activity_date": string;
  "kind"?: DutyKind;
  "note"?: string;
  "approved"?: boolean;
}

export interface DutyEntryUpdate {
  "hours"?: number;
  "activity_date"?: string;
  "kind"?: DutyKind;
  "note"?: string | null;
  "approved"?: boolean;
}

export type ChatChannelType = "team" | "direct";
export const ChatChannelTypeValues: readonly ChatChannelType[] = ["team", "direct"] as const;

export interface ChatChannel {
  "channel_type": ChatChannelType;
  "team_id": string | null;
  "team_name": string | null;
  "peer_member_id": string | null;
  "peer_name": string | null;
  "last_message_id": string | null;
  "last_body": string | null;
  "last_image_url": string | null;
  "last_sender_member_id": string | null;
  "last_message_at": string | null;
}

export interface ChatMessage {
  "id": string;
  "club_id": string;
  "channel_type": ChatChannelType;
  "team_id": string | null;
  "sender_member_id": string;
  "recipient_member_id": string | null;
  "body": string | null;
  "image_url": string | null;
  "created_at": string;
}

export interface ChatMessageCreate {
  "club_id": string;
  "channel_type": ChatChannelType;
  "team_id"?: string;
  "recipient_member_id"?: string;
  "body"?: string;
  "image_url"?: string;
}

export type CheckinMethod = "qr" | "manual";
export const CheckinMethodValues: readonly CheckinMethod[] = ["qr", "manual"] as const;

export interface Checkin {
  "id": string;
  "club_id": string;
  "member_id": string;
  "event_id": string | null;
  "method": CheckinMethod;
  "checked_in_at": string;
  "created_at": string;
}

export interface CheckinCreate {
  "club_id": string;
  "member_id": string;
  "event_id"?: string;
  "method"?: CheckinMethod;
  "checked_in_at"?: string;
}

export interface RegionalEvent {
  "id": string;
  "club_id": string;
  "title": string;
  "host_org": string | null;
  "discipline": string | null;
  "location": string | null;
  "starts_on": string;
  "ends_on": string | null;
  "registration_url": string | null;
  "description": string | null;
  "created_at": string;
  "updated_at": string;
}

export interface RegionalEventCreate {
  "club_id": string;
  "title": string;
  "starts_on": string;
  "ends_on"?: string;
  "host_org"?: string;
  "discipline"?: string;
  "location"?: string;
  "registration_url"?: string;
  "description"?: string;
}

export interface RegionalEventUpdate {
  "title"?: string;
  "starts_on"?: string;
  "ends_on"?: string | null;
  "host_org"?: string | null;
  "discipline"?: string | null;
  "location"?: string | null;
  "registration_url"?: string | null;
  "description"?: string | null;
}

export interface ReportRoleCount {
  "role": ClubRole;
  "count": number | null;
}

export interface ReportTeamCount {
  "team_id": string;
  "team_name": string;
  "member_count": number | null;
}

export interface ReportMedalCounts {
  "gold": number | null;
  "silver": number | null;
  "bronze": number | null;
}

export interface ReportUpcomingEvent {
  "id": string;
  "title": string;
  "type": EventType;
  "starts_at": string;
}

export interface ReportSummary {
  "club_id": string;
  "members_total": number | null;
  "members_active": number | null;
  "members_by_role": ReportRoleCount[];
  "members_by_team": ReportTeamCount[];
  "attendance_rate": number | null;
  "open_invoices_total_cents": number | null;
  "open_invoices_count": number | null;
  "medals": ReportMedalCounts;
  "upcoming_events_count": number | null;
  "upcoming_events": ReportUpcomingEvent[];
}

export type InvoiceStatus = "draft" | "open" | "paid" | "cancelled";
export const InvoiceStatusValues: readonly InvoiceStatus[] = ["draft", "open", "paid", "cancelled"] as const;

export interface Invoice {
  "id": string;
  "club_id": string;
  "member_id": string;
  "number": string;
  "title": string;
  "amount_cents": number | null;
  "currency": string;
  "status": InvoiceStatus;
  "dunning_level": number;
  "issued_on": string | null;
  "due_on": string | null;
  "paid_at": string | null;
  "created_at": string;
  "updated_at": string;
}

export type CounterpartyKind = "person" | "org";
export const CounterpartyKindValues: readonly CounterpartyKind[] = ["person", "org"] as const;

export interface LedgerEntry {
  "id": string;
  "club_id": string;
  "entry_on": string;
  "description": string;
  "counterparty_kind": CounterpartyKind;
  "counterparty_member_id": string | null;
  "counterparty_name": string | null;
  "amount_cents": number | null;
  "currency": string;
  "category": string | null;
  "invoice_id": string | null;
  "reverses_entry_id": string | null;
  "created_at": string;
}

export interface InvoiceCreate {
  "club_id": string;
  "member_id": string;
  "title": string;
  "amount_cents": number;
  "due_on"?: string;
  "issue"?: boolean;
}

export interface Entitlement {
  "id": string;
  "subject_type": "club" | "profile";
  "subject_id": string;
  "entitlement": string;
  "source": "stripe" | "revenuecat" | "manual";
  "product_id": string | null;
  "valid_until": string | null;
}

export interface Product {
  "id": string;
  "code": string;
  "kind": "club_license" | "personal_pro";
  "name": string;
  "description": string | null;
  "price_cents": number | null;
  "currency": string;
  "billing_interval": "month" | "year";
  "max_members": number | null;
  "active": boolean;
  "created_at": string;
  "updated_at": string;
}

export interface DunningAction {
  "invoice_id": string;
  "number": string;
  "member_id": string;
  "amount_cents": number;
  "days_overdue": number;
  "current_level": number;
  "proposed_stage": number;
  "proposed_level": number;
  "escalation": boolean;
  "action": "auto" | "pending_approval" | "none";
}

export interface DunningRunResult {
  "club_id": string;
  "dry_run": boolean;
  "as_of": string;
  "timeline_days": number[];
  "actions": DunningAction[];
  "applied": number;
  "summary": { "auto": number; "pending_approval": number; "none": number };
}

export interface DunningRunRequest {
  "dry_run"?: boolean;
  "as_of"?: string;
}

