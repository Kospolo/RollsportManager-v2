import type { DataRepository } from "../types";
import { activeClubId, apiClient } from "./client";
import {
  mapChatChannel,
  mapChatMessage,
  mapCheckin,
  mapRegionalEvent,
} from "./mappers-batch4";
import { mediaKeyUrl, uploadMedia } from "./media-fetch";

/**
 * API-Implementierung der Batch-4-Module (Chat, Check-in, überregionale
 * Events). Ausgelagert aus api/index.ts (< 400 Zeilen).
 *
 * Rechte sind SERVERSEITIG (RLS + Rollencheck, Referenz 1.3): Team-Kanal posten
 * = NUR Team-Mitglieder (team-fremder Trainer liest, postet nicht); Direkt-
 * nachricht = nur Sender+Empfänger; Check-in anlegen = Self ODER Trainer,
 * löschen = NUR Trainer; regional_events schreiben = is_club_trainer. Der
 * Sender einer Nachricht wird serverseitig aus der eigenen club_members-Zeile
 * abgeleitet — die Facade schickt bewusst KEIN sender_member_id mit.
 */

/** Die 11 Batch-4-Modul-Methoden — wird in apiRepository gespreizt. */
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

export const moduleApiRepositoryBatch4: ModuleMethods = {
  /* ---------- Chat ---------- */
  async listChatChannels() {
    const rows = await apiClient.getChatChannels({ club_id: activeClubId() });
    return rows.map(mapChatChannel);
  },
  async listChatMessages(query) {
    const rows = await apiClient.getChatMessages({
      club_id: activeClubId(),
      channel_type: query.channelType,
      team_id: query.teamId,
      peer_member_id: query.peerMemberId,
    });
    return rows.map(mapChatMessage);
  },
  async sendChatMessage(input) {
    // KEIN sender_member_id — Server leitet den Sender ab (Spoofing-Schutz).
    const created = await apiClient.postChatMessages({
      club_id: activeClubId(),
      channel_type: input.channelType,
      team_id: input.teamId,
      recipient_member_id: input.recipientMemberId,
      body: input.body,
      image_url: input.imageUrl,
    });
    return mapChatMessage(created);
  },
  async uploadChatImage(file) {
    // Stufe 1: Datei hochladen; das storage_key wird als absolute, Bearer-
    // auflösbare Media-URL zurückgegeben (Schema verlangt eine gültige URL).
    const up = await uploadMedia(activeClubId(), file, "Chat-Bild");
    return mediaKeyUrl(up.storageKey);
  },
  async deleteChatMessage(messageId) {
    const deleted = await apiClient.deleteChatMessagesByMessageId(messageId);
    return { id: deleted.id };
  },

  /* ---------- Check-in ---------- */
  async listCheckins(memberId) {
    const rows = await apiClient.getCheckins({
      club_id: activeClubId(),
      member_id: memberId,
    });
    return rows.map(mapCheckin);
  },
  async createCheckin(input) {
    const created = await apiClient.postCheckins({
      club_id: activeClubId(),
      member_id: input.memberId,
      event_id: input.eventId,
      method: input.method,
      checked_in_at: input.checkedInAt,
    });
    return mapCheckin(created);
  },
  async deleteCheckin(checkinId) {
    const deleted = await apiClient.deleteCheckinsByCheckinId(checkinId);
    return { id: deleted.id };
  },

  /* ---------- Überregionale Events ---------- */
  async listRegionalEvents() {
    const rows = await apiClient.getRegionalEvents({ club_id: activeClubId() });
    return rows.map(mapRegionalEvent);
  },
  async createRegionalEvent(input) {
    const created = await apiClient.postRegionalEvents({
      club_id: activeClubId(),
      title: input.title,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      host_org: input.hostOrg,
      discipline: input.discipline,
      location: input.location,
      registration_url: input.registrationUrl,
      description: input.description,
    });
    return mapRegionalEvent(created);
  },
  async updateRegionalEvent(eventId, patch) {
    const updated = await apiClient.patchRegionalEventsByEventId(eventId, {
      title: patch.title,
      starts_on: patch.startsOn,
      ends_on: patch.endsOn,
      host_org: patch.hostOrg,
      discipline: patch.discipline,
      location: patch.location,
      registration_url: patch.registrationUrl,
      description: patch.description,
    });
    return mapRegionalEvent(updated);
  },
  async deleteRegionalEvent(eventId) {
    const deleted = await apiClient.deleteRegionalEventsByEventId(eventId);
    return { id: deleted.id };
  },
};
