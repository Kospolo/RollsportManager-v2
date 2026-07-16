// ============================================================================
// routes/clubs.ts - Verein anlegen, eigene Vereine lesen, eigenen Verein
// aendern (owner/admin).
//
// POST /clubs kam mit der Registrierung dazu (0034). 0002:290-291 sagte schon
// "club creation is an API operation" und liess deshalb bewusst JEDE
// INSERT-Policy auf app.clubs weg - die Route hat nur bis hierher gefehlt.
//
// join_code-REDIGIERUNG (siehe unten): der Code ist ab 0034 die Eintrittskarte
// in die Warteschlange und darf nicht mehr an jedes Mitglied gehen.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
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
 * SQL-Ausdruck, der join_code NUR fuer Code-Verwalter liefert, sonst NULL.
 *
 * ### Warum das eine Verschaerfung ist, die hierher gehoert ###
 * clubSchema hat join_code schon immer (validation.ts:58), und GET /clubs machte
 * 'select *' - jedes Mitglied, bis hinunter zum guest_coach, konnte den
 * Vereinscode auslesen. Solange den Code niemand einloesen konnte (0002:38: eine
 * Spalte ohne Leser), war das folgenlos. Ab 0034 ist er die Eintrittskarte in
 * die Warteschlange: wer ihn hat, kann Antraege ausloesen. Ein ausgetretener
 * guest_coach mit altem Screenshot koennte den Verein sonst mit Antraegen
 * fluten.
 *
 * Kein Vertragsbruch: join_code ist bereits nullable. Der Wert wird redigiert,
 * nicht das Feld entfernt - iOS/Android brauchen kein Update.
 * app.has_club_role loest aus der DB auf (0025), nicht aus dem Token.
 */
const JOIN_CODE_VISIBLE = `case when app.has_club_role(app.clubs.id, array['owner','admin','moderator'])
                                then app.clubs.join_code else null end`;

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
      tx`select app.clubs.*, ${tx.unsafe(JOIN_CODE_VISIBLE)} as join_code
           from app.clubs where deleted_at is null order by name`,
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
      tx`select app.clubs.*, ${tx.unsafe(JOIN_CODE_VISIBLE)} as join_code
           from app.clubs where id = ${clubId} and deleted_at is null`,
    );
    if (rows.length === 0) throw problem(404, 'Not Found', 'Club not found');
    return c.json(clubSchema.parse(rows[0]), 200);
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
    await requireClubRoleDb(c, clubId, ADMIN_ROLES);

    const patch: Record<string, unknown> = { ...body };
    if (patch['settings'] !== undefined) patch['settings'] = JSON.stringify(patch['settings']);

    const rows = await withUser(c.get('claims'), (tx) =>
      tx`update app.clubs set ${tx(patch)}
         where id = ${clubId} and deleted_at is null
         returning *`,
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
                  ${JSON.stringify({ tier: 'pro', status: 'trial' })}::jsonb)
          returning valid_until`;

        // Einwilligungen - je Zweck eine Zeile (Art. 7 Abs. 2 DSGVO).
        for (const purpose of ['terms', 'privacy'] as const) {
          await tx`
            insert into app.consents
              (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id, evidence)
            values (${club.id}, ${member['id'] as string}, ${claims.sub}, ${purpose}, true, ${claims.sub},
                    ${JSON.stringify({ surface: 'POST /clubs' })}::jsonb)`;
        }

        const clubRow = await tx<Record<string, unknown>[]>`
          select * from app.clubs where id = ${club.id}`;

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
