import type * as M from "@/lib/api/generated";
import type { ChatChannel, ChatMessage, Checkin, RegionalEvent } from "@/lib/types";

/**
 * Mapper der Batch-4-Module (Chat, Check-in, überregionale Events):
 * API-Wire-Format (snake_case, `T | null`) → View-Typen (lib/types, camelCase,
 * optionale Felder). Ausgelagert aus api/mappers.ts (< 400 Zeilen).
 */

export function mapChatChannel(w: M.ChatChannel): ChatChannel {
  return {
    channelType: w.channel_type,
    teamId: w.team_id ?? undefined,
    teamName: w.team_name ?? undefined,
    peerMemberId: w.peer_member_id ?? undefined,
    peerName: w.peer_name ?? undefined,
    lastMessageId: w.last_message_id ?? undefined,
    lastBody: w.last_body ?? undefined,
    lastImageUrl: w.last_image_url ?? undefined,
    lastSenderMemberId: w.last_sender_member_id ?? undefined,
    lastMessageAt: w.last_message_at ?? undefined,
  };
}

export function mapChatMessage(w: M.ChatMessage): ChatMessage {
  return {
    id: w.id,
    clubId: w.club_id,
    channelType: w.channel_type,
    teamId: w.team_id ?? undefined,
    senderMemberId: w.sender_member_id,
    recipientMemberId: w.recipient_member_id ?? undefined,
    body: w.body ?? undefined,
    imageUrl: w.image_url ?? undefined,
    createdAt: w.created_at,
  };
}

export function mapCheckin(w: M.Checkin): Checkin {
  return {
    id: w.id,
    clubId: w.club_id,
    memberId: w.member_id,
    eventId: w.event_id ?? undefined,
    method: w.method,
    checkedInAt: w.checked_in_at,
    createdAt: w.created_at,
  };
}

export function mapRegionalEvent(w: M.RegionalEvent): RegionalEvent {
  return {
    id: w.id,
    clubId: w.club_id,
    title: w.title,
    hostOrg: w.host_org ?? undefined,
    discipline: w.discipline ?? undefined,
    location: w.location ?? undefined,
    startsOn: w.starts_on,
    endsOn: w.ends_on ?? undefined,
    registrationUrl: w.registration_url ?? undefined,
    description: w.description ?? undefined,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  };
}
