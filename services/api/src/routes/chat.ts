// ============================================================================
// routes/chat.ts - Team-Chat + Direktnachrichten (v1 chat.html,
// direktnachrichten.html, portal-chat.js). Referenz 1.3, enforced server-side
// (RLS in migration 0011 is the second line of defense):
//   * Team channel  -> only members of that team read/write (trainers of the
//                      club may additionally READ).
//   * Direct message -> only its sender and recipient.
// The sender is ALWAYS the caller's own club_members row (never client-supplied)
// so a message stays attributable and nobody can post as someone else.
// Deletes are SOFT and restricted to the sender by the RLS update policy.
//
// WHO MAY WRITE TO WHOM (migration 0043, child protection):
// GET /chat/recipients is the picker behind "New message to ..."; it filters the
// roster with app.chat_dm_allowed - the SAME predicate the RLS with-check runs
// on POST /chat/messages. An adult reaches a minor only as their guardian or as
// a coach of one of the minor teams (and symmetrically). The picker therefore
// cannot offer a recipient the insert would reject, and hiding a row in the
// picker is never the only thing standing in the way.
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  chatChannelSchema,
  chatMessageCreateSchema,
  chatMessageSchema,
  chatReportCreateSchema,
  chatReportSchema,
  chatReportUpdateSchema,
  deletedSchema,
  memberSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { ADMIN_ROLES, clubRoleHeld, isPlatformAdmin, requireClubMember } from '../lib/guards.js';
import { ownMemberId } from '../lib/ownership.js';
import { clientIp } from '../lib/rate-limit.js';
import { avatarUrlFor } from '../lib/avatar.js';
import {
  maySeeContactOf,
  gateAvatarConsent,
  maySeeFullRoster,
  maySeeInternalSelfProfile,
  redactMemberForViewer,
  redactSelfProfile,
} from './members.js';

export const chatRouter = createRouter();

const messageIdParam = z.object({
  messageId: uuid.openapi({ param: { name: 'messageId', in: 'path' } }),
});

