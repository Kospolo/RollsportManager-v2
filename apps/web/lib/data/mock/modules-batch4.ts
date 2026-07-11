import { club, fullName, members, teams } from "@/lib/mock";
import type { ChatChannel, ChatMessage, Checkin, RegionalEvent } from "@/lib/types";
import type { DataRepository } from "../types";
import { chatMessageSeed, checkinSeed, regionalEventSeed } from "./seed-batch4";

/**
 * Mock-Implementierung der Batch-4-Module (Chat, Check-in, überregionale
 * Events). Eigene In-Memory-Stores (Session-Lebensdauer), kein echter
 * Rechtecheck — die Wahrheit ist im api-Modus der Server (RLS, Referenz 1.3).
 * Aktuelle Person im Mock = members[0] (m-01, Sandra Vogel).
 */

const clubId = club.id;
const nowIso = (): string => new Date().toISOString();
/** Aktuelle Person (Mock) — spiegelt mockRepository.getCurrentUser. */
const currentMemberId = members[0].id;

const messageStore: ChatMessage[] = chatMessageSeed.map((m) => ({ ...m }));
const checkinStore: Checkin[] = checkinSeed.map((c) => ({ ...c }));
const eventStore: RegionalEvent[] = regionalEventSeed.map((e) => ({ ...e }));

let msgSeq = messageStore.length;
let checkinSeq = checkinStore.length;
let eventSeq = eventStore.length;

/** Die 11 Batch-4-Modul-Methoden — wird in mockRepository gespreizt. */
type ModuleMethods = Pick<
  DataRepository,
  | "listChatChannels"
  | "listChatMessages"
  | "sendChatMessage"
  | "uploadChatImage"
  | "deleteChatMessage"
  | "listCheckins"
  | "createCheckin"
  | "deleteCheckin"
  | "listRegionalEvents"
  | "createRegionalEvent"
  | "updateRegionalEvent"
  | "deleteRegionalEvent"
>;

/** Datei als data:-URL lesen — im Mock sofort anzeigbar, kein Server nötig. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader-Fehler"));
    reader.readAsDataURL(file);
  });
}

/** Anzeigename eines Mitglieds (Fallback = ID). */
function memberName(id: string): string {
  const m = members.find((x) => x.id === id);
  return m ? fullName(m) : id;
}

