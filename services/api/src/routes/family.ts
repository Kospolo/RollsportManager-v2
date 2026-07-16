// ============================================================================
// routes/family.ts - the FAMILY self-service surface (Referenz §4 "Familie",
// v1 family.html + portal-family.js). Parents manage their OWN children:
//
//   POST   /clubs/{clubId}/children          create a child (club_members row
//                                            WITHOUT a login) + a guardianship.
//   POST   /clubs/{clubId}/guardianships     link an EXISTING child to a guardian.
//   DELETE /clubs/{clubId}/guardianships/{id} soft-delete a guardianship.
//
// RIGHTS (server-enforced, Referenz 1.3 "Familie"):
//   * is_club_admin (owner/admin/moderator) may act for ANY guardian/child.
//     These calls run impersonated (withUser) so the guardianships RLS (0002:
//     write = owner/admin) stays the second line of defense.
//   * A plain member may act ONLY as guardian = their OWN club_members row
//     ("Eltern verwalten EIGENE Kinder"). RLS would block a member's roster/
//     guardianship writes, so these run in SERVICE MODE with the API guard as
//     the sole authorization (logged reason) - exactly like the report routes.
//     Self-service is deliberately narrow: a member may only CREATE a fresh
//     child, LINK an unclaimed managed child (profile_id NULL, no existing
//     guardianship - never an account or another family's child), and REMOVE a
//     guardianship they own. This closes the "claim any child" escalation path.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  childCreateSchema,
  childCreatedSchema,
  deletedSchema,
  guardianshipCreateSchema,
  guardianshipSchema,
  uuid,
} from '../lib/validation.js';
import { withServiceRole, withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { ADMIN_ROLES, hasClubRole, requireClubMember } from '../lib/guards.js';
import { avatarUrlFor } from '../lib/avatar.js';
import { ownMemberId } from '../lib/ownership.js';
import type { AuthClaims } from '../middleware/auth.js';

export const familyRouter = createRouter();

const clubIdParam = z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) });
const guardianshipParams = z.object({
  clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }),
  guardianshipId: uuid.openapi({ param: { name: 'guardianshipId', in: 'path' } }),
});

/** The caller's own member id in the club, or 403 when they have none. */
async function requireOwnMemberId(tx: Tx, claims: AuthClaims, clubId: string): Promise<string> {
  const id = await ownMemberId(tx, claims, clubId);
  if (!id) throw problem(403, 'Forbidden', 'You have no membership row in this club');
  return id;
}

