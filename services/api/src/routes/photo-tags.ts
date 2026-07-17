// ============================================================================
// routes/photo-tags.ts - Foto-Markierung "diese Person ist auf dem Bild"
// (migration 0056).
//
// ZWEI RECHTE, die AUSEINANDERLIEGEN:
//   * MARKIEREN (POST) = Staff (COACH_ROLES, bewusst OHNE treasurer). Ein
//     Metadatum: darf auch fuer ein Kind gesetzt werden, dessen Eltern der
//     Foto-Nutzung NICHT zugestimmt haben. Keine Einwilligungspruefung.
//   * ANZEIGEN auf dem Profil (GET /members/{id}/photos) = NUR bei wirksamer
//     Einwilligung 'photos_internal'. An die Einwilligung gebunden, NICHT an
//     die Rolle: der Filter (app.has_internal_photo_consent) laeuft auch fuer
//     Staff, sodass ein nicht-eingewilligtes Foto AUCH dem owner verborgen
//     bleibt. Das ist die serverseitige Projektion (CLAUDE.md: sensible
//     Sichtbarkeit serverseitig, nie nur im UI).
//   * ENTFERNEN (DELETE) = die markierte Person, ein eingetragener Vormund
//     (can_act_for_member) ODER Staff. Soft-Delete (deleted_at).
//   * GET /gallery/{itemId}/tags = die VERWALTUNGS-Sicht "wer ist auf diesem
//     Bild": zeigt, was die RLS (photo_tags_select) dem Aufrufer freigibt
//     (Staff/Betroffene sehen alles, uebrige nur Eingewilligte).
//
// Die Bindung an die Einwilligung ist zweifach abgesichert: die RLS-Policy
// (0056) fuer die allgemeine Sicht UND die harte WHERE-Klausel der
// Profil-Projektion hier. RLS bleibt die zweite Linie.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  deletedSchema,
  memberPhotoSchema,
  photoTagCreateSchema,
  photoTagSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import type { Tx } from '../db.js';
import { problem } from '../middleware/error.js';
import { COACH_ROLES, requireClubMember, requireClubRole } from '../lib/guards.js';
import { ownMemberId } from '../lib/ownership.js';

export const photoTagsRouter = createRouter();

const tagIdParam = z.object({ tagId: uuid.openapi({ param: { name: 'tagId', in: 'path' } }) });
const galleryItemIdParam = z.object({
  itemId: uuid.openapi({ param: { name: 'itemId', in: 'path' } }),
});
const memberIdParam = z.object({
  memberId: uuid.openapi({ param: { name: 'memberId', in: 'path' } }),
});

/** Load a gallery item's club (or 404 when invisible/absent under RLS). */
async function loadItemClub(tx: Tx, itemId: string): Promise<string> {
  const rows = await tx`
    select club_id from app.gallery_items
    where id = ${itemId} and deleted_at is null`;
  const club = rows[0]?.['club_id'] as string | undefined;
  if (!club) throw problem(404, 'Not Found', 'Gallery item not found');
  return club;
}

/** Load a tag row's (club_id, member_id) or 404 when invisible/absent. */
async function loadTag(tx: Tx, tagId: string): Promise<{ club_id: string; member_id: string }> {
  const rows = await tx`
    select club_id, member_id from app.photo_tags
    where id = ${tagId} and deleted_at is null`;
  const row = rows[0];
  if (!row) throw problem(404, 'Not Found', 'Photo tag not found');
  return row as { club_id: string; member_id: string };
}

// ----------------------------------------------------------------------------
// POST /photo-tags - markieren (Staff, OHNE treasurer). tagged_by = eigenes
// Mitglied (aus dem Token). KEINE Einwilligungspruefung (Metadatum).
// ----------------------------------------------------------------------------
photoTagsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/photo-tags',
    tags: ['gallery'],
    summary: 'Tag a person on a gallery photo (staff; no consent required to tag)',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: photoTagCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(photoTagSchema, 'Created photo tag'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubRole(claims, body.club_id, COACH_ROLES);

    const created = await withUser(claims, async (tx) => {
      // The gallery item must exist in the SAME club (composite FK also guards
      // this at the DB, but a clear 404/409 beats a raw constraint error).
      const itemClub = await loadItemClub(tx, body.gallery_item_id);
      if (itemClub !== body.club_id) {
        throw problem(404, 'Not Found', 'Gallery item not found in this club');
      }
      const tagger = await ownMemberId(tx, claims, body.club_id);
      if (tagger === null) {
        throw problem(403, 'Forbidden', 'No active membership row for the tagger in this club');
      }
      const rows = await tx`
        insert into app.photo_tags
          (club_id, gallery_item_id, member_id, tagged_by_member_id)
        values
          (${body.club_id}, ${body.gallery_item_id}, ${body.member_id}, ${tagger})
        returning id, club_id, gallery_item_id, member_id, tagged_by_member_id, created_at`;
      return rows[0];
    });
    return c.json(photoTagSchema.parse(created), 201);
  },
);

