import type * as M from "@/lib/api/generated";
import type {
  ChatChannel,
  ChatMessage,
  ChatReport,
  ChatReportSnapshot,
  ChatReportSnapshotMessage,
  Checkin,
  RegionalEvent,
} from "@/lib/types";

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

/* ---------- Meldesystem (Migration 0082) ---------- */

/** Freies JSON defensiv als String lesen (fehlend/falscher Typ -> undefined). */
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Eine Snapshot-Nachricht (snake_case im jsonb) in die getypte Sicht bringen. */
function mapSnapshotMessage(raw: unknown): ChatReportSnapshotMessage | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const o = raw as Record<string, unknown>;
  const id = str(o["id"]);
  const senderMemberId = str(o["sender_member_id"]);
  const createdAt = str(o["created_at"]);
  if (id === undefined || senderMemberId === undefined || createdAt === undefined) return undefined;
  return {
    id,
    senderMemberId,
    recipientMemberId: str(o["recipient_member_id"]),
    body: str(o["body"]),
    imageUrl: str(o["image_url"]),
    createdAt,
  };
}

/**
 * Der Snapshot ist freies JSON (Record<string, unknown>) auf dem Draht — hier
 * defensiv in die getypte ChatReportSnapshot-Form gebracht. Der Server baut ihn
 * mit snake_case-Schlüsseln (message.sender_member_id, captured_at …).
 */
function mapReportSnapshot(raw: Record<string, unknown>): ChatReportSnapshot {
  const channelType = raw["channel_type"];
  const contextRaw = Array.isArray(raw["context"]) ? raw["context"] : [];
  return {
    capturedAt: str(raw["captured_at"]),
    channelType: channelType === "team" || channelType === "direct" ? channelType : undefined,
    teamId: str(raw["team_id"]),
    message: mapSnapshotMessage(raw["message"]),
    context: contextRaw
      .map(mapSnapshotMessage)
      .filter((m): m is ChatReportSnapshotMessage => m !== undefined),
  };
}

export function mapChatReport(w: M.ChatReport): ChatReport {
  return {
    id: w.id,
    clubId: w.club_id,
    messageId: w.message_id ?? undefined,
    reportedMemberId: w.reported_member_id ?? undefined,
    reporterMemberId: w.reporter_member_id,
    reason: w.reason,
    reporterIp: w.reporter_ip ?? undefined,
    snapshot: mapReportSnapshot(w.snapshot ?? {}),
    status: w.status,
    handledByMemberId: w.handled_by_member_id ?? undefined,
    handledAt: w.handled_at ?? undefined,
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
