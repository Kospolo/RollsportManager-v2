// ============================================================================
// routes/sparten.ts - die SPARTEN-Ebene (migration 0062): Verein -> Sparten ->
// Teams -> Mitglieder. Eine Sparte trennt Mehrsparten-Vereine (z.B.
// Eiskunstlauf/Rollkunstlauf/Hockey); NICHT zu verwechseln mit departments
// ("Abteilungen", eine Mitglieder-Gruppierung).
//
// Lesen (List): jedes effektive Vereinsmitglied (is_club_member). Schreiben
// (Anlegen/Bearbeiten/(De-)Aktivieren/Loeschen, Mitglieder-Zuordnung,
// Team->Sparte): NUR app.can_manage_sparten = owner/admin/treasurer/
// Plattform-Admin - BEWUSST OHNE moderator (Chef-Entscheidung). Der API-Guard
// requireCanManageSparten spiegelt das; RLS (sparten_insert/_update,
// sparte_members_*) und der Trigger protect_team_sparte sind die zweite
// Verteidigungslinie (Defense-in-Depth).
//
// Loeschen ist SOFT (deleted_at); es gibt keine DELETE-RLS-Policy (Hard-Delete
// default-deny), genau wie bei teams/departments/lockers.
//
// RETURNING: alle Schreiber, die den Guard passieren, sind unter der SELECT-
// Policy sichtbar (Mitglieder via is_club_member; der Plattform-Admin via
// operator_override, das die Middleware fuer JEDE seiner Anfragen setzt) -
// deshalb ist `returning` hier sicher (wie in teams.ts/departments.ts).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  sparteCreateSchema,
  sparteMembersSetSchema,
  sparteSchema,
  sparteUpdateSchema,
  teamSchema,
  teamSparteSetSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { requireCanManageSparten, requireClubMemberDb } from '../lib/capabilities.js';

export const spartenRouter = createRouter();

const clubIdParam = z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) });
const sparteParams = z.object({
  clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }),
  sparteId: uuid.openapi({ param: { name: 'sparteId', in: 'path' } }),
});
const teamParams = z.object({
  clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }),
  teamId: uuid.openapi({ param: { name: 'teamId', in: 'path' } }),
});

/** Eine Sparte inkl. member_ids re-lesen, oder 404 wenn unsichtbar/abwesend. */
async function sparteWithMembers(tx: Tx, clubId: string, sparteId: string): Promise<unknown> {
  const rows = await tx`
    select s.*,
      coalesce(
        (select array_agg(sm.member_id order by sm.created_at)
         from app.sparte_members sm
         where sm.sparte_id = s.id and sm.deleted_at is null),
        '{}'
      ) as member_ids
    from app.sparten s
    where s.id = ${sparteId} and s.club_id = ${clubId} and s.deleted_at is null`;
  if (rows.length === 0) throw problem(404, 'Not Found', 'Sparte not found');
  return rows[0];
}

/** Ein Team inkl. skater/coach member ids re-lesen (fuer die Team->Sparte-Antwort). */
async function teamWithMembers(tx: Tx, clubId: string, teamId: string): Promise<unknown> {
  const rows = await tx`
    select t.*,
      coalesce((select jsonb_agg(tm.member_id order by tm.created_at)
                from app.team_members tm
                where tm.team_id = t.id and tm.role = 'skater' and tm.deleted_at is null),
               '[]'::jsonb) as skater_member_ids,
      coalesce((select jsonb_agg(tm.member_id order by tm.created_at)
                from app.team_members tm
                where tm.team_id = t.id and tm.role = 'coach' and tm.deleted_at is null),
               '[]'::jsonb) as coach_member_ids
    from app.teams t
    where t.id = ${teamId} and t.club_id = ${clubId} and t.deleted_at is null`;
  if (rows.length === 0) throw problem(404, 'Not Found', 'Team not found');
  return rows[0];
}

