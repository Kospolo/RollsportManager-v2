// ============================================================================
// lib/validation.ts - shared Zod schemas (request AND response typing).
// Everything the OpenAPI spec exposes lives here so the codegen (Blueprint
// ADR-E1) sees one consistent vocabulary. snake_case on the wire, matching
// the database (ADR-E7) - clients get generated types anyway.
// ============================================================================

import { z } from '@hono/zod-openapi';
import { CLUB_ROLES } from '../middleware/auth.js';

export const uuid = z.string().uuid();

export const clubRoleSchema = z.enum(CLUB_ROLES).openapi('ClubRole');

/** Roles assignable through the API. `owner` transfers are a dedicated,
 *  deliberately unimplemented flow (Phase 2) - never a plain role PATCH.
 *  `moderator` IS assignable (owner/admin may grant it; see can_change_member_role). */
export const assignableRoleSchema = z
  .enum(['admin', 'moderator', 'treasurer', 'coach', 'member', 'guest_coach'])
  .openapi('AssignableClubRole');

export const memberStatusSchema = z.enum(['pending', 'active', 'inactive', 'left']).openapi('MemberStatus');
export const eventTypeSchema = z.enum(['training', 'competition', 'other']).openapi('EventType');
export const rsvpStatusSchema = z.enum(['going', 'declined', 'maybe', 'sick']).openapi('RsvpStatus');
export const attendanceStatusSchema = z.enum(['present', 'late', 'excused', 'absent']).openapi('AttendanceStatus');
export const routineStatusSchema = z.enum(['draft', 'ready', 'competition', 'archived']).openapi('RoutineStatus');
export const invoiceStatusSchema = z.enum(['draft', 'open', 'paid', 'cancelled']).openapi('InvoiceStatus');
export const competitionStatusSchema = z.enum(['upcoming', 'running', 'done', 'cancelled']).openapi('CompetitionStatus');
export const entryStatusSchema = z.enum(['registered', 'confirmed', 'withdrawn']).openapi('CompetitionEntryStatus');
export const counterpartyKindSchema = z.enum(['person', 'org']).openapi('CounterpartyKind');

const timestamp = z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v.toISOString() : v));
const isoDate = z.string(); // plain DATE columns come back as 'YYYY-MM-DD'

export const problemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    request_id: z.string().optional(),
  })
  .openapi('Problem');

// ---------------------------------------------------------------------------
// Entities (wire shape = DB shape; snake_case)
// ---------------------------------------------------------------------------

export const clubSchema = z
  .object({
    id: uuid,
    name: z.string(),
    short_name: z.string().nullable(),
    city: z.string().nullable(),
    discipline: z.string().nullable(),
    founded_year: z.number().int().nullable(),
    join_code: z.string().nullable(),
    settings: z.record(z.unknown()),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Club');

export const clubUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    short_name: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    discipline: z.string().nullable().optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('ClubUpdate');

export const memberSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    profile_id: uuid.nullable(),
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().nullable(),
    birth_date: isoDate.nullable(),
    role: clubRoleSchema,
    status: memberStatusSchema,
    joined_on: isoDate.nullable(),
    valid_until: timestamp.nullable(),
    /** Teams (skater or coach) this member belongs to - from app.team_members. */
    team_ids: z.array(uuid),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('ClubMember');

export const memberCreateSchema = z
  .object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email().optional(),
    birth_date: z.string().date().optional(),
    role: assignableRoleSchema.default('member'),
    joined_on: z.string().date().optional(),
    /** required for guest_coach (DB check constraint) */
    valid_until: z.string().datetime({ offset: true }).optional(),
  })
  .refine((v) => v.role !== 'guest_coach' || v.valid_until !== undefined, {
    message: 'guest_coach requires valid_until',
  })
  .openapi('ClubMemberCreate');

export const roleChangeSchema = z
  .object({ role: assignableRoleSchema })
  .openapi('ClubMemberRoleChange');

/** Edit member MASTER DATA (never the role - that is the dedicated role endpoint). */
export const memberUpdateSchema = z
  .object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
    birth_date: z.string().date().nullable().optional(),
    status: memberStatusSchema.optional(),
    /** guest_coach expiry; nullable to clear it for non-guest roles */
    valid_until: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('ClubMemberUpdate');

