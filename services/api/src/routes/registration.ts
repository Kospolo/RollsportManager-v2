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
//
// ### WAS 0037 HIER GEAENDERT HAT ###
// 1. DER CODE IST EINE TABELLE, KEINE SPALTE (app.club_join_codes).
//    Vorher lag er als app.clubs.join_code (0002:38) + _expires_at/_revoked_at
//    (0034:58-61) auf dem Verein - also EIN Code. Die Rotation unten war damit
//    ein UPDATE auf diese Spalte: in dem Moment, in dem der neue Code entstand,
//    war der alte UEBERSCHRIEBEN. Aushang, Eltern-WhatsApp, Screenshot: sofort
//    tot. Ein Ueberlappungsfenster ("der alte gilt noch 24h") war im Schema
//    nicht darstellbar - und eine Rotation, die alle aussperrt, benutzt
//    niemand. Der Einloeser liest jetzt NUR app.club_join_codes.
// 2. ABLEHNEN HEISST 'rejected', NICHT LOESCHEN (0036/0037).
//    Der Soft-Delete von vorher liess den Vorgang verschwinden; die naechste
//    Bewerbung derselben Person traf auf einen Vorstand ohne Gedaechtnis.
// 3. DER WIEDERANTRAG DREHT DIE ZEILE, ER LEGT KEINE ZWEITE AN.
//    Der Eindeutigkeits-Index (0002:82-84) laesst pro (club, profile) nur eine
//    Zeile zu - was 'left'/'inactive'/'rejected' zur Sackgasse machte: die
//    Person konnte NIE wieder beitreten und es nicht einmal signalisieren (den
//    eigenen Status haelt 0007:216-222 fest). Der Service-Mode-Pfad hier ist
//    die einzige Stelle, die das darf, weil er ohne auth.uid() laeuft.
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
import { recordAcknowledgements } from '../lib/consent.js';

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

/**
 * Sperrfrist nach einer ABLEHNUNG, bevor dieselbe Person erneut beantragen darf.
 *
 * Ohne sie waere 'rejected' (0036) nur Dekoration: der Abgelehnte stellte
 * denselben Antrag sofort wieder, und der Vorstand muesste ihn erneut ablehnen —
 * beliebig oft. Die Drosselung aus 0034 hilft hier NICHT: sie begrenzt Versuche
 * pro Stunde, nicht Hartnaeckigkeit ueber Wochen. Sieben Tage: lang genug, dass
 * sich Belaestigung nicht lohnt, kurz genug, dass eine versehentliche Ablehnung
 * ("falsche Zeile erwischt") keine Beziehung zerstoert — und der Vorstand kann
 * eine Ablehnung ohnehin sofort selbst zuruecknehmen (POST .../approve nimmt
 * auch 'rejected').
 */
const REAPPLY_COOLDOWN_DAYS = 7;

