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
  effectiveModuleSchema,
  moduleVisibilityRowSchema,
  moduleVisibilitySetSchema,
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

// ============================================================================
// MODUL-SICHTBARKEIT (Migration 0077) — die vierte Frage.
//
// ############################################################################
// ### !!! SICHTBARKEIT IST KEIN SICHERHEITSERSATZ !!! ########################
// ############################################################################
// Die drei folgenden Endpunkte steuern ein MENUE, keine Erlaubnis.
//
//   * Wer eine Kachel NICHT sieht, darf ueber einen Deeplink, einen direkten
//     API-Aufruf oder curl GENAU SO VIEL wie vorher. Es wird nichts zusaetzlich
//     gesperrt.
//   * Wer eine Kachel SIEHT, bekommt dadurch KEIN Recht. Die Seite dahinter
//     antwortet unveraendert mit leerer Liste oder 403, wenn die Person nicht
//     darf.
//
// Die Grenzen bleiben, wo sie sind: RLS-Mandantentrennung (0002), Entitlement
// (0012/pro-gate.ts), Modul-Gates (0044/0061/0068, module-gate.ts) und die
// Faehigkeiten (0022-0033). app.module_visible() darf deshalb NIE in eine
// RLS-Policy oder einen Guard wandern — die Migration 0077 rechnet in ihrem
// letzten Block sogar nach, dass es niemand getan hat.
//
// Wer ZUGRIFF einschraenken will, aendert die Rolle (Verwaltung > Rollen &
// Rechte) oder den Modul-Schalter (Verwaltung > Module).
// ============================================================================

// ----------------------------------------------------------------------------
// GET /clubs/{clubId}/modules/effective — DIE EINE QUELLE fuer das Menue.
//
// Warum es diesen Endpunkt gibt: ohne ihn baut jeder Client (Web, iOS, macOS,
// Android) die Liste selbst nach — vier Nachbauten, die auseinanderlaufen, und
// genau der Zustand, aus dem der Befund kam (iOS filterte zwei von 32 Kacheln,
// Web filterte anders). Hier entscheidet die Datenbank EINMAL.
//
// Zurueck kommen NUR die sichtbaren Module — bewusst gefiltert und nicht als
// Liste mit Flag: ein Client, der das Flag vergisst, zeigt sonst wieder alles.
// Wer den vollen Zustand braucht (Admin-UI, "nicht gebucht"-Hinweise), nimmt
// weiterhin GET /clubs/{clubId}/modules.
// ----------------------------------------------------------------------------
modulesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/modules/effective',
    tags: ['modules'],
    summary: 'Die Module, die DIESE Person im Menue sehen soll (is_club_member)',
    description:
      'Katalog + Vereins-Schalter + PRO + aufgeloeste Sichtbarkeit (Mitglied > Gruppe > Rolle > Vorgabe) '
      + 'fuer die aufrufende Person. NUR ein Menue — kein Zugriffsrecht: ein hier fehlendes Modul '
      + 'bleibt ueber einen Deeplink genauso erreichbar bzw. gesperrt wie vorher.',
    security: [{ bearerAuth: [] }],
    request: { params: clubParam },
    responses: {
      200: jsonContent(z.array(effectiveModuleSchema), 'Sichtbare Module dieser Person'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    requireClubMember(c.get('claims'), clubId);
    const rows = await withUser(
      c.get('claims'),
      (tx) => tx`select * from app.my_effective_modules(${clubId}) where visible`,
    );
    return c.json(z.array(effectiveModuleSchema).parse(rows), 200);
  },
);