chatRouter.openapi(
  createRoute({
    method: 'get',
    path: '/chat/channels',
    tags: ['chat'],
    summary: 'My chat channels: team channels I belong to + direct threads, newest first',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(chatChannelSchema), 'Channel overview with the last message per channel'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubMember(claims, club_id);

    const channels = await withUser(claims, async (tx) => {
      const meId = await ownMemberId(tx, claims, club_id);
      if (!meId) return [];

      // Team channels: every team I am a (non-deleted) member of, with the
      // most recent visible message as a preview.
      const teams = await tx`
        select 'team'::text as channel_type,
               t.id   as team_id,
               t.name as team_name,
               null::uuid as peer_member_id,
               null::text as peer_name,
               lm.id   as last_message_id,
               lm.body as last_body,
               lm.image_url as last_image_url,
               lm.sender_member_id as last_sender_member_id,
               lm.created_at as last_message_at
        from app.team_members tm
        join app.teams t on t.id = tm.team_id
        left join lateral (
          select m.id, m.body, m.image_url, m.sender_member_id, m.created_at
          from app.chat_messages m
          where m.channel_type = 'team' and m.team_id = t.id and m.deleted_at is null
          order by m.created_at desc
          limit 1
        ) lm on true
        where tm.member_id = ${meId} and tm.deleted_at is null`;

      // Direct threads: the latest message per distinct peer (the other party).
      const directs = await tx`
        select 'direct'::text as channel_type,
               null::uuid as team_id,
               null::text as team_name,
               th.peer_id as peer_member_id,
               trim(p.first_name || ' ' || p.last_name) as peer_name,
               th.id   as last_message_id,
               th.body as last_body,
               th.image_url as last_image_url,
               th.sender_member_id as last_sender_member_id,
               th.created_at as last_message_at
        from (
          select distinct on (peer_id)
                 peer_id, id, body, image_url, sender_member_id, created_at
          from (
            select cm.id, cm.body, cm.image_url, cm.sender_member_id, cm.created_at,
                   case when cm.sender_member_id = ${meId}
                        then cm.recipient_member_id else cm.sender_member_id end as peer_id
            from app.chat_messages cm
            where cm.channel_type = 'direct'
              and cm.club_id = ${club_id}
              and cm.deleted_at is null
          ) x
          order by peer_id, created_at desc
        ) th
        join app.club_members p on p.id = th.peer_id`;

      // Broadcast: EIN vereinsweiter Ansage-Kanal, sobald es mindestens eine
      // (sichtbare) Ansage gibt. RLS gibt sie jedem realen Mitglied frei.
      const broadcast = await tx`
        select 'broadcast'::text as channel_type,
               null::uuid as team_id,
               null::text as team_name,
               null::uuid as peer_member_id,
               null::text as peer_name,
               m.id   as last_message_id,
               m.body as last_body,
               m.image_url as last_image_url,
               m.sender_member_id as last_sender_member_id,
               m.created_at as last_message_at
        from app.chat_messages m
        where m.channel_type = 'broadcast' and m.club_id = ${club_id} and m.deleted_at is null
        order by m.created_at desc
        limit 1`;

      const merged = [...teams, ...broadcast, ...directs];
      merged.sort((a, b) => {
        const ta = a['last_message_at'] ? new Date(a['last_message_at'] as string).getTime() : -Infinity;
        const tb = b['last_message_at'] ? new Date(b['last_message_at'] as string).getTime() : -Infinity;
        return tb - ta;
      });
      return merged;
    });

    return c.json(z.array(chatChannelSchema).parse(channels), 200);
  },
);

chatRouter.openapi(
  createRoute({
    method: 'get',
    path: '/chat/recipients',
    tags: ['chat'],
    summary: 'People I may start a direct message with (child protection applied)',
    description:
      'The picker behind "New message to ...". Returns the club roster MINUS myself, minus ' +
      'everyone app.chat_dm_allowed (migration 0043) forbids me to write to: an adult only ' +
      'reaches a minor as their guardian or as a coach of one of the minor teams, and the same ' +
      'holds the other way round. The rows go through the SAME redaction as ' +
      'GET /clubs/{clubId}/members (redactMemberForViewer): a viewer without can_manage_members ' +
      'sees names only - no birth_date, email, phone, postal_address, valid_until, profile_id, ' +
      'joined_on. A coach (not guest_coach) additionally sees the parent contact data ' +
      '(birth_date/email/phone/postal_address) of members of their OWN teams, row-scoped like the ' +
      'roster. This endpoint is deliberately not a second, wider way into the roster.',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(memberSchema), 'Allowed direct-message recipients, redacted for the viewer'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubMember(claims, club_id);

    const rows = await withUser(claims, async (tx) => {
      const meId = await ownMemberId(tx, claims, club_id);
      if (!meId) return [];
      // app.chat_dm_allowed is the SAME predicate the RLS with-check enforces on
      // POST /chat/messages -> the picker cannot offer a recipient the insert
      // would reject, and hiding a row here is never the only line of defense.
      return tx`
        select m.*,
               coalesce((select jsonb_agg(tm.team_id order by tm.created_at)
                         from app.team_members tm
                         where tm.member_id = m.id and tm.deleted_at is null),
                        '[]'::jsonb) as team_ids,
               -- Selbst-Profil-Projektion (0053): dieselbe Redaktion wie im
               -- Roster, sonst waere der DM-Picker ein zweiter Lese-Pfad, der
               -- interne Profile an gewoehnliche Mitglieder ausliefert.
               app.can_act_for_member(m.id) as _self_or_guardian,
               -- Zeilenweise Kontakt-Sichtbarkeit (0054): derselbe Team-Schnitt
               -- wie im Roster, sonst leckte phone/postal_address/email hier an
               -- der Kontakt-Redaktion vorbei.
               exists (
                 select 1 from app.team_members tmc
                 where tmc.member_id = m.id and tmc.deleted_at is null
                   and tmc.team_id = any (app.coached_team_ids(m.club_id))
               ) as _coach_of_member,
               -- Foto-Anzeige-Wache (Kinderschutz, 0056): wie im Roster — der
               -- DM-Picker darf das Foto nicht-eingewilligter Kinder NICHT zeigen.
               app.has_internal_photo_consent(m.id) as _photo_consent
        from app.club_members m
        where m.club_id = ${club_id}
          and m.deleted_at is null
          and m.id <> ${meId}
          and app.chat_dm_allowed(${meId}, m.id)
        order by m.last_name, m.first_name`;
    });

    const privileged = maySeeFullRoster(claims, club_id);
    const internalProfileViewer = maySeeInternalSelfProfile(claims, club_id);
    const mapped = rows.map((row) =>
      redactSelfProfile(
        redactMemberForViewer(
          gateAvatarConsent({
            ...row,
            avatar_url: avatarUrlFor((row['avatar_key'] as string | null) ?? null),
          }),
          privileged,
          privileged,
          maySeeContactOf(claims, club_id, row),
        ),
        internalProfileViewer,
      ),
    );
    return c.json(z.array(memberSchema).parse(mapped), 200);
  },
);

chatRouter.openapi(
  createRoute({
    method: 'get',
    path: '/chat/messages',
    tags: ['chat'],
    summary: 'List messages of one channel (team by team_id, direct by peer_member_id, or broadcast)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        club_id: uuid,
        channel_type: z.enum(['team', 'direct', 'broadcast']),
        team_id: uuid.optional(),
        peer_member_id: uuid.optional(),
      }),
    },
    responses: {
      200: jsonContent(z.array(chatMessageSchema), 'Messages of the channel (chronological), RLS-filtered'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id, channel_type, team_id, peer_member_id } = c.req.valid('query');
    const claims = c.get('claims');
    requireClubMember(claims, club_id);

    if (channel_type === 'team' && !team_id) {
      throw problem(400, 'Bad Request', 'team_id is required for channel_type=team');
    }
    if (channel_type === 'direct' && !peer_member_id) {
      throw problem(400, 'Bad Request', 'peer_member_id is required for channel_type=direct');
    }

    const rows = await withUser(claims, async (tx) => {
      if (channel_type === 'team') {
        // RLS: only a team member (or a club trainer) sees these rows.
        return tx`
          select * from app.chat_messages
          where channel_type = 'team' and team_id = ${team_id ?? null} and deleted_at is null
          order by created_at asc`;
      }
      if (channel_type === 'broadcast') {
        // Vereinsweite Ansagen: RLS (chat_messages_select, 0083) gibt sie jedem
        // realen Vereinsmitglied frei; geschrieben hat sie ein Vereins-Admin.
        return tx`
          select * from app.chat_messages
          where channel_type = 'broadcast' and club_id = ${club_id} and deleted_at is null
          order by created_at asc`;
      }
      const meId = await ownMemberId(tx, claims, club_id);
      if (!meId) return [];
      // both directions of the 1:1 thread; RLS additionally guards visibility.
      return tx`
        select * from app.chat_messages
        where channel_type = 'direct' and club_id = ${club_id} and deleted_at is null
          and (
            (sender_member_id = ${meId} and recipient_member_id = ${peer_member_id ?? null})
            or
            (sender_member_id = ${peer_member_id ?? null} and recipient_member_id = ${meId})
          )
        order by created_at asc`;
    });
    return c.json(z.array(chatMessageSchema).parse(rows), 200);
  },
);

chatRouter.openapi(
  createRoute({
    method: 'post',
    path: '/chat/messages',
    tags: ['chat'],
    summary: 'Send a message (team, direct or broadcast); sender is always the caller',
    description:
      'Team messages need team membership, direct messages pass the child-protection rule (0043), ' +
      'and broadcast (club-wide announcement) requires a club admin role (owner/admin/moderator). ' +
      'All three are enforced by the RLS with-check policy chat_messages_insert.',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: chatMessageCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(chatMessageSchema, 'Created message'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, body.club_id);

    const created = await withUser(claims, async (tx) => {
      const senderId = await ownMemberId(tx, claims, body.club_id);
      if (!senderId) throw problem(403, 'Forbidden', 'No membership row for the sender in this club');
      // Team membership / recipient-in-club / the child-protection rule are all
      // enforced by the RLS with-check policy (chat_messages_insert, 0043) ->
      // a violation surfaces as 403 either way. This ONE extra lookup exists so
      // a blocked adult<->minor DM says WHY instead of a bare 403; it is not the
      // gate. Removing it changes the wording, not the outcome.
      if (body.channel_type === 'direct' && body.recipient_member_id) {
        const allowed = await tx`
          select app.chat_dm_allowed(${senderId}, ${body.recipient_member_id}) as ok`;
        if (allowed[0]?.['ok'] !== true) {
          throw problem(
            403,
            'Forbidden',
            'You may not start a direct message with this person. Direct messages between an ' +
              'adult and a minor are limited to the minor guardians and the coaches of their teams.',
          );
        }
      }
      const rows = await tx`
        insert into app.chat_messages
          (club_id, channel_type, team_id, sender_member_id, recipient_member_id, body, image_url)
        values
          (${body.club_id}, ${body.channel_type}, ${body.team_id ?? null}, ${senderId},
           ${body.recipient_member_id ?? null}, ${body.body ?? null}, ${body.image_url ?? null})
        returning *`;
      return rows[0];
    });
    return c.json(chatMessageSchema.parse(created), 201);
  },
);

chatRouter.openapi(
  createRoute({
    method: 'delete',
    path: '/chat/messages/{messageId}',
    tags: ['chat'],
    summary: 'Soft-delete a message (its sender, or a club admin as moderation)',
    description:
      'The sender may delete their own message; a club admin (owner/admin/moderator) may delete ' +
      'ANY message they can see, as moderation (migration 0083). For a moderation delete ' +
      'deleted_by_member_id records the admin; a self-delete leaves it null. A non-sender, ' +
      'non-admin is filtered to 0 rows by RLS -> 403. The moderation guard forbids changing ' +
      'anything but the delete fields, so a moderator can never rewrite a foreign message.',
    security: [{ bearerAuth: [] }],
    request: { params: messageIdParam },
    responses: {
      200: jsonContent(deletedSchema, 'Message soft-deleted'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { messageId } = c.req.valid('param');
    const claims = c.get('claims');

    await withUser(claims, async (tx) => {
      const existing = await tx`
        select id, club_id, sender_member_id
        from app.chat_messages where id = ${messageId} and deleted_at is null`;
      if (existing.length === 0) throw problem(404, 'Not Found', 'Message not found');
      const clubId = existing[0]!['club_id'] as string;
      const senderId = existing[0]!['sender_member_id'] as string;
      // Wer löscht? Für eine Moderation (Löschende ≠ Absender) halten wir das
      // fest; bei der Selbstlöschung bleibt deleted_by_member_id null.
      const deleterId = await ownMemberId(tx, claims, clubId);
      const moderatedBy = deleterId && deleterId !== senderId ? deleterId : null;
      // RLS update policy (0083): Absender ODER Vereins-Admin. Andere -> 0 Zeilen.
      const rows = await tx`
        update app.chat_messages
           set deleted_at = now(), deleted_by_member_id = ${moderatedBy}
         where id = ${messageId} and deleted_at is null
        returning id`;
      if (rows.length === 0) {
        throw problem(403, 'Forbidden', 'Only the sender or a club admin may delete a message');
      }
    });
    return c.json({ status: 'deleted' as const, id: messageId }, 200);
  },
);

// ============================================================================
// MELDESYSTEM (migration 0082, app.chat_reports).
// Jedes Mitglied kann eine FREMDE Nachricht als Verstoss MELDEN. Die Meldung
// geht an den Vereinsvorstand (owner/admin/moderator) UND den Betreiber
// (platform admin); RLS ist die Wahrheit. Der SERVER setzt reporter_ip aus der
// Anfrage und baut den snapshot unter den Claims des Melders — nie der Client.
// ============================================================================

const reportIdParam = z.object({
  reportId: uuid.openapi({ param: { name: 'reportId', in: 'path' } }),
});

/** A little context (same conversation, up to this message), newest first. */
const CONTEXT_LIMIT = 12;

chatRouter.openapi(
  createRoute({
    method: 'post',
    path: '/chat/reports',
    tags: ['chat'],
    summary: 'Report a chat message as a violation (any club member)',
    description:
      'Files a report about a message the caller can see. The reporter_ip is set by the SERVER ' +
      'from the request (never the client), and the snapshot (message text + a little context + ' +
      'timestamp) is built server-side under the reporter\'s own RLS — so a report can only capture ' +
      'what the reporter is actually allowed to see. reported_member_id is the sender of the ' +
      'reported message. The report is visible to the club board, the platform operator, and the ' +
      'reporter (their own report only). Reporting a message you cannot see is a 404.',
    security: [{ bearerAuth: [] }],
    request: {
      body: { content: { 'application/json': { schema: chatReportCreateSchema } }, required: true },
    },
    responses: {
      201: jsonContent(chatReportSchema, 'Created report'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const body = c.req.valid('json');
    const claims = c.get('claims');
    requireClubMember(claims, body.club_id);
    // Server-seitig, nie vom Client (Referenz: lib/rate-limit.ts clientIp).
    const ip = clientIp(c) ?? null;

    const created = await withUser(claims, async (tx) => {
      const reporterId = await ownMemberId(tx, claims, body.club_id);
      if (!reporterId) throw problem(403, 'Forbidden', 'No active membership row for the reporter in this club');

      // Die gemeldete Nachricht UNTER RLS laden — das ist die eigentliche
      // Autorisierung: man kann nur melden, was man sehen darf. Nicht sichtbar
      // / weg -> 404, ununterscheidbar (die blosse Existenz einer fremden
      // Nachricht darf so nicht abfragbar werden).
      const msgRows = await tx`
        select id, club_id, channel_type, team_id, sender_member_id, recipient_member_id,
               body, image_url, created_at
        from app.chat_messages
        where id = ${body.message_id} and club_id = ${body.club_id} and deleted_at is null`;
      const msg = msgRows[0];
      if (msg === undefined) throw problem(404, 'Not Found', 'Message not found');

      // created_at kommt als JS-Date zurueck; der Treiber ist in diesem Stack so
      // konfiguriert, dass ein Date NICHT direkt als Parameter serialisiert wird
      // (db.ts types.date erwartet Strings). Als ISO-String weiterreichen und in
      // SQL wieder als timestamptz casten.
      const reportedAtIso = new Date(msg['created_at'] as string | number | Date).toISOString();

      // Ein paar Kontextnachrichten derselben Unterhaltung, ebenfalls unter RLS
      // -> nur, was der Melder sehen darf, wandert in den snapshot. Damit bleibt
      // die Meldung lesbar, auch wenn die Nachricht später gelöscht wird.
      const context =
        msg['channel_type'] === 'team'
          ? await tx`
              select id, sender_member_id, body, image_url, created_at
              from app.chat_messages
              where channel_type = 'team' and team_id = ${msg['team_id']}
                and deleted_at is null and created_at <= ${reportedAtIso}::timestamptz
              order by created_at desc, id desc
              limit ${CONTEXT_LIMIT}`
          : await tx`
              select id, sender_member_id, body, image_url, created_at
              from app.chat_messages
              where channel_type = 'direct' and club_id = ${body.club_id}
                and deleted_at is null and created_at <= ${reportedAtIso}::timestamptz
                and (
                  (sender_member_id = ${msg['sender_member_id']} and recipient_member_id = ${msg['recipient_member_id']})
                  or
                  (sender_member_id = ${msg['recipient_member_id']} and recipient_member_id = ${msg['sender_member_id']})
                )
              order by created_at desc, id desc
              limit ${CONTEXT_LIMIT}`;

      const snapshot = {
        captured_at: new Date().toISOString(),
        channel_type: msg['channel_type'],
        team_id: msg['team_id'] ?? null,
        message: {
          id: msg['id'],
          sender_member_id: msg['sender_member_id'],
          recipient_member_id: msg['recipient_member_id'] ?? null,
          body: msg['body'] ?? null,
          image_url: msg['image_url'] ?? null,
          created_at: msg['created_at'],
        },
        // Kontext chronologisch (die Abfrage liefert absteigend).
        context: [...context].reverse().map((m) => ({
          id: m['id'],
          sender_member_id: m['sender_member_id'],
          body: m['body'] ?? null,
          image_url: m['image_url'] ?? null,
          created_at: m['created_at'],
        })),
      };

      // reported_member_id = Absender der gemeldeten Nachricht (Server, nie
      // Client). RLS insert-Policy prüft reporter=eigene Zeile + Mandant.
      const rows = await tx`
        insert into app.chat_reports
          (club_id, message_id, reported_member_id, reporter_member_id, reason, reporter_ip, snapshot)
        values
          (${body.club_id}, ${body.message_id}, ${msg['sender_member_id'] as string}, ${reporterId},
           ${body.reason}, ${ip}, ${tx.json(snapshot)})
        returning *`;
      return rows[0];
    });
    return c.json(chatReportSchema.parse(created), 201);
  },
);

chatRouter.openapi(
  createRoute({
    method: 'get',
    path: '/chat/reports',
    tags: ['chat'],
    summary: 'Chat reports of one club (club board + platform operator)',
    description:
      'The board\'s queue of reported chat messages. Visible to owner/admin/moderator of the club ' +
      'and to the platform operator; RLS enforces the same. A plain member (even the reporter) gets ' +
      'an honest 403 here — this is the board\'s queue, not a self-view.',
    security: [{ bearerAuth: [] }],
    request: { query: z.object({ club_id: uuid }) },
    responses: {
      200: jsonContent(z.array(chatReportSchema), 'Reports of the club, newest first'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { club_id } = c.req.valid('query');
    const claims = c.get('claims');
    // Ehrliches 403 statt einer (durch RLS) auf die eigene Meldung geschrumpften
    // Liste. RLS bleibt die zweite Linie.
    if (!isPlatformAdmin(claims) && !clubRoleHeld(claims, club_id, ADMIN_ROLES)) {
      throw problem(403, 'Forbidden', 'Requires club board (owner/admin/moderator) or platform admin');
    }
    const rows = await withUser(claims, (tx) =>
      tx`select * from app.chat_reports where club_id = ${club_id} order by created_at desc, id desc`,
    );
    return c.json(z.array(chatReportSchema).parse(rows), 200);
  },
);

chatRouter.openapi(
  createRoute({
    method: 'patch',
    path: '/chat/reports/{reportId}',
    tags: ['chat'],
    summary: 'Set the processing state of a report (club board + platform operator)',
    description:
      'Changes only the processing state; handled_by (the handler\'s own member row, null for the ' +
      'operator) and handled_at are set server-side. The report\'s core (reason, snapshot, who/whom, ' +
      'ip, timestamp) is append-only (DB trigger). An invisible report is a 404.',
    security: [{ bearerAuth: [] }],
    request: {
      params: reportIdParam,
      body: { content: { 'application/json': { schema: chatReportUpdateSchema } }, required: true },
    },
    responses: {
      200: jsonContent(chatReportSchema, 'The updated report'),
      ...errorResponses,
    },
  }),
  async (c) => {
    const { reportId } = c.req.valid('param');
    const { status } = c.req.valid('json');
    const claims = c.get('claims');

    const updated = await withUser(claims, async (tx) => {
      // Unter RLS laden: ein unsichtbares Ticket ist ein 404 (der Vorstand eines
      // fremden Vereins darf Meldungs-IDs nicht abtasten). club_id wird für die
      // eigene Mitgliedszeile des Bearbeiters gebraucht.
      const existing = await tx`select id, club_id from app.chat_reports where id = ${reportId}`;
      const report = existing[0];
      if (report === undefined) throw problem(404, 'Not Found', 'Report not found');

      // handled_by = die EIGENE Mitgliedszeile des Bearbeiters in diesem Verein
      // (null für den Betreiber, der keine hat). Nie ein Client-Wert.
      const handlerId = await ownMemberId(tx, claims, report['club_id'] as string);

      const rows = await tx`
        update app.chat_reports
        set status = ${status}, handled_by_member_id = ${handlerId}, handled_at = now()
        where id = ${reportId}
        returning *`;
      // RLS update-Policy filtert Nicht-Berechtigte auf 0 Zeilen (SELECT ist für
      // den Melder erlaubt, UPDATE nicht) -> ehrliches 403.
      if (rows.length === 0) {
        throw problem(403, 'Forbidden', 'Only the club board or platform admin may update a report');
      }
      return rows[0];
    });
    return c.json(chatReportSchema.parse(updated), 200);
  },
);
