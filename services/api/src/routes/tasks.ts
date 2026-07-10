// ============================================================================
// routes/tasks.ts - club to-dos (optionally bound to a competition).
//
// Read: every club member. Tick-off (PATCH done): staff (owner/admin/coach)
// or the assignee - enforced by the RLS update policy, not re-implemented
// here: an impersonated UPDATE that RLS rejects simply matches 0 rows and
// the handler answers 403 (the row was readable, so it exists).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { taskSchema, taskUpdateSchema, uuid } from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { requireClubMember } from '../lib/guards.js';

export const tasksRouter = createRouter();

const taskIdParam = z.object({ taskId: uuid.openapi({ param: { name: 'taskId', in: 'path' } }) });

tasksRouter.openapi(
  createRoute({
    method: 'get',
    path: '/tasks',
    tags: ['tasks'],
    summary: 'List tasks of a club (open first, then by due date)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(taskSchema), 'Tasks of the club'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.tasks
         where club_id = ${club_id} and deleted_at is null
         order by done, due_on nulls last, created_at`,
    );
    return c.json(z.array(taskSchema).parse(rows), 200);
  },
);

tasksRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/tasks/{taskId}',
    tags: ['tasks'],
    summary: 'Tick a task off / reopen it (staff or assignee)',
    security: [{ bearerAuth: [] }],
    request: {
      params: taskIdParam,
      body: { content: { 'application/json': { schema: taskUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(taskSchema, 'Updated task'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { taskId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const found = await tx`
        select id, club_id from app.tasks
        where id = ${taskId} and deleted_at is null`;
      const task = found[0] as { id: string; club_id: string } | undefined;
      if (!task) throw problem(404, 'Not Found', 'Task not found');
      requireClubMember(claims, task.club_id);

      // RLS update policy decides (staff or assignee): a rejected UPDATE
      // matches 0 rows although the row is readable -> 403, not 404.
      const rows = await tx`
        update app.tasks set done = ${body.done}
        where id = ${taskId} and deleted_at is null
        returning *`;
      if (rows.length === 0) {
        throw problem(403, 'Forbidden', 'Ticking off requires staff role or being the assignee');
      }
      return rows[0];
    });
    return c.json(taskSchema.parse(updated), 200);
  },
);