export const inviteSchema = z
  .object({
    email: z.string().email(),
    role: assignableRoleSchema.default('member'),
  })
  .openapi('ClubMemberInvite');

export const rsvpSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    event_id: uuid,
    member_id: uuid,
    status: rsvpStatusSchema,
    comment: z.string().nullable(),
    responded_at: timestamp,
  })
  .openapi('EventRsvp');

export const eventSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    type: eventTypeSchema,
    title: z.string(),
    note: z.string().nullable(),
    location: z.string().nullable(),
    starts_at: timestamp,
    ends_at: timestamp,
    competition_id: uuid.nullable(),
    /** Linked teams (app.event_teams). */
    team_ids: z.array(uuid),
    /** Current RSVP state of the event (app.event_rsvps, soft-deleted excluded). */
    rsvps: z.array(rsvpSchema),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Event');

export const eventCreateSchema = z
  .object({
    club_id: uuid,
    type: eventTypeSchema.default('training'),
    title: z.string().min(1),
    note: z.string().optional(),
    location: z.string().optional(),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
    team_ids: z.array(uuid).default([]),
  })
  .refine((v) => new Date(v.ends_at) > new Date(v.starts_at), { message: 'ends_at must be after starts_at' })
  .openapi('EventCreate');

export const rsvpUpsertSchema = z
  .object({
    /** club_members.id - own membership or a child via guardianship */
    member_id: uuid,
    status: rsvpStatusSchema,
    comment: z.string().max(500).optional(),
  })
  .openapi('EventRsvpUpsert');

export const attendanceSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    event_id: uuid,
    member_id: uuid,
    status: attendanceStatusSchema,
    checked_in_at: timestamp.nullable(),
  })
  .openapi('Attendance');

export const attendanceUpsertSchema = z
  .object({
    member_id: uuid,
    status: attendanceStatusSchema,
    checked_in_at: z.string().datetime({ offset: true }).optional(),
  })
  .openapi('AttendanceUpsert');

export const routineSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    team_id: uuid.nullable(),
    title: z.string(),
    status: routineStatusSchema,
    category: z.string().nullable(),
    music_title: z.string().nullable(),
    music_artist: z.string().nullable(),
    music_bpm: z.number().int().nullable(),
    music_duration_ms: z.coerce.number().int().nullable(),
    audio_asset_id: uuid.nullable(),
    /** Skaters of this routine (app.routine_skaters) - single, pair or group. */
    skater_member_ids: z.array(uuid),
    /** Normalized waveform peaks (0..1) of the linked audio asset, when present. */
    waveform_peaks: z.array(z.number()).nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Routine');

export const routineCreateSchema = z
  .object({
    club_id: uuid,
    title: z.string().min(1),
    team_id: uuid.optional(),
    category: z.string().optional(),
    music_title: z.string().optional(),
    music_artist: z.string().optional(),
    music_bpm: z.number().int().positive().optional(),
    music_duration_ms: z.number().int().positive().optional(),
    skater_member_ids: z.array(uuid).default([]),
  })
  .openapi('RoutineCreate');

export const markerSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    routine_id: uuid,
    time_ms: z.coerce.number().int(),
    label: z.string(),
    element_code: z.string().nullable(),
  })
  .openapi('RoutineMarker');

export const markerCreateSchema = z
  .object({
    time_ms: z.number().int().nonnegative(),
    label: z.string().min(1),
    element_code: z.string().optional(),
  })
  .openapi('RoutineMarkerCreate');

export const scoreSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    routine_id: uuid,
    competition_id: uuid.nullable(),
    scored_on: isoDate,
    scoring_system: z.string(),
    technical_score: z.coerce.number().nullable(),
    components_score: z.coerce.number().nullable(),
    total_score: z.coerce.number().nullable(),
    note: z.string().nullable(),
  })
  .openapi('RoutineScore');

export const scoreCreateSchema = z
  .object({
    scored_on: z.string().date(),
    scoring_system: z.string().default('rollart'),
    technical_score: z.number().optional(),
    components_score: z.number().optional(),
    total_score: z.number().optional(),
    competition_id: uuid.optional(),
    note: z.string().optional(),
  })
  .openapi('RoutineScoreCreate');

