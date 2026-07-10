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
import {
  dunningApplyRequestSchema,
  dunningApplyResultSchema,
  dunningLogSchema,
  uuid,
} from '../../lib/validation.js';
import { withUser } from '../../db.js';
import { problem } from '../../middleware/error.js';
import { FINANCE_ROLES, requireClubRole } from '../../lib/guards.js';
import type { DunningInvoiceInput } from './engine.js';
import { DUNNING_TIMELINE_DAYS, MAX_DB_DUNNING_LEVEL, computeDunningRun } from './engine.js';

export const dunningRouter = createRouter();

/** Map a to_stage (1..4) to the dunning_log action bucket. */
function stageAction(toStage: number): 'reminder' | 'dunning' | 'handover' {
  if (toStage <= 1) return 'reminder';
  if (toStage >= 4) return 'handover';
  return 'dunning';
}

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

// ============================================================================
// POST /clubs/{clubId}/dunning/apply - deliberately apply a stage to a set of
// invoices and write the audit trail (app.dunning_log). This is the WRITE
// counterpart to /dunning/run (the preview).
//
//   * finance roles only; the impersonated UPDATE keeps invoices_update RLS as
//     the second gate.
//   * stage 1 (reminder) is routine; stages >= 2 (dunning/handover) require the
//     explicit approve_escalation flag - the human sign-off is never implicit.
//   * per invoice the stage is only ever RAISED (dunning_level < target),
//     open invoices only; everything else is reported as skipped (no error).
//   * (stub) mail delivery is logged; real dunning mail lands with the portal.
// ============================================================================
dunningRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/dunning/apply',
    tags: ['dunning'],
    summary: 'Apply a dunning stage to invoices + write the audit log (finance only)',
    description:
      'Raises dunning_level to to_stage (capped at the DB max) for the given open invoices and ' +
      'appends one app.dunning_log row each. Stages >= 2 require approve_escalation=true - the ' +
      'deliberate human approval; stage 1 (reminder) is the routine step.',
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) }),
      body: { content: { 'application/json': { schema: dunningApplyRequestSchema } }, required: true },
    },
    responses: {
      200: jsonContent(dunningApplyResultSchema, 'Applied stage changes + the audit rows written'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, clubId, FINANCE_ROLES);

    // stages >= 2 are NEVER applied without the explicit approval flag.
    if (body.to_stage >= 2 && !body.approve_escalation) {
      throw problem(
        403,
        'Forbidden',
        `Applying dunning stage ${body.to_stage} requires approve_escalation=true (explicit sign-off)`,
      );
    }

    const action = stageAction(body.to_stage);
    const targetLevel = Math.min(body.to_stage, MAX_DB_DUNNING_LEVEL);

    const { applied, skipped, log } = await withUser(claims, async (tx) => {
      // the caller's own membership row = the actor on record (may be null if
      // the finance role sits on a platform admin without a member row).
      const actorRows = await tx`
        select id from app.club_members
        where club_id = ${clubId} and profile_id = ${claims.sub} and deleted_at is null
        limit 1`;
      const actorId = (actorRows[0]?.['id'] as string | undefined) ?? null;

      const skippedOut: Array<{ invoice_id: string; reason: string }> = [];
      const logOut: unknown[] = [];
      let appliedCount = 0;

      for (const invoiceId of body.invoice_ids) {
        const rows = await tx`
          select id, status, dunning_level from app.invoices
          where id = ${invoiceId} and club_id = ${clubId}`;
        const inv = rows[0] as { status: string; dunning_level: number } | undefined;
        if (!inv) {
          skippedOut.push({ invoice_id: invoiceId, reason: 'not found in this club' });
          continue;
        }
        if (inv.status !== 'open') {
          skippedOut.push({ invoice_id: invoiceId, reason: `not open (status: ${inv.status})` });
          continue;
        }
        const fromStage = Number(inv.dunning_level);
        if (fromStage >= targetLevel) {
          skippedOut.push({ invoice_id: invoiceId, reason: `already at stage >= ${targetLevel}` });
          continue;
        }
        const updated = await tx`
          update app.invoices set dunning_level = ${targetLevel}
          where id = ${invoiceId} and status = 'open' and dunning_level < ${targetLevel}`;
        if (updated.count === 0) {
          skippedOut.push({ invoice_id: invoiceId, reason: 'concurrent change, not applied' });
          continue;
        }
        const logged = await tx`
          insert into app.dunning_log
            (club_id, invoice_id, from_stage, to_stage, action, actor_member_id, note)
          values
            (${clubId}, ${invoiceId}, ${fromStage}, ${body.to_stage}, ${action},
             ${actorId}, ${body.note ?? null})
          returning *`;
        logOut.push(logged[0]);
        appliedCount += 1;
      }
      return { applied: appliedCount, skipped: skippedOut, log: logOut };
    });

    console.info(
      `[dunning] apply club=${clubId} to_stage=${body.to_stage} action=${action} ` +
        `applied=${applied} skipped=${skipped.length} by=${claims.sub} ` +
        `(request ${c.get('requestId')}) - mail delivery lands with the portal phase`,
    );

    return c.json(
      dunningApplyResultSchema.parse({
        club_id: clubId,
        to_stage: body.to_stage,
        action,
        applied,
        skipped,
        log: z.array(dunningLogSchema).parse(log),
      }),
      200,
    );
  },
);

// ============================================================================
// GET /clubs/{clubId}/dunning/log - the append-only Mahn-history (finance only).
// ============================================================================
dunningRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/dunning/log',
    tags: ['dunning'],
    summary: 'Dunning audit log of a club (finance only)',
    security: [{ bearerAuth: [] }],
    request: {
      params: z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) }),
      query: z.object({ invoice_id: uuid.optional() }),
    },
    responses: {
      200: jsonContent(z.array(dunningLogSchema), 'Dunning log entries, newest first'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const { invoice_id } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubRole(claims, clubId, FINANCE_ROLES);

    const rows = await withUser(claims, (tx) =>
      tx`select * from app.dunning_log
         where club_id = ${clubId}
           and (${invoice_id ?? null}::uuid is null or invoice_id = ${invoice_id ?? null}::uuid)
         order by created_at desc`,
    );
    return c.json(z.array(dunningLogSchema).parse(rows), 200);
  },
);