/** Ueberlappung: hoechstens 7 Tage. Wer laenger zwei Codes fuehrt, rotiert nicht — er sammelt. */
const MAX_OVERLAP_HOURS = 168;

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
        // DIE WAHRHEIT IST app.club_join_codes (0037), nicht mehr die Spalte
        // app.clubs.join_code: ein Verein kann MEHRERE Codes gleichzeitig
        // gueltig haben (Rotation mit Ueberlappungsfenster). Der Verein steht
        // ueber den Kindsatz fest - ein Code gehoert per Eindeutigkeits-Index
        // (0037, club_join_codes_normalized_uq) immer genau einem Verein.
        const codes = await tx<
          {
            club_id: string;
            club_name: string;
            expires_at: Date | null;
            revoked_at: Date | null;
          }[]
        >`
          select jc.club_id, c.name as club_name, jc.expires_at, jc.revoked_at
          from app.club_join_codes jc
          join app.clubs c on c.id = jc.club_id
          where jc.code_normalized = ${normalized}
            and c.deleted_at is null`;

        const code = codes[0];
        if (code === undefined) return { kind: 'invalid' as const };
        if (code.revoked_at !== null) return { kind: 'revoked' as const };
        if (code.expires_at !== null && code.expires_at.getTime() <= Date.now()) {
          return { kind: 'expired' as const };
        }
        const club = { id: code.club_id, name: code.club_name };

        // Schon drin (oder schon beantragt)? Dann NICHT still eine zweite Zeile
        // anlegen - der unique index club_members(club_id, profile_id) wuerde
        // ohnehin 23505 werfen, aber eine klare Auskunft ist hier ungefaehrlich:
        // wer bis hierher kommt, kennt den Code bereits.
        const existing = await tx<
          { id: string; status: string; rejected_at: Date | null; rejection_count: number }[]
        >`
          select id, status, rejected_at, rejection_count from app.club_members
          where club_id = ${club.id} and profile_id = ${claims.sub} and deleted_at is null`;

        const prior = existing[0];
        let member: { id: string; status: string } | undefined;

        if (prior === undefined) {
          // status='pending' ist der Antrag. role='member' ist die niedrigste
          // Rolle - und sie ist folgenlos, solange status<>'active'.
          const inserted = await tx<{ id: string; status: string }[]>`
            insert into app.club_members (club_id, profile_id, first_name, last_name, role, status)
            values (${club.id}, ${claims.sub}, ${body.first_name}, ${body.last_name}, 'member', 'pending')
            returning id, status`;
          member = inserted[0];
        } else if (prior.status === 'active') {
          return { kind: 'exists' as const, club, member: prior };
        } else if (prior.status === 'pending') {
          return { kind: 'exists' as const, club, member: prior };
        } else if (
          prior.status === 'rejected' &&
          prior.rejected_at !== null &&
          prior.rejected_at.getTime() + REAPPLY_COOLDOWN_DAYS * 86_400_000 > Date.now()
        ) {
          return { kind: 'cooldown' as const, club, member: prior };
        } else {
          // WIEDERANTRAG - rejected (nach Ablauf der Sperrfrist), left oder
          // inactive. Bis 0037 war das eine SACKGASSE: der Eindeutigkeits-Index
          // (0002:82-84) laesst pro (club, profile) nur eine Zeile zu, also
          // scheiterte jeder neue INSERT - und den eigenen status darf niemand
          // aendern (0007:216-222). Wer einmal ausgetreten war, konnte NIE
          // wieder beitreten und es nicht einmal signalisieren.
          //
          // Deshalb dreht der Wiederantrag DIESELBE Zeile zurueck auf 'pending'
          // (kein zweiter Datensatz -> der Index bleibt scharf, und
          // app.own_member_id mit 'order by created_at limit 1' muss nie
          // zwischen zwei Zeilen raten).
          //
          // role = 'member' ist hier KEINE Kosmetik, sondern der Kern:
          // app.member_roles ueberlebt einen Austritt (nur der status-Gate in
          // member_role_keys, 0025:47-49, neutralisiert die Rollen). Ohne diesen
          // Reset kaeme ein ausgetretener ADMIN nach der naechsten Freigabe als
          // ADMIN zurueck - der Vorstand haette nur "Beitrittsantrag freigeben"
          // gelesen. Der Spiegel-Trigger (0024:129-140) zieht member_roles beim
          // Rollenwechsel nach; Zweitrollen raeumt der DELETE darunter weg.
          const revived = await tx<{ id: string; status: string }[]>`
            update app.club_members
               set status      = 'pending',
                   role        = 'member',
                   first_name  = ${body.first_name},
                   last_name   = ${body.last_name},
                   valid_until = null,
                   joined_on   = null
             where id = ${prior.id}
             returning id, status`;
          member = revived[0];

          await tx`
            delete from app.member_roles mr
             using app.roles r
             where mr.member_id = ${prior.id}
               and r.id = mr.role_id
               and r.key <> 'member'`;
        }

        if (member === undefined) throw problem(500, 'Internal Server Error', 'insert failed');

        // KENNTNISNAHME, nicht Einwilligung (0039). Auch beim Wiederantrag -
        // eine Kenntnisnahme von vor dem Austritt traegt den neuen Antrag
        // nicht, und die Fassung kann sich inzwischen geaendert haben.
        //
        // Bis hier landeten terms/privacy als app.consents-Zeilen mit
        // granted=true; 0039 weist das per CHECK ab - diese Schleife WAERE zur
        // Laufzeit gebrochen und kein Test haette es gesehen. terms ist
        // Vertragsschluss (Art. 6 Abs. 1 lit. b), privacy eine
        // Informationspflicht (Art. 13): in beides willigt man nicht ein.
        await recordAcknowledgements(tx, {
          profileId: claims.sub,
          clubId: club.id,
          kinds: ['terms', 'privacy'],
          surface: 'POST /clubs/join',
        });

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
      case 'cooldown': {
        // Die Ablehnung wird BENANNT, nicht verschleiert. Wer bis hierher kommt,
        // kennt den Code und hat schon einmal beantragt - "irgendetwas ging
        // schief" waere hier keine Sicherheit, sondern nur Ratlosigkeit.
        const until = new Date(
          (result.member.rejected_at?.getTime() ?? Date.now()) + REAPPLY_COOLDOWN_DAYS * 86_400_000,
        );
        recordAuthEvent(c, {
          event: 'join_rejected_cooldown',
          status: 409,
          detail: {
            club_id: result.club.id,
            rejection_count: result.member.rejection_count,
            retry_at: until.toISOString(),
          },
        });
        throw problem(
          409,
          'Conflict',
          `Dein Antrag wurde abgelehnt. Ein neuer Antrag ist ab dem ${until.toLocaleDateString('de-DE')} möglich. ` +
            `/ Your request was rejected. You may re-apply from ${until.toLocaleDateString('en-GB')}.`,
        );
      }
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

    // 'rejected' ist hier bewusst mit dabei: eine Ablehnung ist eine
    // Entscheidung DESSELBEN Gremiums (beides members>=manage), und ein
    // Fehlklick auf "Ablehnen" darf die Person nicht sieben Tage lang
    // (REAPPLY_COOLDOWN_DAYS) aussperren. Das Gedaechtnis bleibt trotzdem
    // stehen: rejected_at/rejection_count werden NICHT zurueckgesetzt.
    const rows = await withUser(claims, (tx) =>
      tx`update app.club_members
            set status = 'active',
                joined_on = coalesce(joined_on, current_date)
          where id = ${memberId}
            and club_id = ${clubId}
            and status in ('pending', 'rejected')
            and deleted_at is null
          returning *`,
    );
    if (rows.length === 0) {
      // Kein offener/abgelehnter Antrag (oder RLS hat gefiltert). Keine
      // Auskunft darueber, welcher der Faelle es war.
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
      'Setzt status=rejected und schreibt das Gedaechtnis fort (rejected_at, rejected_by, rejection_count). ' +
      'Die Zeile BLEIBT stehen - vorher war eine Ablehnung ein Soft-Delete, der den Vorgang verschwinden liess: ' +
      'der naechste Antrag derselben Person traf auf einen Vorstand ohne Gedaechtnis. Ein Wiederantrag ist nach ' +
      'einer Sperrfrist moeglich (POST /clubs/join dreht die Zeile zurueck auf pending); eine versehentliche ' +
      'Ablehnung nimmt POST .../approve sofort zurueck. Erfordert members>=manage.',
    security: [{ bearerAuth: [] }],
    request: { params: memberIdParam },
    responses: {
      200: jsonContent(memberSchema, 'Abgelehnter Antrag (status=rejected)'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { clubId, memberId } = c.req.valid('param');
    await requireCap(c, clubId, 'members', 'manage');

    // rejected_by = app.own_member_id (0021, security definer): eine Ablehnung
    // ist eine Entscheidung mit Folgen und braucht einen Namen. NULL bleibt
    // moeglich - ein Plattform-Admin hat keine Mitgliedszeile im Verein.
    const rows = await withUser(c.get('claims'), (tx) =>
      tx`update app.club_members
            set status                = 'rejected',
                rejected_at           = now(),
                rejected_by_member_id = app.own_member_id(${clubId}),
                rejection_count       = rejection_count + 1
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
      'Erzeugt einen neuen Code (CSPRNG, Crockford-Base32). Mit overlap_hours bleibt der ALTE Code noch eine ' +
      'Weile gueltig - das war bis 0037 im Schema unmoeglich (der Code war eine SPALTE auf app.clubs, ' +
      'Rotieren hiess Ueberschreiben, der alte starb in derselben Sekunde). Genau deshalb rotierte niemand: ' +
      'ein Wechsel sperrte Aushang, WhatsApp-Gruppe und Anmeldeformular sofort aus. Ohne overlap_hours ' +
      '(Vorgabe) ist der alte Code sofort tot - das ist der richtige Weg bei einem GELEAKTEN Code. ' +
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
                /**
                 * Wie lange der ALTE Code noch traegt. 0/weggelassen = sofort
                 * tot (bei einem Leak die einzig richtige Antwort). > 0 = das
                 * Uebergangsfenster fuer alle, die den alten Code schon haben.
                 */
                overlap_hours: z.number().int().min(0).max(MAX_OVERLAP_HOURS).optional(),
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
    const overlap = body.overlap_hours ?? 0;

    await requireClubRoleDb(c, clubId, ['owner', 'admin', 'moderator']);

    // withUser: clubs_update (is_club_admin) und club_join_codes_update
    // (owner/admin/moderator, 0037) sind die zweite Verteidigungslinie.
    // Der Code selbst kommt aus der DB-Funktion - der Zufall darf nicht aus
    // Node kommen (Math.random ist kein CSPRNG) und muss dort erzeugt werden,
    // wo auch der Eindeutigkeits-Index sitzt.
    const result = await withUser(c.get('claims'), async (tx) => {
      // 1. ZUERST die alten Codes. Diese Reihenfolge ist zwingend: liefe sie
      //    nach Schritt 2, traefe sie den frisch erzeugten Code gleich mit.
      let previousValidUntil: Date | null = null;
      if (overlap > 0) {
        // least(): eine Rotation darf ein Ueberlappungsfenster nur SETZEN oder
        // VERKUERZEN, nie verlaengern. Ein Code, der in einer Stunde ablaeuft,
        // bekommt durch 'rotieren mit 24h Uebergang' keine 24 Stunden geschenkt.
        const old = await tx<{ expires_at: Date }[]>`
          update app.club_join_codes
             set expires_at = least(
                   coalesce(expires_at, 'infinity'::timestamptz),
                   now() + (${overlap} || ' hours')::interval
                 )
           where club_id = ${clubId}
             and revoked_at is null
             and (expires_at is null or expires_at > now())
          returning expires_at`;
        for (const row of old) {
          if (previousValidUntil === null || row.expires_at.getTime() > previousValidUntil.getTime()) {
            previousValidUntil = row.expires_at;
          }
        }
      } else {
        await tx`
          update app.club_join_codes set revoked_at = now()
           where club_id = ${clubId} and revoked_at is null`;
      }

      // 2. Der neue Code entsteht ZUERST als eigene Abfrage - und NICHT per
      //    `returning join_code`. Das ist keine Kosmetik, sondern die Naht
      //    0035/0037: seit 0035 ist der Rolle `authenticated` das SELECT-Recht
      //    auf app.clubs.join_code entzogen, und RETURNING verlangt SELECT auf
      //    JEDE genannte Spalte. `returning id, join_code, ...` unter withUser
      //    war ein hartes 42501 -> 403: Rotieren waere fuer JEDE Rolle kaputt
      //    gewesen, und KEIN SQL-Test haette es gesehen - hier laufen zwei
      //    Migrationen zusammen, ueber die nur die API faehrt.
      //
      //    Der Zufall bleibt trotzdem in der Datenbank (app.generate_join_code,
      //    CSPRNG): Node erfaehrt den Wert nur, es wuerfelt ihn nicht.
      //    Ein Uniqueness-Loop geht dabei nicht verloren - generate_join_code
      //    hat keinen; die Eindeutigkeit haelt allein der Index
      //    club_join_codes_normalized_uq (0037), und der greift unveraendert.
      const [generated] = await tx<{ code: string }[]>`
        select app.generate_join_code() as code`;
      const newCode = generated!.code;

      // 3. Geschrieben wird weiterhin die SPALTE auf app.clubs - der Trigger
      //    clubs_mirror_join_code (0037) legt den Kindsatz in der
      //    Wahrheitstabelle an. Damit bleibt POST /clubs (clubs.ts, fremde
      //    Spur) unveraendert gueltig: wer die Spalte schreibt, bekommt den
      //    Kindsatz geschenkt.
      const rows = await tx<{ id: string }[]>`
        update app.clubs
           set join_code            = ${newCode},
               join_code_revoked_at = null,
               join_code_expires_at = ${days === null ? null : tx`now() + (${days} || ' days')::interval`}
         where id = ${clubId} and deleted_at is null
        returning id`;
      const row = rows[0];
      if (row === undefined) return undefined;

      // 4. Wer rotiert hat. Ohne diese Zeile weiss der Verein spaeter nicht,
      //    wer den Code in Umlauf gebracht hat. Zugleich holen wir den
      //    Ablaufzeitpunkt aus der WAHRHEIT zurueck (app.club_join_codes) -
      //    lesbar, weil rotieren owner/admin/moderator verlangt und das
      //    exakt app.can_read_join_code() ist (0041).
      const [mirrored] = await tx<{ expires_at: Date | null }[]>`
        update app.club_join_codes
           set created_by_member_id = app.own_member_id(${clubId})
         where club_id = ${clubId}
           and code_normalized = app.normalize_join_code(${newCode})
        returning expires_at`;

      return { id: row.id, joinCode: newCode, expiresAt: mirrored?.expires_at ?? null, previousValidUntil };
    });
    if (result === undefined) throw problem(404, 'Not Found', 'Club not found');

    return c.json(
      clubJoinCodeRotatedSchema.parse({
        club_id: result.id,
        join_code: result.joinCode,
        join_code_expires_at: result.expiresAt,
        previous_code_valid_until: result.previousValidUntil,
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
      'Macht ALLE Codes des Vereins ungueltig, OHNE einen neuen zu erzeugen: der Verein nimmt damit keine ' +
      'Antraege mehr an. "Alle" ist woertlich - seit 0037 kann ein Verein mehrere Codes gleichzeitig fuehren ' +
      '(Ueberlappungsfenster einer Rotation), und ein Widerruf, der einen davon uebersieht, ist keiner. ' +
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
    const rows = await withUser(c.get('claims'), async (tx) => {
      // Erst die Kindtabelle (die Wahrheit): ein noch ueberlappender ALTER Code
      // haengt nicht mehr an der Spalte und wuerde vom UPDATE unten nicht
      // erfasst. Genau er ist aber der, der nach einem Leak noch traegt.
      await tx`
        update app.club_join_codes set revoked_at = now()
         where club_id = ${clubId} and revoked_at is null`;
      return tx`update app.clubs set join_code_revoked_at = now()
                 where id = ${clubId} and deleted_at is null
                 returning id, join_code_revoked_at`;
    });
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
