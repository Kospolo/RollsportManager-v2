// ============================================================================
// routes/public-clubs.ts — das UNAUTHENTIFIZIERTE Vereinsverzeichnis für die
// öffentliche Slider-/Kachel-Seite (alle Vereine, die sich dafür entschieden
// haben, mit Name + kurzer Beschreibung + Logo).
//
// Sicherheitsmodell (analog public-legal.ts):
//   * Route steht in PUBLIC_ROUTES (packages/contracts/codegen/check.mjs) und
//     deklariert KEIN bearerAuth; app.ts überspringt requireAuth für /public/.
//   * Ein öffentlicher Besucher hat keine Claims -> SERVICE-MODE (withServiceRole).
//     Vertretbar NUR, weil die Abfrage
//       (a) ausschließlich Vereine mit public_profile_enabled=true liefert
//           (ausdrücklicher Opt-in, Migration 0081), und
//       (b) ausschließlich NICHT-personenbezogene Vereinsfelder liest —
//           id, name, city, discipline, public_description, public_image.
//     NIEMALS Mitglieds-, Kontakt-, SMTP- oder sonstige interne Spalten. Dies ist
//     ein Kinder-Verein-SaaS: hier darf kein einziges personenbezogenes Feld raus.
//     Wer diese Abfrage erweitert, muss das mitdenken.
// ============================================================================

import { createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { createRouter, jsonContent } from '../lib/openapi.js';
import { publicClubSchema } from '../lib/validation.js';
import { withServiceRole } from '../db.js';

export const publicClubsRouter = createRouter();

publicClubsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/public/clubs',
    tags: ['public'],
    summary: 'Public, login-free directory of clubs that opted in',
    description:
      'Unauthenticated. Returns ONLY clubs with public_profile_enabled=true, and for each ONLY ' +
      'non-personal fields (name, city, discipline, public description, public image). No member ' +
      'data whatsoever. Ordered by name.',
    responses: {
      200: jsonContent(z.array(publicClubSchema), 'Clubs that made their profile public'),
    },
  }),
  async (c) => {
    const clubs = await withServiceRole('public club directory', async (tx) => {
      // NUR die freigegebenen, nicht-personenbezogenen Spalten — nie `select *`.
      return tx`
        select id, name, city, discipline, public_description, public_image
        from app.clubs
        where public_profile_enabled = true
          and deleted_at is null
        order by name`;
    });

    return c.json(z.array(publicClubSchema).parse(clubs), 200);
  },
);
