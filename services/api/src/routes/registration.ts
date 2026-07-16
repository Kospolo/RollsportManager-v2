// ============================================================================
// routes/registration.ts - Beitritt per Vereinscode, Freigabe, Code-Rotation.
//
// DIE KERNENTSCHEIDUNG: EIN RICHTIGER CODE IST EIN ANTRAG, KEIN ZUTRITT.
// Wer den Code kennt, bekommt club_members.status='pending'. Das ist KEIN
// halber Zugang, sondern gar keiner:
//   app.member_role_keys (0025:37-53) filtert hart auf m.status='active'
//   -> pending liefert ein LEERES Rollen-Array
//   -> app.is_club_member (0025:85-94) = false
//   -> jede Policy, die darauf steht (~110 auf 48 Tabellen), sieht 0 Zeilen.
// Der Code ist damit nur die Eintrittskarte in die WARTESCHLANGE. Das ist
// wichtig, weil der Code in WhatsApp-Gruppen und an Aushaengen landet - er ist
// ein GETEILTES Geheimnis und darf niemals allein Zugang verschaffen.
//
// Die Freigabe (pending -> active) ist ein einziges UPDATE und wirkt SOFORT,
// ohne Re-Login: seit 0025 loest die DB die Rollen bei jeder Anfrage neu auf
// statt sie aus dem Token zu lesen.
//
// WARUM SERVICE-MODE BEIM BEITRITT:
// club_members_insert verlangt has_cap(club_id,'members','manage') (0026:33).
// Eine wildfremde Person hat diese Faehigkeit naturgemaess nicht - es gibt fuer
// "Fremder stellt Antrag" keine Policy, und es soll auch keine geben (sie
// muesste jedem Fremden INSERT auf den Roster jedes Vereins erlauben). Der
// Einloese-Pfad autorisiert sich deshalb SELBST: gueltiger Code + Drosselung.
// Genau das verlangt db.ts von jedem Service-Mode-Aufruf.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  clubJoinCodeRevokedSchema,
  clubJoinCodeRotatedSchema,
  clubJoinInputSchema,
  clubJoinResultSchema,
  memberSchema,
  problemSchema,
  uuid,
} from '../lib/validation.js';
import { withServiceRole, withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { requireCap, requireClubRoleDb } from '../lib/capabilities.js';
import { checkRateLimits, clientIp } from '../lib/rate-limit.js';
import { recordAuthEvent } from '../lib/security-log.js';

export const registrationRouter = createRouter();

const clubIdParam = z.object({ clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }) });
const memberIdParam = z.object({
  clubId: uuid.openapi({ param: { name: 'clubId', in: 'path' } }),
  memberId: uuid.openapi({ param: { name: 'memberId', in: 'path' } }),
});

/**
 * DIE Antwort auf jeden fehlgeschlagenen Einloese-Versuch. Immer identisch.
 *
 * Gibt es den Code nicht? Ist er abgelaufen? Widerrufen? Gehoert er zu einem
 * geloeschten Verein? -> Der Aufrufer erfaehrt in ALLEN Faellen exakt dasselbe.
 * Jede Unterscheidung waere ein Enumerations-Orakel: "abgelaufen" verraet, dass
 * es den Code GIBT, und damit haette ein Angreifer den Coderaum von 40 Bit auf
 * "welche der gefundenen Codes sind noch frisch" reduziert.
 *
 * Dasselbe Muster wie public-routines.ts:105 (dort alles -> identisch 404).
 */
function invalidCode(): never {
  throw problem(
    404,
    'Not Found',
    'Dieser Vereinscode ist nicht gültig. / This club code is not valid.',
  );
}

