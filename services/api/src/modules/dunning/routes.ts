// ============================================================================
// modules/dunning/routes.ts - POST /clubs/{clubId}/dunning/run
//
// Server-side dunning run (Blueprint: escalation logic lives ONCE, in the
// API layer - v1 had it triplicated in the clients).
//
//   * dry_run defaults to TRUE - the run is a preview unless explicitly not.
//   * stage 1 (payment reminder) is the only step ever applied automatically.
//   * stages >= 2 come back as 'pending_approval'; applying them stays a
//     deliberate human action (today: POST /invoices/{id}/send-reminder).
//   * finance roles only; writes run impersonated, so the invoices_update
//     RLS policy stays the second line of defense.
//   * `as_of` allows previewing a future run date (and makes the endpoint
//     deterministic in tests) - it never changes what is written beyond the
//     stage-1 rule.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../../lib/openapi.js';
import { uuid } from '../../lib/validation.js';
import { withUser } from '../../db.js';
import { FINANCE_ROLES, requireClubRole } from '../../lib/guards.js';
import type { DunningInvoiceInput } from './engine.js';
import { DUNNING_TIMELINE_DAYS, computeDunningRun } from './engine.js';

export const dunningRouter = createRouter();

const dunningRunRequestSchema = z
  .object({
    /** Preview by default - nothing is written unless dry_run=false. */
    dry_run: z.boolean().default(true),
    /** Run date override 'YYYY-MM-DD' (preview/testing). Default: today. */
    as_of: z.string().date().optional(),
  })
  .openapi('DunningRunRequest');

const dunningActionSchema = z
  .object({
    invoice_id: uuid,
    number: z.string(),
    member_id: uuid,
    amount_cents: z.number().int(),
    days_overdue: z.number().int(),
    current_level: z.number().int(),
    proposed_stage: z.number().int(),
    proposed_level: z.number().int(),
    escalation: z.boolean(),
    action: z.enum(['auto', 'pending_approval', 'none']),
  })
  .openapi('DunningAction');

const dunningRunResultSchema = z
  .object({
    club_id: uuid,
    dry_run: z.boolean(),
    as_of: z.string(),
    timeline_days: z.array(z.number().int()),
    actions: z.array(dunningActionSchema),
    /** number of invoices actually updated (0 in dry-run) */
    applied: z.number().int(),
    summary: z.object({
      auto: z.number().int(),
      pending_approval: z.number().int(),
      none: z.number().int(),
    }),
  })
  .openapi('DunningRunResult');

dunningRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/dunning/run',
    tags: ['dunning'],
    summary: 'Dunning run (dry_run defaults to true; stages >= 2 always need approval)',
    description:
      'Computes due dunning-stage changes along the timeline +7/+21/+35/+49 days after due_on. ' +
      'Only stage 1 (payment reminder) is ever applied automatically (dry_run=false); every ' +
      'stage >= 2 is returned as pending_approval and never written by the run itself.',
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) }),
      body: {
        content: { 'application/json': { schema: dunningRunRequestSchema } },
        required: false,
      },
    },
    responses: {
      200: jsonContent(dunningRunResultSchema, 'Computed (and possibly applied) dunning actions'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const claims = c.get('claims');
    requireClubRole(claims, clubId, FINANCE_ROLES);

    // body is optional: no body at all means a dry run for today
    const body =
      (c.req.valid('json') as z.infer<typeof dunningRunRequestSchema> | undefined) ??
      dunningRunRequestSchema.parse({});
    const asOf = body.as_of !== undefined ? new Date(`${body.as_of}T00:00:00Z`) : new Date();

    const result = await withUser(claims, async (tx) => {
      const rows = await tx`
        select id, number, member_id, status, due_on, dunning_level, amount_cents
        from app.invoices
        where club_id = ${clubId} and status = 'open'
        order by due_on asc nulls last, number asc`;

      const invoices: DunningInvoiceInput[] = rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r['id']),
          number: String(r['number']),
          member_id: String(r['member_id']),
          status: String(r['status']),
          due_on:
            r['due_on'] === null
              ? null
              : r['due_on'] instanceof Date
                ? r['due_on'].toISOString().slice(0, 10)
                : String(r['due_on']),
          dunning_level: Number(r['dunning_level']),
          amount_cents: Number(r['amount_cents']),
        };
      });

      const actions = computeDunningRun(invoices, asOf);

      let applied = 0;
      if (!body.dry_run) {
        for (const action of actions) {
          if (action.action !== 'auto') continue; // stage >= 2: NEVER automatic
          const updated = await tx`
            update app.invoices
            set dunning_level = ${action.proposed_level}
            where id = ${action.invoice_id}
              and status = 'open'
              and dunning_level = ${action.current_level}`;
          applied += updated.count;
        }
        console.info(
          `[dunning] run club=${clubId} as_of=${asOf.toISOString().slice(0, 10)} ` +
            `applied=${applied} pending_approval=${actions.filter((a) => a.action === 'pending_approval').length} ` +
            `by=${claims.sub} (request ${c.get('requestId')})`,
        );
      }

      return { actions, applied };
    });

    return c.json(
      dunningRunResultSchema.parse({
        club_id: clubId,
        dry_run: body.dry_run,
        as_of: asOf.toISOString().slice(0, 10),
        timeline_days: [...DUNNING_TIMELINE_DAYS],
        actions: result.actions,
        applied: result.applied,
        summary: {
          auto: result.actions.filter((a) => a.action === 'auto').length,
          pending_approval: result.actions.filter((a) => a.action === 'pending_approval').length,
          none: result.actions.filter((a) => a.action === 'none').length,
        },
      }),
      200,
    );
  },
);
