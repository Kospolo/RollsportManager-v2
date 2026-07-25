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
  "settings": Record<string, unknown>;
  "logo_asset_id": string | null;
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

export interface ClubJoinCode {
  "club_id": string;
  "join_code": string | null;
  "join_code_expires_at": string | null;
  "join_code_revoked_at": string | null;
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

export type MemberStatus = "pending" | "rejected" | "active" | "inactive" | "left";
export const MemberStatusValues: readonly MemberStatus[] = ["pending", "rejected", "active", "inactive", "left"] as const;

export type ProfileVisibility = "public" | "internal";
export const ProfileVisibilityValues: readonly ProfileVisibility[] = ["public", "internal"] as const;

export interface ClubMember {
  "id": string;
  "club_id": string;
  "profile_id": string | null;
  "first_name": string;
  "last_name": string;
  "email": string | null;
  "birth_date": string | null;
  "phone": string | null;
  "postal_address": string | null;
  "role": ClubRole;
  "status": MemberStatus;
  "joined_on": string | null;
  "valid_until": string | null;
  "avatar_url": string | null;
  "team_ids": string[];
  "profile_motto": string | null;
  "profile_favorite_discipline": string | null;
  "profile_skating_since": number | null;
  "profile_visibility"?: ProfileVisibility;
  "created_at": string;
  "updated_at": string;
}

export interface ClubRegistrationResult {
  "club": Club;
  "member": ClubMember;
  "join_code": string;
  "trial_ends_at": string;
}

export interface ClubRegistration {
  "name": string;
  "city": string;
  "short_name"?: string;
  "discipline"?: string;
  "accept_terms": boolean;
  "accept_privacy": boolean;
}

export interface ClubJoinResult {
  "club_id": string;
  "club_name": string;
  "member_id": string;
  "status": MemberStatus;
}

export interface ClubJoinInput {
  "code": string;
  "first_name": string;
  "last_name": string;
  "accept_terms": boolean;
  "accept_privacy": boolean;
}

export interface ClubJoinCodeRotated {
  "club_id": string;
  "join_code": string;
  "join_code_expires_at": string | null;
  "previous_code_valid_until": string | null;
}

export interface ClubJoinCodeRotateInput {
  "expires_in_days"?: number | null;
  "overlap_hours"?: number;
}

export interface ClubJoinCodeRevoked {
  "club_id": string;
  "join_code_revoked_at": string;
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
  "phone"?: string | null;
  "postal_address"?: string | null;
  "status"?: MemberStatus;
  "valid_until"?: string | null;
}

export interface ClubMemberRoleChange {
  "role": AssignableClubRole;
}

export interface ClubMemberSelfProfileUpdate {
  "motto"?: string | null;
  "favorite_discipline"?: string | null;
  "skating_since"?: number | null;
  "visibility"?: ProfileVisibility;
}

export interface InvitationInfo {
  "club_name": string;
  "role": ClubRole;
}

export interface InvitationAcceptResult {
  "club_id": string;
  "club_name": string;
  "member_id": string;
  "status": MemberStatus;
}

export interface InvitationAcceptInput {
  "first_name": string;
  "last_name": string;
  "accept_terms": boolean;
  "accept_privacy": boolean;
}

export interface MemberRoleRef {
  "role_id": string;
  "key": string;
  "name_de": string;
  "name_en": string;
}

export interface MemberDepartmentRef {
  "id": string;
  "name": string;
  "is_lead": boolean;
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
  "image_asset_id": string | null;
  "audio_url": string | null;
  "image_url": string | null;
  "skater_member_ids": string[];
  "waveform_peaks": number[] | null;
  "created_at": string;
  "updated_at": string;
}

export type CompetitionEntryStatus = "registered" | "confirmed" | "withdrawn";
export const CompetitionEntryStatusValues: readonly CompetitionEntryStatus[] = ["registered", "confirmed", "withdrawn"] as const;

export interface CompetitionEntry {
  "id": string;
  "member_id": string;
  "routine_id": string | null;
  "status": CompetitionEntryStatus;
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
  "placement": number | null;
  "note": string | null;
}

export interface MemberProfileCompetition {
  "entries": CompetitionEntry[];
  "scores": RoutineScore[];
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

export interface DutyRequirement {
  "id": string;
  "club_id": string;
  "team_id": string | null;
  "member_id": string | null;
  "season_label": string;
  "required_hours": number | null;
  "period_start": string;
  "period_end": string;
  "cost_per_hour_cents": number | null;
  "created_at": string;
  "updated_at": string;
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

export interface MemberProfileDuty {
  "requirements": DutyRequirement[];
  "entries": DutyEntry[];
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

export type InvoiceStatus = "draft" | "open" | "partially_paid" | "paid" | "cancelled";
export const InvoiceStatusValues: readonly InvoiceStatus[] = ["draft", "open", "partially_paid", "paid", "cancelled"] as const;

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
  "dunning_fee_cents": number | null;
  "dunning_interest_cents": number | null;
  "total_cents": number | null;
  "vat_total_cents": number | null;
  "paid_cents": number | null;
  "open_cents": number | null;
  "issued_on": string | null;
  "due_on": string | null;
  "paid_at": string | null;
  "paid_via": string | null;
  "created_at": string;
  "updated_at": string;
}

export type MembershipPeriod = "monthly" | "quarterly" | "yearly" | "once";
export const MembershipPeriodValues: readonly MembershipPeriod[] = ["monthly", "quarterly", "yearly", "once"] as const;

export interface MemberFee {
  "id": string;
  "club_id": string;
  "member_id": string;
  "category_id": string;
  "custom_amount_cents": number | null;
  "valid_from": string;
  "valid_until": string | null;
  "created_at": string;
  "updated_at": string;
  "deleted_at": string | null;
  "category_name"?: string | null;
  "category_amount_cents"?: number | null;
  "category_period"?: MembershipPeriod;
}

export type SepaMandateStatus = "active" | "revoked";
export const SepaMandateStatusValues: readonly SepaMandateStatus[] = ["active", "revoked"] as const;

export interface SepaMandate {
  "id": string;
  "club_id": string;
  "member_id": string;
  "mandate_reference": string;
  "iban_last4": string | null;
  "account_holder": string;
  "signed_on": string | null;
  "status": SepaMandateStatus;
  "created_at": string;
  "updated_at": string;
  "deleted_at": string | null;
}

export interface Donation {
  "id": string;
  "club_id": string;
  "member_id": string | null;
  "donor_name": string;
  "donor_address": string | null;
  "amount_cents": number | null;
  "donation_date": string;
  "receipt_number": string;
  "purpose": string | null;
  "issued_at": string | null;
  "created_at": string;
  "updated_at": string;
  "deleted_at": string | null;
}

export interface MemberProfileFinance {
  "invoices": Invoice[];
  "member_fees": MemberFee[];
  "sepa_mandates": SepaMandate[];
  "donations": Donation[];
}

export interface MemberAssessment {
  "id": string;
  "club_id": string;
  "member_id": string;
  "author_member_id": string;
  "body": string;
  "rating_technik": number | null;
  "rating_ausdruck": number | null;
  "assessed_on": string;
  "created_at": string;
  "updated_at": string;
}

export type GalleryKind = "photo" | "video";
export const GalleryKindValues: readonly GalleryKind[] = ["photo", "video"] as const;

export interface MemberPhoto {
  "tag_id": string;
  "gallery_item_id": string;
  "member_id": string;
  "album": string | null;
  "title": string;
  "kind": GalleryKind;
  "storage_key": string;
  "content_type": string;
  "thumbnail_key": string | null;
  "tagged_at": string;
}

export type ConsentPurpose = "terms" | "privacy" | "photos_internal" | "photos_public" | "chat" | "newsletter";
export const ConsentPurposeValues: readonly ConsentPurpose[] = ["terms", "privacy", "photos_internal", "photos_public", "chat", "newsletter"] as const;

export interface EffectiveConsent {
  "id": string;
  "club_id": string;
  "member_id": string | null;
  "subject_profile_id": string | null;
  "purpose": ConsentPurpose;
  "granted_by_profile_id": string;
  "legal_document_id": string | null;
  "policy_version": string | null;
  "recorded_at": string;
  "effective": boolean;
  "recorded_granted": boolean;
  "granted_by_guardian": boolean;
  "state": "valid" | "revoked" | "expired_age_16";
}

export interface MemberProfile {
  "member": ClubMember;
  "contact_visible": boolean;
  "admin_contact_visible": boolean;
  "self_profile_visible": boolean;
  "joined_on_visible": boolean;
  "roles": MemberRoleRef[];
  "departments": MemberDepartmentRef[];
  "routines": Routine[] | null;
  "competition"?: MemberProfileCompetition;
  "achievements": Achievement[] | null;
  "attendance": Attendance[] | null;
  "checkins": Checkin[] | null;
  "duty"?: MemberProfileDuty;
  "rsvps": EventRsvp[] | null;
  "equipment": EquipmentReservation[] | null;
  "finance"?: MemberProfileFinance;
  "assessments": MemberAssessment[] | null;
  "photos": MemberPhoto[] | null;
  "consents": EffectiveConsent[] | null;
}

export interface ChildCreated {
  "child": ClubMember;
  "guardianship": Guardianship;
}

export interface ChildCreate {
  "first_name": string;
  "last_name": string;
  "birth_date"?: string;
  "joined_on"?: string;
  "guardian_member_id"?: string;
  "relation"?: "parent" | "guardian" | "other";
}

export interface GuardianshipCreate {
  "child_member_id": string;
  "guardian_member_id"?: string;
  "relation"?: "parent" | "guardian" | "other";
}

export interface Deleted {
  "status": "deleted";
  "id": string;
}

export type RealConsentPurpose = "photos_internal" | "photos_public" | "chat" | "newsletter";
export const RealConsentPurposeValues: readonly RealConsentPurpose[] = ["photos_internal", "photos_public", "chat", "newsletter"] as const;

export interface ConsentDeclare {
  "member_id": string;
  "purpose": RealConsentPurpose;
  "granted": boolean;
  "policy_version"?: string;
}

export type WaitlistKind = "facility" | "equipment" | "team" | "event";
export const WaitlistKindValues: readonly WaitlistKind[] = ["facility", "equipment", "team", "event"] as const;

export type WaitlistStatus = "waiting" | "offered" | "fulfilled" | "cancelled";
export const WaitlistStatusValues: readonly WaitlistStatus[] = ["waiting", "offered", "fulfilled", "cancelled"] as const;

export interface Waitlist {
  "id": string;
  "club_id": string;
  "member_id": string;
  "kind": WaitlistKind;
  "target_id": string | null;
  "note": string | null;
  "status": WaitlistStatus;
  "created_at": string;
  "updated_at": string;
}

export interface WaitlistCreate {
  "club_id": string;
  "member_id": string;
  "kind": WaitlistKind;
  "target_id"?: string | null;
  "note"?: string | null;
}

export interface WaitlistUpdate {
  "status"?: WaitlistStatus;
  "note"?: string | null;
}

export interface Budget {
  "id": string;
  "club_id": string;
  "year": number | null;
  "category_id": string;
  "planned_cents": number | null;
  "note": string | null;
  "created_at": string;
  "updated_at": string;
}

export interface BudgetCreate {
  "club_id": string;
  "year": number;
  "category_id": string;
  "planned_cents": number | null;
  "note"?: string | null;
}

export interface BudgetUpdate {
  "planned_cents"?: number | null;
  "note"?: string | null;
}

export type LedgerCategoryKind = "income" | "expense";
export const LedgerCategoryKindValues: readonly LedgerCategoryKind[] = ["income", "expense"] as const;

export interface BudgetReportRow {
  "category_id": string;
  "category_name": string | null;
  "kind": LedgerCategoryKind;
  "planned_cents": number | null;
  "actual_cents": number | null;
  "variance_cents": number | null;
}

export interface BudgetReport {
  "club_id": string;
  "year": number | null;
  "rows": BudgetReportRow[];
  "planned_total_cents": number | null;
  "actual_total_cents": number | null;
  "variance_total_cents": number | null;
}

export interface MeMembership {
  "id": string;
  "club_id": string;
  "club_name": string;
  "club_short_name": string | null;
  "first_name": string;
  "last_name": string;
  "email": string | null;
  "birth_date": string | null;
  "phone": string | null;
  "postal_address": string | null;
  "role": ClubRole;
  "status": MemberStatus;
  "joined_on": string | null;
  "valid_until": string | null;
  "avatar_url": string | null;
  "created_at": string;
  "updated_at": string;
}

export interface Me {
  "profile_id": string;
  "display_name": string | null;
  "locale": string;
  "memberships": MeMembership[];
}

export interface MeUpdate {
  "first_name"?: string;
  "last_name"?: string;
  "email"?: string | null;
  "birth_date"?: string | null;
  "phone"?: string | null;
  "postal_address"?: string | null;
}

export type ThemePreference = "light" | "dark" | "auto";
export const ThemePreferenceValues: readonly ThemePreference[] = ["light", "dark", "auto"] as const;

export interface NotificationPrefs {
  "events"?: boolean;
  "invoices"?: boolean;
  "news"?: boolean;
  "chat"?: boolean;
}

export interface UserPreferences {
  "profile_id": string;
  "locale": string;
  "theme": ThemePreference;
  "notifications": NotificationPrefs;
  "updated_at": string;
}

export interface UserPreferencesUpdate {
  "locale"?: string;
  "theme"?: ThemePreference;
  "notifications"?: NotificationPrefs;
}

export type CapabilityLevel = "none" | "read_own" | "read_team" | "read_all" | "edit" | "manage";
export const CapabilityLevelValues: readonly CapabilityLevel[] = ["none", "read_own", "read_team", "read_all", "edit", "manage"] as const;

export type CapabilityEnforcement = "enforced" | "partial" | "write_only" | "unenforced";
export const CapabilityEnforcementValues: readonly CapabilityEnforcement[] = ["enforced", "partial", "write_only", "unenforced"] as const;

export interface ResolvedCapability {
  "capability_key": string;
  "label_de": string;
  "label_en": string;
  "allowed_levels": CapabilityLevel[];
  "sort": number;
  "rank": number;
  "level": CapabilityLevel;
  "owner_only": boolean;
  "enforcement": CapabilityEnforcement;
}

export interface CapabilityResolution {
  "club_id": string;
  "role_keys": string[];
  "is_platform_admin": boolean;
  "capabilities": ResolvedCapability[];
}

export interface Capability {
  "key": string;
  "label_de": string;
  "label_en": string;
  "allowed_levels": CapabilityLevel[];
  "sort": number;
  "owner_only": boolean;
  "enforcement": CapabilityEnforcement;
}

export interface MemberRoleAssignment {
  "member_id": string;
  "role_ids": string[];
}

export interface ClubRoleDef {
  "id": string;
  "club_id": string;
  "key": string;
  "name_de": string;
  "name_en": string;
  "is_system": boolean;
  "protected": boolean;
  "sort": number;
  "created_at": string;
  "updated_at": string;
}

export interface RolePermission {
  "capability_key": string;
  "level": CapabilityLevel;
}

export interface ClubRoleDefCreate {
  "key": string;
  "name_de": string;
  "name_en": string;
  "sort"?: number;
}

export interface ClubRoleDefUpdate {
  "name_de"?: string;
  "name_en"?: string;
  "sort"?: number;
}

export interface RolePermissionSet {
  "permissions": RolePermission[];
}

export interface MemberRolesSet {
  "role_ids": string[];
}

export interface TeamCoachesSet {
  "member_ids": string[];
}

export interface ClubModuleState {
  "module_key": string;
  "label_de": string;
  "label_en": string;
  "desc_de": string;
  "desc_en": string;
  "sort": number;
  "core": boolean;
  "requires_pro": boolean;
  "enforcement": "enforced" | "partial" | "menu_only" | null;
  "default_enabled": boolean;
  "enabled": boolean;
  "pro_ok": boolean;
  "available": boolean;
}

export interface ClubModuleSet {
  "enabled": boolean;
}

export interface EffectiveModule {
  "module_key": string;
  "label_de": string;
  "label_en": string;
  "desc_de": string;
  "desc_en": string;
  "sort": number;
  "core": boolean;
  "requires_pro": boolean;
  "enforcement": "enforced" | "partial" | "menu_only" | null;
  "default_enabled": boolean;
  "enabled": boolean;
  "pro_ok": boolean;
  "available": boolean;
  "visible": boolean;
  "visibility_source": string;
}

export type ModuleVisibilityScope = "role" | "department" | "member";
export const ModuleVisibilityScopeValues: readonly ModuleVisibilityScope[] = ["role", "department", "member"] as const;

export interface ModuleVisibilityRow {
  "module_key": string;
  "scope": ModuleVisibilityScope;
  "target_id": string;
  "target_label": string;
  "default_visible": boolean | null;
  "override": boolean | null;
  "effective": boolean;
}

export interface ModuleVisibilitySet {
  "scope": ModuleVisibilityScope;
  "target_id": string;
  "visible": boolean | null;
}

export interface Team {
  "id": string;
  "club_id": string;
  "name": string;
  "age_group": string | null;
  "sparte_id": string | null;
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

export interface TeamMembersSet {
  "skater_member_ids"?: string[];
  "coach_member_ids"?: string[];
}

export interface Sparte {
  "id": string;
  "club_id": string;
  "name": string;
  "icon": string | null;
  "farbe": string | null;
  "aktiv": boolean;
  "sortierung": number;
  "eigene_finanzen": boolean;
  "member_ids": string[];
  "created_at": string;
  "updated_at": string;
}

export interface SparteCreate {
  "name": string;
  "icon"?: string | null;
  "farbe"?: string | null;
  "aktiv"?: boolean;
  "sortierung"?: number;
  "eigene_finanzen"?: boolean;
}

export interface SparteUpdate {
  "name"?: string;
  "icon"?: string | null;
  "farbe"?: string | null;
  "aktiv"?: boolean;
  "sortierung"?: number;
  "eigene_finanzen"?: boolean;
}

export interface SparteMembersSet {
  "member_ids"?: string[];
}

export interface TeamSparteSet {
  "sparte_id": string | null;
}

export interface PlatformClub {
  "id": string;
  "name": string;
  "short_name": string | null;
  "city": string | null;
  "discipline": string | null;
  "member_count": number | null;
  "logo_asset_id": string | null;
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

export interface PlatformSmtp {
  "host": string;
  "port": number | null;
  "user": string;
  "from": string;
  "secure": boolean;
  "password_set": boolean;
}

export interface PlatformLegal {
  "impressum": string;
  "impressum_en": string;
  "datenschutz": string;
  "datenschutz_en": string;
  "agb": string;
  "agb_en": string;
}

export interface PlatformContent {
  "website_title": string;
  "website_subtitle": string;
  "seo_title": string;
  "seo_description": string;
  "seo_keywords": string;
}

export interface PlatformSettings {
  "smtp": PlatformSmtp;
  "legal": PlatformLegal;
  "content": PlatformContent;
  "feature_flags": Record<string, unknown>;
  "updated_at": string;
}

export interface PlatformSmtpPatch {
  "host"?: string;
  "port"?: number;
  "user"?: string;
  "from"?: string;
  "secure"?: boolean;
  "password"?: string;
}

export interface PlatformLegalPatch {
  "impressum"?: string;
  "impressum_en"?: string;
  "datenschutz"?: string;
  "datenschutz_en"?: string;
  "agb"?: string;
  "agb_en"?: string;
}

export interface PlatformContentPatch {
  "website_title"?: string;
  "website_subtitle"?: string;
  "seo_title"?: string;
  "seo_description"?: string;
  "seo_keywords"?: string;
}

export interface PlatformSettingsPatch {
  "smtp"?: PlatformSmtpPatch;
  "legal"?: PlatformLegalPatch;
  "content"?: PlatformContentPatch;
  "feature_flags"?: Record<string, unknown>;
}

export interface SmtpTestResponse {
  "ok": boolean;
  "mode": "sent" | "dry-run" | "error";
  "detail": string;
  "message_id"?: string;
  "preview"?: { "subject": string; "text": string };
}

export interface SmtpTestRequest {
  "recipient": string;
  "dry_run"?: boolean;
}

export interface PlatformEntitlementRow {
  "club_id": string;
  "club_name": string;
  "short_name": string | null;
  "member_count": number | null;
  "entitlement_id": string | null;
  "tier": string | null;
  "status": string | null;
  "source": "stripe" | "revenuecat" | "manual" | null;
  "provider_ref": string | null;
  "valid_until": string | null;
  "updated_at": string | null;
}

export type PlatformTier = "basic" | "pro" | "premium";
export const PlatformTierValues: readonly PlatformTier[] = ["basic", "pro", "premium"] as const;

export type PlatformEntitlementStatus = "trial" | "active" | "past_due" | "canceled";
export const PlatformEntitlementStatusValues: readonly PlatformEntitlementStatus[] = ["trial", "active", "past_due", "canceled"] as const;

export interface PlatformEntitlementPatch {
  "tier": PlatformTier;
  "status": PlatformEntitlementStatus;
  "valid_until"?: string | null;
  "trial_days"?: number;
  "reason"?: string;
}

export interface PlatformPaymentEvent {
  "id": string;
  "provider": string;
  "event_id": string;
  "event_type": string | null;
  "status": string;
  "error": string | null;
  "received_at": string;
  "processed_at": string | null;
}

export interface PlatformSubscriptionSummary {
  "active": number | null;
  "trial": number | null;
  "past_due": number | null;
  "canceled": number | null;
  "licensed_clubs": number | null;
}

export interface PlatformPaymentsPage {
  "total": number | null;
  "limit": number | null;
  "offset": number | null;
}

export interface PlatformPayments {
  "events": PlatformPaymentEvent[];
  "subscription_summary": PlatformSubscriptionSummary;
  "page": PlatformPaymentsPage;
}

export interface PlatformProduct {
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

export interface PlatformProductPatch {
  "price_cents"?: number;
  "active"?: boolean;
  "name"?: string;
  "description"?: string | null;
}

export interface PlatformRoutineRow {
  "id": string;
  "club_id": string;
  "club_name": string;
  "title": string;
  "status": "draft" | "ready" | "competition" | "archived";
  "category": string | null;
  "music_title": string | null;
  "music_artist": string | null;
  "music_duration_ms": number | null;
  "audio_asset_id": string | null;
  "audio_mime_type": string | null;
  "audio_size_bytes": number | null;
  "skater_count": number | null;
  "created_at": string;
  "updated_at": string;
}

export interface PlatformSystemDb {
  "clubs": number | null;
  "users": number | null;
  "members": number | null;
  "active_entitlements": number | null;
  "webhook_events": number | null;
  "size_bytes": number | null;
  "size_pretty": string;
}

export interface PlatformSystemMigrations {
  "count": number | null;
  "latest": string | null;
  "list": string[];
}

export interface PlatformSystemHealth {
  "status": "ok";
  "db_time": string;
}

export interface PlatformSystem {
  "app_version": string;
  "auth_mode": "dev" | "prod";
  "db": PlatformSystemDb;
  "migrations": PlatformSystemMigrations;
  "health": PlatformSystemHealth;
}

export type EventType = "training" | "competition" | "other";
export const EventTypeValues: readonly EventType[] = ["training", "competition", "other"] as const;

export type EventAudience = "teams" | "club";
export const EventAudienceValues: readonly EventAudience[] = ["teams", "club"] as const;

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
  "audience": EventAudience;
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
  "audience"?: EventAudience;
  "team_ids"?: string[];
}

export interface EventUpdate {
  "type"?: EventType;
  "title"?: string;
  "note"?: string | null;
  "location"?: string | null;
  "starts_at"?: string;
  "ends_at"?: string;
  "audience"?: EventAudience;
  "team_ids"?: string[];
}

export interface EventRsvpUpsert {
  "member_id": string;
  "status": RsvpStatus;
  "comment"?: string;
}

export interface AttendanceUpsert {
  "member_id": string;
  "status": AttendanceStatus;
  "checked_in_at"?: string;
}

export type EventRideStatus = "offen" | "voll" | "abgesagt";
export const EventRideStatusValues: readonly EventRideStatus[] = ["offen", "voll", "abgesagt"] as const;

export type EventRideRiderStatus = "zugesagt" | "abgesagt";
export const EventRideRiderStatusValues: readonly EventRideRiderStatus[] = ["zugesagt", "abgesagt"] as const;

export interface EventRideRider {
  "id": string;
  "ride_id": string;
  "member_id": string;
  "member_first_name": string;
  "member_last_name": string;
  "angemeldet_von_profile_id": string | null;
  "status": EventRideRiderStatus;
  "created_at": string;
  "updated_at": string;
}

export interface EventRide {
  "id": string;
  "club_id": string;
  "event_id": string;
  "driver_member_id": string;
  "driver_first_name": string;
  "driver_last_name": string;
  "abfahrtsort": string;
  "abfahrtszeit": string;
  "plaetze_gesamt": number;
  "plaetze_frei": number;
  "notiz": string | null;
  "status": EventRideStatus;
  "rueckrufnummer": string | null;
  "kontakt_sichtbar": boolean;
  "riders": EventRideRider[];
  "created_at": string;
  "updated_at": string;
}

export interface EventRideCreate {
  "driver_member_id"?: string;
  "abfahrtsort": string;
  "abfahrtszeit": string;
  "plaetze_gesamt": number;
  "notiz"?: string | null;
  "rueckrufnummer"?: string | null;
}

export interface EventRideUpdate {
  "abfahrtsort"?: string;
  "abfahrtszeit"?: string;
  "plaetze_gesamt"?: number;
  "notiz"?: string | null;
  "rueckrufnummer"?: string | null;
  "status"?: "offen" | "abgesagt";
}

export interface EventRideRiderCreate {
  "member_id": string;
}

export interface EventRideRiderUpdate {
  "status": EventRideRiderStatus;
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

export interface RoutineScoreCreate {
  "scored_on": string;
  "scoring_system"?: string;
  "technical_score"?: number;
  "components_score"?: number;
  "total_score"?: number;
  "competition_id"?: string;
  "placement"?: number;
  "note"?: string;
}

export interface RoutineShareCreated {
  "token": string;
  "url": string;
  "expires_at": string | null;
}

export interface RoutineShareCreate {
  "expires_at"?: string;
}

export interface RoutineShareRevoked {
  "revoked": boolean;
}

export type CompetitionStatus = "upcoming" | "running" | "done" | "cancelled";
export const CompetitionStatusValues: readonly CompetitionStatus[] = ["upcoming", "running", "done", "cancelled"] as const;

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

export interface CompetitionStandingRow {
  "category": string;
  "rank": number | null;
  "entry_id": string;
  "member_id": string;
  "first_name": string | null;
  "last_name": string | null;
  "routine_id": string;
  "routine_title": string;
  "technical_score": number | null;
  "components_score": number | null;
  "total_score": number | null;
  "placement": number | null;
  "delta": number | null;
}

export interface CompetitionStandings {
  "competition_id": string;
  "name": string;
  "rows": CompetitionStandingRow[];
}

export interface PublicRoutine {
  "title": string;
  "discipline": string | null;
  "club_name": string;
  "music_title": string | null;
  "music_artist": string | null;
  "music_bpm": number | null;
  "music_duration_ms": number | null;
  "markers": { "time_ms": number | null; "label": string; "element_code": string | null }[];
  "scores": { "scored_on": string; "technical_score": number | null; "components_score": number | null; "total_score": number | null; "placement": number | null }[];
}

export interface PublicLegal {
  "impressum": { "de": string; "en": string };
  "datenschutz": { "de": string; "en": string };
  "agb": { "de": string; "en": string };
}

export interface LoginResponse {
  "token_type": "Bearer";
  "access_token": string;
  "expires_in": number;
  "profile": { "sub": string; "email": string; "is_platform_admin": boolean };
}

export interface LoginRequest {
  "email": string;
  "password": string;
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

export interface MemberAssessmentCreate {
  "club_id": string;
  "member_id": string;
  "body": string;
  "rating_technik"?: number;
  "rating_ausdruck"?: number;
  "assessed_on"?: string;
}

export interface MemberAssessmentUpdate {
  "body"?: string;
  "rating_technik"?: number | null;
  "rating_ausdruck"?: number | null;
  "assessed_on"?: string;
}

export interface MemberCoachNote {
  "id": string;
  "club_id": string;
  "member_id": string;
  "author_member_id": string;
  "body": string;
  "created_at": string;
  "updated_at": string;
}

export interface MemberCoachNoteCreate {
  "club_id": string;
  "member_id": string;
  "body": string;
}

export interface MemberCoachNoteUpdate {
  "body": string;
}

export type SupportTicketStatus = "open" | "in_progress" | "waiting_on_club" | "closed";
export const SupportTicketStatusValues: readonly SupportTicketStatus[] = ["open", "in_progress", "waiting_on_club", "closed"] as const;

export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";
export const SupportTicketPriorityValues: readonly SupportTicketPriority[] = ["low", "normal", "high", "urgent"] as const;

export type SupportActor = "club" | "platform";
export const SupportActorValues: readonly SupportActor[] = ["club", "platform"] as const;

export interface SupportTicket {
  "id": string;
  "club_id": string;
  "club_name": string | null;
  "created_by_member_id": string;
  "created_by_name": string | null;
  "subject": string;
  "status": SupportTicketStatus;
  "priority": SupportTicketPriority;
  "last_reply_at": string | null;
  "last_reply_by": SupportActor;
  "message_count": number;
  "closed_at": string | null;
  "created_at": string;
  "updated_at": string;
}

export interface SupportMessage {
  "id": string;
  "ticket_id": string;
  "club_id": string;
  "author_profile_id": string;
  "author_name": string | null;
  "author_kind": SupportActor;
  "body": string;
  "created_at": string;
}

export interface SupportTicketDetail {
  "id": string;
  "club_id": string;
  "club_name": string | null;
  "created_by_member_id": string;
  "created_by_name": string | null;
  "subject": string;
  "status": SupportTicketStatus;
  "priority": SupportTicketPriority;
  "last_reply_at": string | null;
  "last_reply_by": SupportActor;
  "message_count": number;
  "closed_at": string | null;
  "created_at": string;
  "updated_at": string;
  "messages": SupportMessage[];
}

export interface SupportTicketCreate {
  "club_id": string;
  "subject": string;
  "body": string;
}

export interface SupportMessageCreate {
  "body": string;
}

export interface SupportTicketUpdate {
  "status"?: SupportTicketStatus;
  "priority"?: SupportTicketPriority;
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

export interface DutyRequirementCreate {
  "club_id": string;
  "season_label": string;
  "required_hours": number;
  "period_start": string;
  "period_end": string;
  "team_id"?: string;
  "member_id"?: string;
  "cost_per_hour_cents"?: number | null;
}

export interface DutyRequirementUpdate {
  "season_label"?: string;
  "required_hours"?: number;
  "period_start"?: string;
  "period_end"?: string;
  "team_id"?: string | null;
  "member_id"?: string | null;
  "cost_per_hour_cents"?: number | null;
}

export interface DutyBuyout {
  "requirement_id": string;
  "member_id": string;
  "required_hours": number | null;
  "done_hours": number | null;
  "missing_hours": number | null;
  "cost_per_hour_cents": number | null;
  "buyout_cents": number | null;
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

export interface GalleryItem {
  "id": string;
  "club_id": string;
  "album": string | null;
  "title": string;
  "kind": GalleryKind;
  "storage_key": string;
  "content_type": string;
  "size_bytes": number | null;
  "thumbnail_key": string | null;
  "uploaded_by_member_id": string;
  "created_at": string;
}

export interface GalleryItemCreate {
  "club_id": string;
  "title": string;
  "kind": GalleryKind;
  "storage_key": string;
  "content_type": string;
  "size_bytes": number;
  "album"?: string;
  "thumbnail_key"?: string;
}

export interface PhotoTag {
  "id": string;
  "club_id": string;
  "gallery_item_id": string;
  "member_id": string;
  "tagged_by_member_id": string;
  "created_at": string;
}

export interface PhotoTagCreate {
  "club_id": string;
  "gallery_item_id": string;
  "member_id": string;
}

export interface Document {
  "id": string;
  "club_id": string;
  "title": string;
  "category": string;
  "storage_key": string;
  "content_type": string;
  "size_bytes": number | null;
  "uploaded_by_member_id": string;
  "created_at": string;
  "updated_at": string;
}

export interface DocumentCreate {
  "club_id": string;
  "title": string;
  "storage_key": string;
  "content_type": string;
  "size_bytes": number;
  "category"?: string;
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

export interface AnnualCategoryRow {
  "category_id": string | null;
  "category_name": string | null;
  "kind": LedgerCategoryKind;
  "amount_cents": number | null;
}

export interface AnnualYearTotals {
  "year": number | null;
  "income_cents": number | null;
  "expense_cents": number | null;
  "net_cents": number | null;
}

export interface AnnualReport {
  "club_id": string;
  "year": number | null;
  "income_cents": number | null;
  "expense_cents": number | null;
  "net_cents": number | null;
  "by_category": AnnualCategoryRow[];
  "prev_year": AnnualYearTotals;
  "net_delta_cents": number | null;
  "donations_total_cents": number | null;
  "donations_count": number | null;
  "open_items_count": number | null;
  "open_items_total_cents": number | null;
}

export type AnniversaryKind = "membership" | "birthday";
export const AnniversaryKindValues: readonly AnniversaryKind[] = ["membership", "birthday"] as const;

export interface Anniversary {
  "member_id": string;
  "member_name": string;
  "kind": AnniversaryKind;
  "date": string;
  "years": number | null;
  "days_until": number;
}

export interface Department {
  "id": string;
  "club_id": string;
  "name": string;
  "description": string | null;
  "lead_member_id": string | null;
  "sort_order": number;
  "member_ids": string[];
  "created_at": string;
  "updated_at": string;
}

export interface DepartmentCreate {
  "club_id": string;
  "name": string;
  "description"?: string | null;
  "lead_member_id"?: string | null;
  "sort_order"?: number;
}

export interface DepartmentUpdate {
  "name"?: string;
  "description"?: string | null;
  "lead_member_id"?: string | null;
  "sort_order"?: number;
}

export interface DepartmentMembersSet {
  "member_ids"?: string[];
}

export type LockerStatus = "free" | "assigned" | "broken";
export const LockerStatusValues: readonly LockerStatus[] = ["free", "assigned", "broken"] as const;

export type LockerSize = "klein" | "mittel" | "gross";
export const LockerSizeValues: readonly LockerSize[] = ["klein", "mittel", "gross"] as const;

export interface Locker {
  "id": string;
  "club_id": string;
  "label": string;
  "location": string | null;
  "status": LockerStatus;
  "size": LockerSize;
  "price_per_month_cents": number | null;
  "has_active_rental": boolean;
  "assigned_member_id": string | null;
  "note": string | null;
  "created_at": string;
  "updated_at": string;
}

export interface LockerCreate {
  "club_id": string;
  "label": string;
  "location"?: string | null;
  "status"?: LockerStatus;
  "size"?: LockerSize;
  "price_per_month_cents"?: number | null;
  "assigned_member_id"?: string | null;
  "note"?: string | null;
}

export interface LockerUpdate {
  "label"?: string;
  "location"?: string | null;
  "status"?: LockerStatus;
  "size"?: LockerSize;
  "price_per_month_cents"?: number | null;
  "assigned_member_id"?: string | null;
  "note"?: string | null;
}

export interface LockerAssign {
  "member_id": string;
}

export type LockerRentalStatus = "aktiv" | "beendet" | "gekuendigt";
export const LockerRentalStatusValues: readonly LockerRentalStatus[] = ["aktiv", "beendet", "gekuendigt"] as const;

export interface LockerRental {
  "id": string;
  "club_id": string;
  "locker_id": string;
  "member_id": string;
  "price_per_month_cents": number | null;
  "start_on": string;
  "end_on": string | null;
  "status": LockerRentalStatus;
  "note": string | null;
  "created_at": string;
  "updated_at": string;
}

export interface LockerRentalCreate {
  "club_id": string;
  "locker_id": string;
  "member_id": string;
  "price_per_month_cents"?: number | null;
  "start_on": string;
  "end_on"?: string | null;
  "status"?: LockerRentalStatus;
  "note"?: string | null;
}

export interface LockerRentalUpdate {
  "price_per_month_cents"?: number | null;
  "start_on"?: string;
  "end_on"?: string | null;
  "status"?: LockerRentalStatus;
  "note"?: string | null;
}

export interface InvoiceCreate {
  "club_id": string;
  "member_id": string;
  "title": string;
  "amount_cents": number;
  "due_on"?: string;
  "issue"?: boolean;
}

export interface InvoiceUpdate {
  "status": "paid" | "partially_paid" | "cancelled";
  "paid_via"?: string;
  "post_to_ledger"?: boolean;
  "ledger_category_id"?: string;
  "paid_cents"?: number;
}

export interface InvoiceItem {
  "id": string;
  "club_id": string;
  "invoice_id": string;
  "sort_order": number | null;
  "description": string;
  "quantity": number | null;
  "unit_price_cents": number | null;
  "vat_rate": number | null;
  "net_cents": number | null;
  "vat_cents": number | null;
  "gross_cents": number | null;
  "created_at": string;
  "updated_at": string;
}

export interface InvoiceItemCreate {
  "club_id": string;
  "invoice_id": string;
  "sort_order"?: number;
  "description": string;
  "quantity": number;
  "unit_price_cents": number;
  "vat_rate"?: number;
}

export interface InvoiceItemUpdate {
  "sort_order"?: number;
  "description"?: string;
  "quantity"?: number;
  "unit_price_cents"?: number;
  "vat_rate"?: number;
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
  "category_id": string | null;
  "category_name"?: string | null;
  "category_kind"?: LedgerCategoryKind;
  "invoice_id": string | null;
  "reverses_entry_id": string | null;
  "created_at": string;
}

export interface LedgerEntryCreate {
  "club_id": string;
  "entry_on": string;
  "description": string;
  "counterparty_kind": CounterpartyKind;
  "counterparty_member_id"?: string;
  "counterparty_name"?: string;
  "amount_cents": number;
  "category"?: string;
  "category_id"?: string;
  "invoice_id"?: string;
}

export interface LedgerCategory {
  "id": string;
  "club_id": string;
  "name": string;
  "kind": LedgerCategoryKind;
  "sort_order": number | null;
  "created_at": string;
  "deleted_at": string | null;
}

export interface LedgerCategoryCreate {
  "club_id": string;
  "name": string;
  "kind": LedgerCategoryKind;
  "sort_order"?: number;
}

export interface LedgerReverse {
  "description"?: string;
}

export type BankTransactionStatus = "unmatched" | "matched" | "ignored";
export const BankTransactionStatusValues: readonly BankTransactionStatus[] = ["unmatched", "matched", "ignored"] as const;

export interface BankTransaction {
  "id": string;
  "club_id": string;
  "booked_on": string;
  "amount_cents": number | null;
  "purpose": string | null;
  "counterparty": string | null;
  "matched_invoice_id": string | null;
  "matched_ledger_entry_id": string | null;
  "status": BankTransactionStatus;
  "imported_at": string;
  "created_at": string;
  "updated_at": string;
  "deleted_at": string | null;
}

export interface BankTransactionCreate {
  "club_id": string;
  "booked_on": string;
  "amount_cents": number;
  "purpose"?: string;
  "counterparty"?: string;
}

export interface BankTransactionImportRow {
  "booked_on": string;
  "amount_cents": number;
  "purpose"?: string;
  "counterparty"?: string;
}

export interface BankTransactionImport {
  "club_id": string;
  "rows": BankTransactionImportRow[];
}

export interface BankTransactionMatch {
  "invoice_id": string;
  "post_to_ledger"?: boolean;
  "ledger_category_id"?: string;
}

export interface BankTransactionIgnore {
  "note"?: string;
}

export interface DonationCreate {
  "club_id": string;
  "member_id"?: string;
  "donor_name": string;
  "donor_address"?: string;
  "amount_cents": number;
  "donation_date": string;
  "purpose"?: string;
}

export interface DonationUpdate {
  "donor_name"?: string;
  "donor_address"?: string;
  "amount_cents"?: number;
  "donation_date"?: string;
  "purpose"?: string;
  "issue"?: boolean;
}

export interface DonationReceipt {
  "donation_id": string;
  "receipt_number": string;
  "club_name": string;
  "donor_name": string;
  "donor_address": string | null;
  "amount_cents": number | null;
  "amount_eur": string;
  "donation_date": string;
  "purpose": string | null;
  "issued": boolean;
  "text": string;
}

export interface MembershipCategory {
  "id": string;
  "club_id": string;
  "name": string;
  "amount_cents": number | null;
  "period": MembershipPeriod;
  "is_active": boolean;
  "sort_order": number | null;
  "created_at": string;
  "updated_at": string;
  "deleted_at": string | null;
}

export interface MembershipCategoryCreate {
  "club_id": string;
  "name": string;
  "amount_cents": number;
  "period": MembershipPeriod;
  "is_active"?: boolean;
  "sort_order"?: number;
}

export interface MembershipCategoryUpdate {
  "name"?: string;
  "amount_cents"?: number;
  "period"?: MembershipPeriod;
  "is_active"?: boolean;
  "sort_order"?: number;
}

export interface MemberFeeSummaryBucket {
  "period": MembershipPeriod;
  "count": number | null;
  "amount_cents": number | null;
  "annual_cents": number | null;
}

export interface MemberFeeSummary {
  "club_id": string;
  "by_period": MemberFeeSummaryBucket[];
  "total_annual_cents": number | null;
}

export interface MemberFeeCreate {
  "club_id": string;
  "member_id": string;
  "category_id": string;
  "custom_amount_cents"?: number;
  "valid_from": string;
  "valid_until"?: string;
}

export interface MemberFeeUpdate {
  "category_id"?: string;
  "custom_amount_cents"?: number | null;
  "valid_from"?: string;
  "valid_until"?: string | null;
}

export type FamilyDiscountKind = "percent" | "fixed";
export const FamilyDiscountKindValues: readonly FamilyDiscountKind[] = ["percent", "fixed"] as const;

export interface FamilyDiscount {
  "id": string;
  "club_id": string;
  "label": string;
  "kind": FamilyDiscountKind;
  "value_numeric": number | null;
  "applies_from_child": number | null;
  "is_active": boolean;
  "created_at": string;
  "updated_at": string;
  "deleted_at": string | null;
}

export interface FamilyDiscountCreate {
  "club_id": string;
  "label": string;
  "kind": FamilyDiscountKind;
  "value_numeric": number;
  "applies_from_child"?: number;
  "is_active"?: boolean;
}

export interface FamilyDiscountUpdate {
  "label"?: string;
  "kind"?: FamilyDiscountKind;
  "value_numeric"?: number;
  "applies_from_child"?: number;
  "is_active"?: boolean;
}

export interface SepaMandateCreate {
  "club_id": string;
  "member_id": string;
  "mandate_reference": string;
  "iban_last4"?: string;
  "account_holder": string;
  "signed_on"?: string;
  "status"?: SepaMandateStatus;
}

export interface SepaMandateUpdate {
  "mandate_reference"?: string;
  "iban_last4"?: string | null;
  "account_holder"?: string;
  "signed_on"?: string | null;
  "status"?: SepaMandateStatus;
}

export interface Entitlement {
  "id": string;
  "subject_type": "club" | "profile";
  "subject_id": string;
  "entitlement": string;
  "source": "stripe" | "revenuecat" | "manual";
  "product_id": string | null;
  "valid_until": string | null;
  "tier": string | null;
  "status": string | null;
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

export type DunningLogAction = "reminder" | "dunning" | "handover";
export const DunningLogActionValues: readonly DunningLogAction[] = ["reminder", "dunning", "handover"] as const;

export interface DunningSkip {
  "invoice_id": string;
  "reason": string;
}

export interface DunningLogEntry {
  "id": string;
  "club_id": string;
  "invoice_id": string;
  "from_stage": number | null;
  "to_stage": number | null;
  "action": DunningLogAction;
  "actor_member_id": string | null;
  "note": string | null;
  "fee_cents": number | null;
  "interest_cents": number | null;
  "created_at": string;
}

export interface DunningApplyResult {
  "club_id": string;
  "to_stage": number;
  "action": DunningLogAction;
  "applied": number;
  "skipped": DunningSkip[];
  "log": DunningLogEntry[];
}

export interface DunningApplyRequest {
  "invoice_ids": string[];
  "to_stage": number;
  "approve_escalation"?: boolean;
  "note"?: string;
  "fee_cents"?: number;
  "interest_cents"?: number;
}