/** Team-Kanäle der aktuellen Person + je Direkt-Peer die letzte Nachricht. */
function buildChannels(): ChatChannel[] {
  const channels: ChatChannel[] = [];

  // (a) ALLE Team-Kanäle, in denen die aktuelle Person Mitglied ist — auch leere.
  const myTeams = teams.filter(
    (t) => t.coachIds.includes(currentMemberId) || t.skaterIds.includes(currentMemberId),
  );
  for (const team of myTeams) {
    const teamMsgs = messageStore
      .filter((m) => m.channelType === "team" && m.teamId === team.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = teamMsgs.at(-1);
    channels.push({
      channelType: "team",
      teamId: team.id,
      teamName: team.name,
      lastMessageId: last?.id,
      lastBody: last?.body,
      lastImageUrl: last?.imageUrl,
      lastSenderMemberId: last?.senderMemberId,
      lastMessageAt: last?.createdAt,
    });
  }

  // (b) Je Direkt-Peer die letzte Nachricht (nur Threads der aktuellen Person).
  const byPeer = new Map<string, ChatMessage>();
  for (const m of messageStore) {
    if (m.channelType !== "direct") continue;
    if (m.senderMemberId !== currentMemberId && m.recipientMemberId !== currentMemberId) continue;
    const peer = m.senderMemberId === currentMemberId ? m.recipientMemberId : m.senderMemberId;
    if (!peer) continue;
    const prev = byPeer.get(peer);
    if (!prev || m.createdAt.localeCompare(prev.createdAt) > 0) byPeer.set(peer, m);
  }
  for (const [peerId, last] of byPeer) {
    channels.push({
      channelType: "direct",
      peerMemberId: peerId,
      peerName: memberName(peerId),
      lastMessageId: last.id,
      lastBody: last.body,
      lastImageUrl: last.imageUrl,
      lastSenderMemberId: last.senderMemberId,
      lastMessageAt: last.createdAt,
    });
  }

  // Serverseitige Sortierung: lastMessageAt desc, nulls last.
  return channels.sort((a, b) => {
    if (!a.lastMessageAt && !b.lastMessageAt) return 0;
    if (!a.lastMessageAt) return 1;
    if (!b.lastMessageAt) return -1;
    return b.lastMessageAt.localeCompare(a.lastMessageAt);
  });
}

export const moduleRepositoryBatch4: ModuleMethods = {
  /* ---------- Chat ---------- */
  async listChatChannels(): Promise<ChatChannel[]> {
    return buildChannels();
  },
  async listChatMessages(query): Promise<ChatMessage[]> {
    const list = messageStore.filter((m) => {
      if (m.channelType !== query.channelType) return false;
      if (query.channelType === "team") return m.teamId === query.teamId;
      // direct: Thread zwischen aktueller Person und peerMemberId.
      const involves = (id?: string) =>
        m.senderMemberId === id || m.recipientMemberId === id;
      return involves(currentMemberId) && involves(query.peerMemberId);
    });
    return [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  async sendChatMessage(input): Promise<ChatMessage> {
    // senderMemberId wird serverseitig abgeleitet — im Mock = aktuelle Person.
    const created: ChatMessage = {
      id: `msg-local-${++msgSeq}`,
      clubId,
      channelType: input.channelType,
      teamId: input.channelType === "team" ? input.teamId : undefined,
      senderMemberId: currentMemberId,
      recipientMemberId: input.channelType === "direct" ? input.recipientMemberId : undefined,
      body: input.body,
      imageUrl: input.imageUrl,
      createdAt: nowIso(),
    };
    messageStore.push(created);
    return created;
  },
  async uploadChatImage(file): Promise<string> {
    // Mock: data:-URL statt echter Media-Route — direkt als imageUrl nutzbar.
    return fileToDataUrl(file);
  },
  async deleteChatMessage(messageId): Promise<{ id: string }> {
    const idx = messageStore.findIndex((m) => m.id === messageId);
    if (idx >= 0) messageStore.splice(idx, 1);
    return { id: messageId };
  },

  /* ---------- Check-in ---------- */
  async listCheckins(memberId): Promise<Checkin[]> {
    const list = memberId ? checkinStore.filter((c) => c.memberId === memberId) : checkinStore;
    return [...list].sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
  },
  async createCheckin(input): Promise<Checkin> {
    const at = input.checkedInAt ?? nowIso();
    const created: Checkin = {
      id: `checkin-local-${++checkinSeq}`,
      clubId,
      memberId: input.memberId,
      eventId: input.eventId,
      method: input.method ?? "qr",
      checkedInAt: at,
      createdAt: nowIso(),
    };
    checkinStore.unshift(created);
    return created;
  },
  async deleteCheckin(checkinId): Promise<{ id: string }> {
    const idx = checkinStore.findIndex((c) => c.id === checkinId);
    if (idx >= 0) checkinStore.splice(idx, 1);
    return { id: checkinId };
  },

  /* ---------- Überregionale Events ---------- */
  async listRegionalEvents(): Promise<RegionalEvent[]> {
    return [...eventStore].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  },
  async createRegionalEvent(input): Promise<RegionalEvent> {
    const now = nowIso();
    const created: RegionalEvent = {
      id: `regevt-local-${++eventSeq}`,
      clubId,
      title: input.title,
      hostOrg: input.hostOrg,
      discipline: input.discipline,
      location: input.location,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      registrationUrl: input.registrationUrl,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    };
    eventStore.push(created);
    return created;
  },
  async updateRegionalEvent(eventId, patch): Promise<RegionalEvent> {
    const item = eventStore.find((e) => e.id === eventId);
    if (!item) throw new Error(`Überregionales Event ${eventId} nicht gefunden (mock)`);
    if (patch.title !== undefined) item.title = patch.title;
    if (patch.startsOn !== undefined) item.startsOn = patch.startsOn;
    if (patch.endsOn !== undefined) item.endsOn = patch.endsOn ?? undefined;
    if (patch.hostOrg !== undefined) item.hostOrg = patch.hostOrg ?? undefined;
    if (patch.discipline !== undefined) item.discipline = patch.discipline ?? undefined;
    if (patch.location !== undefined) item.location = patch.location ?? undefined;
    if (patch.registrationUrl !== undefined)
      item.registrationUrl = patch.registrationUrl ?? undefined;
    if (patch.description !== undefined) item.description = patch.description ?? undefined;
    item.updatedAt = nowIso();
    return item;
  },
  async deleteRegionalEvent(eventId): Promise<{ id: string }> {
    const idx = eventStore.findIndex((e) => e.id === eventId);
    if (idx >= 0) eventStore.splice(idx, 1);
    return { id: eventId };
  },
};
