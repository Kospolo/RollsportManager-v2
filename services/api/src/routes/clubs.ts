// ============================================================================
// routes/clubs.ts - Verein anlegen, eigene Vereine lesen, eigenen Verein
// aendern (owner/admin).
//
// POST /clubs kam mit der Registrierung dazu (0034). 0002:290-291 sagte schon
// "club creation is an API operation" und liess deshalb bewusst JEDE
// INSERT-Policy auf app.clubs weg - die Route hat nur bis hierher gefehlt.
//
// join_code: NICHT MEHR HIER (0035). Der Code hat eine eigene Route
// (GET /clubs/{clubId}/join-code, gated auf members:manage) und ein
// Spaltenrecht in der Datenbank. Die frueher hier stehende Redigierung
// (JOIN_CODE_VISIBLE) schuetzte nur diese eine Abfrage - das Recht schuetzt die
// Spalte. Deshalb stehen die SELECTs hier ab jetzt auf Spaltenlisten: `*` ist
// unter withUser seit 0035 ein 42501.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  clubJoinCodeSchema,
  clubRegistrationResultSchema,
  clubRegistrationSchema,
  clubSchema,
  clubUpdateSchema,
  memberSchema,
  problemSchema,
  uuid,
} from '../lib/validation.js';
import { withServiceRole, withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { ADMIN_ROLES } from '../lib/guards.js';
import { requireClubRoleDb } from '../lib/capabilities.js';
import { clientIp, enforceRateLimits } from '../lib/rate-limit.js';
import { recordAcknowledgements } from '../lib/consent.js';

export const clubsRouter = createRouter();

const clubIdParam = z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) });

/**
 * Testphase eines neu angelegten Vereins.
 *
 * 30 Tage: lang genug, um eine Saisonvorbereitung zu erleben (Trainingsplan,
 * ein Wettkampf, eine Abrechnung), kurz genug, um eine Entscheidung zu
 * erzwingen.
 */
const TRIAL_DAYS = 30;

/**
 * Die Spalten eines Vereins, die JEDES Mitglied lesen darf - exakt clubSchema.
 *
 * ### Warum hier eine Liste steht und kein `*` ###
 * Zwei unabhaengige Gruende, und jeder allein wuerde genuegen:
 *   1. SEIT 0035 IST `select *` HIER EIN LAUFZEITFEHLER. Das Leserecht auf
 *      app.clubs.join_code / join_code_normalized ist der Rolle `authenticated`
 *      entzogen; ein `*` verlangt ALLE Spalten und quittiert unter withUser mit
 *      42501 -> 403. Das gilt auch fuer `returning *`.
 *   2. `select *` auf eine Tabelle mit einer Geheimnis-Spalte ist der Fehler
 *      selbst, nicht nur sein Symptom. Eine Liste sagt, was hinausgeht; ein `*`
 *      liefert aus, was morgen jemand danebenlegt.
 *
 * Vorgaenger war JOIN_CODE_VISIBLE - ein `case when has_club_role(...)`, das den
 * Code je Leser auf NULL redigierte. Gut gemeint und wirkungslos: es war eine
 * Bitte an DIESE Abfrage. Wer per PostgREST, psql oder einer zweiten Route an
 * app.clubs ging, bekam den Code weiterhin. Ein Geheimnis wird nicht dort
 * verteidigt, wo es gelesen wird, sondern dort, wo es liegt (0035).
 */
export const CLUB_COLUMNS = `id, name, short_name, city, discipline, founded_year,
                      settings, logo_asset_id, created_at, updated_at`;

clubsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs',
    tags: ['clubs'],
    summary: 'List clubs of the current user (RLS-scoped)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: jsonContent(z.array(clubSchema), 'Clubs the caller is a member of'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select ${tx.unsafe(CLUB_COLUMNS)} from app.clubs where deleted_at is null order by name`,
    );
    return c.json(z.array(clubSchema).parse(rows), 200);
  },
);

clubsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}',
    tags: ['clubs'],
    summary: 'Get a single club',
    security: [{ bearerAuth: [] }],
    request: { params: clubIdParam },
    responses: {
      200: jsonContent(clubSchema, 'The club'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    // Kein requireClubMember aus dem TOKEN: wer gerade einen Verein angelegt
    // hat, steht dort noch nicht drin (der Token ist aelter als der Verein).
    // RLS (clubs_select = app.is_club_member, DB-aufgeloest seit 0025) ist die
    // Autorisierung - ein Nicht-Mitglied bekommt 0 Zeilen und damit 404.
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select ${tx.unsafe(CLUB_COLUMNS)} from app.clubs where id = ${clubId} and deleted_at is null`,
    );
    if (rows.length === 0) throw problem(404, 'Not Found', 'Club not found');
    return c.json(clubSchema.parse(rows[0]), 200);
  },
);

// ---------------------------------------------------------------------------
// GET /clubs/{clubId}/join-code - der Vereinscode, fuer die, die ihn brauchen.
//
// Die Gegenbuchung zum Entfernen von join_code aus clubSchema (0035): der Code
// verschwindet nicht, er bekommt eine eigene Adresse. Das ist der eigentliche
// Gewinn - ein Geheimnis, das in jeder Vereinsantwort mitfaehrt, kann niemand
// bewachen; eines mit eigener Route hat einen Aufrufer, einen Gate und eine
// Zeile im Zugriffslog.
//
// ZWEI Schranken, und die zweite ist die, die zaehlt:
//   * requireClubRoleDb (hier) liefert ein ehrliches 403 mit lesbarem Text.
//   * app.club_join_code() prueft die Rolle NOCHMAL in der Datenbank. Faellt
//     diese Route weg, wird sie umgangen oder vergisst jemand den Guard, bleibt
//     der Code trotzdem verschlossen (42501 -> 403). Ohne diese zweite Schranke
//     waere das Spaltenrecht aus 0035 fuer die Berechtigten nur ein
//     Service-Mode-Schluessel unter der Fussmatte.
//
// DAS GATE IST owner/admin/moderator, NICHT members:manage (0041). 0035 fragte
// den Katalog (has_cap('members','manage')) und liess damit auch den treasurer
// durch - begruendet mit "wer Mitglieder anlegen darf, ...". Das stimmt nicht:
// club_members_insert ist owner/admin (0002:321-323), der treasurer darf es
// NICHT. Fuer ihn waere der Code der einzige Weg, Menschen in den Verein zu
// bringen. Die Regel steht genau einmal - in app.can_read_join_code() (0041),
// die auch die RLS auf app.club_join_codes fahrt.
// ---------------------------------------------------------------------------
clubsRouter.openapi(
  createRoute({
    method: 'get',
    path: '/clubs/{clubId}/join-code',
    tags: ['clubs'],
    summary: 'Vereinscode lesen (owner/admin/moderator) / Read the club join code',
    description:
      'Liefert den juengsten Einladungscode des Vereins. Erfordert owner, admin oder moderator - ' +
      'dieselbe Rollenliste, die den Code rotieren und widerrufen darf: wer ihn sieht, kann ihn auch ' +
      'einziehen. Der Code steht seit 0035 NICHT mehr am Club-Objekt (GET /clubs lieferte ihn bis dahin ' +
      'an jedes Mitglied, auch an Kinder); das Leserecht auf die Spalte ist der Rolle authenticated in ' +
      'der Datenbank entzogen. / Returns the club\'s most recent invite code. Requires owner, admin or moderator.',
    security: [{ bearerAuth: [] }],
    request: { params: clubIdParam },
    responses: {
      200: jsonContent(clubJoinCodeSchema, 'Der Vereinscode / The club join code'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    await requireClubRoleDb(c, clubId, ADMIN_ROLES, 'club_settings');

    // withUser, NICHT withServiceRole: app.club_join_code ist security definer
    // und liest die Rolle aus der aufrufenden Sitzung. Im Service-Mode gaebe es
    // keinen `sub` - can_read_join_code waere false und die Funktion wuerde den
    // eigenen Aufrufer aussperren. Der Gate lebt von der Impersonation.
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`select club_id, join_code, join_code_expires_at, join_code_revoked_at
           from app.club_join_code(${clubId})`,
    );
    // 0 Zeilen = Verein weg oder soft-deleted. Wer nicht darf, ist hier nie
    // angekommen (requireClubRoleDb 403, sonst 42501 aus der Funktion).
    if (rows.length === 0) throw problem(404, 'Not Found', 'Club not found');
    return c.json(clubJoinCodeSchema.parse(rows[0]), 200);
  },
);

clubsRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/clubs/{clubId}',
    tags: ['clubs'],
    summary: 'Update own club (owner/admin)',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: { content: { 'application/json': { schema: clubUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(clubSchema, 'Updated club'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json');
    // DB-aufgeloest statt aus dem Token: sonst koennte der frisch registrierte
    // Inhaber seinen EIGENEN Verein nicht bearbeiten (sein Token entstand vor
    // dem Verein und traegt club_roles={}).
    await requireClubRoleDb(c, clubId, ADMIN_ROLES, 'club_settings');

    const patch: Record<string, unknown> = { ...body };
    if (patch['settings'] !== undefined) patch['settings'] = JSON.stringify(patch['settings']);

    // `returning *` waere hier seit 0035 ein 42501: RETURNING verlangt das
    // Leserecht auf JEDE genannte Spalte, und join_code ist fuer authenticated
    // keine mehr. Die Liste ist nicht Kosmetik, sie ist die Bedingung.
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`update app.clubs set ${tx(patch)}
         where id = ${clubId} and deleted_at is null
         returning ${tx.unsafe(CLUB_COLUMNS)}`,
    );
    if (rows.length === 0) throw problem(404, 'Not Found', 'Club not found');
    return c.json(clubSchema.parse(rows[0]), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /clubs - Vereins-SELBSTANLAGE mit Testphase
//
// "OEFFENTLICH" HEISST HIER: OHNE VEREINSZUGEHOERIGKEIT - NICHT OHNE ANMELDUNG.
// Die Route steht bewusst NICHT in app.ts PUBLIC_PATHS. Zwei Gruende:
//   1. Ohne `sub` gibt es niemanden, den man zum Inhaber machen koennte. Der
//      Verein braeuchte einen Inhaber, den man erst spaeter "irgendwie"
//      nachtraegt - und bis dahin waere er ein herrenloser Mandant.
//   2. Ein anonymes POST /clubs ist eine Einladung, die Datenbank mit
//      Phantasievereinen zu fluten, gegen die keine Konto-Achse hilft.
// Der Ablauf ist trotzdem vollstaendig: Person meldet sich an (heute
// /dev/login, spaeter GoTrue) -> POST /clubs -> sie ist Inhaberin.
//
// GEFRAGT WERDEN NUR NAME + ORT. Keine Registernummer, keine Rechtsform, keine
// Zahlungsdaten. Wer beim Ausprobieren nach dem Vereinsregister-Auszug fragt,
// bekommt niemanden zum Ausprobieren; das kommt beim Upgrade.
// ---------------------------------------------------------------------------
clubsRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs',
    tags: ['clubs'],
    summary: 'Verein selbst anlegen (Testphase) / Register a club (trial)',
    description:
      'Legt einen Verein an und macht die aufrufende Person zur Inhaberin (owner, active) - inklusive ' +
      'Rollenzuweisung, sonst haette sie im eigenen Verein NULL Rechte (app.member_role_keys, 0025:37-53). ' +
      'Setzt eine 30-Tage-Testphase (Entitlement club_license, metadata.status=trial) und erzeugt den ersten ' +
      'Vereinscode. Erfordert eine Anmeldung (fuer den Inhaber-Bezug), aber KEINE Vereinszugehoerigkeit.',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: clubRegistrationSchema } }, required: true },
    },
    responses: {
      201: jsonContent(clubRegistrationResultSchema, 'Verein angelegt, Aufrufer ist Inhaber'),
      429: jsonContent(problemSchema, 'Zu viele Versuche (RFC 7807 + Retry-After)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');

    // Konto-Achse zuerst: EIN Konto darf nicht beliebig viele Vereine anlegen.
    await enforceRateLimits(c, [
      { scope: 'account', identifier: claims.sub, limit: 3, window: '24 hours' },
      { scope: 'ip', identifier: clientIp(c), limit: 10, window: '24 hours' },
    ]);

    // SERVICE-MODE, und zwar zwingend - nicht aus Bequemlichkeit:
    //   a) app.clubs hat KEINE INSERT-Policy (0002:290-291, Absicht).
    //   b) protect_club_membership (0007:191-194) wirft bei einer
    //      owner-Zeile 'only owners may grant owner roles', solange
    //      auth.uid() nicht schon owner IST. Beim ERSTEN owner eines neuen
    //      Vereins kann das niemand sein - ein Henne-Ei-Problem, das der
    //      Trigger bewusst offen laesst: 'auth.uid() is null = Migration/
    //      Seed/service_role' (0024:155). Genau dieser Pfad ist gemeint.
    // Autorisierung dieses Service-Mode-Aufrufs (db.ts verlangt sie): gueltige
    // Anmeldung + Drosselung; es gibt niemanden, dessen Rechte man verletzen
    // koennte - der Verein existiert noch nicht.
    const created = await withServiceRole(
      `club self-registration by profile ${claims.sub} (no INSERT policy on app.clubs by design, 0002:290)`,
      async (tx) => {
        // Der Verein. Der clubs_rbac_seed-Trigger (0024:74) legt dabei
        // automatisch die 7 Systemrollen + die Start-Rechtematrix an.
        const clubRows = await tx<{ id: string; join_code: string }[]>`
          insert into app.clubs (name, city, short_name, discipline, join_code)
          values (${body.name}, ${body.city}, ${body.short_name ?? null},
                  ${body.discipline ?? null}, app.generate_join_code())
          returning id, join_code`;
        const club = clubRows[0];
        if (club === undefined) throw problem(500, 'Internal Server Error', 'club insert failed');

        // Anzeigename aus dem Profil. Es gibt (noch) kein Namensfeld im
        // Anmeldeformular - der Verein wird angelegt, nicht die Person.
        const profiles = await tx<{ display_name: string | null }[]>`
          select display_name from app.profiles where id = ${claims.sub}`;
        const displayName = profiles[0]?.display_name ?? 'Inhaber:in';
        const parts = displayName.trim().split(/\s+/);
        const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : displayName;
        const lastName = parts.length > 1 ? (parts[parts.length - 1] as string) : '-';

        // Die Inhaber-Mitgliedschaft. status='active' (nicht pending: wer den
        // Verein anlegt, beantragt nichts).
        //
        // Der Trigger club_members_rbac_sync_insert (0024:130) spiegelt
        // club_members.role automatisch nach app.member_roles - ein manuelles
        // INSERT dort waere doppelt und wuerde am unique (member_id, role_id)
        // haengen. member_roles ist seit 0025 die Wahrheit fuer alle Policies;
        // ohne diese Zeile haette der Inhaber NULL Rechte im eigenen Verein.
        // Der Trigger scheitert LAUT, falls die Systemrolle fehlt (0024:100).
        const memberRows = await tx<Record<string, unknown>[]>`
          insert into app.club_members (club_id, profile_id, first_name, last_name, role, status, joined_on)
          values (${club.id}, ${claims.sub}, ${firstName}, ${lastName}, 'owner', 'active', current_date)
          returning *`;
        const member = memberRows[0];
        if (member === undefined) throw problem(500, 'Internal Server Error', 'owner insert failed');

        // Testphase. source='manual', weil app.entitlement_source nur
        // (stripe|revenuecat|manual) kennt (0006:27) - der Trial-Zustand steckt
        // in metadata.status='trial', genau wie app.is_club_pro es liest
        // (0012:60: status in ('active','trial')). tier='pro' schaltet die
        // PRO-Module fuer die Testphase frei.
        const entRows = await tx<{ valid_until: Date }[]>`
          insert into app.entitlements
            (subject_type, subject_id, entitlement, source, provider_ref, valid_until, metadata)
          values ('club', ${club.id}, 'club_license', 'manual', 'self-service trial',
                  now() + (${TRIAL_DAYS} || ' days')::interval,
                  ${tx.json({ tier: 'pro', status: 'trial' })})
          returning valid_until`;

        // KENNTNISNAHME, nicht Einwilligung (0039).
        //
        // Bis hier landeten terms/privacy als Zeilen in app.consents mit
        // granted=true. Das war aus zwei Gruenden falsch, und 0039 weist es
        // jetzt per CHECK ab - diese Schleife WAERE zur Laufzeit gebrochen
        // (kein vitest faehrt sie, deshalb waeren die Gates gruen geblieben):
        //   * terms = Vertragsschluss (Art. 6 Abs. 1 lit. b), privacy =
        //     Informationspflicht (Art. 13). In beides willigt man nicht ein,
        //     und beides ist nicht frei widerruflich (Art. 7 Abs. 3).
        //   * Pflichthaken in einer Tabelle namens "consents" faerben auf das
        //     daneben stehende Freiwillige ab (Kopplungsverbot, Art. 7 Abs. 4).
        // Der Nachweis zeigt jetzt auf eine unveraenderliche Fassung
        // (internal.legal_documents) - ohne die gibt es ein ehrliches 409
        // statt einer Anmeldung, die hinterher nichts belegt.
        await recordAcknowledgements(tx, {
          profileId: claims.sub,
          clubId: club.id,
          kinds: ['terms', 'privacy'],
          surface: 'POST /clubs',
        });

        // Spaltenliste, obwohl hier service_role laeuft und `*` durchginge:
        // der Code steht schon in `club.join_code` (aus dem INSERT-RETURNING)
        // und geht von dort gezielt als `join_code` der Registrierungs-Antwort
        // hinaus. Ihn hier ein zweites Mal einzusammeln, hiesse, ihn in ein
        // Objekt zu legen, das clubSchema heisst - und genau diese Vermischung
        // war der Befund. Der Verein und sein Geheimnis werden ab 0035
        // getrennt gefuehrt, auch wo es "eh nicht auffiele".
        const clubRow = await tx<Record<string, unknown>[]>`
          select ${tx.unsafe(CLUB_COLUMNS)} from app.clubs where id = ${club.id}`;

        return {
          club: clubRow[0],
          member,
          joinCode: club.join_code,
          trialEndsAt: entRows[0]?.valid_until,
        };
      },
    );

    return c.json(
      clubRegistrationResultSchema.parse({
        club: clubSchema.parse(created.club),
        member: memberSchema.parse({ ...created.member, avatar_url: null, team_ids: [] }),
        join_code: created.joinCode,
        trial_ends_at: created.trialEndsAt,
      }),
      201,
    );
  },
);
