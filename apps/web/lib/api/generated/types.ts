// GENERIERT — NICHT VON HAND AENDERN
//
// Generated from packages/contracts/openapi.json (RollsportManager v2 API v0.1.0).
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

export type ClubRole = "owner" | "admin" | "treasurer" | "coach" | "member" | "guest_coach";
export const ClubRoleValues: readonly ClubRole[] = ["owner", "admin", "treasurer", "coach", "member", "guest_coach"] as const;

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
  "created_at": string;
  "updated_at": string;
}

export type AssignableClubRole = "admin" | "treasurer" | "coach" | "member" | "guest_coach";
export const AssignableClubRoleValues: readonly AssignableClubRole[] = ["admin", "treasurer", "coach", "member", "guest_coach"] as const;

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

export interface ClubMemberRoleChange {
  "role": AssignableClubRole;
}

export type EventType = "training" | "competition" | "other";
export const EventTypeValues: readonly EventType[] = ["training", "competition", "other"] as const;

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

