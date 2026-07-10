// ============================================================================
// routes/news.ts - club announcements ("Vereins-Nachrichten", v1 news.html).
//
// Read: every club member (is_club_member). Write: coaching staff
// (is_club_trainer = owner/admin/moderator/coach + time-boxed guest_coach).
// The author is stored as the caller's own club_members row so a news item
// stays attributable. Deletes are SOFT (deleted_at); the RLS update policy is
// the second line of defense behind the API role guard (Blueprint risk #16).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  newsCreateSchema,
  newsSchema,
  newsUpdateSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';
import type { AuthClaims } from '../middleware/auth.js';

export const newsRouter = createRouter();

const newsIdParam = z.object({ newsId: uuid.openapi({ param: { name: 'newsId', in: 'path' } }) });

/** The caller's own club_members row in this club (the news author). */
async function authorMemberId(tx: Tx, claims: AuthClaims, clubId: string): Promise<string> {
  const rows = await tx`
    select id from app.club_members
    where club_id = ${clubId} and profile_id = ${claims.sub} and deleted_at is null
    limit 1`;
  const id = rows[0]?.['id'] as string | undefined;
  if (!id) throw problem(403, 'Forbidden', 'No membership row for the author in this club');
  return id;
}

/** Load a news row (club_id) or 404 when invisible/absent. */
async function loadNews(tx: Tx, newsId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.news
    where id = ${newsId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'News item not found');
  return row as { id: string; club_id: string };
}

newsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/news',
    tags: ['news'],
    summary: 'List club news (pinned first, then newest published)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(newsSchema), 'News visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    requireClubMember(c.get('claims'), club_id);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.news
         where club_id = ${club_id} and deleted_at is null
         order by is_pinned desc, published_at desc nulls last, created_at desc`,
    );
    return c.json(z.array(newsSchema).parse(rows), 200);
  },
);

newsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/news',
    tags: ['news'],
    summary: 'Create a news item (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: newsCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(newsSchema, 'Created news item'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, COACH_ROLES);

    const publishedAt = body.published_at ?? new Date().toISOString();
    const created = await withUser(claims, async (tx) => {
      const author = await authorMemberId(tx, claims, body.club_id);
      const rows = await tx`
        insert into app.news (club_id, author_member_id, title, body, is_pinned, published_at)
        values (${body.club_id}, ${author}, ${body.title}, ${body.body},
                ${body.is_pinned}, ${publishedAt})
        returning *`;
      return rows[0];
    });
    return c.json(newsSchema.parse(created), 201);
  },
);

newsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/news/{newsId}',
    tags: ['news'],
    summary: 'Edit a news item (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: {
      params: newsIdParam,
      body: { content: { 'application/json': { schema: newsUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(newsSchema, 'Updated news item'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { newsId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const news = await loadNews(tx, newsId);
      requireClubRole(claims, news.club_id, COACH_ROLES);
      const rows = await tx`
        update app.news set ${tx(body)}
        where id = ${newsId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing news requires a coaching role');
      return rows[0];
    });
    return c.json(newsSchema.parse(updated), 200);
  },
);

newsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/news/{newsId}',
    tags: ['news'],
    summary: 'Soft-delete a news item (coaching staff, is_club_trainer)',
    security: [{ bearerAuth: [] }],
    request: { params: newsIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'News item soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { newsId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const news = await loadNews(tx, newsId);
      requireClubRole(claims, news.club_id, COACH_ROLES);
      const rows = await tx`
        update app.news set deleted_at = now()
        where id = ${newsId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting news requires a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: newsId }, 200);
  },
);
