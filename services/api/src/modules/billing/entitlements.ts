// ============================================================================
// modules/billing/entitlements.ts - THE single writer for app.entitlements.
//
// Blueprint ADR-E6: entitlements is the only license/tier truth, written
// EXCLUSIVELY by the API layer in service mode (clients are structurally
// read-only - no INSERT/UPDATE grant, no policy). Every write goes through
// applyEntitlementChange():
//   * state machine  trial -> active -> past_due -> canceled (+ recovery)
//   * tier           basic | pro | premium
//   * audit          append-only entries in metadata.audit + structured log
// The v1 leak (activate_premium callable by every client) is impossible by
// construction: nothing else in the codebase writes this table.
//
// The store is an interface so the state machine is unit-testable without a
// database; the SQL implementation lives in store.ts and MUST only ever be
// constructed inside withServiceRole() (see db.ts - service mode call sites
// authorize on their own).
// ============================================================================

export const ENTITLEMENT_STATUSES = ['trial', 'active', 'past_due', 'canceled'] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export const ENTITLEMENT_TIERS = ['basic', 'pro', 'premium'] as const;
export type EntitlementTier = (typeof ENTITLEMENT_TIERS)[number];

export type EntitlementSource = 'stripe' | 'revenuecat' | 'manual';

/**
 * Allowed status transitions. A same-status "transition" is always allowed
 * (idempotent refresh, e.g. a renewal keeps `active` but bumps valid_until).
 */
const TRANSITIONS: Record<EntitlementStatus, readonly EntitlementStatus[]> = {
  trial: ['active', 'canceled'], // trial converts or is abandoned
  active: ['past_due', 'canceled'], // payment failed / subscription ended
  past_due: ['active', 'canceled'], // payment recovered / dunning gave up
  canceled: ['active'], // resubscribe
};

/** States a NEW entitlement row may start in. */
export const INITIAL_STATUSES: readonly EntitlementStatus[] = ['trial', 'active'];

export function canTransition(from: EntitlementStatus, to: EntitlementStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/** Domain error: the requested write violates billing invariants. */
export class BillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingError';
  }
}

/** Domain error: the state machine forbids this status transition. */
export class EntitlementTransitionError extends BillingError {
  constructor(
    public readonly from: EntitlementStatus,
    public readonly to: EntitlementStatus,
  ) {
    super(`illegal entitlement transition: ${from} -> ${to}`);
    this.name = 'EntitlementTransitionError';
  }
}

// ---------------------------------------------------------------------------
// Storage contract (implemented by the SQL store and by test fakes)
// ---------------------------------------------------------------------------

export interface EntitlementRow {
  id: string;
  subject_type: 'club' | 'profile';
  subject_id: string;
  entitlement: string;
  source: EntitlementSource;
  product_id: string | null;
  provider_ref: string | null;
  valid_until: string | Date | null;
  metadata: Record<string, unknown>;
}

export interface NewEntitlementRow {
  subject_type: 'club' | 'profile';
  subject_id: string;
  entitlement: string;
  source: EntitlementSource;
  product_id: string | null;
  provider_ref: string | null;
  valid_until: string | null;
  metadata: Record<string, unknown>;
}

export interface EntitlementPatch {
  source: EntitlementSource;
  provider_ref: string | null;
  valid_until: string | null;
  metadata: Record<string, unknown>;
  /** undefined = keep the existing product_id */
  product_id?: string | null;
}

export interface EntitlementStore {
  findProductByCode(code: string): Promise<{ id: string } | undefined>;
  getEntitlement(
    subjectType: 'club' | 'profile',
    subjectId: string,
    entitlement: string,
  ): Promise<EntitlementRow | undefined>;
  insertEntitlement(row: NewEntitlementRow): Promise<void>;
  updateEntitlement(id: string, patch: EntitlementPatch): Promise<void>;
}

// ---------------------------------------------------------------------------
// The single write operation
// ---------------------------------------------------------------------------

export interface EntitlementChange {
  subject_type: 'club' | 'profile';
  subject_id: string;
  /** e.g. 'club_license' | 'personal_pro' */
  entitlement: string;
  status: EntitlementStatus;
  tier: EntitlementTier;
  source: EntitlementSource;
  /** products.code - resolved to product_id; unknown codes are rejected. */
  product_code?: string;
  /** Stripe subscription id / RevenueCat transaction id / manual note. */
  provider_ref?: string;
  /** ISO timestamp or null (= open-ended). undefined = keep existing. */
  valid_until?: string | null;
  /** Audit: WHO caused this (e.g. 'webhook:stripe:evt_123', 'system:seed'). */
  actor: string;
  /** Audit: WHY (e.g. 'stripe customer.subscription.updated (past_due)'). */
  reason: string;
}