// ---------------------------------------------------------------------------
// POST /clubs/{clubId}/children - create a child + guardianship.
// ---------------------------------------------------------------------------
familyRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/children',
    tags: ['members'],
    summary: 'Create a child (no login) + guardianship (self-service or admin)',
    description:
      'Creates a club_members row without a profile (a child) and links it to a guardian. The guardian defaults ' +
      'to the CALLER\'S own membership (self-service - any member may add their own child); passing a foreign ' +
      'guardian_member_id requires is_club_admin.',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: childCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(childCreatedSchema, 'Created child + guardianship'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, clubId);
    const isAdmin = hasClubRole(claims, clubId, ADMIN_ROLES);

    const run = async (tx: Tx) => {
      const ownId = await requireOwnMemberId(tx, claims, clubId);
      const guardianId = body.guardian_member_id ?? ownId;
      // Acting for a FOREIGN guardian is an admin office task.
      if (guardianId !== ownId && !isAdmin) {
        throw problem(403, 'Forbidden', 'Only club admins may create a child for another guardian');
      }
      // The guardian must be a member of this club (also enforced by the DB
      // guardianship_same_club trigger + FK).
      const guardian = await tx`
        select id from app.club_members
        where id = ${guardianId} and club_id = ${clubId} and deleted_at is null`;
      if (guardian.length === 0) throw problem(404, 'Not Found', 'Guardian membership not found in this club');

      // G3: status. Ein selbst angelegtes Kind ist ein ANTRAG, kein Zutritt.
      //
      // Vorher stand hier hart 'active' — und zwar GEGEN den Vorgabewert der
      // Spalte: app.club_members.status hat default 'pending' (0002:78). Wer
      // 'active' schreibt, uebersteuert diese Vorgabe aktiv. Damit konnte jedes
      // einfache Mitglied eine ACTIVE Zeile in den Vereinsbestand schreiben,
      // ohne dass der Vorstand je zustimmt — waehrend POST /clubs/join fuer
      // ERWACHSENE mit demselben Ziel penibel auf 'pending' besteht
      // (registration.ts:152-160: "Ein richtiger Code ist ein ANTRAG, kein
      // ZUTRITT"). Fuer ein Kind, das noch weniger geprueft ist als ein
      // Code-Inhaber, war die Huerde also NIEDRIGER als fuer Erwachsene. Das
      // ist keine Absicht, das ist ein Loch: eine active-Zeile zaehlt im
      // Bestand mit (Beitraege, Familienrabatte, Mannschaftslisten).
      //
      // Der Vormund-Vorgabewert (guardian = Aufrufer, oben) bleibt dagegen —
      // DAS ist die Absicht ("Eltern verwalten EIGENE Kinder"). Nicht der
      // Vormund ist das Problem, sondern dass niemand den Neuzugang bestaetigt.
      // Genau das holt 'pending' nach: die Freigabe ist ein einziges UPDATE und
      // wirkt sofort (registration.ts:165-167).
      //
      // Admins legen weiter direkt aktiv an: sie haben members:manage ohnehin,
      // fuer sie waere die eigene Freigabe ein leerer Umweg.
      const childStatus = isAdmin ? 'active' : 'pending';
      const childRows = await tx`
        insert into app.club_members
          (club_id, first_name, last_name, birth_date, role, status, joined_on)
        values
          (${clubId}, ${body.first_name}, ${body.last_name}, ${body.birth_date ?? null},
           'member', ${childStatus}, ${body.joined_on ?? null})
        returning *`;
      const child = childRows[0] as Record<string, unknown>;

      const gRows = await tx`
        insert into app.guardianships (club_id, guardian_member_id, child_member_id, relation)
        values (${clubId}, ${guardianId}, ${child['id'] as string}, ${body.relation})
        returning *`;

      return {
        child: { ...child, team_ids: [], avatar_url: avatarUrlFor((child['avatar_key'] as string | null) ?? null) },
        guardianship: gRows[0],
      };
    };

    // Admins go through RLS (second line of defense); a self-service member
    // cannot write the roster/guardianship under RLS, so runs in service mode.
    const created = isAdmin
      ? await withUser(claims, run)
      : await withServiceRole(`family self-service: create child in club=${clubId} (caller ${claims.sub})`, run);

    return c.json(childCreatedSchema.parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// POST /clubs/{clubId}/guardianships - link an existing child to a guardian.
// ---------------------------------------------------------------------------
familyRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/guardianships',
    tags: ['members'],
    summary: 'Link an existing child to a guardian (self-service or admin)',
    description:
      'Links an existing member as a child of a guardian. The guardian defaults to the CALLER\'S own membership; ' +
      'a foreign guardian_member_id requires is_club_admin. Self-service is restricted to UNCLAIMED managed ' +
      'children (no login, no existing guardianship) so it can never claim an account or another family\'s child.',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: guardianshipCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(guardianshipSchema, 'Created guardianship'),
      409: jsonContent(z.object({}).passthrough(), 'Relation already exists'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, clubId);
    const isAdmin = hasClubRole(claims, clubId, ADMIN_ROLES);

    const run = async (tx: Tx) => {
      const ownId = await requireOwnMemberId(tx, claims, clubId);
      const guardianId = body.guardian_member_id ?? ownId;
      if (guardianId !== ownId && !isAdmin) {
        throw problem(403, 'Forbidden', 'Only club admins may link a child for another guardian');
      }

      const children = await tx`
        select id, profile_id from app.club_members
        where id = ${body.child_member_id} and club_id = ${clubId} and deleted_at is null`;
      const child = children[0];
      if (!child) throw problem(404, 'Not Found', 'Child membership not found in this club');
      const guardian = await tx`
        select id from app.club_members
        where id = ${guardianId} and club_id = ${clubId} and deleted_at is null`;
      if (guardian.length === 0) throw problem(404, 'Not Found', 'Guardian membership not found in this club');

      if (!isAdmin) {
        // Self-service safety: only an unclaimed managed child may be linked.
        if (child['profile_id'] !== null) {
          throw problem(403, 'Forbidden', 'Self-service linking is only allowed for children without a login');
        }
        const existing = await tx`
          select 1 from app.guardianships
          where child_member_id = ${body.child_member_id} and deleted_at is null limit 1`;
        if (existing.length > 0) {
          throw problem(403, 'Forbidden', 'This child already has a guardian; ask a club admin to add another');
        }
      }

      const rows = await tx`
        insert into app.guardianships (club_id, guardian_member_id, child_member_id, relation)
        values (${clubId}, ${guardianId}, ${body.child_member_id}, ${body.relation})
        returning *`;
      return rows[0];
    };

    const created = isAdmin
      ? await withUser(claims, run)
      : await withServiceRole(`family self-service: link guardianship in club=${clubId} (caller ${claims.sub})`, run);

    return c.json(guardianshipSchema.parse(created), 201);
  },
);

// ---------------------------------------------------------------------------
// DELETE /clubs/{clubId}/guardianships/{guardianshipId} - soft-delete.
// ---------------------------------------------------------------------------
familyRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/clubs/{clubId}/guardianships/{guardianshipId}',
    tags: ['members'],
    summary: 'Remove a guardianship (its guardian, self-service, or admin)',
    security: [{ bearerAuth: [] }],
    request: { params: guardianshipParams },
    responses: {
      200: jsonContent(deletedSchema, 'Guardianship soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, guardianshipId } = c.req.valid('param');
    const claims = c.get('claims');
    requireClubMember(claims, clubId);
    const isAdmin = hasClubRole(claims, clubId, ADMIN_ROLES);

    const run = async (tx: Tx) => {
      const rows = await tx`
        select id, guardian_member_id from app.guardianships
        where id = ${guardianshipId} and club_id = ${clubId} and deleted_at is null`;
      const relation = rows[0];
      if (!relation) throw problem(404, 'Not Found', 'Guardianship not found');

      if (!isAdmin) {
        const ownId = await requireOwnMemberId(tx, claims, clubId);
        if (relation['guardian_member_id'] !== ownId) {
          throw problem(403, 'Forbidden', 'Only the guardian or a club admin may remove this relation');
        }
      }
      await tx`update app.guardianships set deleted_at = now() where id = ${guardianshipId}`;
    };

    if (isAdmin) await withUser(claims, run);
    else await withServiceRole(`family self-service: remove guardianship ${guardianshipId} (caller ${claims.sub})`, run);

    return c.json({ status: 'deleted' as const, id: guardianshipId }, 200);
  },
);
