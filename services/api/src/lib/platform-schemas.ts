// ============================================================================
// lib/platform-schemas.ts - Zod schemas for the Betreiber-Konsole (super-admin
// console). Kept out of the already-large validation.ts so this feature owns
// one focused, <400-line contract module (Blueprint ADR-E1: one vocabulary,
// snake_case on the wire). Every schema here feeds the OpenAPI spec + codegen.
// ============================================================================

import { z } from '@hono/zod-openapi';

export const uuid = z.string().uuid();
const timestamp = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString() : v));

// License vocabulary — mirrors modules/billing/entitlements.ts so the console
// and the billing state machine speak the same tiers/statuses.
export const platformTierSchema = z.enum(['basic', 'pro', 'premium']).openapi('PlatformTier');
export const platformStatusSchema = z
  .enum(['trial', 'active', 'past_due', 'canceled'])
  .openapi('PlatformEntitlementStatus');

// ---------------------------------------------------------------------------
// Lizenzen — GET /platform/entitlements, PATCH /platform/entitlements/{clubId}
// ---------------------------------------------------------------------------

/** One club with its club_license state (cross-club overview). */
export const platformEntitlementRowSchema = z
  .object({
    club_id: uuid,
    club_name: z.string(),
    short_name: z.string().nullable(),
    /** number of active, non-deleted members (capacity view). */
    member_count: z.coerce.number().int(),
    /** app.entitlements.id of the club_license row, or null when none exists yet. */
    entitlement_id: uuid.nullable(),
    /** metadata.tier — 'basic'|'pro'|'premium' — or null when unlicensed. */
    tier: z.string().nullable(),
    /** metadata.status — 'trial'|'active'|'past_due'|'canceled' — or null. */
    status: z.string().nullable(),
    source: z.enum(['stripe', 'revenuecat', 'manual']).nullable(),
    provider_ref: z.string().nullable(),
    valid_until: timestamp.nullable(),
    updated_at: timestamp.nullable(),
  })
  .openapi('PlatformEntitlementRow');

/**
 * Set a club's license by hand (support/sales action). tier + status are the
 * target license state; the entitlements state machine validates the
 * transition. valid_until sets the term (null = open-ended); trial_days is a
 * convenience for status='trial' (sets valid_until = now + N days, overriding
 * valid_until). reason is written to the append-only entitlement audit trail.
 */
export const platformEntitlementPatchSchema = z
  .object({
    tier: platformTierSchema,
    status: platformStatusSchema,
    /** ISO 8601, or null for an open-ended term. Omit to keep the existing term. */
    valid_until: z.string().datetime({ offset: true }).nullable().optional(),
    /** status='trial' convenience: term = now + trial_days (overrides valid_until). */
    trial_days: z.number().int().min(1).max(365).optional(),
    /** Audit reason written to metadata.audit; defaults to a generic note. */
    reason: z.string().min(1).max(500).optional(),
  })
  .openapi('PlatformEntitlementPatch');

// ---------------------------------------------------------------------------
// Zahlungen — GET /platform/payments
// ---------------------------------------------------------------------------

export const platformPaymentEventSchema = z
  .object({
    id: uuid,
    provider: z.string(),
    event_id: z.string(),
    event_type: z.string().nullable(),
    status: z.string(),
    error: z.string().nullable(),
    received_at: timestamp,
    processed_at: timestamp.nullable(),
  })
  .openapi('PlatformPaymentEvent');

/** Summed club_license lifecycle states across all clubs (Abo-Zustände). */
export const platformSubscriptionSummarySchema = z
  .object({
    active: z.coerce.number().int(),
    trial: z.coerce.number().int(),
    past_due: z.coerce.number().int(),
    canceled: z.coerce.number().int(),
    /** clubs with any club_license entitlement row. */
    licensed_clubs: z.coerce.number().int(),
  })
  .openapi('PlatformSubscriptionSummary');

export const platformPaymentsSchema = z
  .object({
    events: z.array(platformPaymentEventSchema),
    subscription_summary: platformSubscriptionSummarySchema,
    page: z
      .object({
        total: z.coerce.number().int(),
        limit: z.coerce.number().int(),
        offset: z.coerce.number().int(),
      })
      .openapi('PlatformPaymentsPage'),
  })
  .openapi('PlatformPayments');

