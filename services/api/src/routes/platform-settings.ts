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
import { clientIp, enforceRateLimits } from '../lib/rate-limit.js';
import { sendMail, MailConfigError } from '../lib/mailer.js';
import { bilingual } from '../lib/mail-templates/types.js';

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

// ============================================================================
// POST /platform/settings/smtp-test - Testversand fuer den Betreiber.
//
// WOZU: Der Admin will PRUEFEN, dass SMTP wirklich geht, OHNE dafuer einen
// echten Nutzer-Vorgang (Verifikation/Reset) auszuloesen. Er gibt eine Adresse
// an - typischerweise seine eigene -, bekommt eine schlichte Testmail und ein
// EHRLICHES Ergebnis: gesendet, oder Fehler mit Grund. Kein "irgendwie ok".
//
// dry_run=true erzeugt die Mail nur (MIME, Umlaut-Kodierung) und gibt sie
// zurueck, ohne zu senden - zum Ansehen, und der Weg, den die Tests gehen.
//
// DROSSEL an der 'recipient'-Achse (Salvage, rate-limit.ts): auch ein Betreiber-
// Endpunkt darf nicht zur Mailschleuder auf eine fremde Adresse werden. Zusaetz-
// lich account+ip. Die Adresse geht GEHASHT in die Drossel (storedIdentifier).
//
// ANTWORT bewusst 200 mit ok:true|false: der Aufruf ist "fuehre einen Test aus";
// ein fehlgeschlagener SMTP-Versand ist ein gueltiges Testergebnis, kein 5xx.
// Nur die Drossel (429) und fehlende Rechte (401/403) brechen frueher ab.
// ============================================================================

const smtpTestRequestSchema = z
  .object({
    recipient: z.string().email().openapi({ example: 'admin@example.org' }),
    dry_run: z.boolean().optional().openapi({
      description: 'Nur erzeugen und zurueckgeben, nicht senden (Vorschau/Test).',
    }),
  })
  .openapi('SmtpTestRequest');

const smtpTestResponseSchema = z
  .object({
    ok: z.boolean(),
    mode: z.enum(['sent', 'dry-run', 'error']),
    detail: z.string(),
    message_id: z.string().optional(),
    /** Nur bei dry_run: die erzeugte Mail zur Anzeige. */
    preview: z
      .object({ subject: z.string(), text: z.string() })
      .optional(),
  })
  .openapi('SmtpTestResponse');

function buildTestMail() {
  return bilingual(
    {
      subject: 'SMTP-Test',
      body: [
        'Hallo,',
        '',
        'dies ist eine Testnachricht des RollsportManagers. Wenn du sie liest,',
        'ist der SMTP-Versand korrekt eingerichtet.',
        '',
        'Echte Umlaute zur Kontrolle: aeaeae -> ä ö ü ß.',
      ].join('\n'),
    },
    {
      subject: 'SMTP test',
      body: [
        'Hello,',
        '',
        'this is a test message from RollsportManager. If you can read it,',
        'outgoing SMTP is set up correctly.',
      ].join('\n'),
    },
  );
}

platformSettingsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/platform/settings/smtp-test',
    tags: ['platform'],
    summary: 'Send a test email to verify SMTP (platform admin only)',
    description:
      'Sends a small bilingual test mail to the given address so the operator can ' +
      'confirm SMTP works, without triggering a real user flow. dry_run=true only ' +
      'renders the mail and returns it. Rate-limited on the recipient (and account/IP) ' +
      'axis. Always answers 200 with ok:true|false and an honest reason.',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: smtpTestRequestSchema } }, required: true },
    },
    responses: {
      200: jsonContent(smtpTestResponseSchema, 'Honest test result (sent / dry-run / error)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const { recipient, dry_run } = c.req.valid('json');
    const normalized = recipient.trim().toLowerCase();

    // Auch der Betreiber darf keine fremde Adresse zumuellen. Die Adresse geht
    // gehasht in die Drossel (rate-limit.ts, storedIdentifier).
    await enforceRateLimits(c, [
      { scope: 'account', identifier: claims.sub, limit: 5, window: '1 hour' },
      { scope: 'ip', identifier: clientIp(c), limit: 10, window: '1 hour' },
      { scope: 'recipient', identifier: normalized, limit: 5, window: '1 hour' },
    ]);

    const mail = buildTestMail();
    try {
      const result = await sendMail(normalized, mail, dry_run ? { transport: 'dry-run' } : {});
      if (result.mode === 'dry-run') {
        console.info(`[platform] smtp-test dry-run by=${claims.sub} (request ${c.get('requestId')})`);
        return c.json(
          {
            ok: true,
            mode: 'dry-run' as const,
            detail:
              'Trockenlauf: die Mail wurde erzeugt, aber NICHT gesendet. / Dry run: mail rendered, not sent.',
            message_id: result.messageId,
            preview: { subject: result.subject, text: result.text },
          },
          200,
        );
      }
      console.info(
        `[platform] smtp-test sent by=${claims.sub} accepted=${result.accepted.length} ` +
          `rejected=${result.rejected.length} (request ${c.get('requestId')})`,
      );
      return c.json(
        {
          ok: result.rejected.length === 0 && result.accepted.length > 0,
          mode: 'sent' as const,
          detail:
            result.rejected.length === 0 && result.accepted.length > 0
              ? 'Testmail gesendet. / Test mail sent.'
              : `Der Server hat die Adresse abgelehnt. / The server rejected the address. ` +
                `(accepted=${result.accepted.length}, rejected=${result.rejected.length})`,
          message_id: result.messageId,
        },
        200,
      );
    } catch (err) {
      // EHRLICH: kein "ok". Konfigurationsfehler wird als solcher benannt,
      // ein SMTP-/Netzfehler mit seiner Meldung. Nichts wird verschluckt.
      const isConfig = err instanceof MailConfigError;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[platform] smtp-test FAILED (${isConfig ? 'config' : 'smtp'}) by=${claims.sub}: ${message} ` +
          `(request ${c.get('requestId')})`,
      );
      return c.json(
        {
          ok: false,
          mode: 'error' as const,
          detail: isConfig
            ? message
            : `SMTP-Versand fehlgeschlagen: ${message} / SMTP delivery failed: ${message}`,
        },
        200,
      );
    }
  },
);
