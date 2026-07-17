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

/**
 * Lebenslauf einer Mitgliedschaft (app.member_status, 0002:25 + 0036).
 *
 * 'rejected' kam mit 0036 dazu: eine Ablehnung war vorher NICHT ausdrueckbar.
 * Der Ausweg soft-delete liess den Vorgang verschwinden (der naechste Antrag
 * traf auf einen Vorstand ohne Gedaechtnis), der Ausweg 'left' war semantisch
 * falsch UND eine Sackgasse (der Eindeutigkeits-Index 0002:82-84 blockte jede
 * weitere Bewerbung). Nur 'active' oeffnet Rechte (app.member_role_keys, 0025).
 */
export const memberStatusSchema = z
  .enum(['pending', 'rejected', 'active', 'inactive', 'left'])
  .openapi('MemberStatus');
export const eventTypeSchema = z.enum(['training', 'competition', 'other']).openapi('EventType');
export const rsvpStatusSchema = z.enum(['going', 'declined', 'maybe', 'sick']).openapi('RsvpStatus');
export const attendanceStatusSchema = z.enum(['present', 'late', 'excused', 'absent']).openapi('AttendanceStatus');
export const routineStatusSchema = z.enum(['draft', 'ready', 'competition', 'archived']).openapi('RoutineStatus');
export const invoiceStatusSchema = z.enum(['draft', 'open', 'paid', 'cancelled']).openapi('InvoiceStatus');
export const competitionStatusSchema = z.enum(['upcoming', 'running', 'done', 'cancelled']).openapi('CompetitionStatus');
export const entryStatusSchema = z.enum(['registered', 'confirmed', 'withdrawn']).openapi('CompetitionEntryStatus');
export const counterpartyKindSchema = z.enum(['person', 'org']).openapi('CounterpartyKind');

/**
 * Publikum des Selbst-Profils (0053). ZWEI Stufen, beide INNERHALB des Vereins:
 *   'public'   = jedes aktive Vereinsmitglied sieht Motto/Disziplin/seit-wann.
 *   'internal' = nur Vorstand/Trainer (owner/admin/moderator/coach/guest_coach).
 * Vorgabe in der DB ist 'internal' (fail-safe). Schema-Name bewusst
 * 'ProfileVisibility' und NICHT 'Visibility': generische Namen kollidieren im
 * Swift-Codegen gern mit App-Enums.
 */
export const profileVisibilitySchema = z.enum(['public', 'internal']).openapi('ProfileVisibility');

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

/**
 * Ein Verein - OHNE join_code.
 *
 * ### BREAKING CHANGE, und zwar ein gewollter (0035) ###
 * join_code stand hier bis 0035 als `z.string().nullable()`. Das war nicht
 * neutral: ein Feld im Response-Schema ist eine ZUSAGE, es auszuliefern. Zod
 * strippt nur, was NICHT im Schema steht - was drinsteht, wird publiziert. Der
 * Vereinscode ging damit ueber GET /clubs an jedes Mitglied, bis hinunter zu
 * den Kindern, und ueber die Codegen bis in die iOS-/Android-/Web-Typen.
 *
 * Eine Redigierung auf `null` (der Wert bleibt weg, das Feld bleibt stehen) waere
 * nicht-brechend gewesen und war der erste Versuch. Sie ist trotzdem falsch:
 *   * Sie laesst das Versprechen im Vertrag stehen. Jeder Client sieht ein
 *     `join_code`-Feld an Club und darf annehmen, dass es manchmal gefuellt ist -
 *     die naechste Route, die einen Club-Datensatz zurueckgibt, fuellt es
 *     gutglaeubig wieder.
 *   * Sie ist an EINE Abfrage geheftet. Das Spaltenrecht aus 0035 gilt fuer die
 *     ganze Datenbank; der Vertrag muss dasselbe sagen, sonst widersprechen sich
 *     Vertrag und Datenbank - und dann gewinnt die Datenbank mit einem
 *     Laufzeitfehler statt mit einem Compile-Fehler.
 * Der Code hat jetzt eine eigene Adresse: GET /clubs/{clubId}/join-code, gated
 * auf members:manage. Wer ihn braucht, holt ihn dort - sichtbar im Vertrag,
 * pruefbar im Zugriffslog, statt beilaeufig in jeder Vereinsantwort.
 */