// ---------------------------------------------------------------------------
// Produkte / Monetarisierung — GET /platform/products, PATCH /platform/products/{id}
// ---------------------------------------------------------------------------

/** Full product row incl. inactive ones (the console sees the whole catalog). */
export const platformProductSchema = z
  .object({
    id: uuid,
    code: z.string(),
    kind: z.enum(['club_license', 'personal_pro']),
    name: z.string(),
    description: z.string().nullable(),
    price_cents: z.coerce.number().int(),
    currency: z.string(),
    billing_interval: z.enum(['month', 'year']),
    max_members: z.coerce.number().int().nullable(),
    active: z.boolean(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('PlatformProduct');

export const platformProductPatchSchema = z
  .object({
    /** Blueprint §4: money is integer cents, never float. */
    price_cents: z.number().int().nonnegative().optional(),
    active: z.boolean().optional(),
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('PlatformProductPatch');

// ---------------------------------------------------------------------------
// System — GET /platform/system
// ---------------------------------------------------------------------------

export const platformSystemSchema = z
  .object({
    app_version: z.string(),
    auth_mode: z.enum(['dev', 'prod']),
    db: z
      .object({
        clubs: z.coerce.number().int(),
        users: z.coerce.number().int(),
        members: z.coerce.number().int(),
        active_entitlements: z.coerce.number().int(),
        webhook_events: z.coerce.number().int(),
        size_bytes: z.coerce.number().int(),
        size_pretty: z.string(),
      })
      .openapi('PlatformSystemDb'),
    migrations: z
      .object({
        count: z.coerce.number().int(),
        latest: z.string().nullable(),
        list: z.array(z.string()),
      })
      .openapi('PlatformSystemMigrations'),
    health: z
      .object({
        status: z.literal('ok'),
        db_time: timestamp,
      })
      .openapi('PlatformSystemHealth'),
  })
  .openapi('PlatformSystem');

// ---------------------------------------------------------------------------
// Einstellungen — GET/PATCH /platform/settings
// ---------------------------------------------------------------------------

/** SMTP as RETURNED: password is masked to password_set (never the value). */
export const platformSmtpSchema = z
  .object({
    host: z.string(),
    port: z.coerce.number().int(),
    user: z.string(),
    from: z.string(),
    secure: z.boolean(),
    /** DATENSCHUTZ: true when a password is stored; the value is never returned. */
    password_set: z.boolean(),
  })
  .openapi('PlatformSmtp');

// Rechtstexte-OVERRIDE des Betreibers, ZWEISPRACHIG. Die *_en-Felder kamen mit
// der öffentlichen Rechtstext-Anzeige dazu: v2 ist durchgängig DE+EN, also muss
// auch ein vom Betreiber gepflegter Text beide Sprachen tragen können. Ein
// leerer Wert bedeutet nicht "kein Text", sondern "zeig den eingebauten
// Standard" (LegalPage DEFAULT_LEGAL) — die Auflösung passiert im Web.
export const platformLegalSchema = z
  .object({
    impressum: z.string(),
    impressum_en: z.string(),
    datenschutz: z.string(),
    datenschutz_en: z.string(),
    agb: z.string(),
    agb_en: z.string(),
  })
  .openapi('PlatformLegal');

// Was GET /public/legal ausliefert — OHNE Auth, deshalb bewusst NUR die
// Rechtstexte und nichts sonst aus platform_settings (kein SMTP, keine Flags).
// Pro Dokument je ein deutscher und ein englischer Text; leer = eingebauter
// Standard.
export const publicLegalSchema = z
  .object({
    impressum: z.object({ de: z.string(), en: z.string() }),
    datenschutz: z.object({ de: z.string(), en: z.string() }),
    agb: z.object({ de: z.string(), en: z.string() }),
  })
  .openapi('PublicLegal');

export const platformContentSchema = z
  .object({
    website_title: z.string(),
    website_subtitle: z.string(),
    seo_title: z.string(),
    seo_description: z.string(),
    seo_keywords: z.string(),
  })
  .openapi('PlatformContent');

/** Abrechnungs-Konfiguration des Betreibers (aktuell: Default-Testphase). */
export const platformBillingSchema = z
  .object({
    /** Default-Länge der Selbst-Registrierungs-Testphase in Tagen (1..365). */
    trial_days: z.number().int().min(1).max(365),
  })
  .openapi('PlatformBilling');

export const platformSettingsSchema = z
  .object({
    smtp: platformSmtpSchema,
    legal: platformLegalSchema,
    content: platformContentSchema,
    feature_flags: z.record(z.boolean()),
    billing: platformBillingSchema,
    updated_at: timestamp,
  })
  .openapi('PlatformSettings');

/** SMTP patch: every field optional; password is WRITE-ONLY (never echoed). */
export const platformSmtpPatchSchema = z
  .object({
    host: z.string().min(1).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    user: z.string().min(1).optional(),
    from: z.string().min(1).optional(),
    secure: z.boolean().optional(),
    /** Set/replace the SMTP password. Omit to keep the stored one. */
    password: z.string().min(1).optional(),
  })
  .openapi('PlatformSmtpPatch');

export const platformLegalPatchSchema = z
  .object({
    impressum: z.string().optional(),
    impressum_en: z.string().optional(),
    datenschutz: z.string().optional(),
    datenschutz_en: z.string().optional(),
    agb: z.string().optional(),
    agb_en: z.string().optional(),
  })
  .openapi('PlatformLegalPatch');

export const platformContentPatchSchema = z
  .object({
    website_title: z.string().optional(),
    website_subtitle: z.string().optional(),
    seo_title: z.string().optional(),
    seo_description: z.string().optional(),
    seo_keywords: z.string().optional(),
  })
  .openapi('PlatformContentPatch');

export const platformBillingPatchSchema = z
  .object({
    trial_days: z.number().int().min(1).max(365).optional(),
  })
  .openapi('PlatformBillingPatch');

export const platformSettingsPatchSchema = z
  .object({
    smtp: platformSmtpPatchSchema.optional(),
    legal: platformLegalPatchSchema.optional(),
    content: platformContentPatchSchema.optional(),
    feature_flags: z.record(z.boolean()).optional(),
    billing: platformBillingPatchSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty update' })
  .openapi('PlatformSettingsPatch');

// ---------------------------------------------------------------------------
// Küren-Moderation — GET /platform/routines
//
// Warum es diesen Endpoint gibt: der Betreiber muss die Küren ALLER Vereine
// sichten koennen ("nicht damit da illegale Sachen gemacht werden"). Ueber die
// vorhandene Route ginge das nur als /routines?club_id=… je Verein — also N
// Requests, N Protokollzeilen und keine vereinsuebergreifende Sortierung. Diese
// Sicht ist EIN Request, EINE Protokollzeile (die Audit-Middleware aus 0051
// greift, wie bei jedem /platform/*-Aufruf) und club-uebergreifend sortierbar.
// ---------------------------------------------------------------------------

/**
 * Eine Kür in der Moderations-Sicht: die fachlichen Felder plus der Verein, zu
 * dem sie gehoert (der Betreiber sieht mandantenuebergreifend).
 *
 * Bewusst NICHT enthalten: die Namen der Laeufer:innen. Es sind fast immer
 * KINDER, und fuer die Moderationsfrage ("ist die Musik/der Titel in Ordnung?")
 * sind sie nicht noetig. Wer sie wirklich braucht, geht ueber den
 * Vereins-Umschalter in den Verein — und genau dieser Schritt steht dann
 * einzeln im Protokoll. Datensparsamkeit als Voreinstellung (Art. 25 Abs. 2
 * DSGVO), nicht als Nachgedanke.
 */
export const platformRoutineRowSchema = z
  .object({
    id: uuid,
    club_id: uuid,
    club_name: z.string(),
    title: z.string(),
    status: z.enum(['draft', 'ready', 'competition', 'archived']),
    category: z.string().nullable(),
    music_title: z.string().nullable(),
    music_artist: z.string().nullable(),
    music_duration_ms: z.coerce.number().int().nullable(),
    /** Die verknuepfte Audio-Datei — null, wenn keine hinterlegt ist. */
    audio_asset_id: uuid.nullable(),
    /** MIME-Typ der Audio-Datei (aus app.media_assets) — null ohne Datei. */
    audio_mime_type: z.string().nullable(),
    /** Groesse der Audio-Datei in Bytes — null ohne Datei. */
    audio_size_bytes: z.coerce.number().int().nullable(),
    /** Anzahl der Laeufer:innen — die Zahl, nicht die Menschen (s. o.). */
    skater_count: z.coerce.number().int(),
    created_at: timestamp,
    updated_at: timestamp,
  })
  .openapi('PlatformRoutineRow');