// ---------------------------------------------------------------------------
// LIST - alle effektiven Vereinsmitglieder (is_club_member).
// ---------------------------------------------------------------------------
spartenRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/sparten',
    tags: ['sparten'],
    summary: 'List sparten of a club incl. member ids (is_club_member)',
    security: [{ bearerAuth: [] }],
    request: { params: clubIdParam },
    responses: {
      200: jsonContent(z.array(sparteSchema), 'Sparten of the club'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    await requireClubMemberDb(c, clubId);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select s.*,
           coalesce(
             (select array_agg(sm.member_id order by sm.created_at)
              from app.sparte_members sm
              where sm.sparte_id = s.id and sm.deleted_at is null),
             '{}'
           ) as member_ids
         from app.sparten s
         where s.club_id = ${clubId} and s.deleted_at is null
         order by s.sortierung, s.name`,
    );
    return c.json(z.array(sparteSchema).parse(rows), 200);
  },
);

// ---------------------------------------------------------------------------
// CREATE - can_manage_sparten.
// ---------------------------------------------------------------------------
spartenRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/sparten',
    tags: ['sparten'],
    summary: 'Create a sparte (can_manage_sparten: owner/admin/treasurer)',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: sparteCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(sparteSchema, 'Created sparte'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    await requireCanManageSparten(c, clubId);

    const created = await withUser(c.get('claims'), async (tx) => {
      const rows = await tx`
        insert into app.sparten (club_id, name, icon, farbe, aktiv, sortierung, eigene_finanzen)
        values (${clubId}, ${body.name}, ${body.icon ?? null}, ${body.farbe ?? null},
                ${body.aktiv}, ${body.sortierung}, ${body.eigene_finanzen})
        returning id`;
      const id = rows[0]?.['id'] as string;
      return sparteWithMembers(tx, clubId, id);
    });
    return c.json(sparteSchema.parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH - bearbeiten inkl. (De-)Aktivieren via aktiv (can_manage_sparten).
// ---------------------------------------------------------------------------
spartenRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/clubs/{clubId}/sparten/{sparteId}',
    tags: ['sparten'],
    summary: 'Edit / (de)activate a sparte (can_manage_sparten)',
    security: [{ bearerAuth: [] }],
    request: {
      params: sparteParams,
      body: { content: { 'application/json': { schema: sparteUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(sparteSchema, 'Updated sparte'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, sparteId } = c.req.valid('param');
    const body = c.req.valid('json');
    await requireCanManageSparten(c, clubId);

    const updated = await withUser(c.get('claims'), async (tx) => {
      const rows = await tx`
        update app.sparten set ${tx(body)}
        where id = ${sparteId} and club_id = ${clubId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Sparte not found');
      return sparteWithMembers(tx, clubId, sparteId);
    });
    return c.json(sparteSchema.parse(updated), 200);
  },
);

