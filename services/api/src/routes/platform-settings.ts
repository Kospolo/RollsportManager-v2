// ============================================================================
// routes/platform-settings.ts - Betreiber-Konsole: Einstellungen (Referenz
// §3.3 email.html / legal.html / content.html / seo.html + server-settings).
//
// GET/PATCH /platform/settings read & write the singleton internal
// .platform_settings row (id = 1). ACCESS MODEL (see migration 0019): this is
// the one internal object reachable by the `authenticated` role, gated by RLS
// app.is_platform_admin(). We therefore run IMPERSONATED (withUser) so RLS is
// the live enforcement - and additionally guard with requirePlatformAdmin for a
// clean 403 to every non-platform caller (club owner/admin/member included).
//
// DATENSCHUTZ: the SMTP password is stored in smtp.password but NEVER returned
// in the clear - GET masks it to password_set:boolean; PATCH takes it write-only
// and keeps the stored value when omitted.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  platformSettingsPatchSchema,
  platformSettingsSchema,
} from '../lib/platform-schemas.js';
import { withUser } from '../db.js';
import { requirePlatformAdmin } from '../lib/guards.js';
import { problem } from '../middleware/error.js';

export const platformSettingsRouter = createRouter();

type Json = Record<string, unknown>;
type SettingsResponse = z.infer<typeof platformSettingsSchema>;

/** Shape the stored row into the masked API response (password -> password_set). */
function toResponse(row: Json): SettingsResponse {
  const smtp = (row['smtp'] ?? {}) as Json;
  const legal = (row['legal'] ?? {}) as Json;
  const content = (row['content'] ?? {}) as Json;
  const flags = (row['feature_flags'] ?? {}) as Json;
  const pw = smtp['password'];
  return platformSettingsSchema.parse({
    smtp: {
      host: smtp['host'] ?? '',
      port: smtp['port'] ?? 587,
      user: smtp['user'] ?? '',
      from: smtp['from'] ?? '',
      secure: smtp['secure'] ?? true,
      password_set: typeof pw === 'string' && pw.length > 0,
    },
    legal: {
      impressum: legal['impressum'] ?? '',
      datenschutz: legal['datenschutz'] ?? '',
      agb: legal['agb'] ?? '',
    },
    content: {
      website_title: content['website_title'] ?? '',
      website_subtitle: content['website_subtitle'] ?? '',
      seo_title: content['seo_title'] ?? '',
      seo_description: content['seo_description'] ?? '',
      seo_keywords: content['seo_keywords'] ?? '',
    },
    feature_flags: flags,
    updated_at: row['updated_at'],
  });
}

platformSettingsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/platform/settings',
    tags: ['platform'],
    summary: 'Platform settings incl. SMTP (password masked) (platform admin only)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(platformSettingsSchema, 'Operator settings; SMTP password masked'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const row = await withUser(claims, async (tx) => {
      const rows = await tx`select * from internal.platform_settings where id = 1`;
      return rows[0] as Json | undefined;
    });
    if (!row) throw problem(404, 'Not Found', 'platform settings row is missing');
    return c.json(toResponse(row), 200);
  },
);

platformSettingsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/platform/settings',
    tags: ['platform'],
    summary: 'Update platform settings (SMTP/legal/content/flags) (platform admin only)',
    description:
      'Deep-merges the given sections into the singleton settings row. The SMTP ' +
      'password is write-only: send it to set/replace it, omit it to keep the stored ' +
      'one. The response masks it to password_set.',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: platformSettingsPatchSchema } }, required: true },
    },
    responses: {
      200: jsonContent(platformSettingsSchema, 'Updated operator settings (SMTP password masked)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const patch = c.req.valid('json');

    const row = await withUser(claims, async (tx) => {
      const current = (await tx`select * from internal.platform_settings where id = 1`)[0] as
        | Json
        | undefined;
      if (!current) throw problem(404, 'Not Found', 'platform settings row is missing');

      const smtp = { ...((current['smtp'] ?? {}) as Json) };
      if (patch.smtp) {
        for (const k of ['host', 'port', 'user', 'from', 'secure'] as const) {
          if (patch.smtp[k] !== undefined) smtp[k] = patch.smtp[k];
        }
        // password: write-only; only replaced when a non-empty value is sent.
        if (patch.smtp.password !== undefined) smtp['password'] = patch.smtp.password;
      }
      const legal = { ...((current['legal'] ?? {}) as Json), ...(patch.legal ?? {}) };
      const content = { ...((current['content'] ?? {}) as Json), ...(patch.content ?? {}) };
      const featureFlags = patch.feature_flags ?? (current['feature_flags'] ?? {});

      const updated = await tx`
        update internal.platform_settings
        set smtp = ${tx.json(smtp as never)},
            legal = ${tx.json(legal as never)},
            content = ${tx.json(content as never)},
            feature_flags = ${tx.json(featureFlags as never)}
        where id = 1
        returning *`;
      return updated[0] as Json;
    });

    console.info(
      `[platform] settings updated (sections: ${Object.keys(patch).join(', ')}) ` +
        `by=${claims.sub} (request ${c.get('requestId')})`,
    );
    return c.json(toResponse(row), 200);
  },
);
