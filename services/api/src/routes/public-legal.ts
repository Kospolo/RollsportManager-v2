// ============================================================================
// routes/public-legal.ts — die UNAUTHENTIFIZIERTE Auslieferung der Rechtstexte
// (Impressum, Datenschutz, AGB) für die öffentlichen Seiten /impressum,
// /datenschutz, /agb.
//
// Sicherheitsmodell (analog public-routines.ts):
//   * Die Route steht in PUBLIC_ROUTES (packages/contracts/codegen/check.mjs)
//     und deklariert KEIN bearerAuth; app.ts überspringt requireAuth für den
//     /public/-Präfix.
//   * Ein öffentlicher Besucher hat keine Claims. Gelesen wird deshalb im
//     SERVICE-MODE (withServiceRole). Das ist hier vertretbar, weil die Abfrage
//     AUSSCHLIESSLICH die Spalte `legal` liest und NUR die Rechtstexte
//     zurückgibt — kein SMTP, keine Feature-Flags, keine anderen Einstellungen.
//     platform_settings enthält Betreiber-Geheimnisse (SMTP-Passwort); die
//     dürfen diesen Endpunkt niemals verlassen. Wer hier etwas ergänzt, muss
//     das mitdenken.
//   * Der Rückgabewert ist der reine OVERRIDE. Ein leerer String heißt „der
//     Betreiber hat nichts Eigenes hinterlegt" — die öffentliche Seite zeigt
//     dann ihren eingebauten Standardtext. Diese Auflösung passiert im Web,
//     nicht hier: Der Server kennt den eingebauten Text nicht.
// ============================================================================

import { createRoute } from '@hono/zod-openapi';
import { createRouter, jsonContent } from '../lib/openapi.js';
import { publicLegalSchema } from '../lib/platform-schemas.js';
import { withServiceRole } from '../db.js';

export const publicLegalRouter = createRouter();

type LegalJson = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

publicLegalRouter.openapi(
  createRoute({
    method: 'get',
    path: '/public/legal',
    tags: ['public'],
    summary: 'Public, login-free legal texts (imprint, privacy, terms)',
    description:
      'Unauthenticated. Returns ONLY the operator-maintained legal override texts (imprint, ' +
      'privacy policy, terms) in German and English. An empty value means the public page ' +
      'shows its built-in default. No other operator settings are exposed.',
    responses: {
      200: jsonContent(publicLegalSchema, 'Legal override texts (empty = built-in default)'),
    },
  }),
  async (c) => {
    const legal = await withServiceRole('public legal texts', async (tx) => {
      // NUR die legal-Spalte lesen — nie `select *` von platform_settings.
      const rows = await tx`select legal from internal.platform_settings where id = 1`;
      return ((rows[0]?.legal as LegalJson) ?? {}) as LegalJson;
    });

    return c.json(
      publicLegalSchema.parse({
        impressum: { de: str(legal['impressum']), en: str(legal['impressum_en']) },
        datenschutz: { de: str(legal['datenschutz']), en: str(legal['datenschutz_en']) },
        agb: { de: str(legal['agb']), en: str(legal['agb_en']) },
      }),
      200,
    );
  },
);
