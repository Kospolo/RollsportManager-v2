// ============================================================================
// routes/platform-licenses.ts - Betreiber-Konsole: Lizenzen (Referenz §3.3
// lizenzen.html / premium.html).
//
//   GET   /platform/entitlements            - every club + its club_license state
//   PATCH /platform/entitlements/{clubId}   - set tier/status/term by hand
//
// Reads are cross-club aggregates -> SERVICE MODE (withServiceRole) behind the
// requirePlatformAdmin guard, exactly like /platform/clubs|users|stats: a
// platform admin has no club_roles, so RLS could not serve a cross-club view
// under its own claims (routes/platform.ts documents the service-mode reason).
//
// WRITES keep the Blueprint ADR-E6 invariant: app.entitlements is written ONLY
// through applyEntitlementChange() (the single writer, state machine + audit) in
// service mode - never a raw UPDATE. The manual console change is source='manual'
// and records actor='platform:<sub>' + reason in the append-only audit trail.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  platformEntitlementPatchSchema,
  platformEntitlementRowSchema,
  uuid,
} from '../lib/platform-schemas.js';
import { problemSchema } from '../lib/validation.js';
import { withServiceRole } from '../db.js';
import { requirePlatformAdmin } from '../lib/guards.js';
import { problem } from '../middleware/error.js';
import { createSqlBillingStore } from '../modules/billing/store.js';
import {
  BillingError,
  EntitlementTransitionError,
  applyEntitlementChange,
} from '../modules/billing/entitlements.js';
import type { Tx } from '../db.js';

export const platformLicensesRouter = createRouter();

const CLUB_LICENSE = 'club_license';

/** Cross-club club_license overview: one row per club, latest license state. */
function selectRows(tx: Tx, clubId?: string) {
  return tx`
    select c.id as club_id, c.name as club_name, c.short_name,
           (select count(*) from app.club_members m
              where m.club_id = c.id and m.deleted_at is null and m.status = 'active')::int
             as member_count,
           e.id as entitlement_id,
           e.metadata ->> 'tier'   as tier,
           e.metadata ->> 'status' as status,
           e.source, e.provider_ref, e.valid_until, e.updated_at
    from app.clubs c
    left join lateral (
      select id, metadata, source, provider_ref, valid_until, updated_at
      from app.entitlements
      where subject_type = 'club' and subject_id = c.id and entitlement = ${CLUB_LICENSE}
      order by created_at desc
      limit 1
    ) e on true
    where c.deleted_at is null
      and (${clubId ?? null}::uuid is null or c.id = ${clubId ?? null}::uuid)
    order by c.name`;
}

platformLicensesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/platform/entitlements',
    tags: ['platform'],
    summary: 'All clubs incl. license tier/status/term (platform admin only)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(z.array(platformEntitlementRowSchema), 'Club license overview'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const rows = await withServiceRole(
      `platform-admin entitlements overview (caller ${claims.sub})`,
      (tx) => selectRows(tx),
    );
    return c.json(z.array(platformEntitlementRowSchema).parse(rows), 200);
  },
);

platformLicensesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/platform/entitlements/{clubId}',
    tags: ['platform'],
    summary: 'Set a club license tier/status/term by hand (platform admin only)',
    description:
      "Writes the club_license entitlement through the single billing writer " +
      '(state machine + audit). source=manual, actor=platform:<sub>. trial_days is a ' +
      "convenience for status='trial' (term = now + N days).",
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) }),
      body: {
        content: { 'application/json': { schema: platformEntitlementPatchSchema } },
        required: true,
      },
    },
    responses: {
      200: jsonContent(platformEntitlementRowSchema, 'The updated club license row'),
      409: jsonContent(problemSchema, 'Illegal license transition'),
      422: jsonContent(problemSchema, 'Unknown product / billing invariant violated'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');

    // status='trial' + trial_days -> concrete term; else use valid_until as given.
    let validUntil: string | null | undefined = body.valid_until;
    if (body.trial_days !== undefined) {
      validUntil = new Date(Date.now() + body.trial_days * 86_400_000).toISOString();
    }

    const row = await withServiceRole(
      `platform-admin manual license change club=${clubId} (caller ${claims.sub})`,
      async (tx) => {
        const club = (await tx`select 1 from app.clubs where id = ${clubId} and deleted_at is null`)[0];
        if (!club) throw problem(404, 'Not Found', 'club not found');

        const store = createSqlBillingStore(tx);
        await applyEntitlementChange(store, {
          subject_type: 'club',
          subject_id: clubId,
          entitlement: CLUB_LICENSE,
          status: body.status,
          tier: body.tier,
          source: 'manual',
          ...(validUntil !== undefined ? { valid_until: validUntil } : {}),
          actor: `platform:${claims.sub}`,
          reason: body.reason ?? `manual console change to ${body.tier}/${body.status}`,
        });
        return (await selectRows(tx, clubId))[0];
      },
    ).catch((err: unknown) => {
      if (err instanceof EntitlementTransitionError) {
        throw problem(409, 'Conflict', err.message);
      }
      if (err instanceof BillingError) {
        throw problem(422, 'Unprocessable Entity', err.message);
      }
      throw err;
    });

    console.info(
      `[platform] license set club=${clubId} tier=${body.tier} status=${body.status} ` +
        `by=${claims.sub} (request ${c.get('requestId')})`,
    );
    return c.json(platformEntitlementRowSchema.parse(row), 200);
  },
);
