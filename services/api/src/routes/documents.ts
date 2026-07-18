// ============================================================================
// routes/documents.ts - Dokumente (v1 documents.html, PRO-gated via
// checkPremiumAccess).
//
// PRO module (migration 0012): read = is_club_member AND is_club_pro, write =
// is_club_trainer AND is_club_pro. Same pattern as routes/gallery.ts — the API
// pre-checks the PRO gate (assertClubPro -> 402 `club_pro_required`) and RLS is
// the second line of defense. Deletes are SOFT (deleted_at). The bytes are
// transferred via POST /media/upload (modules/media); this router only records
// the returned storage_key + metadata.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  documentCreateSchema,
  documentSchema,
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

export const documentsRouter = createRouter();

const documentIdParam = z.object({
  documentId: uuid.openapi({ param: { name: 'documentId', in: 'path' } }),
});

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

/** Load a document row (club_id) or 404 when invisible/absent. */
async function loadDocument(tx: Tx, documentId: string): Promise<{ id: string; club_id: string }> {
  const rows = await tx`
    select id, club_id from app.documents
    where id = ${documentId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Document not found');
  return row as { id: string; club_id: string };
}

documentsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/documents',
    tags: ['documents'],
    summary: 'List documents (PRO; newest first)',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(documentSchema), 'Documents visible to the caller'),
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
      await assertModuleEnabled(tx, club_id, 'document');
      return tx`select * from app.documents
         where club_id = ${club_id} and deleted_at is null
         order by created_at desc`;
    });
    return c.json(z.array(documentSchema).parse(rows), 200);
  },
);

documentsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/documents',
    tags: ['documents'],
    summary: 'Add a document after upload (PRO; coaching staff)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: documentCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(documentSchema, 'Created document'),
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
      await assertModuleEnabled(tx, body.club_id, 'document');
      const uploader = await uploaderMemberId(tx, claims, body.club_id);
      const rows = await tx`
        insert into app.documents
          (club_id, title, category, storage_key, content_type, size_bytes, uploaded_by_member_id)
        values
          (${body.club_id}, ${body.title}, ${body.category}, ${body.storage_key},
           ${body.content_type}, ${body.size_bytes}, ${uploader})
        returning *`;
      return rows[0];
    });
    return c.json(documentSchema.parse(created), 201);
  },
);

documentsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/documents/{documentId}',
    tags: ['documents'],
    summary: 'Soft-delete a document (PRO; coaching staff)',
    security: [{ bearerAuth: [] }],
    request: { params: documentIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Document soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { documentId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const doc = await loadDocument(tx, documentId);
      requireClubRole(claims, doc.club_id, COACH_ROLES);
      const rows = await tx`
        update app.documents set deleted_at = now()
        where id = ${documentId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting a document requires a coaching role');
    });
    return c.json({ status: 'deleted' as const, id: documentId }, 200);
  },
);