export const clubSchema = z
  .object({
    id: uuid,
    name: z.string(),
    short_name: z.string().nullable(),
    city: z.string().nullable(),
    discipline: z.string().nullable(),
    founded_year: z.number().int().nullable(),
    settings: z.record(z.unknown()),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Club');

/**
 * Der Vereinscode fuer Code-Verwalter - die Antwort von
 * GET /clubs/{clubId}/join-code (0035).
 *
 * join_code ist nullable, weil ein Verein keinen Code haben MUSS: die Spalte ist
 * seit 0002:38 nullable, und ein Widerruf ohne Rotation (POST .../join-code/revoke)
 * ist der Normalfall "wir nehmen gerade niemanden auf". Die Zeitstempel
 * begleiten ihn, damit die Oberflaeche "gesperrt seit …" / "laeuft ab am …"
 * anzeigen kann, ohne den Verein ein zweites Mal zu laden.
 */
export const clubJoinCodeSchema = z
  .object({
    club_id: uuid,
    join_code: z.string().nullable(),
    join_code_expires_at: timestamp.nullable(),
    join_code_revoked_at: timestamp.nullable(),
  })
  .openapi('ClubJoinCode');

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
    /** Served profile-photo URL derived from avatar_key (null = no photo). */
    avatar_url: z.string().nullable(),
    /** Teams (skater or coach) this member belongs to - from app.team_members. */
    team_ids: z.array(uuid),
    // -----------------------------------------------------------------------
    // Selbst-Profil (0045). NICHT redigiert: jedes aktive Vereinsmitglied darf
    // das sehen — das ist der ganze Zweck ("mitglied darf ... wenn das mitglied
    // was ueber sich eintraegt, dann das auch"). Geschrieben ausschliesslich von
    // der Person selbst / ihren Erziehungsberechtigten
    // (PATCH .../members/{memberId}/profile, Trigger app.protect_self_profile).
    // Bewusst drei BENANNTE Felder statt eines offenen Freitexts — Begruendung
    // im Kopf von 0045 (Publikum = ganzer Verein, ueberwiegend Kinder).
    // -----------------------------------------------------------------------
    profile_motto: z.string().nullable(),
    profile_favorite_discipline: z.string().nullable(),
    profile_skating_since: z.number().int().nullable(),
    // Publikum des Selbst-Profils (0053). Wer die Profil-Felder NICHT sehen darf,
    // sieht auch die Stufe nicht — die API setzt dann alle vier auf null
    // (members.ts/redactSelfProfile). Wer die Felder sieht, sieht 'public' bzw.
    // 'internal'. In der DB ist die Spalte NOT NULL DEFAULT 'internal'; null
    // steht hier ausschliesslich fuer "redigiert".
    //
    // .nullable().optional() und nicht nur .nullable(): ein registriertes
    // Enum wird als OpenAPI-$ref emittiert, und ein $ref schluckt das
    // begleitende `nullable` (das laesst sich an einem $ref nicht ausdruecken).
    // Waere das Feld required, entstuende im Codegen ein NICHT-optionaler Typ
    // (Swift: ProfileVisibility) — und der wuerde beim Dekodieren eines
    // redigierten null brechen. .optional() nimmt das Feld aus `required`, der
    // Codegen macht daraus ein optionales ProfileVisibility?, und null dekodiert
    // sauber zu nil. Der Wert ist real immer gesetzt ODER null (nie schlicht
    // weggelassen) — die Optionalitaet im Typ ist nur der Traeger fuer "null".
    profile_visibility: profileVisibilitySchema.nullable().optional(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('ClubMember');

/**
 * Das Selbst-Profil, geschrieben von der PERSON SELBST (oder ihren
 * Erziehungsberechtigten bei Kindern ohne Konto).
 *
 * Die Grenzen stehen doppelt: hier (freundliche Fehlermeldung) und als
 * CHECK-Constraint in 0045 (die eigentliche Durchsetzung — die API ist nur
 * EIN Leser der Tabelle). `null` = Angabe loeschen.
 *
 * `.max(140)` / `.max(60)` sind deckungsgleich mit
 * club_members_profile_motto_len_chk / _discipline_len_chk.
 */
export const memberSelfProfileUpdateSchema = z
  .object({
    motto: z.string().max(140).nullable().optional(),
    favorite_discipline: z.string().max(60).nullable().optional(),
    skating_since: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear() + 1)
      .nullable()
      .optional(),
    // Der Umschalter (0053). BEWUSST nicht nullable: eine Stufe hat kein
    // "leeren" — sie ist immer 'public' oder 'internal'. Fehlt der Schluessel,
    // bleibt die bisherige Stufe stehen (Patch-Semantik in app.set_self_profile).
    visibility: profileVisibilitySchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('ClubMemberSelfProfileUpdate');

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

// ---------------------------------------------------------------------------
// App-shell "/me" (migration 0016). The caller's own identity: the profile
// plus every membership row that belongs to them (profile_id = auth.uid()),
// each enriched with its club name/role. PATCH /me edits master data on the
// caller's OWN membership rows only — never role/status (that stays with the
// dedicated members endpoints + the protect_club_membership trigger).
// ---------------------------------------------------------------------------

export const meMembershipSchema = z
  .object({
    /** club_members.id of this membership. */
    id: uuid,
    club_id: uuid,
    club_name: z.string(),
    club_short_name: z.string().nullable(),
    first_name: z.string(),
    last_name: z.string(),
    email: z.string().nullable(),
    birth_date: isoDate.nullable(),
    role: clubRoleSchema,
    status: memberStatusSchema,
    joined_on: isoDate.nullable(),
    valid_until: timestamp.nullable(),
    /** Served profile-photo URL derived from avatar_key (null = no photo). */
    avatar_url: z.string().nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('MeMembership');

export const meSchema = z
  .object({
    /** auth.users id (= app.profiles.id) of the logged-in user. */
    profile_id: uuid,
    display_name: z.string().nullable(),
    locale: z.string(),
    /** Every club the user is a member of, with their per-club role. */
    memberships: z.array(meMembershipSchema),
  })
  .openapi('Me');

/** Edit the caller's OWN master data (never role/status — server-enforced). */
export const meUpdateSchema = z
  .object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
    birth_date: z.string().date().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('MeUpdate');

// app-shell notification toggle-flags (v1 notification-settings.html) --------
export const notificationPrefsSchema = z
  .object({
    events: z.boolean().optional(),
    invoices: z.boolean().optional(),
    news: z.boolean().optional(),
    chat: z.boolean().optional(),
  })
  .openapi('NotificationPrefs');

// Schema-Name bewusst 'ThemePreference' (nicht 'Theme'): der generierte Swift-Typ
// 'Theme' kollidierte sonst mit dem Design-System-Enum Theme der iOS-App.
export const themeSchema = z.enum(['light', 'dark', 'auto']).openapi('ThemePreference');

export const userPreferencesSchema = z
  .object({
    profile_id: uuid,
    locale: z.string(),
    theme: themeSchema,
    notifications: notificationPrefsSchema,
    updated_at: timestamp,
  })
  .openapi('UserPreferences');

/** PATCH preferences: partial; notifications is deep-merged server-side. */
export const userPreferencesUpdateSchema = z
  .object({
    locale: z.string().min(2).max(10).optional(),
    theme: themeSchema.optional(),
    notifications: notificationPrefsSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('UserPreferencesUpdate');

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

/**
 * Zielgruppe eines Termins (app.event_audience, Migration 0050).
 *   'teams' — nur die zugeordneten Teams (Vorgabe, fail-closed)
 *   'club'  — ausdrueckliche Vereinsveranstaltung; jedes Mitglied sieht sie.
 *             Setzen/Aendern verlangt die Faehigkeit club_events=manage.
 * BEWUSST ein eigenes Feld und KEIN Rateschluss aus leeren team_ids: wer beim
 * Anlegen das Team vergisst, soll nicht versehentlich vereinsweit
 * veroeffentlichen — dahinter haengen Kinderdaten.
 */
export const eventAudienceSchema = z.enum(['teams', 'club']).openapi('EventAudience');

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
    audience: eventAudienceSchema,
    /** Linked teams (app.event_teams). Always empty when audience = 'club'. */
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
    audience: eventAudienceSchema.default('teams'),
    team_ids: z.array(uuid).default([]),
  })
  .refine((v) => new Date(v.ends_at) > new Date(v.starts_at), { message: 'ends_at must be after starts_at' })
  // Zielgruppe 'club' UND Teams waere eine zweite Wahrheit neben der
  // Zielgruppe: bei 'club' sieht ohnehin jedes Mitglied den Termin, die
  // Team-Zeile begrenzt nichts mehr - ein Leser wuerde sie aber genau so
  // deuten. Die Datenbank weist das ebenfalls ab (Trigger
  // event_teams_audience_guard, 23514); hier faellt es als sauberes 400 mit
  // Begruendung statt als Fehlschlag tief im Insert.
  .refine((v) => !(v.audience === 'club' && v.team_ids.length > 0), {
    message: 'audience=club: a club-wide event carries no team assignment (team_ids must be empty)',
    path: ['team_ids'],
  })
  // BEWUSST KEIN Gegenstueck "'teams' verlangt mindestens ein Team": das waere
  // eine Verschaerfung, die niemand bestellt hat, und sie braeche den
  // bestehenden Contract (test/schemas.test.ts:85-89 haelt team_ids=[] als
  // gueltige Vorgabe fest, POST /events kommt heute ohne Teams durch).
  // Der Fall ist ohnehin harmlos, weil er FAIL-CLOSED faellt: ein 'teams'-
  // Termin ohne Team-Zeile adressiert niemanden und ist deshalb fuer Mitglieder,
  // Eltern und Trainer:innen unsichtbar - nur der Vorstand findet ihn noch
  // (Grenzfall A in Migration 0050, belegt in 99g). Kein Leck, nur ein
  // Schoenheitsfehler.
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
    /** Final rank of the Kür at a competition (Live-Scoring), 1-based. */
    placement: z.coerce.number().int().nullable(),
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
    placement: z.number().int().positive().optional(),
    note: z.string().optional(),
  })
  .openapi('RoutineScoreCreate');

// ----------------------------------------------------------------------------
// Standings (GET /competitions/{id}/standings) — computed read model: per
// category, the starters ranked by total_score with the delta to the routine's
// previous score. Personal names are club-internal (member view), never public.
// ----------------------------------------------------------------------------
export const standingRowSchema = z
  .object({
    category: z.string(),
    rank: z.coerce.number().int(),
    entry_id: uuid,
    member_id: uuid,
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    routine_id: uuid,
    routine_title: z.string(),
    technical_score: z.coerce.number().nullable(),
    components_score: z.coerce.number().nullable(),
    total_score: z.coerce.number().nullable(),
    placement: z.coerce.number().int().nullable(),
    /** total_score minus the routine's previous score (null if no prior). */
    delta: z.coerce.number().nullable(),
  })
  .openapi('CompetitionStandingRow');

export const standingsSchema = z
  .object({
    competition_id: uuid,
    name: z.string(),
    rows: z.array(standingRowSchema),
  })
  .openapi('CompetitionStandings');

// ----------------------------------------------------------------------------
// Küren teilen (kuer-share.html): create an opaque, revocable share link.
// ----------------------------------------------------------------------------
export const shareCreateSchema = z
  .object({
    /** ISO 8601; omit for a link that never expires ("Nie"). */
    expires_at: z.string().datetime().optional(),
  })
  .openapi('RoutineShareCreate');

export const shareCreatedSchema = z
  .object({
    token: z.string(),
    /** Relative public path the web app renders as the share target. */
    url: z.string(),
    expires_at: timestamp.nullable(),
  })
  .openapi('RoutineShareCreated');

// ----------------------------------------------------------------------------
// Public token view (GET /public/routines/{token}) — UNAUTHENTICATED. Minimal,
// non-personal Kür payload only: NO skater identities, NO contact/finance data.
// ----------------------------------------------------------------------------
export const publicRoutineSchema = z
  .object({
    title: z.string(),
    /** RollArt discipline / category label, e.g. 'Jugend Kür A'. */
    discipline: z.string().nullable(),
    club_name: z.string(),
    music_title: z.string().nullable(),
    music_artist: z.string().nullable(),
    music_bpm: z.coerce.number().int().nullable(),
    music_duration_ms: z.coerce.number().int().nullable(),
    markers: z.array(
      z.object({
        time_ms: z.coerce.number().int(),
        label: z.string(),
        element_code: z.string().nullable(),
      }),
    ),
    scores: z.array(
      z.object({
        scored_on: isoDate,
        technical_score: z.coerce.number().nullable(),
        components_score: z.coerce.number().nullable(),
        total_score: z.coerce.number().nullable(),
        placement: z.coerce.number().int().nullable(),
      }),
    ),
  })
  .openapi('PublicRoutine');

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
    /** How a paid invoice was settled (SEPA/bar/Überweisung…), free text. */
    paid_via: z.string().nullable(),
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

/**
 * PATCH an invoice's lifecycle: open → paid or open/draft → cancelled.
 * `paid` optionally posts a matching income row into the cash book
 * (post_to_ledger, default true) under ledger_category_id when given.
 * Corrections stay GoBD-safe: a cancelled/paid invoice is never re-opened here.
 */
export const invoiceUpdateSchema = z
  .object({
    status: z.enum(['paid', 'cancelled']),
    /** How it was settled (only meaningful for status=paid). */
    paid_via: z.string().min(1).optional(),
    /** status=paid: also append a Kassenbuch income entry (default true). */
    post_to_ledger: z.boolean().default(true),
    /** Category for the auto-posted ledger income row (status=paid only). */
    ledger_category_id: uuid.optional(),
  })
  .openapi('InvoiceUpdate');

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

/** Link an EXISTING member as a child. guardian defaults to the caller's own
 *  membership when omitted (self-service); providing a foreign guardian needs
 *  is_club_admin (server-enforced in routes/members.ts). */
export const guardianshipCreateSchema = z
  .object({
    child_member_id: uuid,
    /** Omit for self-service (guardian = the caller's own membership). */
    guardian_member_id: uuid.optional(),
    relation: z.enum(['parent', 'guardian', 'other']).default('parent'),
  })
  .openapi('GuardianshipCreate');

/** Create a CHILD (club_members row without a login) plus the guardianship in
 *  one call. guardian defaults to the caller's own membership (self-service);
 *  a chosen guardian_member_id requires is_club_admin. */
export const childCreateSchema = z
  .object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    birth_date: z.string().date().optional(),
    joined_on: z.string().date().optional(),
    /** Omit for self-service (guardian = the caller's own membership). */
    guardian_member_id: uuid.optional(),
    relation: z.enum(['parent', 'guardian', 'other']).default('parent'),
  })
  .openapi('ChildCreate');

/** POST /clubs/{id}/children response: the created child + guardianship. */
export const childCreatedSchema = z
  .object({
    child: memberSchema,
    guardianship: guardianshipSchema,
  })
  .openapi('ChildCreated');

// ---------------------------------------------------------------------------
// Waitlists (Cluster 6a, migration 0020) — a member queues for a scarce
// resource; read/write = own row OR trainer.
// ---------------------------------------------------------------------------
export const waitlistKindSchema = z
  .enum(['facility', 'equipment', 'team', 'event'])
  .openapi('WaitlistKind');
export const waitlistStatusSchema = z
  .enum(['waiting', 'offered', 'fulfilled', 'cancelled'])
  .openapi('WaitlistStatus');

export const waitlistSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    member_id: uuid,
    kind: waitlistKindSchema,
    /** Optional concrete resource id (facility/equipment/team/event) — no FK. */
    target_id: uuid.nullable(),
    note: z.string().nullable(),
    status: waitlistStatusSchema,
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Waitlist');

export const waitlistCreateSchema = z
  .object({
    club_id: uuid,
    /** The member joining the queue (self, or anyone when trainer+). */
    member_id: uuid,
    kind: waitlistKindSchema,
    target_id: uuid.nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .openapi('WaitlistCreate');

/** PATCH a waitlist entry: status transition and/or note (both optional). */
export const waitlistUpdateSchema = z
  .object({
    status: waitlistStatusSchema.optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('WaitlistUpdate');

export const ledgerCategoryKindSchema = z.enum(['income', 'expense']).openapi('LedgerCategoryKind');

export const ledgerCategorySchema = z
  .object({
    id: uuid,
    club_id: uuid,
    name: z.string(),
    kind: ledgerCategoryKindSchema,
    sort_order: z.coerce.number().int(),
    created_at: timestamp,
    deleted_at: timestamp.nullable(),
  })
  .openapi('LedgerCategory');

export const ledgerCategoryCreateSchema = z
  .object({
    club_id: uuid,
    name: z.string().min(1),
    kind: ledgerCategoryKindSchema,
    sort_order: z.number().int().default(0),
  })
  .openapi('LedgerCategoryCreate');

// ---------------------------------------------------------------------------
// Budget planning (Cluster 6a, migration 0020) — planned amount per Kassenbuch
// category and year; can_manage_finance only. Plan-vs-Ist in the report below.
// ---------------------------------------------------------------------------
export const budgetSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    year: z.coerce.number().int(),
    category_id: uuid,
    planned_cents: z.coerce.number().int(),
    note: z.string().nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Budget');

export const budgetCreateSchema = z
  .object({
    club_id: uuid,
    year: z.coerce.number().int().min(2000).max(2100),
    category_id: uuid,
    planned_cents: z.coerce.number().int(),
    note: z.string().max(2000).nullable().optional(),
  })
  .openapi('BudgetCreate');

export const budgetUpdateSchema = z
  .object({
    planned_cents: z.coerce.number().int().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('BudgetUpdate');

/** One category row of the budget report: plan vs. booked (Ist) + variance. */
export const budgetReportRowSchema = z
  .object({
    category_id: uuid,
    category_name: z.string().nullable(),
    kind: ledgerCategoryKindSchema.nullable(),
    planned_cents: z.coerce.number().int(),
    /** Signed sum booked to this category in the year (from the ledger). */
    actual_cents: z.coerce.number().int(),
    /** actual_cents - planned_cents. */
    variance_cents: z.coerce.number().int(),
  })
  .openapi('BudgetReportRow');

export const budgetReportSchema = z
  .object({
    club_id: uuid,
    year: z.coerce.number().int(),
    rows: z.array(budgetReportRowSchema),
    planned_total_cents: z.coerce.number().int(),
    actual_total_cents: z.coerce.number().int(),
    variance_total_cents: z.coerce.number().int(),
  })
  .openapi('BudgetReport');

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
    /** Legacy free-text category (kept for import/back-compat). */
    category: z.string().nullable(),
    /** Structured category (app.ledger_categories), or null. */
    category_id: uuid.nullable(),
    /** Joined from app.ledger_categories in GET /ledger (absent on writes). */
    category_name: z.string().nullable().optional(),
    category_kind: ledgerCategoryKindSchema.nullable().optional(),
    invoice_id: uuid.nullable(),
    reverses_entry_id: uuid.nullable(),
    created_at: timestamp,
  })
  .openapi('LedgerEntry');

/**
 * Append a Kassenbuch entry (GoBD: journal is append-only, corrections go
 * through POST /ledger/{id}/reverse). amount_cents is SIGNED — income > 0,
 * expense < 0. Counterparty is a member (person) or a free-text org name.
 */
export const ledgerEntryCreateSchema = z
  .object({
    club_id: uuid,
    entry_on: z.string().date(),
    description: z.string().min(1),
    counterparty_kind: counterpartyKindSchema,
    /** required for counterparty_kind='person'. */
    counterparty_member_id: uuid.optional(),
    /** required for counterparty_kind='org'. */
    counterparty_name: z.string().min(1).optional(),
    /** Signed integer cents: income > 0, expense < 0. */
    amount_cents: z.number().int(),
    category: z.string().min(1).optional(),
    category_id: uuid.optional(),
    /** Optionally tie the entry to an invoice (e.g. a manual payment). */
    invoice_id: uuid.optional(),
  })
  .refine(
    (v) => (v.counterparty_kind === 'person' ? v.counterparty_member_id !== undefined : v.counterparty_name !== undefined),
    { message: "person entries need counterparty_member_id, org entries need counterparty_name" },
  )
  .openapi('LedgerEntryCreate');

/**
 * Storno: reverse an existing ledger entry by appending a mirror row with the
 * negated amount and reverses_entry_id set — never a DELETE/UPDATE (GoBD).
 */
export const ledgerReverseSchema = z
  .object({
    /** Overrides the auto-generated "Storno: …" description when given. */
    description: z.string().min(1).optional(),
  })
  .openapi('LedgerReverse');

// ---------------------------------------------------------------------------
// Dunning apply + log (migration 0013). The dry-run preview lives in
// modules/dunning (DunningRunResult); these cover the WRITE path: applying a
// stage to a set of invoices and reading the resulting audit trail.
// ---------------------------------------------------------------------------

export const dunningActionSchema = z.enum(['reminder', 'dunning', 'handover']).openapi('DunningLogAction');

export const dunningLogSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    invoice_id: uuid,
    from_stage: z.coerce.number().int(),
    to_stage: z.coerce.number().int(),
    action: dunningActionSchema,
    /** club_members.id of the treasurer/admin who applied the step, or null. */
    actor_member_id: uuid.nullable(),
    note: z.string().nullable(),
    created_at: timestamp,
  })
  .openapi('DunningLogEntry');

/**
 * Apply a dunning stage to a set of open invoices. Stage 1 (reminder) is the
 * routine step; stages >= 2 (dunning/handover) ONLY apply when approve_escalation
 * is explicitly true (the deliberate human sign-off — never automatic).
 */
export const dunningApplyRequestSchema = z
  .object({
    invoice_ids: z.array(uuid).min(1),
    /** 1 = reminder, 2/3 = dunning, 4 = handover. */
    to_stage: z.number().int().min(1).max(4),
    /** Required true to apply any stage >= 2. */
    approve_escalation: z.boolean().default(false),
    note: z.string().max(500).optional(),
  })
  .openapi('DunningApplyRequest');

export const dunningApplyResultSchema = z
  .object({
    club_id: uuid,
    to_stage: z.number().int(),
    action: dunningActionSchema,
    /** number of invoices whose stage was raised + logged. */
    applied: z.number().int(),
    /** invoices left untouched, with the reason (not open / already >= stage / not found). */
    skipped: z.array(z.object({ invoice_id: uuid, reason: z.string() }).openapi('DunningSkip')),
    /** the audit rows just written. */
    log: z.array(dunningLogSchema),
  })
  .openapi('DunningApplyResult');

// ---------------------------------------------------------------------------
// Beitragswesen — Finance depth B (migration 0014): membership categories,
// member fees (Beitragszuordnung), family discounts, SEPA mandates.
// ---------------------------------------------------------------------------

export const membershipPeriodSchema = z
  .enum(['monthly', 'quarterly', 'yearly', 'once'])
  .openapi('MembershipPeriod');

export const membershipCategorySchema = z
  .object({
    id: uuid,
    club_id: uuid,
    name: z.string(),
    /** Blueprint §4: money is integer cents, never float. */
    amount_cents: z.coerce.number().int(),
    period: membershipPeriodSchema,
    is_active: z.boolean(),
    sort_order: z.coerce.number().int(),
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: timestamp.nullable(),
  })
  .openapi('MembershipCategory');

export const membershipCategoryCreateSchema = z
  .object({
    club_id: uuid,
    name: z.string().min(1),
    amount_cents: z.number().int().nonnegative(),
    period: membershipPeriodSchema,
    is_active: z.boolean().default(true),
    sort_order: z.number().int().default(0),
  })
  .openapi('MembershipCategoryCreate');

/** PATCH a category: every field optional; deleted_at is set via DELETE (soft). */
export const membershipCategoryUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    amount_cents: z.number().int().nonnegative().optional(),
    period: membershipPeriodSchema.optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  })
  .openapi('MembershipCategoryUpdate');

export const memberFeeSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    member_id: uuid,
    category_id: uuid,
    /** Per-member override; null = use the category's amount_cents. */
    custom_amount_cents: z.coerce.number().int().nullable(),
    valid_from: isoDate,
    valid_until: isoDate.nullable(),
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: timestamp.nullable(),
    /** Joined from app.membership_categories in GET /member-fees. */
    category_name: z.string().nullable().optional(),
    category_amount_cents: z.coerce.number().int().nullable().optional(),
    category_period: membershipPeriodSchema.nullable().optional(),
  })
  .openapi('MemberFee');

