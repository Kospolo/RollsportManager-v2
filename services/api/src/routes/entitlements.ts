// ============================================================================
// routes/entitlements.ts - READ-ONLY for clients (Blueprint ADR-E6).
// Writes happen exclusively in the webhook service (service_role); the table
// is structurally unwritable for client roles. This endpoint only surfaces
// the club license state, impersonated so RLS scopes visibility.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { entitlementSchema, uuid } from '../lib/validation.js';
import { withUser } from '../db.js';
import { requireClubMember } from '../lib/guards.js';

export const entitlementsRouter = createRouter();

entitlementsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/entitlements/{clubId}',
    tags: ['entitlements'],
    summary: 'Club license entitlements (read-only; written only by the webhook service)',
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) }),
    },
    responses: {
      200: jsonContent(z.array(entitlementSchema), 'Entitlements of the club'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    requireClubMember(c.get('claims'), clubId);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.entitlements
         where subject_type = 'club' and subject_id = ${clubId}
         order by created_at desc`,
    );
    return c.json(z.array(entitlementSchema).parse(rows), 200);
  },
);
