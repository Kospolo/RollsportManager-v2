// ============================================================================
// routes/coach-notes.ts — INTERNE Trainer-Notizen über ein Mitglied
// (Migration 0069, app.member_coach_notes).
//
// ### DAS IST DAS DRITTE DING — NICHT DIE ANDEREN ZWEI ###
//   routes/notes.ts       app.notes (0008)  = persönlicher Zettel der Autorin,
//                                             über niemanden.
//   routes/assessments.ts (0055)            = offizielle Beurteilung. Die
//                                             FAMILIE liest sie — bewusst.
//   DIESE DATEI           (0069)            = interne Arbeitsnotiz. Mitglied
//                                             und Eltern sehen sie NICHT.
// Wer hier etwas "vereinheitlicht", bricht genau die Trennung, die den Zweck
// dieser drei Tabellen ausmacht.
//
// ### DIE SICHTBARKEIT LIEGT IN DER DATENBANK, NICHT HIER ###
// app.can_read_coach_note / app.can_write_coach_note (0069) sind der EINE Ort
// der Regel. Diese Datei ruft sie für ein ehrliches 403 auf, aber sie ist
// nicht der Wächter: jede Abfrage läuft über withUser -> RLS. Ein Fehler in
// diesem Handler kostet eine gute Fehlermeldung, nicht die Vertraulichkeit.
//
// Kern der Regel, weil er beim Lesen des Codes sonst untergeht:
//   not app.can_act_for_member(member_id)  steht als ERSTER Faktor in beiden
//   Funktionen. Die betroffene Person und ihre Erziehungsberechtigten sind
//   IMMER ausgeschlossen — auch wenn sie zugleich Vorstand oder Trainer:in
//   sind. Das ist keine Nebenwirkung, das ist die Vorgabe.
//
// ### KEIN EINBAU IN /members/{id}/profile ###
// Die Notizen werden BEWUSST NICHT in das Profil-Aggregat (member-profile.ts)
// aufgenommen, obwohl die Beurteilungen dort stehen. Dieses Aggregat ist genau
// die Route, die ein Elternteil für sein Kind öffnet. Auch wenn die RLS dort
// filtern würde: eine interne Notiz gehört nicht in eine Antwort, deren
// Publikum die Familie IST. Das ist die "andere Route", vor der die Vorgabe
// gewarnt hat — sie bleibt zu.
//
// ### RETURNING-FALLE ###
// Repo-Muster (event-rides.ts): app.uuid_v7() vorab, INSERT OHNE RETURNING,
// danach getrennt lesen. Hier ist Schreiben zwar beweisbar eine Teilmenge des
// Lesens (write verlangt 'edit'/'manage', read nur 'read_team'/'manage'), ein
// RETURNING liefe also heute durch — aber genau diese Beweisführung ist das,
// was bei der nächsten Regeländerung niemand nachrechnet. Das Muster kostet
// eine Abfrage und kann nicht falsch werden.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  coachNoteCreateSchema,
  coachNoteSchema,
  coachNoteUpdateSchema,
  deletedSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { requireClubMemberDb } from '../lib/capabilities.js';
import { ownMemberId } from '../lib/ownership.js';
import type { AuthClaims } from '../middleware/auth.js';

export const coachNotesRouter = createRouter();

const coachNoteIdParam = z.object({
  noteId: uuid.openapi({ param: { name: 'noteId', in: 'path' } }),
});

/**
 * Darf die aufrufende Person über DIESES Mitglied schreiben? Die Antwort holt
 * ausschliesslich die DB (app.can_write_coach_note, SECURITY DEFINER) — das
 * Token trägt weder die Teams noch die Elternschaft, beides ist aber Teil der
 * Regel. Zweck: ein sprechendes 403 statt einer stillen RLS-Abweisung.
 */
async function requireWritable(tx: Tx, clubId: string, memberId: string): Promise<void> {
  const gate = await tx`
    select app.can_write_coach_note(${clubId}, ${memberId}) as ok`;
  if (!gate[0]?.['ok']) {
    throw problem(
      403,
      'Forbidden',
      'Interne Trainer-Notizen darf nur schreiben, wer dieses Mitglied als Trainer:in betreut ' +
        'oder der Vereinsleitung angehört — und niemals über sich selbst oder das eigene Kind. ' +
        '/ Internal coach notes may only be written by a coach of this member or by the board — ' +
        'and never about oneself or one\'s own child.',
    );
  }
}

/**
 * Lädt eine Notiz, die die aufrufende Person SEHEN darf (RLS entscheidet).
 * Wer sie nicht sehen darf, bekommt 0 Zeilen -> 404: ein Elternteil soll nicht
 * einmal die EXISTENZ einer Notiz über sein Kind erschliessen können. 403 wäre
 * hier ein Informationsleck.
 */