export const memberFeeCreateSchema = z
  .object({
    club_id: uuid,
    member_id: uuid,
    category_id: uuid,
    custom_amount_cents: z.number().int().nonnegative().optional(),
    valid_from: z.string().date(),
    valid_until: z.string().date().optional(),
  })
  .openapi('MemberFeeCreate');

export const memberFeeUpdateSchema = z
  .object({
    category_id: uuid.optional(),
    custom_amount_cents: z.number().int().nonnegative().nullable().optional(),
    valid_from: z.string().date().optional(),
    valid_until: z.string().date().nullable().optional(),
  })
  .openapi('MemberFeeUpdate');

/**
 * GET /member-fees/summary — expected annual fee income by period. Each period
 * bucket carries the raw count + summed cents at their native period; annual_cents
 * annualises them (monthly×12, quarterly×4, yearly×1, once excluded from the
 * recurring total). custom_amount_cents overrides the category amount per fee.
 */
export const memberFeeSummarySchema = z
  .object({
    club_id: uuid,
    /** per-period breakdown of active fee assignments. */
    by_period: z.array(
      z
        .object({
          period: membershipPeriodSchema,
          /** number of active member_fees in this period bucket. */
          count: z.coerce.number().int(),
          /** summed effective amount at the native period (not annualised). */
          amount_cents: z.coerce.number().int(),
          /** annualised contribution of this bucket (once = 0). */
          annual_cents: z.coerce.number().int(),
        })
        .openapi('MemberFeeSummaryBucket'),
    ),
    /** total expected recurring income per year across all buckets. */
    total_annual_cents: z.coerce.number().int(),
  })
  .openapi('MemberFeeSummary');

export const familyDiscountKindSchema = z.enum(['percent', 'fixed']).openapi('FamilyDiscountKind');

export const familyDiscountSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    label: z.string(),
    kind: familyDiscountKindSchema,
    /** percent → a percentage (0–100); fixed → a cent amount. */
    value_numeric: z.coerce.number(),
    applies_from_child: z.coerce.number().int(),
    is_active: z.boolean(),
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: timestamp.nullable(),
  })
  .openapi('FamilyDiscount');

export const familyDiscountCreateSchema = z
  .object({
    club_id: uuid,
    label: z.string().min(1),
    kind: familyDiscountKindSchema,
    value_numeric: z.number().nonnegative(),
    applies_from_child: z.number().int().min(1).default(2),
    is_active: z.boolean().default(true),
  })
  .refine((v) => v.kind !== 'percent' || v.value_numeric <= 100, {
    message: 'a percent discount cannot exceed 100',
  })
  .openapi('FamilyDiscountCreate');

export const familyDiscountUpdateSchema = z
  .object({
    label: z.string().min(1).optional(),
    kind: familyDiscountKindSchema.optional(),
    value_numeric: z.number().nonnegative().optional(),
    applies_from_child: z.number().int().min(1).optional(),
    is_active: z.boolean().optional(),
  })
  .openapi('FamilyDiscountUpdate');

export const sepaMandateStatusSchema = z.enum(['active', 'revoked']).openapi('SepaMandateStatus');

export const sepaMandateSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    member_id: uuid,
    mandate_reference: z.string(),
    /** DATENSCHUTZ: only the last 4 IBAN digits are ever stored/returned. */
    iban_last4: z.string().nullable(),
    account_holder: z.string(),
    signed_on: isoDate.nullable(),
    status: sepaMandateStatusSchema,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: timestamp.nullable(),
  })
  .openapi('SepaMandate');

export const sepaMandateCreateSchema = z
  .object({
    club_id: uuid,
    member_id: uuid,
    mandate_reference: z.string().min(1),
    /** DATENSCHUTZ: pass ONLY the last 4 digits — never a full IBAN. */
    iban_last4: z.string().regex(/^[0-9]{4}$/).optional(),
    account_holder: z.string().min(1),
    signed_on: z.string().date().optional(),
    status: sepaMandateStatusSchema.default('active'),
  })
  .openapi('SepaMandateCreate');

export const sepaMandateUpdateSchema = z
  .object({
    mandate_reference: z.string().min(1).optional(),
    iban_last4: z.string().regex(/^[0-9]{4}$/).nullable().optional(),
    account_holder: z.string().min(1).optional(),
    signed_on: z.string().date().nullable().optional(),
    status: sepaMandateStatusSchema.optional(),
  })
  .openapi('SepaMandateUpdate');

// ---------------------------------------------------------------------------
// Finance depth C (migration 0015): bank reconciliation (bank_transactions),
// donations (Spenden + Spendenbescheinigung) and the annual report aggregate.
// ---------------------------------------------------------------------------

export const bankTransactionStatusSchema = z
  .enum(['unmatched', 'matched', 'ignored'])
  .openapi('BankTransactionStatus');

export const bankTransactionSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    booked_on: isoDate,
    /** Signed integer cents: + Eingang / - Ausgang (Blueprint §4). */
    amount_cents: z.coerce.number().int(),
    purpose: z.string().nullable(),
    counterparty: z.string().nullable(),
    matched_invoice_id: uuid.nullable(),
    matched_ledger_entry_id: uuid.nullable(),
    status: bankTransactionStatusSchema,
    imported_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: timestamp.nullable(),
  })
  .openapi('BankTransaction');

/** One imported/manual bank movement. amount_cents is SIGNED (+ in / - out). */
export const bankTransactionCreateSchema = z
  .object({
    club_id: uuid,
    booked_on: z.string().date(),
    amount_cents: z.number().int(),
    purpose: z.string().min(1).optional(),
    counterparty: z.string().min(1).optional(),
  })
  .openapi('BankTransactionCreate');