// ----------------------------------------------------------------------------
// GET /clubs/{clubId}/modules/visibility — die Matrix fuer das Admin-UI.
//
// Rollen-Ebene VOLLSTAENDIG (Vorgabe + Ausnahme + Ergebnis), Gruppen- und
// Mitglieds-Ebene nur die tatsaechlich gesetzten Ausnahmen. Eine vollstaendige
// Mitglieds-Matrix waere im UI nicht lesbar und im Netz nicht klein.
//
// Lesbar fuer jedes Mitglied (RLS auf app.module_visibility): es stehen keine
// Personendaten drin ausser dem Namen des Ziels, den jedes Mitglied ohnehin im
// Verzeichnis sieht — und die eigene Menue-Einstellung nachvollziehen zu
// koennen ist keine Schwaeche, sondern verhindert Support-Faelle.
// ----------------------------------------------------------------------------
modulesRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/modules/visibility',
    tags: ['modules'],
    summary: 'Sichtbarkeits-Matrix des Vereins (is_club_member)',
    security: [{ bearerAuth: [] }],
    request: { params: clubParam },
    responses: {
      200: jsonContent(z.array(moduleVisibilityRowSchema), 'Rollen-Matrix + gesetzte Ausnahmen'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    requireClubMember(c.get('claims'), clubId);
    const rows = await withUser(
      c.get('claims'),
      (tx) => tx`select * from app.club_module_visibility_matrix(${clubId})
                  order by module_key, scope, target_label`,
    );
    return c.json(z.array(moduleVisibilityRowSchema).parse(rows), 200);
  },
);

