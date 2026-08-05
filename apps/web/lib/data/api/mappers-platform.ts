import type * as M from "@/lib/api/generated";
import type {
  PlatformEntitlement,
  PlatformEntitlementSource,
  PlatformEntitlementStatus,
  PlatformPayment,
  PlatformPaymentsResult,
  PlatformProduct,
  PlatformRoutineModeration,
  PlatformSettings,
  PlatformSystemInfo,
  PlatformTier,
} from "@/lib/types";
import type { PlatformRoutineWire } from "./modules-platform";

/**
 * Mapper der Betreiber-/Plattform-Konsole: API-Wire-Format (snake_case) →
 * View-Typen (lib/types, camelCase). Ausgelagert aus api/mappers.ts (< 400
 * Zeilen). z.coerce macht viele Aggregat-Zahlen im Spec nullable — 0 bzw. der
 * jeweilige Default ist reiner Typ-Fallback (DB-Spalten sind i. d. R. NOT NULL).
 *
 * DATENSCHUTZ: PlatformSettings kennt bewusst kein Passwort-Feld — der Server
 * liefert ausschließlich smtp.password_set:boolean, das hier gespiegelt wird.
 */

/** Feature-Flags (Wire: Record<string,unknown>) auf eine flache Bool-Map casten. */
function toBoolFlags(raw: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (raw) for (const [key, value] of Object.entries(raw)) out[key] = Boolean(value);
  return out;
}

export function mapPlatformEntitlement(w: M.PlatformEntitlementRow): PlatformEntitlement {
  return {
    clubId: w.club_id,
    clubName: w.club_name,
    shortName: w.short_name ?? undefined,
    memberCount: w.member_count ?? 0,
    entitlementId: w.entitlement_id ?? undefined,
    tier: (w.tier as PlatformTier | null) ?? undefined,
    status: (w.status as PlatformEntitlementStatus | null) ?? undefined,
    source: (w.source as PlatformEntitlementSource | null) ?? undefined,
    providerRef: w.provider_ref ?? undefined,
    validUntil: w.valid_until ?? undefined,
    updatedAt: w.updated_at ?? undefined,
  };
}

export function mapPlatformPayment(w: M.PlatformPaymentEvent): PlatformPayment {
  return {
    id: w.id,
    provider: w.provider,
    eventId: w.event_id,
    eventType: w.event_type ?? undefined,
    status: w.status,
    error: w.error ?? undefined,
    receivedAt: w.received_at,
    processedAt: w.processed_at ?? undefined,
  };
}

export function mapPlatformPayments(w: M.PlatformPayments): PlatformPaymentsResult {
  return {
    events: w.events.map(mapPlatformPayment),
    subscriptionSummary: {
      active: w.subscription_summary.active ?? 0,
      trial: w.subscription_summary.trial ?? 0,
      pastDue: w.subscription_summary.past_due ?? 0,
      canceled: w.subscription_summary.canceled ?? 0,
      licensedClubs: w.subscription_summary.licensed_clubs ?? 0,
    },
    page: {
      total: w.page.total ?? 0,
      limit: w.page.limit ?? 0,
      offset: w.page.offset ?? 0,
    },
  };
}

export function mapPlatformProduct(w: M.PlatformProduct): PlatformProduct {
  return {
    id: w.id,
    code: w.code,
    kind: w.kind,
    name: w.name,
    description: w.description ?? undefined,
    priceCents: w.price_cents ?? undefined,
    currency: w.currency,
    billingInterval: w.billing_interval,
    maxMembers: w.max_members ?? undefined,
    active: w.active,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}

export function mapPlatformSystem(w: M.PlatformSystem): PlatformSystemInfo {
  return {
    appVersion: w.app_version,
    authMode: w.auth_mode,
    db: {
      clubs: w.db.clubs ?? 0,
      users: w.db.users ?? 0,
      members: w.db.members ?? 0,
      activeEntitlements: w.db.active_entitlements ?? 0,
      webhookEvents: w.db.webhook_events ?? 0,
      sizeBytes: w.db.size_bytes ?? 0,
      sizePretty: w.db.size_pretty,
    },
    migrations: {
      count: w.migrations.count ?? 0,
      latest: w.migrations.latest ?? undefined,
      list: [...w.migrations.list],
    },
    health: {
      status: w.health.status,
      dbTime: w.health.db_time,
    },
  };
}

export function mapPlatformSettings(w: M.PlatformSettings): PlatformSettings {
  return {
    smtp: {
      host: w.smtp.host,
      port: w.smtp.port ?? undefined,
      user: w.smtp.user,
      from: w.smtp.from,
      secure: w.smtp.secure,
      passwordSet: w.smtp.password_set,
    },
    legal: {
      impressum: w.legal.impressum,
      impressumEn: w.legal.impressum_en,
      datenschutz: w.legal.datenschutz,
      datenschutzEn: w.legal.datenschutz_en,
      agb: w.legal.agb,
      agbEn: w.legal.agb_en,
    },
    content: {
      websiteTitle: w.content.website_title,
      websiteSubtitle: w.content.website_subtitle,
      seoTitle: w.content.seo_title,
      seoDescription: w.content.seo_description,
      seoKeywords: w.content.seo_keywords,
    },
    featureFlags: toBoolFlags(w.feature_flags),
    billing: { trialDays: Number(w.billing?.trial_days ?? 14) },
    updatedAt: w.updated_at,
  };
}

/**
 * Küren-Moderation (GET /platform/routines) → View-Typ.
 *
 * Der Wire-Typ kommt aus ./modules-platform (von Hand getippt), nicht aus dem
 * Generat: die Route ist neu, und der Codegen läuft erst beim Zusammenführen.
 * Nach `npm run generate` wird daraus M.PlatformRoutineRow — die Zuweisungen
 * unten bleiben, wie sie sind.
 */
export function mapPlatformRoutine(w: PlatformRoutineWire): PlatformRoutineModeration {
  return {
    id: w.id,
    clubId: w.club_id,
    clubName: w.club_name,
    title: w.title,
    status: w.status,
    ...(w.category !== null ? { category: w.category } : {}),
    ...(w.music_title !== null ? { musicTitle: w.music_title } : {}),
    ...(w.music_artist !== null ? { musicArtist: w.music_artist } : {}),
    ...(w.music_duration_ms !== null ? { musicDurationMs: w.music_duration_ms } : {}),
    ...(w.audio_asset_id !== null ? { audioAssetId: w.audio_asset_id } : {}),
    ...(w.audio_mime_type !== null ? { audioMimeType: w.audio_mime_type } : {}),
    ...(w.audio_size_bytes !== null ? { audioSizeBytes: w.audio_size_bytes } : {}),
    skaterCount: w.skater_count,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}
