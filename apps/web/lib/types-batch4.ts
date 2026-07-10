import type { Id } from "./types";

/**
 * View-Typen der Batch-4-Module (Chat, Check-in, überregionale Events).
 * Ausgelagert aus lib/types.ts (< 400 Zeilen) und dort per
 * `export type * from "./types-batch4"` wieder unter "@/lib/types" verfügbar.
 * Die Label-Maps (DE/EN, echte Umlaute) werden zusätzlich als Werte aus
 * lib/types.ts re-exportiert (siehe dortiges
 * `export { chatChannelTypeLabels, checkinMethodLabels }`).
 *
 * Rechte sind SERVERSEITIG (RLS, Referenz 1.3) — die UI gatet nur zur Anzeige:
 *  - Team-Kanal lesen  = Team-Mitglied ODER is_club_trainer
 *  - Team-Kanal posten = NUR Team-Mitglied (ein team-fremder Trainer liest, postet nicht!)
 *  - Direktnachricht   = ausschließlich Sender + Empfänger (auch Trainer sehen fremde DMs NICHT)
 *  - Check-in lesen/anlegen = eigenes Mitglied (Self) ODER is_club_trainer
 *  - Check-in löschen  = NUR Trainer (Mitglied kann den eigenen Check-in NICHT löschen)
 *  - regional_events lesen = is_club_member, schreiben = is_club_trainer
 */

/* ---------- Chat (Kanäle & Nachrichten) ---------- */

/** Art eines Chat-Kanals: Team-Kanal oder 1:1-Direktnachricht. */
export type ChatChannelType = "team" | "direct";

/**
 * Read-Model eines Chat-Kanals (GET /chat/channels). Enthält
 *  (a) ALLE Team-Kanäle, in denen der Caller Mitglied ist — auch OHNE
 *      Nachrichten (dann sind alle last*-Felder undefined), und
 *  (b) je Direkt-Peer die jeweils letzte Nachricht.
 * Serverseitig sortiert nach lastMessageAt desc (nulls last). Ein Kanal hat
 * KEINE eigene id: team-Kanäle identifiziert teamId, direct-Kanäle peerMemberId.
 */
export interface ChatChannel {
  channelType: ChatChannelType;
  /** Gesetzt bei channelType='team'. */
  teamId?: Id;
  /** Anzeigename des Teams (nur team). */
  teamName?: string;
  /** Gesetzt bei channelType='direct' — die andere Person. */
  peerMemberId?: Id;
  /** Anzeigename des Direkt-Peers (nur direct). */
  peerName?: string;
  /** Letzte Nachricht im Kanal (fehlt bei leeren Team-Kanälen). */
  lastMessageId?: Id;
  lastBody?: string;
  lastImageUrl?: string;
  lastSenderMemberId?: Id;
  /** ISO-Zeitstempel der letzten Nachricht (undefined = leerer Kanal). */
  lastMessageAt?: string;
}

/**
 * Einzelne Chat-Nachricht (GET /chat/messages, chronologisch aufsteigend).
 * body und/oder imageUrl ist gesetzt (mindestens eines). team-Nachrichten
 * haben teamId, direct-Nachrichten recipientMemberId. Der senderMemberId wird
 * serverseitig aus der eigenen club_members-Zeile abgeleitet (Spoofing-Schutz).
 */
export interface ChatMessage {
  id: Id;
  clubId: Id;
  channelType: ChatChannelType;
  /** Gesetzt bei channelType='team'. */
  teamId?: Id;
  senderMemberId: Id;
  /** Gesetzt bei channelType='direct'. */
  recipientMemberId?: Id;
  body?: string;
  imageUrl?: string;
  /** ISO-Zeitstempel */
  createdAt: string;
}

/* ---------- Check-in (Anwesenheit per QR/manuell) ---------- */

/** Erfassungsart eines Check-ins: QR-Scan oder manuell durch den Trainerstab. */
export type CheckinMethod = "qr" | "manual";

/**
 * Ein erfasster Check-in. Lesen/Anlegen = eigenes Mitglied (Self) ODER Trainer;
 * Soft-Löschen = NUR Trainer. eventId optional (Check-in ohne konkreten Termin).
 * method default 'qr'. checkedInAt kommt als ISO-Zeitstempel vom Server.
 */
export interface Checkin {
  id: Id;
  clubId: Id;
  memberId: Id;
  /** Optionaler Bezug auf einen Termin. */
  eventId?: Id;
  method: CheckinMethod;
  /** ISO-Zeitstempel des Check-ins */
  checkedInAt: string;
  createdAt: string;
}

/* ---------- Überregionale Events (regional_events) ---------- */

/**
 * Überregionales Event (Wettkampf/Lehrgang o. ä.). Lesen = jedes Vereinsmitglied
 * (is_club_member), Anlegen/Ändern/Löschen = Trainerstab+ (is_club_trainer).
 * hostOrg/discipline/location/registrationUrl/description sind Freitext (nullable,
 * KEINE Enums). startsOn/endsOn sind ISO-Datumsangaben (YYYY-MM-DD).
 */
export interface RegionalEvent {
  id: Id;
  clubId: Id;
  title: string;
  /** Ausrichter (Freitext). */
  hostOrg?: string;
  /** Disziplin (Freitext). */
  discipline?: string;
  location?: string;
  /** ISO-Datum (YYYY-MM-DD) */
  startsOn: string;
  /** ISO-Datum (YYYY-MM-DD) */
  endsOn?: string;
  registrationUrl?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------- Enum-Labels (DE/EN, echte Umlaute) ---------- */

/** Anzeige-Labels für ChatChannelType in beiden Sprachen. */
export const chatChannelTypeLabels: Record<ChatChannelType, { de: string; en: string }> = {
  team: { de: "Team-Kanal", en: "Team channel" },
  direct: { de: "Direktnachricht", en: "Direct message" },
};

/** Anzeige-Labels für CheckinMethod in beiden Sprachen. */
export const checkinMethodLabels: Record<CheckinMethod, { de: string; en: string }> = {
  qr: { de: "QR-Code", en: "QR code" },
  manual: { de: "Manuell", en: "Manual" },
};
