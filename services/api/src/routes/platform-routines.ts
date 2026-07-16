// ============================================================================
// routes/platform-routines.ts — Betreiber-Konsole: KÜREN-MODERATION.
//
//   GET /platform/routines?club_id=&status=&q=&limit=&offset=
//
// ### Warum es das gibt ###
// Der ausdrueckliche Grund des Betreibers: "alle Kueren sehen koennen — nicht
// damit da illegale Sachen gemacht werden". Ohne diese Route gaebe es dafuer nur
// GET /routines?club_id=… je Verein: N Requests, N Protokollzeilen, keine
// vereinsuebergreifende Sortierung und kein Filter ueber den Bestand. Ein
// Moderationswerkzeug, das man 40-mal aufrufen muss, benutzt niemand.
//
// ### Service-Modus — mit derselben Begruendung wie /platform/clubs|users|stats
// Ein Plattform-Admin hat in KEINEM Verein eine Mitgliedszeile; app.routines ist
// unter RLS club-gescoped. Eine vereinsuebergreifende Sicht kann deshalb nicht
// unter den eigenen Claims bedient werden (routes/platform.ts dokumentiert
// denselben Grund). requirePlatformAdmin ist hier die ALLEINIGE Autorisierung.
//
// ### Und das Protokoll? ###
// Kommt von selbst. Die Audit-Middleware (middleware/operator-access.ts,
// Migration 0051) haengt global an '*' und protokolliert JEDEN Request eines
// Plattform-Admins — also auch diesen, mit club_id aus ?club_id= bzw. null bei
// der Gesamtsicht. Hier steht bewusst KEINE eigene Protokoll-Zeile: eine
// zweite, per Hand gepflegte Protokollstelle waere genau die Lueckenquelle, die
// jene Middleware abschafft.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import { platformRoutineRowSchema, uuid } from '../lib/platform-schemas.js';
import { withServiceRole } from '../db.js';
import { requirePlatformAdmin } from '../lib/guards.js';

export const platformRoutinesRouter = createRouter();

const querySchema = z.object({
  club_id: uuid.optional(),
  status: z.enum(['draft', 'ready', 'competition', 'archived']).optional(),
  /** Freitext ueber Titel / Musiktitel / Interpret — der Moderations-Filter. */
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

platformRoutinesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/platform/routines',
    tags: ['platform'],
    summary: 'All routines across all clubs, for moderation (platform admin only)',
    description:
      'Cross-club routine list for content moderation (music/title review). Optional ' +
      'filters: club_id, status, free text q over title/music_title/music_artist. ' +
      'Skater names are deliberately NOT returned — see PlatformRoutineRow.',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        club_id: uuid.optional().openapi({ param: { name: 'club_id', in: 'query' } }),
        status: z
          .enum(['draft', 'ready', 'competition', 'archived'])
          .optional()
          .openapi({ param: { name: 'status', in: 'query' } }),
        q: z.string().optional().openapi({ param: { name: 'q', in: 'query' } }),
        limit: z.coerce.number().int().min(1).max(200).optional().openapi({ param: { name: 'limit', in: 'query' } }),
        offset: z.coerce.number().int().min(0).optional().openapi({ param: { name: 'offset', in: 'query' } }),
      }),
    },
    responses: {
      200: jsonContent(z.array(platformRoutineRowSchema), 'Routines across all clubs'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const claims = c.get('claims');
    requirePlatformAdmin(claims);
    const q = querySchema.parse(c.req.valid('query'));

    const clubId = q.club_id ?? null;
    const status = q.status ?? null;
    // ILIKE-Muster: die Platzhalter des Nutzers entwerten, sonst waere ein
    // eingegebenes '%' ein Treffer auf alles und '_' ein Joker.
    //
    // Escape-Zeichen ist '!' und NICHT der uebliche Backslash: in einem
    // JS-Template-Literal muesste der als `escape '\\'` geschrieben werden, um
    // in der SQL als `escape '\'` anzukommen — eine Falle, die beim naechsten
    // Anfassen still zuschnappt (`\'` waere dort ein einfaches Hochkomma und
    // zerlegte das Statement). '!' braucht keine Escape-Gymnastik.
    const text = q.q === undefined ? null : `%${q.q.replace(/([!%_])/g, '!$1')}%`;

    const rows = await withServiceRole(
      `platform-admin routine moderation (caller ${claims.sub})`,
      (tx) => tx`
        select r.id, r.club_id, c.name as club_name, r.title, r.status, r.category,
               r.music_title, r.music_artist, r.music_duration_ms,
               r.audio_asset_id,
               ma.mime_type  as audio_mime_type,
               ma.size_bytes as audio_size_bytes,
               (select count(*) from app.routine_skaters rs
                 where rs.routine_id = r.id and rs.deleted_at is null)::int as skater_count,
               r.created_at, r.updated_at
          from app.routines r
          join app.clubs c on c.id = r.club_id and c.deleted_at is null
          left join app.media_assets ma
            on ma.id = r.audio_asset_id and ma.deleted_at is null
         where r.deleted_at is null
           and (${clubId}::uuid is null or r.club_id = ${clubId}::uuid)
           and (${status}::text is null or r.status::text = ${status}::text)
           and (${text}::text is null
                or r.title        ilike ${text}::text escape '!'
                or r.music_title  ilike ${text}::text escape '!'
                or r.music_artist ilike ${text}::text escape '!')
         order by r.created_at desc
         limit ${q.limit} offset ${q.offset}`,
    );

    return c.json(z.array(platformRoutineRowSchema).parse(rows), 200);
  },
);