export const invoiceSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    member_id: uuid,
    number: z.string(),
    title: z.string(),
    amount_cents: z.coerce.number().int(),
    currency: z.string(),
    status: invoiceStatusSchema,
    dunning_level: z.number().int(),
    issued_on: isoDate.nullable(),
    due_on: isoDate.nullable(),
    paid_at: timestamp.nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Invoice');

export const invoiceCreateSchema = z
  .object({
    club_id: uuid,
    member_id: uuid,
    title: z.string().min(1),
    /** Blueprint §4: money is integer cents, never float. */
    amount_cents: z.number().int().nonnegative(),
    due_on: z.string().date().optional(),
    /** true = issue immediately (status open, issued_on today), false = draft */
    issue: z.boolean().default(false),
  })
  .openapi('InvoiceCreate');

export const teamSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    name: z.string(),
    age_group: z.string().nullable(),
    /** Member ids with team role 'skater' (app.team_members). */
    skater_member_ids: z.array(uuid),
    /** Member ids with team role 'coach' (app.team_members). */
    coach_member_ids: z.array(uuid),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Team');

export const teamCreateSchema = z
  .object({
    name: z.string().min(1),
    age_group: z.string().optional(),
  })
  .openapi('TeamCreate');

export const teamUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    age_group: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('TeamUpdate');

/** Full replace of a team's roster: skaters + coaches (member ids). */
export const teamMembersSetSchema = z
  .object({
    skater_member_ids: z.array(uuid).default([]),
    coach_member_ids: z.array(uuid).default([]),
  })
  .openapi('TeamMembersSet');

export const deletedSchema = z
  .object({ status: z.literal('deleted'), id: uuid })
  .openapi('Deleted');

export const guardianshipSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    guardian_member_id: uuid,
    child_member_id: uuid,
    /** parent | guardian | other (free text, DB default 'parent'). */
    relation: z.string(),
    created_at: timestamp,
  })
  .openapi('Guardianship');

export const ledgerEntrySchema = z
  .object({
    id: uuid,
    club_id: uuid,
    entry_on: isoDate,
    description: z.string(),
    counterparty_kind: counterpartyKindSchema,
    counterparty_member_id: uuid.nullable(),
    counterparty_name: z.string().nullable(),
    /** Signed integer cents: income > 0, expense < 0 (Blueprint §4). */
    amount_cents: z.coerce.number().int(),
    currency: z.string(),
    category: z.string().nullable(),
    invoice_id: uuid.nullable(),
    reverses_entry_id: uuid.nullable(),
    created_at: timestamp,
  })
  .openapi('LedgerEntry');

export const competitionEntrySchema = z
  .object({
    id: uuid,
    member_id: uuid,
    routine_id: uuid.nullable(),
    status: entryStatusSchema,
  })
  .openapi('CompetitionEntry');

export const competitionSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    name: z.string(),
    location: z.string().nullable(),
    starts_at: timestamp,
    ends_at: timestamp,
    registration_deadline: isoDate.nullable(),
    status: competitionStatusSchema,
    /** Start list (app.competition_entries, soft-deleted excluded). */
    entries: z.array(competitionEntrySchema),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Competition');

export const taskSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    title: z.string(),
    done: z.boolean(),
    due_on: isoDate.nullable(),
    assignee_member_id: uuid.nullable(),
    competition_id: uuid.nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Task');

export const taskUpdateSchema = z
  .object({ done: z.boolean() })
  .openapi('TaskUpdate');

export const entitlementSchema = z
  .object({
    id: uuid,
    subject_type: z.enum(['club', 'profile']),
    subject_id: uuid,
    entitlement: z.string(),
    source: z.enum(['stripe', 'revenuecat', 'manual']),
    product_id: uuid.nullable(),
    valid_until: timestamp.nullable(),
  })
  .openapi('Entitlement');

// ---------------------------------------------------------------------------
// Modules batch 1 (migration 0008): news, notes, exercises.
// ---------------------------------------------------------------------------