/** A single row of a CSV/JSON bank statement import (club_id comes from the envelope). */
export const bankTransactionImportRowSchema = z
  .object({
    booked_on: z.string().date(),
    amount_cents: z.number().int(),
    purpose: z.string().min(1).optional(),
    counterparty: z.string().min(1).optional(),
  })
  .openapi('BankTransactionImportRow');

export const bankTransactionImportSchema = z
  .object({
    club_id: uuid,
    rows: z.array(bankTransactionImportRowSchema).min(1).max(1000),
  })
  .openapi('BankTransactionImport');

/**
 * Match a bank transaction to an open invoice. post_to_ledger (default true)
 * also marks the invoice paid (open → paid) and appends a Kassenbuch income row
 * under ledger_category_id — the reconciliation booking.
 */
export const bankTransactionMatchSchema = z
  .object({
    invoice_id: uuid,
    /** Also settle the invoice + post a matching Kassenbuch income row (default true). */
    post_to_ledger: z.boolean().default(true),
    ledger_category_id: uuid.optional(),
  })
  .openapi('BankTransactionMatch');

/** Ignore a bank transaction (irrelevant/private). Optional note is logged only. */
export const bankTransactionIgnoreSchema = z
  .object({ note: z.string().max(500).optional() })
  .openapi('BankTransactionIgnore');

// donations ------------------------------------------------------------------
export const donationSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    /** Optional link to the donor's membership (null = external donor). */
    member_id: uuid.nullable(),
    donor_name: z.string(),
    donor_address: z.string().nullable(),
    amount_cents: z.coerce.number().int(),
    donation_date: isoDate,
    receipt_number: z.string(),
    purpose: z.string().nullable(),
    /** Set when the Spendenbescheinigung was actually issued (null = draft). */
    issued_at: timestamp.nullable(),
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: timestamp.nullable(),
  })
  .openapi('Donation');

/** Create a donation. receipt_number is generated race-free server-side. */
export const donationCreateSchema = z
  .object({
    club_id: uuid,
    member_id: uuid.optional(),
    donor_name: z.string().min(1),
    donor_address: z.string().min(1).optional(),
    amount_cents: z.number().int().nonnegative(),
    donation_date: z.string().date(),
    purpose: z.string().min(1).optional(),
  })
  .openapi('DonationCreate');

/**
 * PATCH a donation: edit the (still unissued) master data and/or issue the
 * receipt (issue=true → issued_at=now). Once issued, master data is frozen
 * (GoBD) — only edits before issuing are accepted.
 */
