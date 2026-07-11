// ============================================================================
// routes/platform-billing.ts - Betreiber-Konsole: Zahlungen + Produkte
// (Referenz §3.3 zahlungen.html / monetization.html).
//
//   GET   /platform/payments        - webhook_events feed + Abo-Zustände, paginated
//   GET   /platform/products        - full product catalog (incl. inactive)
//   PATCH /platform/products/{id}    - set price / active
//
// All SERVICE MODE behind requirePlatformAdmin: internal.webhook_events is
// service_role-only, the cross-club subscription summary needs BYPASSRLS, and
// products carry no client write grant (Blueprint ADR-E7 - catalog is the single
// pricing truth, mutated only by admin/service tooling).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  platformPaymentsSchema,
  platformProductPatchSchema,
  platformProductSchema,
  uuid,
} from '../lib/platform-schemas.js';
import { withServiceRole } from '../db.js';
import { requirePlatformAdmin } from '../lib/guards.js';
import { problem } from '../middleware/error.js';

export const platformBillingRouter = createRouter();

const paymentsQuerySchema = z.object({
  provider: z.enum(['stripe', 'revenuecat']).optional(),
  status: z.enum(['received', 'processed', 'failed', 'skipped']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

platformBillingRouter.openapi(
  createRoute({
    method: 'get',
    path: '/platform/payments',
    tags: ['platform'],
    summary: 'Payment webhook events + subscription states, paginated (platform admin only)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        provider: z.enum(['stripe', 'revenuecat']).optional().openapi({ param: { name: 'provider', in: 'query' } }),
        status: z.enum(['received', 'processed', 'failed', 'skipped']).optional().openapi({ param: { name: 'status', in: 'query' } }),
        limit: z.coerce.number().int().min(1).max(200).optional().openapi({ param: { name: 'limit', in: 'query' } }),
        offset: z.coerce.number().int().min(0).optional().openapi({ param: { name: 'offset', in: 'query' } }),
      }),
    },
    responses: {
      200: jsonContent(platformPaymentsSchema, 'Webhook events + subscription summary'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const q = paymentsQuerySchema.parse(c.req.valid('query'));

    const result = await withServiceRole(
      `platform-admin payments feed (caller ${claims.sub})`,
      async (tx) => {
        const provider = q.provider ?? null;
        const status = q.status ?? null;
        const events = await tx`
          select id, provider, event_id, event_type, status, error, received_at, processed_at
          from internal.webhook_events
          where (${provider}::text is null or provider = ${provider})
            and (${status}::text is null or status = ${status})
          order by received_at desc
          limit ${q.limit} offset ${q.offset}`;
        const totalRow = await tx`
          select count(*)::int as total
          from internal.webhook_events
          where (${provider}::text is null or provider = ${provider})
            and (${status}::text is null or status = ${status})`;
        // Abo-Zustände: club_license lifecycle counts across all clubs.
        const summary = await tx`
          select
            count(*) filter (where metadata ->> 'status' = 'active')::int    as active,
            count(*) filter (where metadata ->> 'status' = 'trial')::int     as trial,
            count(*) filter (where metadata ->> 'status' = 'past_due')::int  as past_due,
            count(*) filter (where metadata ->> 'status' = 'canceled')::int  as canceled,
            count(*)::int as licensed_clubs
          from app.entitlements
          where subject_type = 'club' and entitlement = 'club_license'`;
        return {
          events,
          total: Number((totalRow[0] as { total: number }).total),
          summary: summary[0],
        };
      },
    );

    return c.json(
      platformPaymentsSchema.parse({
        events: result.events,
        subscription_summary: result.summary,
        page: { total: result.total, limit: q.limit, offset: q.offset },
      }),
      200,
    );
  },
);

platformBillingRouter.openapi(
  createRoute({
    method: 'get',
    path: '/platform/products',
    tags: ['platform'],
    summary: 'Full product catalog incl. inactive (platform admin only)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(z.array(platformProductSchema), 'All products (active + inactive)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const rows = await withServiceRole(
      `platform-admin products catalog (caller ${claims.sub})`,
      (tx) => tx`select * from app.products order by kind, price_cents`,
    );
    return c.json(z.array(platformProductSchema).parse(rows), 200);
  },
);

platformBillingRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/platform/products/{id}',
    tags: ['platform'],
    summary: 'Update a product price / active flag (platform admin only)',
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ id: uuid.openapi({ param: { name: 'id', in: 'path' } }) }),
      body: { content: { 'application/json': { schema: platformProductPatchSchema } }, required: true },
    },
    responses: {
      200: jsonContent(platformProductSchema, 'The updated product'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const { id } = c.req.valid('param');
    const patch = c.req.valid('json');

    // description is nullable: an explicit null CLEARS it, undefined KEEPS it.
    const descProvided = patch.description !== undefined;
    const row = await withServiceRole(
      `platform-admin product update ${id} (caller ${claims.sub})`,
      async (tx) => {
        const updated = await tx`
          update app.products set
            price_cents = coalesce(${patch.price_cents ?? null}::bigint, price_cents),
            active      = coalesce(${patch.active ?? null}::boolean, active),
            name        = coalesce(${patch.name ?? null}::text, name),
            description = case when ${descProvided}::boolean
                           then ${patch.description ?? null}::text else description end
          where id = ${id}
          returning *`;
        return updated[0] as Record<string, unknown> | undefined;
      },
    );
    if (!row) throw problem(404, 'Not Found', 'product not found');
    return c.json(platformProductSchema.parse(row), 200);
  },
);