// news -----------------------------------------------------------------------
export const newsSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    /** club_members.id of the (trainer) author. */
    author_member_id: uuid,
    title: z.string(),
    body: z.string(),
    is_pinned: z.boolean(),
    published_at: timestamp.nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('News');

export const newsCreateSchema = z
  .object({
    club_id: uuid,
    title: z.string().min(1),
    body: z.string().min(1),
    is_pinned: z.boolean().default(false),
    /** Defaults to "now" (published immediately) when omitted. */
    published_at: z.string().datetime({ offset: true }).optional(),
  })
  .openapi('NewsCreate');

export const newsUpdateSchema = z
  .object({
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    is_pinned: z.boolean().optional(),
    published_at: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('NewsUpdate');

// notes ----------------------------------------------------------------------
export const noteSchema = z
  .object({
    id: uuid,
    /** auth.users id of the owner (app.profiles.id). */
    owner_profile_id: uuid,
    club_id: uuid.nullable(),
    title: z.string(),
    body: z.string(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Note');

export const noteCreateSchema = z
  .object({
    title: z.string().min(1),
    body: z.string().min(1),
    /** Optional club context; grants no one else access. */
    club_id: uuid.optional(),
  })
  .openapi('NoteCreate');

export const noteUpdateSchema = z
  .object({
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    club_id: uuid.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('NoteUpdate');

// exercises ------------------------------------------------------------------
export const exerciseCategorySchema = z
  .enum(['warmup', 'stretching', 'strength', 'jump', 'spin', 'steps', 'combination'])
  .openapi('ExerciseCategory');

export const exerciseSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    /** club_members.id of the (trainer) author. */
    created_by_member_id: uuid,
    name: z.string(),
    description: z.string().nullable(),
    category: exerciseCategorySchema,
    difficulty: z.coerce.number().int(),
    video_url: z.string().nullable(),
    instructions: z.string().nullable(),
    duration_seconds: z.coerce.number().int().nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Exercise');

export const exerciseCreateSchema = z
  .object({
    club_id: uuid,
    name: z.string().min(1),
    category: exerciseCategorySchema,
    difficulty: z.number().int().min(1).max(5),
    description: z.string().optional(),
    video_url: z.string().url().optional(),
    instructions: z.string().optional(),
    duration_seconds: z.number().int().positive().optional(),
  })
  .openapi('ExerciseCreate');

export const exerciseUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    category: exerciseCategorySchema.optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    description: z.string().nullable().optional(),
    video_url: z.string().url().nullable().optional(),
    instructions: z.string().nullable().optional(),
    duration_seconds: z.number().int().positive().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('ExerciseUpdate');

// ---------------------------------------------------------------------------
// Platform (super_admin) read models - cross-club, only for platform admins.
// ---------------------------------------------------------------------------

export const platformClubSchema = z
  .object({
    id: uuid,
    name: z.string(),
    short_name: z.string().nullable(),
    city: z.string().nullable(),
    discipline: z.string().nullable(),
    /** Active, non-deleted membership rows in this club. */
    member_count: z.coerce.number().int(),
    created_at: timestamp,
  })
  .openapi('PlatformClub');

export const platformUserSchema = z
  .object({
    id: uuid,
    display_name: z.string().nullable(),
    locale: z.string(),
    /** Distinct clubs this profile is an active member of. */
    club_count: z.coerce.number().int(),
    created_at: timestamp,
  })
  .openapi('PlatformUser');

export const platformStatsSchema = z
  .object({
    clubs: z.coerce.number().int(),
    users: z.coerce.number().int(),
    members: z.coerce.number().int(),
    active_members: z.coerce.number().int(),
    teams: z.coerce.number().int(),
    events: z.coerce.number().int(),
    open_invoices: z.coerce.number().int(),
  })
  .openapi('PlatformStats');

export const productSchema = z
  .object({
    id: uuid,
    code: z.string(),
    kind: z.enum(['club_license', 'personal_pro']),
    name: z.string(),
    description: z.string().nullable(),
    /** Blueprint §4: money is integer cents (BIGINT), never float. */
    price_cents: z.coerce.number().int(),
    currency: z.string(),
    billing_interval: z.enum(['month', 'year']),
    max_members: z.number().int().nullable(),
    active: z.boolean(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Product');