export const donationUpdateSchema = z
  .object({
    donor_name: z.string().min(1).optional(),
    donor_address: z.string().min(1).optional(),
    amount_cents: z.number().int().nonnegative().optional(),
    donation_date: z.string().date().optional(),
    purpose: z.string().min(1).optional(),
    /** true = issue the Spendenbescheinigung now (sets issued_at). */
    issue: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('DonationUpdate');

/** Printable Spendenbescheinigung: the donation fields plus a rendered text block. */
export const donationReceiptSchema = z
  .object({
    donation_id: uuid,
    receipt_number: z.string(),
    club_name: z.string(),
    donor_name: z.string(),
    donor_address: z.string().nullable(),
    amount_cents: z.coerce.number().int(),
    amount_eur: z.string(),
    donation_date: isoDate,
    purpose: z.string().nullable(),
    issued: z.boolean(),
    /** Ready-to-print Bescheinigungstext (DE). */
    text: z.string(),
  })
  .openapi('DonationReceipt');

// annual report ("Jahresabschluss") -----------------------------------------
export const annualCategoryRowSchema = z
  .object({
    category_id: uuid.nullable(),
    category_name: z.string().nullable(),
    kind: ledgerCategoryKindSchema.nullable(),
    /** Summed signed cents booked to this category in the year. */
    amount_cents: z.coerce.number().int(),
  })
  .openapi('AnnualCategoryRow');

export const annualYearTotalsSchema = z
  .object({
    year: z.coerce.number().int(),
    income_cents: z.coerce.number().int(),
    expense_cents: z.coerce.number().int(),
    net_cents: z.coerce.number().int(),
  })
  .openapi('AnnualYearTotals');

export const annualReportSchema = z
  .object({
    club_id: uuid,
    year: z.coerce.number().int(),
    /** Kassenbuch totals for the year (income positive, expense positive, net = income - expense). */
    income_cents: z.coerce.number().int(),
    expense_cents: z.coerce.number().int(),
    net_cents: z.coerce.number().int(),
    /** Per-category signed sums (null category = uncategorised/legacy rows). */
    by_category: z.array(annualCategoryRowSchema),
    /** Prior-year totals for the comparison column. */
    prev_year: annualYearTotalsSchema,
    /** Change in net vs. the previous year (net_cents - prev_year.net_cents). */
    net_delta_cents: z.coerce.number().int(),
    /** Donations recorded in the year. */
    donations_total_cents: z.coerce.number().int(),
    donations_count: z.coerce.number().int(),
    /** Invoices still open at year end (issued on/before Dec 31 of the year). */
    open_items_count: z.coerce.number().int(),
    open_items_total_cents: z.coerce.number().int(),
  })
  .openapi('AnnualReport');

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
    /**
     * License tier from metadata.tier ('basic'|'pro'|'premium'|…). The PRO
     * gate (app.is_club_pro) keys off this; surfaced so the client can mirror
     * the gate for the UI upgrade hint (the real gate stays server-side).
     */
    tier: z.string().nullable(),
    /** Lifecycle from metadata.status ('active'|'trial'|'past_due'|…). */
    status: z.string().nullable(),
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
// Modules batch 2 (migration 0009): facilities, facility_bookings, equipment,
// equipment_reservations, achievements. Enum-like columns are TEXT + CHECK in
// the DB; here they are z.enum so the wire contract stays typed.
// ---------------------------------------------------------------------------

export const facilityKindSchema = z
  .enum(['hall', 'room', 'outdoor', 'other'])
  .openapi('FacilityKind');
export const bookingStatusSchema = z
  .enum(['confirmed', 'pending', 'cancelled'])
  .openapi('BookingStatus');
export const equipmentConditionSchema = z
  .enum(['good', 'fair', 'defect'])
  .openapi('EquipmentCondition');
export const reservationStatusSchema = z
  .enum(['active', 'returned', 'cancelled'])
  .openapi('ReservationStatus');
export const medalSchema = z.enum(['gold', 'silver', 'bronze']).openapi('Medal');

// facilities -----------------------------------------------------------------
export const facilitySchema = z
  .object({
    id: uuid,
    club_id: uuid,
    name: z.string(),
    kind: facilityKindSchema,
    address: z.string().nullable(),
    capacity: z.coerce.number().int().nullable(),
    notes: z.string().nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Facility');

export const facilityCreateSchema = z
  .object({
    club_id: uuid,
    name: z.string().min(1),
    kind: facilityKindSchema.default('hall'),
    address: z.string().optional(),
    capacity: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
  })
  .openapi('FacilityCreate');

export const facilityUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    kind: facilityKindSchema.optional(),
    address: z.string().nullable().optional(),
    capacity: z.number().int().nonnegative().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('FacilityUpdate');

// facility_bookings ----------------------------------------------------------
export const facilityBookingSchema = z
  .object({
    id: uuid,
    facility_id: uuid,
    club_id: uuid,
    /** club_members.id of the booker (self-service) or the team's coach. */
    booked_by_member_id: uuid,
    team_id: uuid.nullable(),
    title: z.string(),
    starts_at: timestamp,
    ends_at: timestamp,
    status: bookingStatusSchema,
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('FacilityBooking');

export const facilityBookingCreateSchema = z
  .object({
    club_id: uuid,
    facility_id: uuid,
    /** Own membership (self-service) or, for staff, any member of the club. */
    booked_by_member_id: uuid,
    team_id: uuid.optional(),
    title: z.string().min(1),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
    status: bookingStatusSchema.default('confirmed'),
  })
  .refine((v) => new Date(v.ends_at) > new Date(v.starts_at), { message: 'ends_at must be after starts_at' })
  .openapi('FacilityBookingCreate');

export const facilityBookingUpdateSchema = z
  .object({
    title: z.string().min(1).optional(),
    team_id: uuid.nullable().optional(),
    starts_at: z.string().datetime({ offset: true }).optional(),
    ends_at: z.string().datetime({ offset: true }).optional(),
    status: bookingStatusSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('FacilityBookingUpdate');

// equipment ------------------------------------------------------------------
export const equipmentSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    name: z.string(),
    category: z.string().nullable(),
    total_quantity: z.coerce.number().int(),
    available_quantity: z.coerce.number().int(),
    condition: equipmentConditionSchema,
    notes: z.string().nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Equipment');

export const equipmentCreateSchema = z
  .object({
    club_id: uuid,
    name: z.string().min(1),
    category: z.string().optional(),
    total_quantity: z.number().int().nonnegative().default(1),
    available_quantity: z.number().int().nonnegative().optional(),
    condition: equipmentConditionSchema.default('good'),
    notes: z.string().optional(),
  })
  .refine((v) => v.available_quantity === undefined || v.available_quantity <= v.total_quantity, {
    message: 'available_quantity must not exceed total_quantity',
  })
  .openapi('EquipmentCreate');

export const equipmentUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    category: z.string().nullable().optional(),
    total_quantity: z.number().int().nonnegative().optional(),
    available_quantity: z.number().int().nonnegative().optional(),
    condition: equipmentConditionSchema.optional(),
    notes: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('EquipmentUpdate');

// equipment_reservations -----------------------------------------------------
export const equipmentReservationSchema = z
  .object({
    id: uuid,
    equipment_id: uuid,
    club_id: uuid,
    /** club_members.id of the borrower (self-service) or a staff-created row. */
    reserved_by_member_id: uuid,
    quantity: z.coerce.number().int(),
    from_at: timestamp,
    to_at: timestamp,
    status: reservationStatusSchema,
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('EquipmentReservation');

export const equipmentReservationCreateSchema = z
  .object({
    club_id: uuid,
    equipment_id: uuid,
    /** Own membership (self-service) or, for staff, any member of the club. */
    reserved_by_member_id: uuid,
    quantity: z.number().int().positive().default(1),
    from_at: z.string().datetime({ offset: true }),
    to_at: z.string().datetime({ offset: true }),
    status: reservationStatusSchema.default('active'),
  })
  .refine((v) => new Date(v.to_at) > new Date(v.from_at), { message: 'to_at must be after from_at' })
  .openapi('EquipmentReservationCreate');

export const equipmentReservationUpdateSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    from_at: z.string().datetime({ offset: true }).optional(),
    to_at: z.string().datetime({ offset: true }).optional(),
    status: reservationStatusSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('EquipmentReservationUpdate');

// achievements ---------------------------------------------------------------
export const achievementSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    member_id: uuid,
    title: z.string(),
    competition_name: z.string().nullable(),
    placement: z.coerce.number().int().nullable(),
    medal: medalSchema.nullable(),
    achieved_on: isoDate,
    note: z.string().nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Achievement');

export const achievementCreateSchema = z
  .object({
    club_id: uuid,
    member_id: uuid,
    title: z.string().min(1),
    competition_name: z.string().optional(),
    placement: z.number().int().positive().optional(),
    medal: medalSchema.optional(),
    achieved_on: z.string().date(),
    note: z.string().optional(),
  })
  .openapi('AchievementCreate');

export const achievementUpdateSchema = z
  .object({
    title: z.string().min(1).optional(),
    competition_name: z.string().nullable().optional(),
    placement: z.number().int().positive().nullable().optional(),
    medal: medalSchema.nullable().optional(),
    achieved_on: z.string().date().optional(),
    note: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('AchievementUpdate');

// ---------------------------------------------------------------------------
// Modules batch 3 (migration 0010): training_slots, duty_requirements,
// duty_entries + the reports/summary aggregate ("Auswertung"). weekday is
// 0=Monday..6=Sunday; time columns come back as 'HH:MM:SS' strings.
// ---------------------------------------------------------------------------

/** 0 = Monday … 6 = Sunday (Referenz Trainingsplan-Wochenraster). */
export const weekdaySchema = z.number().int().min(0).max(6).openapi('Weekday');
/** 'HH:MM' or 'HH:MM:SS' — a plain wall-clock time (no offset). */
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'expected HH:MM[:SS]');
export const dutyKindSchema = z.enum(['training', 'helper', 'competition', 'other']).openapi('DutyKind');

// training_slots -------------------------------------------------------------
export const trainingSlotSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    team_id: uuid.nullable(),
    weekday: weekdaySchema,
    starts_time: z.string(),
    ends_time: z.string(),
    facility_id: uuid.nullable(),
    location: z.string().nullable(),
    coach_member_id: uuid.nullable(),
    note: z.string().nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('TrainingSlot');

export const trainingSlotCreateSchema = z
  .object({
    club_id: uuid,
    weekday: weekdaySchema,
    starts_time: timeString,
    ends_time: timeString,
    team_id: uuid.optional(),
    facility_id: uuid.optional(),
    location: z.string().optional(),
    coach_member_id: uuid.optional(),
    note: z.string().optional(),
  })
  .refine((v) => v.ends_time > v.starts_time, { message: 'ends_time must be after starts_time' })
  .openapi('TrainingSlotCreate');

export const trainingSlotUpdateSchema = z
  .object({
    weekday: weekdaySchema.optional(),
    starts_time: timeString.optional(),
    ends_time: timeString.optional(),
    team_id: uuid.nullable().optional(),
    facility_id: uuid.nullable().optional(),
    location: z.string().nullable().optional(),
    coach_member_id: uuid.nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('TrainingSlotUpdate');

// duty_requirements ----------------------------------------------------------
export const dutyRequirementSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    team_id: uuid.nullable(),
    member_id: uuid.nullable(),
    season_label: z.string(),
    required_hours: z.coerce.number(),
    period_start: isoDate,
    period_end: isoDate,
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('DutyRequirement');

export const dutyRequirementCreateSchema = z
  .object({
    club_id: uuid,
    season_label: z.string().min(1),
    required_hours: z.number().nonnegative(),
    period_start: z.string().date(),
    period_end: z.string().date(),
    team_id: uuid.optional(),
    member_id: uuid.optional(),
  })
  .refine((v) => v.period_end >= v.period_start, { message: 'period_end must not be before period_start' })
  .openapi('DutyRequirementCreate');

export const dutyRequirementUpdateSchema = z
  .object({
    season_label: z.string().min(1).optional(),
    required_hours: z.number().nonnegative().optional(),
    period_start: z.string().date().optional(),
    period_end: z.string().date().optional(),
    team_id: uuid.nullable().optional(),
    member_id: uuid.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('DutyRequirementUpdate');

// duty_entries ---------------------------------------------------------------
export const dutyEntrySchema = z
  .object({
    id: uuid,
    club_id: uuid,
    member_id: uuid,
    hours: z.coerce.number(),
    activity_date: isoDate,
    kind: dutyKindSchema,
    note: z.string().nullable(),
    approved: z.boolean(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('DutyEntry');

export const dutyEntryCreateSchema = z
  .object({
    club_id: uuid,
    /** Own membership (self-service) or, for staff, any member of the club. */
    member_id: uuid,
    hours: z.number().positive(),
    activity_date: z.string().date(),
    kind: dutyKindSchema.default('training'),
    note: z.string().optional(),
    /** Trainer-only; a member's own entry is always created unapproved (DB guard). */
    approved: z.boolean().default(false),
  })
  .openapi('DutyEntryCreate');

export const dutyEntryUpdateSchema = z
  .object({
    hours: z.number().positive().optional(),
    activity_date: z.string().date().optional(),
    kind: dutyKindSchema.optional(),
    note: z.string().nullable().optional(),
    /** Trainer-only (DB guard rejects a member flipping this on their own row). */
    approved: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('DutyEntryUpdate');

// reports/summary ("Auswertung") — server-computed aggregate, trainer/admin only
export const reportRoleCountSchema = z
  .object({ role: clubRoleSchema, count: z.coerce.number().int() })
  .openapi('ReportRoleCount');

export const reportTeamCountSchema = z
  .object({ team_id: uuid, team_name: z.string(), member_count: z.coerce.number().int() })
  .openapi('ReportTeamCount');

export const reportUpcomingEventSchema = z
  .object({ id: uuid, title: z.string(), type: eventTypeSchema, starts_at: timestamp })
  .openapi('ReportUpcomingEvent');

export const reportSummarySchema = z
  .object({
    club_id: uuid,
    /** Non-deleted membership rows (any status). */
    members_total: z.coerce.number().int(),
    /** status = 'active'. */
    members_active: z.coerce.number().int(),
    /** Active members grouped by their club role. */
    members_by_role: z.array(reportRoleCountSchema),
    /** Skaters per team (app.team_members role='skater'). */
    members_by_team: z.array(reportTeamCountSchema),
    /** present+late over all recorded attendance rows (0..1); 0 when none. */
    attendance_rate: z.coerce.number(),
    /** Sum of amount_cents of status='open' invoices (integer cents). */
    open_invoices_total_cents: z.coerce.number().int(),
    open_invoices_count: z.coerce.number().int(),
    /** Medal wall tally (app.achievements). */
    medals: z
      .object({
        gold: z.coerce.number().int(),
        silver: z.coerce.number().int(),
        bronze: z.coerce.number().int(),
      })
      .openapi('ReportMedalCounts'),
    /** Count of events with starts_at >= now(). */
    upcoming_events_count: z.coerce.number().int(),
    /** The next up-to-5 events (soonest first). */
    upcoming_events: z.array(reportUpcomingEventSchema),
  })
  .openapi('ReportSummary');

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

// ---------------------------------------------------------------------------
// Modules batch 4 (migration 0011): chat_messages, checkins, regional_events.
// Enum-like columns are TEXT + CHECK in the DB; here they are z.enum so the
// wire contract stays typed.
// ---------------------------------------------------------------------------

export const chatChannelTypeSchema = z.enum(['team', 'direct']).openapi('ChatChannelType');
export const checkinMethodSchema = z.enum(['qr', 'manual']).openapi('CheckinMethod');

// chat_messages --------------------------------------------------------------
export const chatMessageSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    channel_type: chatChannelTypeSchema,
    /** set for team channels (null for direct messages). */
    team_id: uuid.nullable(),
    /** author's club_members.id (always the caller for own writes). */
    sender_member_id: uuid,
    /** set for direct messages (null for team channels). */
    recipient_member_id: uuid.nullable(),
    body: z.string().nullable(),
    image_url: z.string().nullable(),
    created_at: timestamp,
  })
  .openapi('ChatMessage');

export const chatMessageCreateSchema = z
  .object({
    club_id: uuid,
    channel_type: chatChannelTypeSchema,
    /** required for channel_type='team'. */
    team_id: uuid.optional(),
    /** required for channel_type='direct'. */
    recipient_member_id: uuid.optional(),
    /** text and/or image_url — at least one must be present (DB check). */
    body: z.string().min(1).max(4000).optional(),
    image_url: z.string().url().optional(),
  })
  .refine((v) => (v.channel_type === 'team' ? v.team_id !== undefined : v.recipient_member_id !== undefined), {
    message: "team messages need team_id, direct messages need recipient_member_id",
  })
  .refine((v) => (v.channel_type === 'team' ? v.recipient_member_id === undefined : v.team_id === undefined), {
    message: 'team_id and recipient_member_id are mutually exclusive per channel_type',
  })
  .refine((v) => (v.body !== undefined && v.body.trim().length > 0) || v.image_url !== undefined, {
    message: 'a message must carry body text and/or an image_url',
  })
  .openapi('ChatMessageCreate');

/** Channel-overview row: my team channels + my direct threads, last msg first. */
export const chatChannelSchema = z
  .object({
    channel_type: chatChannelTypeSchema,
    /** team channel: the team id + name. */
    team_id: uuid.nullable(),
    team_name: z.string().nullable(),
    /** direct thread: the other party's member id + display name. */
    peer_member_id: uuid.nullable(),
    peer_name: z.string().nullable(),
    /** preview of the most recent (non-deleted) message in the channel. */
    last_message_id: uuid.nullable(),
    last_body: z.string().nullable(),
    last_image_url: z.string().nullable(),
    last_sender_member_id: uuid.nullable(),
    last_message_at: timestamp.nullable(),
  })
  .openapi('ChatChannel');

// checkins -------------------------------------------------------------------
export const checkinSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    member_id: uuid,
    event_id: uuid.nullable(),
    method: checkinMethodSchema,
    checked_in_at: timestamp,
    created_at: timestamp,
  })
  .openapi('Checkin');

export const checkinCreateSchema = z
  .object({
    club_id: uuid,
    /** Own membership (self check-in) or, for staff, any member of the club. */
    member_id: uuid,
    event_id: uuid.optional(),
    method: checkinMethodSchema.default('qr'),
    /** Defaults to "now" when omitted. */
    checked_in_at: z.string().datetime({ offset: true }).optional(),
  })
  .openapi('CheckinCreate');

// regional_events ------------------------------------------------------------
export const regionalEventSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    title: z.string(),
    host_org: z.string().nullable(),
    discipline: z.string().nullable(),
    location: z.string().nullable(),
    starts_on: isoDate,
    ends_on: isoDate.nullable(),
    registration_url: z.string().nullable(),
    description: z.string().nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('RegionalEvent');

export const regionalEventCreateSchema = z
  .object({
    club_id: uuid,
    title: z.string().min(1),
    starts_on: z.string().date(),
    ends_on: z.string().date().optional(),
    host_org: z.string().optional(),
    discipline: z.string().optional(),
    location: z.string().optional(),
    registration_url: z.string().url().optional(),
    description: z.string().optional(),
  })
  .refine((v) => v.ends_on === undefined || v.ends_on >= v.starts_on, {
    message: 'ends_on must not be before starts_on',
  })
  .openapi('RegionalEventCreate');

export const regionalEventUpdateSchema = z
  .object({
    title: z.string().min(1).optional(),
    starts_on: z.string().date().optional(),
    ends_on: z.string().date().nullable().optional(),
    host_org: z.string().nullable().optional(),
    discipline: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    registration_url: z.string().url().nullable().optional(),
    description: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('RegionalEventUpdate');

// ---------------------------------------------------------------------------
// Modules batch 5 (migration 0012): gallery_items, documents — the two
// PRO-gated modules (app.is_club_pro). The bytes live outside the DB; these
// schemas carry only metadata + the opaque storage_key (see modules/media).
// The upload itself is a separate multipart endpoint (POST /media/upload),
// deliberately OUTSIDE this typed spec — like the webhooks (app.ts).
// ---------------------------------------------------------------------------

export const galleryKindSchema = z.enum(['photo', 'video']).openapi('GalleryKind');

// gallery_items --------------------------------------------------------------
export const galleryItemSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    /** Named album/gallery, or null for ungrouped items. */
    album: z.string().nullable(),
    title: z.string(),
    kind: galleryKindSchema,
    /** Opaque handle; fetch the bytes via GET /media/{storage_key}. */
    storage_key: z.string(),
    content_type: z.string(),
    size_bytes: z.coerce.number().int(),
    /** Optional poster/preview key (typically for videos). */
    thumbnail_key: z.string().nullable(),
    /** club_members.id of the (trainer) uploader. */
    uploaded_by_member_id: uuid,
    created_at: timestamp,
  })
  .openapi('GalleryItem');

/**
 * Create a gallery item AFTER the bytes were stored via POST /media/upload
 * (which returns storage_key/content_type/size_bytes). The uploader member id
 * is resolved server-side from the caller's claims — never trusted from input.
 */
export const galleryItemCreateSchema = z
  .object({
    club_id: uuid,
    title: z.string().min(1),
    kind: galleryKindSchema,
    storage_key: z.string().min(1),
    content_type: z.string().min(1),
    size_bytes: z.number().int().nonnegative(),
    album: z.string().min(1).optional(),
    thumbnail_key: z.string().min(1).optional(),
  })
  .openapi('GalleryItemCreate');

// documents ------------------------------------------------------------------
export const documentSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    title: z.string(),
    category: z.string(),
    storage_key: z.string(),
    content_type: z.string(),
    size_bytes: z.coerce.number().int(),
    uploaded_by_member_id: uuid,
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Document');

export const documentCreateSchema = z
  .object({
    club_id: uuid,
    title: z.string().min(1),
    storage_key: z.string().min(1),
    content_type: z.string().min(1),
    size_bytes: z.number().int().nonnegative(),
    /** Free-text bucket the App renders as a label/filter. */
    category: z.string().min(1).default('allgemein'),
  })
  .openapi('DocumentCreate');

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

// ---------------------------------------------------------------------------
// Organisation (migration 0017): departments, department members, lockers.
// ---------------------------------------------------------------------------

export const departmentSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    name: z.string(),
    description: z.string().nullable(),
    /** club_members.id of the optional Abteilungsleiter. */
    lead_member_id: uuid.nullable(),
    sort_order: z.number().int(),
    /** club_members.id list of the department's members (skaters + staff). */
    member_ids: z.array(uuid),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Department');

export const departmentCreateSchema = z
  .object({
    club_id: uuid,
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    lead_member_id: uuid.nullable().optional(),
    sort_order: z.number().int().default(0),
  })
  .openapi('DepartmentCreate');

export const departmentUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    lead_member_id: uuid.nullable().optional(),
    sort_order: z.number().int().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('DepartmentUpdate');

/** Full replace of a department roster (is_club_trainer). */
export const departmentMembersSetSchema = z
  .object({ member_ids: z.array(uuid).default([]) })
  .openapi('DepartmentMembersSet');

export const lockerStatusSchema = z.enum(['free', 'assigned', 'broken']).openapi('LockerStatus');

export const lockerSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    label: z.string(),
    location: z.string().nullable(),
    status: lockerStatusSchema,
    assigned_member_id: uuid.nullable(),
    note: z.string().nullable(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('Locker');

export const lockerCreateSchema = z
  .object({
    club_id: uuid,
    label: z.string().min(1),
    location: z.string().nullable().optional(),
    status: lockerStatusSchema.default('free'),
    assigned_member_id: uuid.nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .openapi('LockerCreate');

export const lockerUpdateSchema = z
  .object({
    label: z.string().min(1).optional(),
    location: z.string().nullable().optional(),
    status: lockerStatusSchema.optional(),
    assigned_member_id: uuid.nullable().optional(),
    note: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('LockerUpdate');

/** Assign a locker to a member (status -> 'assigned'). */
export const lockerAssignSchema = z
  .object({ member_id: uuid })
  .openapi('LockerAssign');

// ---------------------------------------------------------------------------
// Anniversaries (Jubiläen, v1 jubilaeen.html) — a read-only derived report.
// kind = 'membership' (5/10/15/20/25 … years from joined_on) or 'birthday'
// (round birthdays, multiples of 10 from birth_date). `date` is the next
// occurrence (YYYY-MM-DD), `years` the milestone reached on that date, and
// `days_until` the distance from today (the sort key: nearest first).
// ---------------------------------------------------------------------------

export const anniversaryKindSchema = z.enum(['membership', 'birthday']).openapi('AnniversaryKind');

export const anniversarySchema = z
  .object({
    member_id: uuid,
    member_name: z.string(),
    kind: anniversaryKindSchema,
    /** ISO date of the upcoming milestone (YYYY-MM-DD). */
    date: z.string(),
    /**
     * Erreichte Jahre — NUR bei kind='membership' ("10 Jahre dabei").
     *
     * Bei kind='birthday' IMMER null, und das ist der ganze Punkt: dort waere
     * `years` das ALTER, und `date` minus `years` ergaebe das exakte
     * Geburtsdatum. Der Verein soll wissen, dass Emma am 3. November Geburtstag
     * hat — nicht, wie alt sie wird.
     */
    years: z.number().int().nullable(),
    /** Whole days from today until `date` (>= 0; sort ascending). */
    days_until: z.number().int(),
  })
  .openapi('Anniversary');

// ---------------------------------------------------------------------------
// RBAC (RBAC-DESIGN §2/§3/§6) — das konfigurierbare Rechte-System.
//
// ### Zur NAMENSWAHL (Lehre aus dem Theme/ThemePreference-Desaster) ###
// Die Generatoren fuer Swift/Kotlin kennen keinen Namensraum: apps/ios/
// project.yml zieht App/ und packages/contracts/generated/swift in EIN Target.
// Ein Schema `Permissions` kollidierte hart mit apps/ios/App/Auth/
// Permissions.swift:35 (struct Permissions) -> iOS-Build tot. `Role` kollidierte
// weich mit androidx.compose.ui.semantics.Role (in 5 Kotlin-Dateien importiert)
// und mit dem bestehenden ClubRole. `RoleLevel`/`MeCapabilities` kollidierten
// mit SICH SELBST: hoistedTypes (codegen/lib/spec.mjs:167-189) hebt jede INLINE
// definierte Enum/Objekt-Property als `<Schema><Prop>` heraus — aus
// `Role.level` wuerde `RoleLevel`, aus `Me.capabilities` `MeCapabilities`.
// check.mjs sieht so etwas NICHT (es vergleicht nur Bytes, es kompiliert nichts).
//
// Daraus zwei harte Regeln, die unten eingehalten sind:
//   1. Kein Schema-Name ist gleich `<AnderesSchema><PropInPascalCase>`.
//      Deshalb hat `Capability` KEINE Property `level` — sonst entstuende ein
//      zweites `CapabilityLevel`.
//   2. Kein BENANNTER SKALAR. gen-swift.mjs:198-210 / gen-kotlin.mjs:140-152
//      emittieren nur string-Enums und Objekte; ein benanntes
//      {"type":"integer"} faellt STUMM heraus (Beleg: `Weekday` — deshalb
//      braucht iOS den ContractCodegenShim und der Android-Build ist kaputt).
//      `rank` ist daher inline z.number().int() und NIE .openapi('CapRank').
// Alle Namen unten sind gegen die Spec-Schemas, die iOS-Top-Level-Typen und die
// Kotlin-Deklarationen geprueft: frei.
// ---------------------------------------------------------------------------

/** Die Stufen-Skala (§2) = app.role_level. Geordnet: none < … < manage. */
export const capabilityLevelSchema = z
  .enum(['none', 'read_own', 'read_team', 'read_all', 'edit', 'manage'])
  .openapi('CapabilityLevel');

/**
 * Wie weit die eingestellte Stufe TATSAECHLICH durchgesetzt wird (0033).
 * Rein deskriptiv — NIE Grundlage einer Autorisierung, sondern der Beschriftung:
 *   enforced   Die Stufe wirkt auf das LESEN. "none" entzieht den Zugriff wirklich.
 *   partial    Die Stufe wirkt nur auf einen TEIL des Lesens. "none" hier als
 *              "kein Zugriff" zu beschriften waere eine Taeuschung — und zwar
 *              die gefaehrlichste Sorte: sie verspricht Vertraulichkeit, die
 *              nachweislich nicht existiert (finance, member_contact).
 *   write_only Die Stufe wirkt nur auf das SCHREIBEN. Gelesen wird weiter.
 *   unenforced Die Stufe wirkt NIRGENDS (18 von 32 — die Bereiche haengen noch
 *              an den alten Rollen-Praedikaten).
 * Clients MUESSEN das auswerten, bevor sie eine Stufe beschriften. Herleitung
 * und Dauerkontrolle: Migration 0033 + supabase/tests/sql/93j.
 */
export const capabilityEnforcementSchema = z
  .enum(['enforced', 'partial', 'write_only', 'unenforced'])
  .openapi('CapabilityEnforcement');

/** Ein Katalog-Eintrag (app.capabilities). Bewusst OHNE `level` (siehe Regel 1). */
export const capabilitySchema = z
  .object({
    key: z.string(),
    label_de: z.string(),
    label_en: z.string(),
    /** Die im Admin-UI waehlbare Teilmenge der Skala. */
    allowed_levels: z.array(capabilityLevelSchema),
    sort: z.number().int(),
    /**
     * Geschuetzte Faehigkeit (0032): nur der Vereinsinhaber darf sie in der
     * Rollen-Matrix aendern. Ohne dieses Feld baut ein Admin-UI aus DIESEM
     * Katalog ein Dropdown, das beim Speichern 403 liefert (roles.ts:404-415).
     */
    owner_only: z.boolean(),
    /** Was die Stufe wirklich bewirkt (0033) — fuer die Beschriftung. */
    enforcement: capabilityEnforcementSchema,
  })
  .openapi('Capability');

/** Eine aufgeloeste Faehigkeit: Katalog + der Rang der aufrufenden Person. */
export const resolvedCapabilitySchema = z
  .object({
    capability_key: z.string(),
    label_de: z.string(),
    label_en: z.string(),
    allowed_levels: z.array(capabilityLevelSchema),
    sort: z.number().int(),
    /** Numerischer Rang 0..5 (= app.level_rank). Inline: kein benannter Skalar. */
    rank: z.number().int(),
    level: capabilityLevelSchema,
    /**
     * true = GESCHUETZTE Faehigkeit (0032): nur der Vereinsinhaber darf sie in
     * der Rollen-Matrix aendern, nicht jeder mit roles:manage. Das Admin-UI
     * MUSS die Zeile sonst sperren — sonst baut es ein Dropdown, das beim
     * Speichern 403 liefert. Inline: kein benannter Skalar.
     */
    owner_only: z.boolean(),
    /**
     * Was die eingestellte Stufe WIRKLICH bewirkt (0033). Das UI darf "none"
     * nur dort als "kein Zugriff" beschriften, wo hier 'enforced' steht.
     */
    enforcement: capabilityEnforcementSchema,
  })
  .openapi('ResolvedCapability');

/**
 * Die Antwort von GET /me/capabilities — alles, was ein Client zum Gating
 * braucht. `role_keys` kommt aus der DATENBANK (app.member_role_keys), nicht
 * aus dem Token: bei Mehrfachrollen stehen hier mehrere Keys, waehrend der
 * Claim nur einen kennt.
 */
export const capabilityResolutionSchema = z
  .object({
    club_id: uuid,
    /** Alle Rollen-Keys der Person in diesem Verein (DB-aufgeloest, Mehrfachrollen). */
    role_keys: z.array(z.string()),
    /** Plattform-Admin ist KEINE Vereinsrolle, sondern ein Token-Claim (§5). */
    is_platform_admin: z.boolean(),
    capabilities: z.array(resolvedCapabilitySchema),
  })
  .openapi('CapabilityResolution');

// ---------------------------------------------------------------------------
// Rollen-Admin (RBAC-DESIGN §6/§7) — die Schreibseite der Rechte-Matrix.
//
// Namen: `Role` waere weich mit androidx.compose.ui.semantics.Role kollidiert
// (in 5 Kotlin-Dateien importiert) und verwirrend neben dem bestehenden
// `ClubRole` (= der Enum der Primaerrolle). `Permissions` haette den iOS-Build
// zerlegt (apps/ios/App/Auth/Permissions.swift:35, gleiches Target). Daher
// ClubRoleDef* / RolePermission* — gegen Spec/iOS/Kotlin geprueft: frei.
// ---------------------------------------------------------------------------

/** Eine Rolle eines Vereins (app.roles): 7 Systemrollen + frei angelegte. */
export const clubRoleDefSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    key: z.string(),
    name_de: z.string(),
    name_en: z.string(),
    /** Systemrolle = Vorlage; key unveraenderlich, nicht loeschbar. */
    is_system: z.boolean(),
    /** owner: Stufen nicht absenkbar (sonst sperrt sich der Verein aus). */
    protected: z.boolean(),
    sort: z.number().int(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('ClubRoleDef');

/**
 * Eine EIGENE Rolle anlegen. is_system/protected fehlen bewusst: sie sind ueber
 * die API strukturell nicht setzbar, nicht bloss ungepruefte Felder.
 */
export const clubRoleDefCreateSchema = z
  .object({
    key: z
      .string()
      .regex(/^[a-z][a-z0-9_]{1,40}$/, 'key muss ^[a-z][a-z0-9_]{1,40}$ erfuellen')
      .openapi({ description: 'Stabiler Schluessel, klein geschrieben (app.roles.key).' }),
    name_de: z.string().min(1),
    name_en: z.string().min(1),
    sort: z.number().int().optional(),
  })
  .openapi('ClubRoleDefCreate');

/**
 * Eine Rolle umbenennen/umsortieren. `key` fehlt bewusst: bei Systemrollen ist
 * er unveraenderlich (protect_roles, 0024:256-258) — und bei eigenen Rollen
 * waere ein Key-Wechsel eine stille Neudefinition der Rechte.
 */
export const clubRoleDefUpdateSchema = z
  .object({
    name_de: z.string().min(1).optional(),
    name_en: z.string().min(1).optional(),
    sort: z.number().int().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('ClubRoleDefUpdate');

/** Eine Zelle der Rechte-Matrix: Faehigkeit -> Stufe. */
export const rolePermissionSchema = z
  .object({
    capability_key: z.string(),
    level: capabilityLevelSchema,
  })
  .openapi('RolePermission');

/** Die Matrix EINER Rolle, wie das Admin-UI sie speichert (PUT = Vollbild). */
export const rolePermissionSetSchema = z
  .object({
    permissions: z.array(rolePermissionSchema),
  })
  .openapi('RolePermissionSet');

/** Die Rollen EINER Person (Mehrfachrollen, §1.3) — PUT = Zielzustand. */
export const memberRolesSetSchema = z
  .object({
    role_ids: z.array(uuid),
  })
  .openapi('MemberRolesSet');

/**
 * Wer hat welche Rollen? Die LESESEITE der Mehrfachrollen — bis Phase 3 gab es
 * sie nicht: PUT .../members/{id}/roles lieferte die Rollen einer Person nur als
 * Antwort auf ein SCHREIBEN. Eine Personen-Liste mit Rollen-Chips war damit ohne
 * N+1 nicht baubar (und ohne GET je Person gar nicht).
 *
 * Vereinsweit statt je Person, weil das Admin-UI immer die ganze Liste zeigt.
 * Kein neues Recht: member_roles_select ist is_club_member (0022:242) — jedes
 * Mitglied darf ohnehin sehen, wer welche Rolle hat (die Chips muessen benannt
 * werden koennen). Die Zeilen kommen durch RLS, nicht an ihr vorbei.
 */
export const memberRoleAssignmentSchema = z
  .object({
    member_id: uuid,
    /** Alle Rollen der Person, nach roles.sort. Leer = nur die Primaerrolle-Spiegelung fehlt. */
    role_ids: z.array(uuid),
  })
  .openapi('MemberRoleAssignment');

/** Die Trainer:innen EINES Teams (§1.4) — PUT = Zielzustand. */
export const teamCoachesSetSchema = z
  .object({
    member_ids: z.array(uuid),
  })
  .openapi('TeamCoachesSet');

// ---------------------------------------------------------------------------
// Registrierung (Migration 0034): Vereins-Selbstanlage + Beitritt per Code.
//
// NAMENSREGEL: Die Vertragsnamen landen 1:1 als Swift-Typen in
// packages/contracts/generated/swift/RSMContracts.swift. Namen wie Task, Result,
// Session, Date, Data, Group, Notification kollidieren dort mit Swift/Foundation
// und verdecken das Original - RSMContracts.swift:3025 definiert bereits 'Task'
// und verdeckt damit Swift.Task, was die iOS-App mit 91x '_Concurrency.Task'
// bezahlt. Die Namen hier sind gegen den Bestand geprueft und frei.
// ---------------------------------------------------------------------------

/**
 * Vereinsanlage. Nur Name + Ort - mehr wird NICHT gefragt.
 *
 * Registernummer, Rechtsform, Zahlungsdaten kommen erst beim Upgrade. Wer beim
 * Ausprobieren nach dem Vereinsregister-Auszug fragt, bekommt niemanden zum
 * Ausprobieren.
 */
export const clubRegistrationSchema = z
  .object({
    name: z.string().min(2).max(120),
    city: z.string().min(2).max(120),
    /** Optional - der Verein kann es spaeter im Profil nachtragen. */
    short_name: z.string().min(1).max(32).optional(),
    discipline: z.string().min(1).max(60).optional(),
    /** Zustimmung zu Bedingungen/Datenschutz. Ohne sie keine Anlage. */
    accept_terms: z.literal(true),
    accept_privacy: z.literal(true),
  })
  .openapi('ClubRegistration');

/**
 * Ergebnis der Vereinsanlage: der Verein, die eigene Mitgliedschaft (owner,
 * active) und der frisch erzeugte Einladungscode in Anzeigeform.
 */
export const clubRegistrationResultSchema = z
  .object({
    club: clubSchema,
    member: memberSchema,
    /** Anzeigeform XXXX-XXXX. Nur hier und fuer Code-Verwalter sichtbar. */
    join_code: z.string(),
    /** Ende der Testphase (Entitlement 'club_license', source='trial'). */
    trial_ends_at: timestamp,
  })
  .openapi('ClubRegistrationResult');

/**
 * Ein Name, den ein FREMDER waehlt und der ungeprueft im Freigabe-Bildschirm
 * des Vorstands landet.
 *
 * Steuerzeichen sind dort keine Formatierung, sondern eine Taeuschung: ein
 * "Max\nVom Vorstand bereits geprueft" ist im Antrag eine zweite Zeile. Die
 * Datenbank haelt dieselbe Zusage fuer JEDEN Schreiber (0037,
 * club_members_name_sane) — hier steht sie nur frueher und mit einer
 * verstaendlichen Meldung.
 */
const applicantName = z
  .string()
  .min(1)
  .max(80)
  // eslint-disable-next-line no-control-regex
  .regex(/^[^\u0000-\u001F\u007F]+$/u, 'Steuerzeichen sind nicht erlaubt / control characters are not allowed');

/** Beitritt per Code. Der Code ist tippfehler-tolerant (Crockford, 0034). */
export const clubJoinInputSchema = z
  .object({
    code: z.string().min(4).max(40),
    first_name: applicantName,
    last_name: applicantName,
    accept_terms: z.literal(true),
    accept_privacy: z.literal(true),
  })
  .openapi('ClubJoinInput');

/**
 * Ergebnis eines Beitritts-ANTRAGS.
 *
 * status ist IMMER 'pending' - ein richtiger Code ist ein Antrag, kein Zutritt.
 * Das Feld steht trotzdem im Vertrag, weil der Client die Wartelage anzeigen
 * muss ("Dein Antrag liegt beim Vorstand") und nicht raten soll.
 */
export const clubJoinResultSchema = z
  .object({
    club_id: uuid,
    club_name: z.string(),
    member_id: uuid,
    status: memberStatusSchema,
  })
  .openapi('ClubJoinResult');

/**
 * Antwort auf das Rotieren des Einladungscodes.
 *
 * previous_code_valid_until ist seit 0037 der eigentliche Punkt: solange der
 * Code eine SPALTE auf app.clubs war (0002:38), starb der alte Code in
 * derselben Sekunde, in der der neue entstand — Aushang und WhatsApp-Gruppe
 * sofort tot. Genau deshalb rotierte niemand. Mit app.club_join_codes gelten N
 * Codes gleichzeitig, und dieses Feld sagt der Oberflaeche, bis wann der alte
 * noch traegt (null = er ist sofort tot, das ist die Vorgabe).
 */
export const clubJoinCodeRotatedSchema = z
  .object({
    club_id: uuid,
    join_code: z.string(),
    join_code_expires_at: timestamp.nullable(),
    previous_code_valid_until: timestamp.nullable(),
  })
  .openapi('ClubJoinCodeRotated');

/** Zwecke einer Einwilligung - EINZELN (Art. 7 Abs. 2 DSGVO). */
export const consentPurposeSchema = z
  .enum(['terms', 'privacy', 'photos_internal', 'photos_public', 'chat', 'newsletter'])
  .openapi('ConsentPurpose');

/**
 * Die Zwecke, die WIRKLICH eine Einwilligung sind (Art. 6 Abs. 1 lit. a).
 *
 * terms/privacy fehlen hier mit Absicht und sind seit Migration 0039 in
 * app.consents per CHECK gesperrt: 'terms' ist Vertragserfuellung
 * (Art. 6 Abs. 1 lit. b), 'privacy' ist eine Informationspflicht (Art. 13).
 * In eine Datenschutzerklaerung willigt man nicht ein, man nimmt sie zur
 * Kenntnis -> app.policy_acknowledgements (policyAcknowledgementSchema).
 * Beide als Einwilligung zu fuehren verletzt das Kopplungsverbot
 * (Art. 7 Abs. 4), weil accept_terms/accept_privacy Pflicht sind
 * (z.literal(true), siehe clubJoinInputSchema) — ein Pflicht-Haken neben
 * freiwilligen laesst auch die freiwilligen wie Pflicht wirken.
 */
export const realConsentPurposeSchema = z
  .enum(['photos_internal', 'photos_public', 'chat', 'newsletter'])
  .openapi('RealConsentPurpose');

/** Rechtstexte, die zur KENNTNIS genommen werden (keine Einwilligung). */
export const acknowledgementKindSchema = z
  .enum(['terms', 'privacy'])
  .openapi('AcknowledgementKind');

/**
 * Eine Einwilligung erteilen ODER widerrufen.
 *
 * granted=false IST der Widerruf (Art. 7 Abs. 3) — app.consents ist
 * append-only, ein Widerruf ist eine NEUE Zeile, kein UPDATE und kein DELETE.
 * member_id ist Pflicht: ohne Mitgliedszeile gibt es kein Geburtsdatum und
 * keine Vormundschaft, also auch keine Art.-8-Pruefung.
 */
export const consentDeclareSchema = z
  .object({
    member_id: uuid,
    purpose: realConsentPurposeSchema,
    granted: z.boolean(),
    policy_version: z.string().max(120).optional(),
  })
  .openapi('ConsentDeclare');

/** Der WIRKSAME Stand einer Einwilligung (app.effective_consents). */
export const effectiveConsentSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    member_id: uuid.nullable(),
    subject_profile_id: uuid.nullable(),
    purpose: consentPurposeSchema,
    granted_by_profile_id: uuid,
    legal_document_id: uuid.nullable(),
    policy_version: z.string().nullable(),
    recorded_at: timestamp,
    /** DAS Feld, das zaehlt - inklusive Ablauf am 16. Geburtstag. */
    effective: z.boolean(),
    /** Was in der Zeile steht (vor der Auswertung des Alters). */
    recorded_granted: z.boolean(),
    /** true = von einer erziehungsberechtigten Person erklaert (Art. 8). */
    granted_by_guardian: z.boolean(),
    /** valid | revoked | expired_age_16 */
    state: z.enum(['valid', 'revoked', 'expired_age_16']),
  })
  .openapi('EffectiveConsent');

/** Eine Kenntnisnahme (app.policy_acknowledgements) - KEINE Einwilligung. */
export const policyAcknowledgementSchema = z
  .object({
    id: uuid,
    profile_id: uuid,
    club_id: uuid.nullable(),
    kind: acknowledgementKindSchema,
    /** NOT NULL - eine Kenntnisnahme ohne Fassung waere kein Nachweis. */
    legal_document_id: uuid,
    acknowledged_at: timestamp,
  })
  .openapi('PolicyAcknowledgement');

/** Eine Einwilligung (append-only: ein Widerruf ist eine neue Zeile). */
export const memberConsentSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    member_id: uuid.nullable(),
    subject_profile_id: uuid.nullable(),
    purpose: consentPurposeSchema,
    granted: z.boolean(),
    /** WER hat erklaert - bei Kindern der Sorgeberechtigte (Art. 8 DSGVO). */
    granted_by_profile_id: uuid,
    legal_document_id: uuid.nullable(),
    policy_version: z.string().nullable(),
    recorded_at: timestamp,
  })
  .openapi('MemberConsent');

/** Eine unveraenderliche Fassung eines Rechtstextes (internal.legal_documents). */
export const legalDocumentVersionSchema = z
  .object({
    id: uuid,
    kind: z.enum(['terms', 'privacy', 'imprint']),
    version: z.number().int(),
    locale: z.enum(['de', 'en']),
    title: z.string(),
    published_at: timestamp,
  })
  .openapi('LegalDocumentVersion');

/**
 * Antwort auf den Widerruf eines Vereinscodes.
 *
 * Ein 204 waere hier naheliegend gewesen, aber die Vertragspruefung
 * (packages/contracts/codegen/check.mjs:107-112) verlangt von JEDER Operation
 * ein 2xx MIT JSON-Schema — und das zu Recht: ein leeres 204 zwingt jeden
 * Client zu raten, was passiert ist. Der Zeitpunkt des Widerrufs ist die
 * Information, die die Oberflaeche danach anzeigen will ("Code gesperrt seit …").
 */
export const clubJoinCodeRevokedSchema = z
  .object({
    club_id: uuid,
    join_code_revoked_at: timestamp,
  })
  .openapi('ClubJoinCodeRevoked');

// ============================================================================
// Modul-Schalter pro Verein (0044). Siehe die Abgrenzung im Kopf der Migration:
//   gekauft (entitlement) -> eingeschaltet (dieses hier) -> erlaubt (capability)
// ============================================================================

/**
 * Was der Modul-Schalter WIRKLICH bewirkt (app.module_enforcement, 0044).
 * Muster aus 0033: ein Schalter, der nur das Menue versteckt, darf NICHT als
 * "aus" beschriftet werden.
 *
 * - `enforced`  RLS. Aus = 0 Zeilen beim Lesen, 42501/403 beim Schreiben.
 * - `partial`   RLS greift, aber ein Server-Pfad umgeht sie (service_role).
 * - `menu_only` Versteckt nur die Kachel. Die Daten bleiben per API abrufbar.
 * - `null`      Kernmodul — es gibt keinen Schalter.
 */
export const moduleEnforcementSchema = z.enum(['enforced', 'partial', 'menu_only']);

/**
 * Ein Modul samt Schalterstellung fuer EINEN Verein (app.club_module_states).
 *
 * `available` ist die UND-Kette OHNE die Faehigkeit: gekauft (pro_ok) UND
 * eingeschaltet (enabled). Ob die aufrufende PERSON das Modul benutzen darf,
 * ist die dritte, unabhaengige Frage (GET /me/capabilities) — bewusst nicht
 * hier hineingemischt.
 */
export const clubModuleStateSchema = z
  .object({
    module_key: z.string(),
    label_de: z.string(),
    label_en: z.string(),
    desc_de: z.string(),
    desc_en: z.string(),
    sort: z.number().int(),
    /** Kernmodul: kein Schalter (Mitglieder / Finanzen-GoBD / Verwaltung). */
    core: z.boolean(),
    /** PRO-Modul: haengt zusaetzlich an app.is_club_pro (0012). */
    requires_pro: z.boolean(),
    /** null <=> core: bei einem Kernmodul stellt sich die Frage nicht. */
    enforcement: moduleEnforcementSchema.nullable(),
    enabled: z.boolean(),
    /** Entitlement erfuellt? Bei requires_pro=false immer true. */
    pro_ok: z.boolean(),
    /** enabled AND pro_ok — der Schalter hebelt das PRO-Gate NICHT aus. */
    available: z.boolean(),
  })
  .openapi('ClubModuleState');

/** Einen Schalter stellen. Mehr gibt es nicht zu setzen — der Rest ist Katalog. */
export const clubModuleSetSchema = z
  .object({
    enabled: z.boolean(),
  })
  .openapi('ClubModuleSet');

// ----------------------------------------------------------------------------
// Support-Tickets (Migration 0052) — Verein <-> Betreiber.
//
// Schema-Namen: "Message" allein ist als Contract-Name verboten (kollidiert mit
// Swift/Foundation), deshalb durchgehend das Praefix Support*.
//
// Sichtbarkeit ist NICHT Sache dieser Schemas: ein Ticket sehen nur der
// Vereinsvorstand (app.is_club_admin) und der Betreiber
// (app.is_platform_admin) — durchgesetzt von RLS (0052) und den Guards in
// routes/support.ts.
// ----------------------------------------------------------------------------

export const supportTicketStatusSchema = z
  .enum(['open', 'in_progress', 'waiting_on_club', 'closed'])
  .openapi('SupportTicketStatus');

export const supportTicketPrioritySchema = z
  .enum(['low', 'normal', 'high', 'urgent'])
  .openapi('SupportTicketPriority');

/** Seite, von der eine Nachricht stammt (app.support_actor). */
export const supportActorSchema = z.enum(['club', 'platform']).openapi('SupportActor');

/**
 * Die Felder eines Tickets als blosse Shape — NICHT als registriertes Schema.
 *
 * ZUSAMMENFUEHRUNG: hier stand `supportTicketSchema.extend({messages})`. Das
 * ist das einzige .extend() auf einem bereits mit .openapi() registrierten
 * Schema in dieser Datei gewesen, und es erzeugt im Vertrag ein
 * `allOf: [$ref SupportTicket, {messages}]`. Der Codegen kann diese Form nicht
 * (codegen/lib/spec.mjs:85-99 kennt allOf nur als "$ref mit default") und ist
 * daran gescheitert — aufgefallen erst hier, weil der Codegen bewusst zuletzt
 * laeuft. Das Hausmuster in dieser Datei ist ueberall sonst das flache Objekt
 * mit geschachtelter Liste (meSchema:267, competitionSchema:1385, …).
 * Die gemeinsame Shape haelt beide Schemata zusammen, ohne den Vertrag zu
 * verbiegen und ohne ein Feld doppelt zu pflegen.
 */
const supportTicketFields = {
  id: uuid,
  club_id: uuid,
  /** Anzeigename des Vereins — der Betreiber sieht Tickets mandantenuebergreifend. */
  club_name: z.string().nullable(),
  created_by_member_id: uuid,
  /** Wer es aufgemacht hat, als fertiger Anzeigename ("Thomas Krueger"). */
  created_by_name: z.string().nullable(),
  subject: z.string(),
  status: supportTicketStatusSchema,
  priority: supportTicketPrioritySchema,
  /** Zeitpunkt der letzten Nachricht (Trigger-gepflegt, nie vom Client). */
  last_reply_at: timestamp.nullable(),
  /** Seite der letzten Nachricht (Trigger-gepflegt, nie vom Client). */
  last_reply_by: supportActorSchema.nullable(),
  message_count: z.number().int(),
  closed_at: timestamp.nullable(),
  created_at: timestamp,
  updated_at: timestamp,
} as const;

export const supportTicketSchema = z.object(supportTicketFields).openapi('SupportTicket');

export const supportMessageSchema = z
  .object({
    id: uuid,
    ticket_id: uuid,
    club_id: uuid,
    author_profile_id: uuid,
    /** Anzeigename der schreibenden Person. */
    author_name: z.string().nullable(),
    author_kind: supportActorSchema,
    body: z.string(),
    created_at: timestamp,
  })
  .openapi('SupportMessage');

/** Ein Ticket samt Verlauf (GET /support/tickets/{id}). Siehe supportTicketFields. */
export const supportTicketDetailSchema = z
  .object({ ...supportTicketFields, messages: z.array(supportMessageSchema) })
  .openapi('SupportTicketDetail');

/**
 * Ticket aufmachen. club_id im Body wie bei routineCreateSchema (Hausmuster
 * fuer nicht-geschachtelte Routen).
 *
 * created_by_member_id ist bewusst NICHT im Vertrag: die API loest die eigene
 * Mitgliedszeile aus dem Token auf. Sonst legte ein Vorstand das Ticket im
 * Namen einer Kollegin an — die INSERT-Policy (0052) verboete es ohnehin, aber
 * der Vertrag soll gar nicht erst danach fragen.
 *
 * Die Eroeffnungsnachricht ist Pflicht: ein Ticket ohne Text ist fuer den
 * Betreiber wertlos.
 */
export const supportTicketCreateSchema = z
  .object({
    club_id: uuid,
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(10000),
  })
  .openapi('SupportTicketCreate');

export const supportMessageCreateSchema = z
  .object({
    body: z.string().min(1).max(10000),
  })
  .openapi('SupportMessageCreate');

/**
 * Status/Prioritaet aendern — BETREIBER-VORBEHALT (0052: support_tickets_update
 * = app.is_platform_admin()). Beide Felder optional, aber mindestens eines muss
 * kommen: ein leeres PATCH ist ein Client-Fehler, kein No-Op.
 */
export const supportTicketUpdateSchema = z
  .object({
    status: supportTicketStatusSchema.optional(),
    priority: supportTicketPrioritySchema.optional(),
  })
  .refine((v) => v.status !== undefined || v.priority !== undefined, {
    message: 'mindestens ein Feld erforderlich (status oder priority) / at least one field required',
  })
  .openapi('SupportTicketUpdate');
