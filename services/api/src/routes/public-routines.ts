// ============================================================================
// routes/public-routines.ts - the UNAUTHENTICATED Kür token view
// (kuer-share.html "Teilen-Link"). This is the ONE public, login-free read in
// the whole API.
//
// Security model (Referenz 1.5, task rules):
//   * The route is in PUBLIC_ROUTES (packages/contracts/codegen/check.mjs) and
//     declares NO bearerAuth; app.ts skips requireAuth for the /public/ prefix.
//   * A public visitor has NO JWT claims, so the token is resolved in SERVICE
//     MODE (withServiceRole) - RLS cannot help without a caller. The query is
//     therefore hand-scoped to return ONLY the minimal, non-personal payload of
//     the ONE shared Kür: title, discipline, music meta, markers, scores and
//     the club NAME. Never skater identities, contact data or finance.
//   * A token that is unknown, revoked, expired or soft-deleted resolves to
//     nothing -> 404 (no existence leak, no distinction between the cases).
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, jsonContent } from '../lib/openapi.js';
import { problemSchema, publicRoutineSchema } from '../lib/validation.js';
import { withServiceRole } from '../db.js';
import { problem } from '../middleware/error.js';

export const publicRoutinesRouter = createRouter();

publicRoutinesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/public/routines/{token}',
    tags: ['public'],
    summary: 'Public, login-free view of a shared Kür (opaque token)',
    description:
      'Unauthenticated. Resolves a share token to the minimal, non-personal Kür payload. ' +
      'A revoked, expired or unknown token returns 404. No skater identities, no finance.',
    request: {
      params: z.object({
        token: z.string().min(1).openapi({ param: { name: 'token', in: 'path' } }),
      }),
    },
    responses: {
      200: jsonContent(publicRoutineSchema, 'The shared Kür (minimal, non-personal)'),
      404: jsonContent(problemSchema, 'Token unknown, revoked or expired'),
    },
  }),
  async (c) => {
    const { token } = c.req.valid('param');

    const payload = await withServiceRole('public share token resolution', async (tx) => {
      const shareRows = await tx`
        select r.id            as routine_id,
               r.title         as title,
               r.category      as discipline,
               r.music_title,
               r.music_artist,
               r.music_bpm,
               r.music_duration_ms,
               cl.name         as club_name
          from app.routine_shares sh
          join app.routines r on r.id = sh.routine_id and r.deleted_at is null
          join app.clubs   cl on cl.id = sh.club_id and cl.deleted_at is null
         where sh.token = ${token}
           and sh.deleted_at is null
           and sh.revoked = false
           and (sh.expires_at is null or sh.expires_at > now())
         limit 1`;
      const share = shareRows[0] as
        | {
            routine_id: string;
            title: string;
            discipline: string | null;
            music_title: string | null;
            music_artist: string | null;
            music_bpm: number | null;
            music_duration_ms: number | null;
            club_name: string;
          }
        | undefined;
      if (!share) return undefined;

      const markers = await tx`
        select time_ms, label, element_code
          from app.routine_markers
         where routine_id = ${share.routine_id} and deleted_at is null
         order by time_ms`;

      const scores = await tx`
        select scored_on, technical_score, components_score, total_score, placement
          from app.routine_scores
         where routine_id = ${share.routine_id} and deleted_at is null
         order by scored_on desc`;

      return {
        title: share.title,
        discipline: share.discipline,
        club_name: share.club_name,
        music_title: share.music_title,
        music_artist: share.music_artist,
        music_bpm: share.music_bpm,
        music_duration_ms: share.music_duration_ms,
        markers,
        scores,
      };
    });

    if (payload === undefined) throw problem(404, 'Not Found', 'No shared Kür for this token');
    return c.json(publicRoutineSchema.parse(payload), 200);
  },
);