// ---------------------------------------------------------------------------
// POST /clubs/join - Beitrittsantrag per Code
// ---------------------------------------------------------------------------
registrationRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/join',
    tags: ['registration'],
    summary: 'Beitritt beantragen (Vereinscode) / Request to join a club (club code)',
    description:
      'Ein RICHTIGER Code erzeugt einen ANTRAG (status=pending), keinen Zugang: app.member_role_keys (0025) ' +
      'filtert auf status=active, eine pending-Mitgliedschaft faellt damit durch jede Policy. ' +
      'Der Vorstand gibt frei (POST .../approve) - das wirkt sofort ohne Re-Login. ' +
      'Falscher/abgelaufener/widerrufener Code -> immer dieselbe 404 (keine Enumeration), zusaetzlich gedrosselt.',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: clubJoinInputSchema } }, required: true },
    },
    responses: {
      201: jsonContent(clubJoinResultSchema, 'Antrag angelegt (status=pending)'),
      409: jsonContent(problemSchema, 'Bereits Mitglied oder Antrag laeuft bereits'),
      429: jsonContent(problemSchema, 'Zu viele Versuche (RFC 7807 + Retry-After)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');

    // Normalisierung VOR der Drosselung: sonst liefen 'rsv-dem0' und
    // 'RSV-DEMO' auf getrennte Zaehler und die code-Achse waere umgehbar,
    // indem man einfach die Schreibweise variiert.
    const normalized = await withServiceRole('normalize join code', async (tx) => {
      const rows = await tx<{ n: string | null }[]>`
        select app.normalize_join_code(${body.code}) as n`;
      return rows[0]?.n ?? null;
    });
    if (normalized === null) invalidCode();

    // Drei Achsen. Die dritte (code, global) ist die einzige, die gegen
    // verteilte Bots wirkt - siehe lib/rate-limit.ts.
    //
    // checkRateLimits statt enforceRateLimits, weil die Sperre eine Zeile im
    // Protokoll verdient: ein 429 IST das Ereignis, das man spaeter auswerten
    // will ("wann und wie lange lief das Dauerfeuer?"). enforceRateLimits
    // wuerfe sofort und der Aufruf von recordAuthEvent kaeme nie zustande.
    const verdict = await checkRateLimits([
      { scope: 'ip', identifier: clientIp(c), limit: 20, window: '1 hour' },
      { scope: 'account', identifier: claims.sub, limit: 10, window: '1 hour' },
      { scope: 'code', identifier: normalized, limit: 20, window: '1 hour' },
    ]);
    if (!verdict.allowed) {
      // Die Achse steht im PROTOKOLL (auswertbar), nicht in der Antwort:
      // "zu viele Versuche fuer diesen Code" verriete, dass es den Code gibt.
      recordAuthEvent(c, {
        event: 'join_rate_limited',
        status: 429,
        detail: { scope: verdict.scope, retry_after: verdict.retryAfter },
      });
      throw problem(
        429,
        'Too Many Requests',
        `Zu viele Versuche. Bitte in ${verdict.retryAfter} Sekunden erneut versuchen. ` +
          `/ Too many attempts. Please retry in ${verdict.retryAfter} seconds.`,
      ).withHeaders({ 'retry-after': String(verdict.retryAfter) });
    }

    const result = await withServiceRole(
      'club join by code (authorized by the code itself + rate limit)',
      async (tx) => {
        const clubs = await tx<
          {
            id: string;
            name: string;
            join_code_expires_at: Date | null;
            join_code_revoked_at: Date | null;
          }[]
        >`
          select id, name, join_code_expires_at, join_code_revoked_at
          from app.clubs
          where join_code_normalized = ${normalized}
            and deleted_at is null`;

        const club = clubs[0];
        if (club === undefined) return { kind: 'invalid' as const };
        if (club.join_code_revoked_at !== null) return { kind: 'revoked' as const };
        if (club.join_code_expires_at !== null && club.join_code_expires_at.getTime() <= Date.now()) {
          return { kind: 'expired' as const };
        }

        // Schon drin (oder schon beantragt)? Dann NICHT still eine zweite Zeile
        // anlegen - der unique index club_members(club_id, profile_id) wuerde
        // ohnehin 23505 werfen, aber eine klare Auskunft ist hier ungefaehrlich:
        // wer bis hierher kommt, kennt den Code bereits.
        const existing = await tx<{ id: string; status: string }[]>`
          select id, status from app.club_members
          where club_id = ${club.id} and profile_id = ${claims.sub} and deleted_at is null`;
        if (existing[0] !== undefined) {
          return { kind: 'exists' as const, club, member: existing[0] };
        }

        // status='pending' ist der Antrag. role='member' ist die niedrigste
        // Rolle - und sie ist folgenlos, solange status<>'active'.
        const inserted = await tx<{ id: string; status: string }[]>`
          insert into app.club_members (club_id, profile_id, first_name, last_name, role, status)
          values (${club.id}, ${claims.sub}, ${body.first_name}, ${body.last_name}, 'member', 'pending')
          returning id, status`;

        const member = inserted[0];
        if (member === undefined) throw problem(500, 'Internal Server Error', 'insert failed');

        // Einwilligungen: getrennt je Zweck (Art. 7 Abs. 2 DSGVO).
        for (const purpose of ['terms', 'privacy'] as const) {
          await tx`
            insert into app.consents
              (club_id, member_id, subject_profile_id, purpose, granted, granted_by_profile_id, evidence)
            values (${club.id}, ${member.id}, ${claims.sub}, ${purpose}, true, ${claims.sub},
                    ${tx.json({ surface: 'POST /clubs/join' })})`;
        }

        return { kind: 'created' as const, club, member };
      },
    );

    switch (result.kind) {
      case 'invalid':
        recordAuthEvent(c, { event: 'join_code_invalid', status: 404 });
        invalidCode();
      // eslint-disable-next-line no-fallthrough
      case 'revoked':
        // Protokolliert getrennt (auswertbar), antwortet identisch (keine Auskunft).
        recordAuthEvent(c, { event: 'join_code_revoked', status: 404 });
        invalidCode();
      // eslint-disable-next-line no-fallthrough
      case 'expired':
        recordAuthEvent(c, { event: 'join_code_expired', status: 404 });
        invalidCode();
      // eslint-disable-next-line no-fallthrough
      case 'exists':
        recordAuthEvent(c, {
          event: 'join_already_member',
          status: 409,
          detail: { club_id: result.club.id, status: result.member.status },
        });
        throw problem(
          409,
          'Conflict',
          result.member.status === 'pending'
            ? 'Dein Antrag liegt bereits vor. / Your request is already pending.'
            : 'Du bist bereits Mitglied dieses Vereins. / You are already a member of this club.',
        );
      case 'created':
        return c.json(
          clubJoinResultSchema.parse({
            club_id: result.club.id,
            club_name: result.club.name,
            member_id: result.member.id,
            status: result.member.status,
          }),
          201,
        );
    }
  },
);