// ---------------------------------------------------------------------------
// DELETE - soft-delete (can_manage_sparten). Loest die Mitglieder-Zuordnungen
// mit; Teams behalten ihre Zeile und werden sparten-los (FK ON DELETE SET NULL
// greift nur bei Hard-Delete; hier setzen wir es nicht, das Team bleibt
// zugeordnet an eine soft-geloeschte Sparte -> beim Re-Lesen filtert die List
// die geloeschte Sparte ohnehin aus). Wir loesen die Team-Zuordnung bewusst
// NICHT automatisch: das Loesen ist eine eigene, protokollierbare Handlung.
// ---------------------------------------------------------------------------
spartenRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/clubs/{clubId}/sparten/{sparteId}',
    tags: ['sparten'],
    summary: 'Soft-delete a sparte (can_manage_sparten)',
    security: [{ bearerAuth: [] }],
    request: { params: sparteParams },
    responses: {
      200: jsonContent(deletedSchema, 'Sparte soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, sparteId } = c.req.valid('param');
    await requireCanManageSparten(c, clubId);

    await withUser(c.get('claims'), async (tx) => {
      const rows = await tx`
        update app.sparten set deleted_at = now()
        where id = ${sparteId} and club_id = ${clubId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Sparte not found');
      // Mitglieder-Zuordnungen mit-abhaengen, damit die Sparte aus deren Listen
      // verschwindet (Muster wie departments delete).
      await tx`
        update app.sparte_members set deleted_at = now()
        where sparte_id = ${sparteId} and deleted_at is null`;
    });
    return c.json({ status: 'deleted' as const, id: sparteId }, 200);
  },
);

// ---------------------------------------------------------------------------
// MEMBERS - full replace der Sparten-Zuordnung (can_manage_sparten). Deckt
// ZUORDNEN und ENTFERNEN ab. Anders als departments (dort darf der Trainer
// zuordnen) ist das hier bewusst eng: nur can_manage_sparten.
// ---------------------------------------------------------------------------
spartenRouter.openapi(
  createRoute({
    method: 'put',
    path: '/clubs/{clubId}/sparten/{sparteId}/members',
    tags: ['sparten'],
    summary: 'Replace a sparte roster (can_manage_sparten)',
    description:
      'Full replace. Member ids must belong to the sparte\'s club. Missing members are soft-detached; ' +
      'previously removed members are revived. Assigning/removing is can_manage_sparten only.',
    security: [{ bearerAuth: [] }],
    request: {
      params: sparteParams,
      body: { content: { 'application/json': { schema: sparteMembersSetSchema } }, required: true },
    },
    responses: {
      200: jsonContent(sparteSchema, 'Updated sparte incl. roster'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, sparteId } = c.req.valid('param');
    const body = c.req.valid('json');
    await requireCanManageSparten(c, clubId);

    const desiredIds = [...new Set(body.member_ids)];

    const updated = await withUser(c.get('claims'), async (tx) => {
      await sparteWithMembers(tx, clubId, sparteId); // 404 wenn Sparte fehlt

      if (desiredIds.length > 0) {
        const known = await tx`
          select id from app.club_members
          where club_id = ${clubId} and deleted_at is null and id in ${tx(desiredIds)}`;
        if (known.length !== desiredIds.length) {
          throw problem(400, 'Bad Request', 'One or more member ids are not members of this club');
        }
      }

      // Gewuenschte Zuordnungen upserten (soft-geloeschte beleben; unique auf
      // (sparte_id, member_id)).
      for (const memberId of desiredIds) {
        await tx`
          insert into app.sparte_members (club_id, sparte_id, member_id)
          values (${clubId}, ${sparteId}, ${memberId})
          on conflict (sparte_id, member_id)
          do update set deleted_at = null`;
      }

      // Alle, die nicht mehr im gewuenschten Set sind, soft-abhaengen.
      if (desiredIds.length > 0) {
        await tx`
          update app.sparte_members set deleted_at = now()
          where sparte_id = ${sparteId} and deleted_at is null
            and member_id not in ${tx(desiredIds)}`;
      } else {
        await tx`
          update app.sparte_members set deleted_at = now()
          where sparte_id = ${sparteId} and deleted_at is null`;
      }

      return sparteWithMembers(tx, clubId, sparteId);
    });
    return c.json(sparteSchema.parse(updated), 200);
  },
);

// ---------------------------------------------------------------------------
// TEAM -> SPARTE zuordnen / Zuordnung entfernen (can_manage_sparten).
//
// Der Trigger protect_team_sparte erzwingt zusaetzlich die Integritaet
// (Team+Sparte im selben Verein, Sparte existent/nicht geloescht) UND die
// Autorisierung an der DB-Grenze. sparte_id = null entfernt die Zuordnung.
// ---------------------------------------------------------------------------
spartenRouter.openapi(
  createRoute({
    method: 'put',
    path: '/clubs/{clubId}/teams/{teamId}/sparte',
    tags: ['sparten'],
    summary: 'Assign a team to a sparte (or clear it) (can_manage_sparten)',
    security: [{ bearerAuth: [] }],
    request: {
      params: teamParams,
      body: { content: { 'application/json': { schema: teamSparteSetSchema } }, required: true },
    },
    responses: {
      200: jsonContent(teamSchema, 'Updated team incl. sparte_id'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, teamId } = c.req.valid('param');
    const { sparte_id } = c.req.valid('json');
    await requireCanManageSparten(c, clubId);

    const updated = await withUser(c.get('claims'), async (tx) => {
      const rows = await tx`
        update app.teams set sparte_id = ${sparte_id}
        where id = ${teamId} and club_id = ${clubId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(404, 'Not Found', 'Team not found');
      return teamWithMembers(tx, clubId, teamId);
    });
    return c.json(teamSchema.parse(updated), 200);
  },
);
