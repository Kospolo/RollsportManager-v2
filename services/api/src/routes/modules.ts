// ============================================================================
// routes/modules.ts — MODUL-SCHALTER PRO VEREIN (Migration 0044).
//
// Ein Verein schaltet Module ein und aus. Die Abgrenzung zu den zwei
// bestehenden Systemen steht ausfuehrlich im Kopf von 0044 und wird hier nicht
// wiederholt — die Kurzfassung ist die UND-Kette:
//
//     gekauft (entitlement)  UND  eingeschaltet (hier)  UND  erlaubt (capability)
//
// ### WO DIE DURCHSETZUNG SITZT — UND WO NICHT ###
// Diese Datei ist NICHT das Gate. Sie ist nur die Fernbedienung.
// Das Gate sind die restriktiven RLS-Policies aus 0044: ein abgeschaltetes
// Modul liefert JEDER Route 0 Zeilen und laesst jeden Schreibversuch mit 42501
// (-> 403) auflaufen — auch Routen, die es heute noch gar nicht gibt.
// Das ist bewusst so herum: ein Gate in jeder einzelnen Route waere die
// Bauform, die in v1 vergessen wurde.
//
// EHRLICH BENANNT: ein abgeschaltetes Modul antwortet beim LESEN mit einer
// leeren Liste, nicht mit einem Fehlercode — das Gate sitzt unter der Route,
// nicht in ihr. Die Clients erfahren die Schalterstellung ueber GET
// /clubs/{clubId}/modules (diese Datei), nicht ueber einen HTTP-Fehler.
//
// ### KEIN SERVICE-MODE ###
// Alles laeuft durch withUser -> RLS + der Kernmodul-Trigger bleiben wirksam.
// service_role haette BYPASSRLS (db.ts:17) und wuerde genau den Schutz
// aushebeln, den diese Datei stellt.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  clubModuleSetSchema,
  clubModuleStateSchema,
  problemSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { requireClubMember } from '../lib/guards.js';

export const modulesRouter = createRouter();

const clubParam = z.object({
  clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }),
});

const moduleParam = z.object({
  clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }),
  moduleKey: z.string().openapi({ param: { name: 'moduleKey', in: 'path' } }),
});

/**
 * Die Schalterstellung EINES Moduls holen — nach dem Schreiben, damit die
 * Antwort den WIRKLICHEN Zustand zeigt und nicht den erhofften. Wichtig bei
 * einem PRO-Modul: `enabled` kann true sein und `available` trotzdem false,
 * weil das Entitlement fehlt. Ein Client, der nur das Echo des Formulars
 * zurueckbekaeme, wuerde genau diesen Fall falsch anzeigen.
 */
async function loadState(
  tx: Parameters<Parameters<typeof withUser>[1]>[0],
  clubId: string,
  moduleKey: string,
): Promise<Record<string, unknown>> {
  const rows = await tx`
    select * from app.club_module_states(${clubId}) where module_key = ${moduleKey}`;
  const row = rows[0];
  if (!row) {
    throw problem(
      404,
      'Not Found',
      `Unbekanntes Modul "${moduleKey}". / Unknown module "${moduleKey}".`,
    );
  }
  return row;
}

// ----------------------------------------------------------------------------
// GET /clubs/{clubId}/modules — Katalog + Schalterstellung.
//
// Fuer JEDES Mitglied lesbar, nicht nur fuer Admins: die Clients bauen daraus
// ihr Menue (das „Mehr"-Raster). Der Katalog enthaelt keine Vereinsdaten, und
// die Schalterstellung ist im Verein ohnehin sichtbar — sie steht buchstaeblich
// im Menue.
// ----------------------------------------------------------------------------
modulesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/modules',
    tags: ['modules'],
    summary: 'Modul-Katalog + Schalterstellung des Vereins (is_club_member)',
    security: [{ bearerAuth: [] }],
    request: { params: clubParam },
    responses: {
      200: jsonContent(z.array(clubModuleStateSchema), 'Module des Vereins'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    requireClubMember(c.get('claims'), clubId);
    const rows = await withUser(
      c.get('claims'),
      (tx) => tx`select * from app.club_module_states(${clubId})`,
    );
    return c.json(z.array(clubModuleStateSchema).parse(rows), 200);
  },
);