// ---------------------------------------------------------------------------
// POST /clubs/{clubId}/members/{memberId}/approve
// ---------------------------------------------------------------------------
registrationRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/members/{memberId}/approve',
    tags: ['registration'],
    summary: 'Beitrittsantrag freigeben (pending -> active) / Approve a join request',
    description:
      'Setzt status=active. Wirkt SOFORT ohne Re-Login (0025 loest Rollen bei jeder Anfrage aus der DB auf). ' +
      'Erfordert die Faehigkeit members>=manage. Der Trigger protect_club_membership (0007:216-222) blockt ' +
      'zusaetzlich jede Selbst-Freigabe.',
    security: [{ bearerAuth: [] }],
    request: { params: memberIdParam },
    responses: {
      200: jsonContent(memberSchema, 'Freigegebenes Mitglied (status=active)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, memberId } = c.req.valid('param');
    const claims = c.get('claims');

    // DB-aufgeloest, NICHT aus dem Token: der frisch registrierte Inhaber hat
    // club_roles={} im Token (dev-login/GoTrue kennen seinen neuen Verein noch
    // nicht). guards.requireClubRole wuerde ihn im EIGENEN Verein aussperren.
    await requireCap(c, clubId, 'members', 'manage');

    const rows = await withUser(claims, (tx) =>
      tx`update app.club_members
            set status = 'active',
                joined_on = coalesce(joined_on, current_date)
          where id = ${memberId}
            and club_id = ${clubId}
            and status = 'pending'
            and deleted_at is null
          returning *`,
    );
    if (rows.length === 0) {
      // Kein pending-Antrag (oder RLS hat gefiltert). Keine Auskunft darueber,
      // welcher der beiden Faelle es war.
      throw problem(404, 'Not Found', 'Kein offener Antrag. / No pending request.');
    }
    return c.json(memberSchema.parse({ ...rows[0], avatar_url: null, team_ids: [] }), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /clubs/{clubId}/members/{memberId}/reject
// ---------------------------------------------------------------------------
registrationRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/members/{memberId}/reject',
    tags: ['registration'],
    summary: 'Beitrittsantrag ablehnen / Reject a join request',
    description:
      'Soft-Delete des Antrags (deleted_at). Die Person kann danach erneut beantragen - eine Ablehnung ist ' +
      'keine Sperre. Erfordert members>=manage.',
    security: [{ bearerAuth: [] }],
    request: { params: memberIdParam },
    responses: {
      200: jsonContent(memberSchema, 'Abgelehnter Antrag (deleted_at gesetzt)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, memberId } = c.req.valid('param');
    await requireCap(c, clubId, 'members', 'manage');

    const rows = await withUser(c.get('claims'), (tx) =>
      tx`update app.club_members
            set deleted_at = now(), status = 'left'
          where id = ${memberId}
            and club_id = ${clubId}
            and status = 'pending'
            and deleted_at is null
          returning *`,
    );
    if (rows.length === 0) throw problem(404, 'Not Found', 'Kein offener Antrag. / No pending request.');
    return c.json(memberSchema.parse({ ...rows[0], avatar_url: null, team_ids: [] }), 200);
  },
);

// ---------------------------------------------------------------------------
// POST /clubs/{clubId}/join-code/rotate
// ---------------------------------------------------------------------------
registrationRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/join-code/rotate',
    tags: ['registration'],
    summary: 'Vereinscode neu erzeugen / Rotate the club join code',
    description:
      'Erzeugt einen neuen Code (CSPRNG, Crockford-Base32) und macht den alten damit sofort wertlos. ' +
      'Noetig, weil der Code ein GETEILTES Geheimnis ist: er steht in WhatsApp-Gruppen und an Aushaengen. ' +
      'Ohne Rotation waere die einzige Reaktion auf einen geleakten Code die Neuanlage des Vereins. ' +
      'Erfordert owner/admin/moderator (wie clubs_update, 0007:253).',
    security: [{ bearerAuth: [] }],
    request: {
      params: clubIdParam,
      body: {
        content: {
          'application/json': {
            schema: z
              .object({
                /** Tage bis zum Ablauf. null/weggelassen = laeuft nie ab. */
                expires_in_days: z.number().int().min(1).max(365).nullable().optional(),
              })
              .openapi('ClubJoinCodeRotateInput'),
          },
        },
        required: false,
      },
    },
    responses: {
      200: jsonContent(clubJoinCodeRotatedSchema, 'Neuer Code'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    const body = c.req.valid('json') ?? {};
    const days = body.expires_in_days ?? null;

    await requireClubRoleDb(c, clubId, ['owner', 'admin', 'moderator']);

    // withUser: clubs_update (is_club_admin) ist die zweite Verteidigungslinie.
    // Der Code selbst kommt aus der DB-Funktion - der Zufall darf nicht aus
    // Node kommen (Math.random ist kein CSPRNG) und muss dort erzeugt werden,
    // wo auch der Eindeutigkeits-Index sitzt.
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`update app.clubs
            set join_code            = app.generate_join_code(),
                join_code_revoked_at = null,
                join_code_expires_at = ${days === null ? null : tx`now() + (${days} || ' days')::interval`}
          where id = ${clubId} and deleted_at is null
          returning id, join_code, join_code_expires_at`,
    );
    if (rows.length === 0) throw problem(404, 'Not Found', 'Club not found');

    const row = rows[0] as { id: string; join_code: string; join_code_expires_at: Date | null };
    return c.json(
      clubJoinCodeRotatedSchema.parse({
        club_id: row.id,
        join_code: row.join_code,
        join_code_expires_at: row.join_code_expires_at,
      }),
      200,
    );
  },
);

// ---------------------------------------------------------------------------
// POST /clubs/{clubId}/join-code/revoke
// ---------------------------------------------------------------------------
registrationRouter.openapi(
  createRoute({
    method: 'post',
    path: '/clubs/{clubId}/join-code/revoke',
    tags: ['registration'],
    summary: 'Vereinscode widerrufen / Revoke the club join code',
    description:
      'Macht den Code ungueltig, OHNE einen neuen zu erzeugen: der Verein nimmt damit keine Antraege mehr an. ' +
      'Getrennt von rotate, weil "niemand soll mehr beitreten" etwas anderes ist als "alle brauchen einen neuen Code".',
    security: [{ bearerAuth: [] }],
    request: { params: clubIdParam },
    responses: {
      200: jsonContent(clubJoinCodeRevokedSchema, 'Code widerrufen'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId } = c.req.valid('param');
    await requireClubRoleDb(c, clubId, ['owner', 'admin', 'moderator']);
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`update app.clubs set join_code_revoked_at = now()
          where id = ${clubId} and deleted_at is null
          returning id, join_code_revoked_at`,
    );
    const row = rows[0] as { id: string; join_code_revoked_at: Date } | undefined;
    if (row === undefined) throw problem(404, 'Not Found', 'Club not found');
    return c.json(
      clubJoinCodeRevokedSchema.parse({
        club_id: row.id,
        join_code_revoked_at: row.join_code_revoked_at,
      }),
      200,
    );
  },
);