async function loadCoachNote(
  tx: Tx,
  noteId: string,
): Promise<{ id: string; club_id: string; member_id: string; author_member_id: string }> {
  const rows = await tx`
    select id, club_id, member_id, author_member_id from app.member_coach_notes
    where id = ${noteId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Coach note not found');
  return row as { id: string; club_id: string; member_id: string; author_member_id: string };
}

/** Autor:in ODER Leitung ('manage') — der Spiegel der UPDATE-Policy. */
async function requireEditor(
  tx: Tx,
  claims: AuthClaims,
  row: { club_id: string; author_member_id: string },
): Promise<void> {
  const gate = await tx`
    select app.has_cap(${row.club_id}, 'coach_notes', 'manage') as ok`;
  if (gate[0]?.['ok']) return;
  const mine = await ownMemberId(tx, claims, row.club_id);
  if (mine && mine === row.author_member_id) return;
  throw problem(
    403,
    'Forbidden',
    'Nur die Autor:in oder die Vereinsleitung darf eine interne Trainer-Notiz ändern. ' +
      '/ Only the author or the board may change an internal coach note.',
  );
}

// GET /coach-notes?club_id&member_id -----------------------------------------
coachNotesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/coach-notes',
    tags: ['coach-notes'],
    summary: 'List the internal coach notes about one member (never visible to the member or their guardians)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({ club_id: uuid, member_id: uuid }),
    },
    responses: {
      200: jsonContent(z.array(coachNoteSchema), 'Coach notes visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, member_id } = c.req.valid('query');
    const claims = c.get('claims');
    await requireClubMemberDb(c, club_id);
    // WAS zurückkommt, entscheidet allein die RLS. Für die Familie ist das
    // eine leere Liste — nicht ein Fehler, denn ein Fehler wäre schon eine
    // Auskunft ("da ist etwas, du darfst nur nicht").
    const rows = await withUser(claims, (tx) =>
      tx`select * from app.member_coach_notes
         where club_id = ${club_id} and member_id = ${member_id} and deleted_at is null
         order by created_at desc`,
    );
    return c.json(z.array(coachNoteSchema).parse(rows), 200);
  },
);

// POST /coach-notes ----------------------------------------------------------
coachNotesRouter.openapi(
  createRoute({
    method: 'post',
    path: '/coach-notes',
    tags: ['coach-notes'],
    summary: 'Write an internal coach note about a member (coach of that member, or the board)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: coachNoteCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(coachNoteSchema, 'Created coach note'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    await requireClubMemberDb(c, body.club_id);

    const created = await withUser(claims, async (tx) => {
      await requireWritable(tx, body.club_id, body.member_id);
      const author = await ownMemberId(tx, claims, body.club_id);
      if (!author) {
        throw problem(403, 'Forbidden', 'No active membership row for the author in this club');
      }
      // uuid_v7 vorab + INSERT OHNE RETURNING (RETURNING-Falle, siehe Kopf).
      const [{ id: noteId }] = (await tx`select app.uuid_v7() as id`) as unknown as [{ id: string }];
      await tx`
        insert into app.member_coach_notes (id, club_id, member_id, author_member_id, body)
        values (${noteId}, ${body.club_id}, ${body.member_id}, ${author}, ${body.body})`;
      const rows = await tx`select * from app.member_coach_notes where id = ${noteId}`;
      return rows[0];
    });
    return c.json(coachNoteSchema.parse(created), 201);
  },
);

// PATCH /coach-notes/{noteId} ------------------------------------------------
coachNotesRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/coach-notes/{noteId}',
    tags: ['coach-notes'],
    summary: 'Edit an internal coach note (author or board)',
    security: [{ bearerAuth: [] }],
    request: {
      params: coachNoteIdParam,
      body: { content: { 'application/json': { schema: coachNoteUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(coachNoteSchema, 'Updated coach note'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { noteId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      const row = await loadCoachNote(tx, noteId);
      await requireEditor(tx, claims, row);
      // member_id/author_member_id/club_id sind nicht Teil des Update-Schemas
      // und zusätzlich per Trigger eingefroren (member_coach_notes_protect).
      await tx`
        update app.member_coach_notes set body = ${body.body}
        where id = ${noteId} and deleted_at is null`;
      const rows = await tx`select * from app.member_coach_notes where id = ${noteId}`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Editing this coach note is not allowed');
      return rows[0];
    });
    return c.json(coachNoteSchema.parse(updated), 200);
  },
);

// DELETE /coach-notes/{noteId} (soft) ----------------------------------------
coachNotesRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/coach-notes/{noteId}',
    tags: ['coach-notes'],
    summary: 'Soft-delete an internal coach note (author or board)',
    security: [{ bearerAuth: [] }],
    request: { params: coachNoteIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Coach note soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { noteId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const row = await loadCoachNote(tx, noteId);
      await requireEditor(tx, claims, row);
      const rows = await tx`
        update app.member_coach_notes set deleted_at = now()
        where id = ${noteId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Deleting this coach note is not allowed');
    });
    return c.json({ status: 'deleted' as const, id: noteId }, 200);
  },
);