// ----------------------------------------------------------------------------
// PUT /clubs/{clubId}/modules/{moduleKey} — den Schalter stellen.
//
// Gate: app.is_club_admin (owner/admin/moderator) — durchgesetzt von der RLS
// auf app.club_modules, nicht von einem if hier. Warum nicht has_cap: 0033
// stuft 'club_settings' als wirkungslos ein und 93j prueft, dass keine
// wirkungslose Faehigkeit in einer Policy vorkommt; eine NEUE Faehigkeit wuerde
// die Katalog-Abzaehlung in 0033/93j (exakt 32) reissen. Ausfuehrlich in 0044.
//
// upsert statt insert: die Zeile fehlt beim ersten Umlegen (fehlende Zeile =
// eingeschaltet, 0044). Ein Client soll dafuer nicht zwei Verben brauchen.
// ----------------------------------------------------------------------------
modulesRouter.openapi(
  createRoute({
    method: 'put',
    path: '/clubs/{clubId}/modules/{moduleKey}',
    tags: ['modules'],
    summary: 'Modul ein-/ausschalten (is_club_admin; Kernmodule sind gesperrt)',
    security: [{ bearerAuth: [] }],
    request: {
      params: moduleParam,
      body: jsonContent(clubModuleSetSchema, 'Neue Schalterstellung'),
    },
    responses: {
      200: jsonContent(clubModuleStateSchema, 'Der WIRKLICHE Zustand nach dem Schalten'),
      // Kernmodul: der Trigger aus 0044 wirft P0001. Die Fehler-Middleware
      // wuerde daraus 403 machen — fachlich richtig ist 409: nicht "du darfst
      // nicht", sondern "das geht bei diesem Modul grundsaetzlich nicht".
      // Muster: roles.ts faengt seine Trigger aus demselben Grund selbst ab.
      409: jsonContent(problemSchema, 'Kernmodul — nicht abschaltbar'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, moduleKey } = c.req.valid('param');
    const { enabled } = c.req.valid('json');
    requireClubMember(c.get('claims'), clubId);

    return c.json(
      await withUser(c.get('claims'), async (tx) => {
        // 404 vor allem anderen: ein Tippfehler im Schluessel soll nicht als
        // FK-Verletzung (23503 -> 422) beim Nutzer ankommen.
        const state = await loadState(tx, clubId, moduleKey);

        // Kernmodul: VOR dem Trigger abfangen, damit der Text erklaert WARUM.
        // Der Trigger bleibt trotzdem stehen — er ist das Netz, nicht die
        // Fehlermeldung (Muster roles.ts).
        if (state.core === true && !enabled) {
          throw problem(
            409,
            'Conflict',
            `Das Modul "${moduleKey}" ist ein Kernmodul und kann nicht abgeschaltet werden. ` +
              `Mitglieder, Finanzen (Aufbewahrungspflicht) und Verwaltung bleiben immer an. ` +
              `/ Module "${moduleKey}" is a core module and cannot be switched off. ` +
              `Members, finance (retention duty) and administration always stay on.`,
          );
        }

        await tx`
          insert into app.club_modules (club_id, module_key, enabled)
          values (${clubId}, ${moduleKey}, ${enabled})
          on conflict (club_id, module_key)
          do update set enabled = excluded.enabled`;

        // Neu lesen statt das Formular zu spiegeln: siehe loadState().
        return clubModuleStateSchema.parse(await loadState(tx, clubId, moduleKey));
      }),
      200,
    );
  },
);