export interface AppliedEntitlement {
  created: boolean;
  from_status: EntitlementStatus | undefined;
  status: EntitlementStatus;
  tier: EntitlementTier;
}

/** Audit entries kept in metadata.audit (bounded; oldest are dropped). */
export const AUDIT_MAX_ENTRIES = 20;

/**
 * Legacy/manual rows (e.g. the seeded beta grandfather entitlement) carry no
 * machine status in metadata - they are treated as 'active'.
 */
export function readEntitlementStatus(metadata: Record<string, unknown>): EntitlementStatus {
  const v = metadata['status'];
  return typeof v === 'string' && (ENTITLEMENT_STATUSES as readonly string[]).includes(v)
    ? (v as EntitlementStatus)
    : 'active';
}

function toIsoOrNull(v: string | Date | null): string | null {
  if (v === null) return null;
  return v instanceof Date ? v.toISOString() : v;
}

/**
 * Apply one entitlement change - validates the state machine, resolves the
 * product code, appends an audit entry and upserts the row for
 * (subject_type, subject_id, entitlement). Callers MUST run this inside
 * withServiceRole() (webhook service / explicitly authorized system ops).
 */
export async function applyEntitlementChange(
  store: EntitlementStore,
  change: EntitlementChange,
): Promise<AppliedEntitlement> {
  // resolve product code first - an unknown code is a config error, not data
  let productId: string | undefined;
  if (change.product_code !== undefined) {
    const product = await store.findProductByCode(change.product_code);
    if (!product) throw new BillingError(`unknown product code '${change.product_code}'`);
    productId = product.id;
  }

  const existing = await store.getEntitlement(
    change.subject_type,
    change.subject_id,
    change.entitlement,
  );
  const fromStatus = existing ? readEntitlementStatus(existing.metadata) : undefined;

  if (fromStatus !== undefined) {
    if (!canTransition(fromStatus, change.status)) {
      throw new EntitlementTransitionError(fromStatus, change.status);
    }
  } else if (!INITIAL_STATUSES.includes(change.status)) {
    throw new BillingError(
      `a new entitlement cannot start in status '${change.status}' (allowed: ${INITIAL_STATUSES.join(', ')})`,
    );
  }

  const auditEntry = {
    at: new Date().toISOString(),
    actor: change.actor,
    reason: change.reason,
    from_status: fromStatus ?? null,
    to_status: change.status,
    tier: change.tier,
  };
  const previousAudit =
    existing && Array.isArray(existing.metadata['audit'])
      ? (existing.metadata['audit'] as unknown[])
      : [];
  const metadata: Record<string, unknown> = {
    ...(existing?.metadata ?? {}),
    status: change.status,
    tier: change.tier,
    audit: [...previousAudit, auditEntry].slice(-AUDIT_MAX_ENTRIES),
  };

  if (existing) {
    await store.updateEntitlement(existing.id, {
      source: change.source,
      provider_ref: change.provider_ref ?? existing.provider_ref,
      valid_until:
        change.valid_until !== undefined ? change.valid_until : toIsoOrNull(existing.valid_until),
      metadata,
      ...(productId !== undefined ? { product_id: productId } : {}),
    });
  } else {
    await store.insertEntitlement({
      subject_type: change.subject_type,
      subject_id: change.subject_id,
      entitlement: change.entitlement,
      source: change.source,
      product_id: productId ?? null,
      provider_ref: change.provider_ref ?? null,
      valid_until: change.valid_until ?? null,
      metadata,
    });
  }

  // structured audit log line - one per entitlement write, greppable
  console.info(
    `[billing] entitlement audit: ${change.subject_type}/${change.subject_id} ` +
      `${change.entitlement} ${fromStatus ?? '(new)'} -> ${change.status} ` +
      `tier=${change.tier} source=${change.source} actor=${change.actor} reason=${change.reason}`,
  );

  return { created: !existing, from_status: fromStatus, status: change.status, tier: change.tier };
}
