// ============================================================================
// routes/notes.ts - strictly private per-user notes (v1 notes.html).
//
// There is NO role model here: a note belongs to exactly one profile and is
// invisible to everyone else (RLS: owner_profile_id = auth.uid()). The API
// never trusts a caller-supplied owner - it is always claims.sub. PATCH/DELETE
// on a foreign (or absent) note match 0 rows under RLS -> 404, so a stranger
// cannot even probe existence.
//
// ### ZUBUCHBARES MODUL (0068) ###############################################
// 'notes' ist seit 0068 zubuchbar: fuer einen NEUEN Verein voreingestellt AUS.
// Durchgesetzt wird das von der restriktiven RLS-Policy notes_module_gate
// (0044) — eine Notiz MIT club_id verschwindet aus GET /notes, sobald der Verein
// das Modul nicht (mehr) gebucht hat. Deshalb braucht GET hier keinen eigenen
// Check: die Liste ist bereits richtig, nicht nur huebsch.
//
// POST bekommt den Check trotzdem: eine Notiz, die man anlegen kann und die
// danach unsichtbar waere, ist die schlechteste aller Antworten. Der Check macht
// daraus ein klares 403 mit MODULE_DISABLED_CODE.
//
// EHRLICHE GRENZE: club_id ist NULLABLE (0008:70). Eine Notiz OHNE Verein ist
// ein rein persoenlicher Zettel und gehoert zu keinem Verein — sie bleibt vom
// Vereins-Schalter unberuehrt (app.module_enabled(null, ...) = true, begruendet
// in 0068). Wer "Notizen" fuer den Verein abschaltet, entzieht die
// VEREINS-Notizen, nicht die privaten Zettel einer Person.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { deletedSchema, noteCreateSchema, noteSchema, noteUpdateSchema, uuid } from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { assertModuleEnabled } from '../lib/module-gate.js';

export const notesRouter = createRouter();

const noteIdParam = z.object({ noteId: uuid.openapi({ param: { name: 'noteId', in: 'path' } }) });

notesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/notes',
    tags: ['notes'],
    summary: 'List the caller\'s own notes (strictly private)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(z.array(noteSchema), 'The caller\'s notes, newest first'),
      ...errorResponses,
    },
  }),
  async (c) => {
    // RLS scopes to owner_profile_id = auth.uid(); no club membership required.
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select * from app.notes
         where deleted_at is null
         order by updated_at desc`,
    );
    return c.json(z.array(noteSchema).parse(rows), 200);
  },
);

notesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/notes',
    tags: ['notes'],
    summary: 'Create a private note',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: noteCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(noteSchema, 'Created note'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    const created = await withUser(claims, async (tx) => {
      // Nur wenn die Notiz einem VEREIN zugeordnet wird: ein persoenlicher
      // Zettel ohne club_id haengt an keinem Vereins-Schalter (siehe Kopf).
      if (body.club_id) await assertModuleEnabled(tx, body.club_id, 'notes');
      const rows = await tx`
        insert into app.notes (owner_profile_id, club_id, title, body)
        values (${claims.sub}, ${body.club_id ?? null}, ${body.title}, ${body.body})
        returning *`;
      return rows;
    });
    return c.json(noteSchema.parse(created[0]), 201);
  },
);

notesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/notes/{noteId}',
    tags: ['notes'],
    summary: 'Edit an own note',
    security: [{ bearerAuth: [] }],
    request: {
      params: noteIdParam,
      body: { content: { 'application/json': { schema: noteUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(noteSchema, 'Updated note'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { noteId } = c.req.valid('param');
    const body = c.req.valid('json');
    const updated = await withUser(c.get('claims'), async (tx) => {
      // RLS restricts the row to the owner; a foreign/absent note matches 0.
      const rows = await tx`
        update app.notes set ${tx(body)}
        where id = ${noteId} and deleted_at is null
        returning *`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Note not found');
      return rows[0];
    });
    return c.json(noteSchema.parse(updated), 200);
  },
);

notesRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/notes/{noteId}',
    tags: ['notes'],
    summary: 'Soft-delete an own note',
    security: [{ bearerAuth: [] }],
    request: { params: noteIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Note soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { noteId } = c.req.valid('param');
    await withUser(c.get('claims'), async (tx) => {
      const rows = await tx`
        update app.notes set deleted_at = now()
        where id = ${noteId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Note not found');
    });
    return c.json({ status: 'deleted' as const, id: noteId }, 200);
  },
);
