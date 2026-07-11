// ============================================================================
// routes/platform-system.ts - Betreiber-Konsole: System (Referenz §3.3
// system.html / server-settings.html).
//
// GET /platform/system returns operational health for the console: API version,
// auth mode, DB key figures, the applied-migrations ledger and a live DB
// health probe. SERVICE MODE behind requirePlatformAdmin - it reads
// internal.schema_migrations + internal.webhook_events (service_role-only) and
// cross-club counts that need BYPASSRLS.
// ============================================================================

import { createRoute } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { platformSystemSchema } from '../lib/platform-schemas.js';
import { withServiceRole } from '../db.js';
import { getConfig } from '../config.js';
import { requirePlatformAdmin } from '../lib/guards.js';

export const platformSystemRouter = createRouter();

/** API contract version - keep in sync with app.ts openApiConfig.info.version. */
const APP_VERSION = '0.2.0';

platformSystemRouter.openapi(
  createRoute({
    method: 'get',
    path: '/platform/system',
    tags: ['platform'],
    summary: 'System health: version, DB figures, migrations, health (platform admin only)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(platformSystemSchema, 'Operational system snapshot'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);

    const snap = await withServiceRole(
      `platform-admin system snapshot (caller ${claims.sub})`,
      async (tx) => {
        const db = (await tx`
          select
            (select count(*) from app.clubs where deleted_at is null)::int    as clubs,
            (select count(*) from app.profiles where deleted_at is null)::int  as users,
            (select count(*) from app.club_members where deleted_at is null)::int as members,
            (select count(*) from app.entitlements
               where metadata ->> 'status' in ('active', 'trial'))::int        as active_entitlements,
            (select count(*) from internal.webhook_events)::int                as webhook_events,
            pg_database_size(current_database())::bigint                       as size_bytes,
            pg_size_pretty(pg_database_size(current_database()))              as size_pretty`)[0];
        const migrations = await tx`
          select version from internal.schema_migrations order by version`;
        const now = (await tx`select now() as db_time`)[0] as { db_time: unknown };
        return { db, migrations, db_time: now.db_time };
      },
    );

    const list = snap.migrations.map((r) => String((r as Record<string, unknown>)['version']));
    return c.json(
      platformSystemSchema.parse({
        app_version: APP_VERSION,
        auth_mode: getConfig().auth.mode,
        db: snap.db,
        migrations: {
          count: list.length,
          latest: list.length > 0 ? list[list.length - 1] : null,
          list,
        },
        health: { status: 'ok', db_time: snap.db_time },
      }),
      200,
    );
  },
);
