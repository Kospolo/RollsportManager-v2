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
// ============================================================================

import { createRoute, z } from '@hono/zod-openapi';
import { createRouter, errorResponses, jsonContent } from '../lib/openapi.js';
import {
  chatChannelSchema,
  chatMessageCreateSchema,
  chatMessageSchema,
  deletedSchema,
  uuid,
} from '../lib/validation.js';
import { withUser } from '../db.js';
import { problem } from '../middleware/error.js';
import { requireClubMember } from '../lib/guards.js';
import { ownMemberId } from '../lib/ownership.js';

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

      const merged = [...teams, ...directs];
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
    path: '/chat/messages',
    tags: ['chat'],
    summary: 'List messages of one channel (team by team_id, direct by peer_member_id)',
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        club_id: uuid,
        channel_type: z.enum(['team', 'direct']),
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
    summary: 'Send a message (team channel or direct); sender is always the caller',
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
      // Team membership / recipient-in-club is enforced by the RLS with-check
      // policy (chat_messages_insert) -> a violation surfaces as 403.
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
    summary: 'Soft-delete a message (only the sender)',
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
        select id from app.chat_messages where id = ${messageId} and deleted_at is null`;
      if (existing.length === 0) throw problem(404, 'Not Found', 'Message not found');
      // RLS update policy (is_own_member(sender)) filters non-senders to 0 rows.
      const rows = await tx`
        update app.chat_messages set deleted_at = now()
        where id = ${messageId} and deleted_at is null
        returning id`;
      if (rows.length === 0) throw problem(403, 'Forbidden', 'Only the sender may delete a message');
    });
    return c.json({ status: 'deleted' as const, id: messageId }, 200);
  },
);