// ----------------------------------------------------------------------------
// GET /gallery/{itemId}/tags - VERWALTUNG: wer ist auf diesem Bild. Zeigt, was
// die RLS dem Aufrufer freigibt (Staff/Betroffene: alle; uebrige: nur
// Eingewilligte). NICHT die Profil-Anzeige.
// ----------------------------------------------------------------------------
photoTagsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/gallery/{itemId}/tags',
    tags: ['gallery'],
    summary: 'List tags on a gallery item (management view; RLS-scoped)',
    security: [{ bearerAuth: [] }],
    request: { params: galleryItemIdParam },
    responses: {
      200: jsonContent(z.array(photoTagSchema), 'Tags visible to the caller'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { itemId } = c.req.valid('param');
    const claims = c.get('claims');
    const rows = await withUser(claims, async (tx) => {
      const club = await loadItemClub(tx, itemId);
      requireClubMember(claims, club);
      return tx`
        select id, club_id, gallery_item_id, member_id, tagged_by_member_id, created_at
        from app.photo_tags
        where gallery_item_id = ${itemId} and deleted_at is null
        order by created_at`;
    });
    return c.json(z.array(photoTagSchema).parse(rows), 200);
  },
);

// ----------------------------------------------------------------------------
// GET /members/{memberId}/photos - PROFIL-ANZEIGE. Nur Fotos, fuer die eine
// wirksame Einwilligung 'photos_internal' vorliegt. Der Consent-Filter ist
// HART und rollenunabhaengig: auch Staff sieht hier nichts ohne Einwilligung.
// ----------------------------------------------------------------------------
photoTagsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/members/{memberId}/photos',
    tags: ['gallery'],
    summary: 'Photos a member appears on — consent-gated (photos_internal)',
    security: [{ bearerAuth: [] }],
    request: { params: memberIdParam, query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(memberPhotoSchema), 'Tagged photos with effective internal-photo consent'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { memberId } = c.req.valid('param');
    const { club_id } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubMember(claims, club_id);

    const rows = await withUser(claims, (tx) => selectMemberPhotos(tx, club_id, memberId));
    return c.json(z.array(memberPhotoSchema).parse(rows), 200);
  },
);

/**
 * The consent-gated profile projection: a member's tagged photos, but ONLY
 * when app.has_internal_photo_consent(member) is true. The consent guard is a
 * hard WHERE clause, so a non-consented photo is invisible to EVERYONE — staff
 * included. Exported so the aggregate phase / web portal reuse the exact rule.
 */
export async function selectMemberPhotos(
  tx: Tx,
  clubId: string,
  memberId: string,
): Promise<readonly unknown[]> {
  return tx`
    select
      pt.id            as tag_id,
      pt.gallery_item_id,
      pt.member_id,
      g.album,
      g.title,
      g.kind,
      g.storage_key,
      g.content_type,
      g.thumbnail_key,
      pt.created_at    as tagged_at
    from app.photo_tags pt
    join app.gallery_items g
      on g.id = pt.gallery_item_id and g.deleted_at is null
    where pt.club_id = ${clubId}
      and pt.member_id = ${memberId}
      and pt.deleted_at is null
      and app.has_internal_photo_consent(pt.member_id)
    order by g.created_at desc`;
}

// ----------------------------------------------------------------------------
// DELETE /photo-tags/{tagId} - Markierung entfernen (Soft-Delete). Erlaubt der
// markierten Person, einem Vormund ODER Staff. Die RLS (photo_tags_update) ist
// die zweite Linie.
// ----------------------------------------------------------------------------
photoTagsRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/photo-tags/{tagId}',
    tags: ['gallery'],
    summary: 'Remove a photo tag (the tagged person, a guardian, or staff)',
    security: [{ bearerAuth: [] }],
    request: { params: tagIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Photo tag soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { tagId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      await loadTag(tx, tagId);
      // Authorization is enforced by the photo_tags_update RLS policy (staff OR
      // can_act_for_member). If the caller may not act, the UPDATE matches 0
      // rows -> 403, no information leak about the tag's existence beyond what
      // photo_tags_select already grants.
      const rows = await tx`
        update app.photo_tags set deleted_at = now()
        where id = ${tagId} and deleted_at is null
        returning id`;
      if (rows.length === 0) {
        throw problem(403, 'Forbidden', 'Removing this tag requires the tagged person, a guardian, or staff');
      }
    });
    return c.json({ status: 'deleted' as const, id: tagId }, 200);
  },
);
