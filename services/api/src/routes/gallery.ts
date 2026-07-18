// ============================================================================
// routes/gallery.ts - Galerie (v1 gallery.html, PRO-gated via checkPremiumAccess).
//
// PRO module (migration 0012): read = is_club_member AND is_club_pro, write =
// is_club_trainer AND is_club_pro. The API pre-checks the PRO gate (assertClubPro)
// so a club without an active pro/premium licence gets a CLEAR 402 with the
// `club_pro_required` code (UI shows an upgrade hint) instead of a generic 403;
// RLS is the second line of defense. Deletes are SOFT (deleted_at).
//
// The bytes are transferred separately: POST /media/upload (modules/media)
// returns storage_key/content_type/size_bytes, which the client then posts here
// as metadata. The uploader member id is resolved from the caller's claims.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  galleryItemCreateSchema,
  galleryItemSchema,
  problemSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';
import { assertClubPro } from '../lib/pro-gate.js';
import { assertModuleEnabled } from '../lib/module-gate.js';
import type { AuthClaims } from '../middleware/auth.js';

export const galleryRouter = createRouter();

const itemIdParam = z.object({ itemId: uuid.openapi({ param: { name: 'itemId', in: 'path' } }) });

/** 402 response shared by the PRO-gated read/write operations. */
const paymentRequired = {
  402: jsonContent(problemSchema, 'Club lacks an active PRO/Premium licence (club_pro_required)'),
} as const;

/** The caller's own club_members row in this club (the uploader). */
async function uploaderMemberId(tx: Tx, claims: AuthClaims, clubId: string): Promise<string> {
  const rows = await tx`
    select id from app.club_members
    where club_id = ${clubId} and profile_id = ${claims.sub} and deleted_at is null
    limit 1`;
  const id = rows[0]?.['id'] as string | undefined;
  if (!id) throw problem(403, 'Forbidden', 'No membership row for the uploader in this club');
  return id;
}

/** Load a gallery row (club_id) or 404 when invisible/absent. */
async function loadItem(tx: Tx, itemId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.gallery_items
    where id = ${itemId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Gallery item not found');
  return row as { id: string; club_id: string };
}

galleryRouter.openapi(
  createRoute({
    method: 'get',
    path: '/gallery',
    tags: ['gallery'],
    summary: 'List gallery items (PRO; newest first)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(galleryItemSchema), 'Gallery items visible to the caller'),
      ...paymentRequired,
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubMember(claims, club_id);
    const rows = await withUser(claims, async (tx) => {
      // Reihenfolge: erst LIZENZ (402), dann BUCHUNG (403) — zwei Ursachen,
      // zwei Auswege. Siehe lib/module-gate.ts. Seit 0068 ist dieses Modul
      // fuer einen neuen Verein voreingestellt AUS; die RLS liefert dann eine
      // leere Liste, dieser Check macht daraus ein ehrliches "nicht gebucht".
      await assertClubPro(tx, club_id);
      await assertModuleEnabled(tx, club_id, 'gallery');
      return tx`select * from app.gallery_items
         where club_id = ${club_id} and deleted_at is null
         order by created_at desc`;
    });
    return c.json(z.array(galleryItemSchema).parse(rows), 200);
  },
);

galleryRouter.openapi(
  createRoute({
    method: 'post',
    path: '/gallery',
    tags: ['gallery'],
    summary: 'Add a gallery item after upload (PRO; coaching staff)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: galleryItemCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(galleryItemSchema, 'Created gallery item'),
      ...paymentRequired,
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, COACH_ROLES);

    const created = await withUser(claims, async (tx) => {
      await assertClubPro(tx, body.club_id);
      await assertModuleEnabled(tx, body.club_id, 'gallery');
      const uploader = await uploaderMemberId(tx, claims, body.club_id);
      const rows = await tx`
        insert into app.gallery_items
          (club_id, album, title, kind, storage_key, content_type, size_bytes,
           thumbnail_key, uploaded_by_member_id)
        values
          (${body.club_id}, ${body.album ?? null}, ${body.title}, ${body.kind},
           ${body.storage_key}, ${body.content_type}, ${body.size_bytes},
           ${body.thumbnail_key ?? null}, ${uploader})
        returning *`;
      return rows[0];
    });
    return c.json(galleryItemSchema.parse(created), 201);
  },
);

galleryRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/gallery/{itemId}',
    tags: ['gallery'],
    summary: 'Soft-delete a gallery item (PRO; coaching staff)',
    security: [{ bearerAuth: [] }],
    request: { params: itemIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Gallery item soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { itemId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const item = await loadItem(tx, itemId);
      requireClubRole(claims, item.club_id, COACH_ROLES);
      const rows = await tx`
        update app.gallery_items set deleted_at = now()
        where id = ${itemId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting a gallery item requires a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: itemId }, 200);
  },
);