// ----------------------------------------------------------------------------
// PUT /clubs/{clubId}/modules/{moduleKey}/visibility — eine Ausnahme setzen
// oder zuruecknehmen.
//
// `visible: null` LOESCHT die Ausnahme (zurueck auf die abgeleitete Vorgabe).
// Es gibt in der Tabelle bewusst kein "unset" — sonst gaebe es zwei Arten,
// dasselbe zu sagen.
//
// ### WO DIE DURCHSETZUNG SITZT ###
// Gate ist app.is_club_admin (owner/admin/moderator), durchgesetzt von der RLS
// auf app.module_visibility. Der ausdrueckliche Vorab-Check unten ERSETZT sie
// nicht, er ergaenzt sie um eine ehrliche Antwort: beim Zuruecksetzen wuerde
// ein DELETE ohne Recht schlicht 0 Zeilen treffen und 200 melden — das waere
// eine Luege gegenueber dem Formular. Beim Schreiben faengt zusaetzlich die RLS
// (42501 -> 403). Faellt der Check bei einem Umbau aus, bleibt die RLS stehen.
//
// Warum kein has_cap: 0033 zaehlt den Faehigkeiten-Katalog auf exakt 32 ab und
// 93j prueft dieselbe Zahl — eine 33. Faehigkeit wuerde beide rot machen.
// Ausfuehrlich in 0044 und im Kopf von 0077.
// ----------------------------------------------------------------------------
modulesRouter.openapi(
  createRoute({
    method: 'put',
    path: '/clubs/{clubId}/modules/{moduleKey}/visibility',
    tags: ['modules'],
    summary: 'Modul fuer Rolle/Gruppe/Mitglied ein- oder ausblenden (is_club_admin)',
    description:
      'Setzt eine Ausnahme von der abgeleiteten Vorgabe. visible: null nimmt die Ausnahme zurueck. '
      + 'NUR das Menue — es wird dadurch kein Zugriff gewaehrt und keiner entzogen.',
    security: [{ bearerAuth: [] }],
    request: {
      params: moduleParam,
      body: jsonContent(moduleVisibilitySetSchema, 'Ziel + neue Sichtbarkeit'),
    },
    responses: {
      200: jsonContent(
        z.array(moduleVisibilityRowSchema),
        'Die Matrix-Zeilen dieses Moduls nach der Aenderung',
      ),
      // 'manage' nimmt keine Zeile an (Trigger app.module_visibility_guard).
      // Fachlich kein "du darfst nicht", sondern "das geht bei diesem Modul
      // grundsaetzlich nicht" -> 409, Muster wie beim Kernmodul oben.
      409: jsonContent(problemSchema, 'Verwaltung — nicht ausblendbar'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, moduleKey } = c.req.valid('param');
    const { scope, target_id: targetId, visible } = c.req.valid('json');
    requireClubMember(c.get('claims'), clubId);

    return c.json(
      await withUser(c.get('claims'), async (tx) => {
        // 404 vor allem anderen: ein Tippfehler im Schluessel soll nicht als
        // FK-Verletzung (23503 -> 422) beim Nutzer ankommen.
        await loadState(tx, clubId, moduleKey);

        // Der Weg zurueck (0077): VOR dem Trigger abfangen, damit der Text
        // erklaert WARUM. Der Trigger bleibt das Netz, nicht die Meldung.
        if (moduleKey === 'manage') {
          throw problem(
            409,
            'Conflict',
            'Die Verwaltung kann nicht ausgeblendet werden — dort stehen die Einstellungen selbst, '
              + 'ein Ausblenden waere unumkehrbar. Wer sie einschraenken will, aendert die Faehigkeit '
              + '"Vereinseinstellungen" unter Verwaltung › Rollen & Rechte. '
              + '/ Administration cannot be hidden: it holds the settings themselves, so hiding it '
              + 'would be irreversible. Restrict it via the "Club settings" capability under '
              + 'Administration › Roles & permissions.',
          );
        }

        // Ehrliche Antwort statt eines stillen 200 beim Zuruecksetzen — siehe
        // Kopf. Die RLS bleibt die Durchsetzung.
        const admin = await tx`select app.is_club_admin(${clubId}) as ok`;
        if ((admin[0] as { ok: boolean } | undefined)?.ok !== true) {
          throw problem(
            403,
            'Forbidden',
            'Nur die Vereinsleitung (Eigentuemer, Administrator, Moderator) kann einstellen, '
              + 'wem ein Modul angeboten wird. '
              + '/ Only club leadership (owner, admin, moderator) can configure who is offered a module.',
          );
        }

        if (visible === null) {
          // Zuruecksetzen = die Ausnahme loeschen. Der Ziel-Vergleich laeuft
          // ueber die drei Spalten, damit ein falsch gepaartes (scope,
          // target_id) nichts Fremdes trifft.
          await tx`
            delete from app.module_visibility
             where club_id = ${clubId}
               and module_key = ${moduleKey}
               and scope = ${scope}
               and coalesce(role_id, department_id, member_id) = ${targetId}`;
        } else if (scope === 'role') {
          // upsert: die Zeile fehlt beim ersten Umlegen (fehlende Zeile = die
          // abgeleitete Vorgabe). Ein Client soll dafuer nicht zwei Verben
          // brauchen. Drei partielle Unique-Indizes = drei ON-CONFLICT-Ziele,
          // deshalb drei ausgeschriebene Anweisungen: ein zusammengesetztes
          // Fragment waere kuerzer, aber der Konflikt-Index steht dann nicht
          // mehr lesbar neben seiner Bedingung.
          await tx`
            insert into app.module_visibility
              (club_id, module_key, scope, role_id, visible)
            values (${clubId}, ${moduleKey}, 'role', ${targetId}, ${visible})
            on conflict (club_id, module_key, role_id) where scope = 'role'
            do update set visible = excluded.visible`;
        } else if (scope === 'department') {
          await tx`
            insert into app.module_visibility
              (club_id, module_key, scope, department_id, visible)
            values (${clubId}, ${moduleKey}, 'department', ${targetId}, ${visible})
            on conflict (club_id, module_key, department_id) where scope = 'department'
            do update set visible = excluded.visible`;
        } else {
          await tx`
            insert into app.module_visibility
              (club_id, module_key, scope, member_id, visible)
            values (${clubId}, ${moduleKey}, 'member', ${targetId}, ${visible})
            on conflict (club_id, module_key, member_id) where scope = 'member'
            do update set visible = excluded.visible`;
        }

        // Neu lesen statt das Formular zu spiegeln (Muster loadState): die
        // Vorgabe kann sich zwischen zwei Klicks geaendert haben, wenn jemand
        // gleichzeitig an den Rollen arbeitet.
        return z.array(moduleVisibilityRowSchema).parse(
          await tx`select * from app.club_module_visibility_matrix(${clubId})
                    where module_key = ${moduleKey}
                    order by scope, target_label`,
        );
      }),
      200,
    );
  },
);
