import type {
  ChatChannel,
  ChatChannelType,
  ChatMessage,
  Checkin,
  CheckinMethod,
  Id,
  RegionalEvent,
} from "@/lib/types";

/**
 * Eingabe-Typen der Batch-4-Module (Chat, Check-in, überregionale Events).
 * Ausgelagert aus lib/data/types.ts, damit beide Dateien < 400 Zeilen bleiben.
 * Re-exportiert über lib/data/index.ts.
 *
 * Rechte sind SERVERSEITIG (RLS + Rollencheck, Referenz 1.3): Team-Kanal posten
 * = NUR Team-Mitglieder; Direktnachricht = nur Sender+Empfänger; Check-in
 * anlegen = Self ODER Trainer, löschen = NUR Trainer; regional_events schreiben
 * = is_club_trainer. Die Facade reicht nur durch.
 */

/* ---------- Chat (Nachrichten lesen/senden) ---------- */

/**
 * Kanal-Selektor für listChatMessages. channelType='team' braucht teamId,
 * channelType='direct' braucht peerMemberId (jeweils das andere Feld leer).
 */
export interface ChatMessageQuery {
  channelType: ChatChannelType;
  /** Pflicht bei channelType='team'. */
  teamId?: Id;
  /** Pflicht bei channelType='direct' — die andere Person. */
  peerMemberId?: Id;
}

/**
 * Nachricht senden. KEIN senderMemberId — der Server leitet den Sender aus der
 * eigenen club_members-Zeile ab (Spoofing-Schutz). Validierung serverseitig:
 * team → teamId (recipientMemberId muss fehlen); direct → recipientMemberId
 * (teamId muss fehlen); body UND/ODER imageUrl Pflicht (mind. eines,
 * body max 4000 Zeichen, imageUrl muss eine URL sein).
 */
export interface SendChatMessageInput {
  channelType: ChatChannelType;
  /** Pflicht bei channelType='team'. */
  teamId?: Id;
  /** Pflicht bei channelType='direct'. */
  recipientMemberId?: Id;
  body?: string;
  imageUrl?: string;
}

/* ---------- Check-in ---------- */

/**
 * Check-in anlegen (eigenes Mitglied ODER Trainer). method default 'qr';
 * checkedInAt default = jetzt (Server). eventId optional.
 */
export interface CreateCheckinInput {
  memberId: Id;
  eventId?: Id;
  /** Default 'qr'. */
  method?: CheckinMethod;
  /** ISO-Zeitstempel; Default = jetzt (serverseitig). */
  checkedInAt?: string;
}

/* ---------- Überregionale Events ---------- */

/**
 * Überregionales Event anlegen (is_club_trainer). Alle Freitextfelder optional.
 * startsOn/endsOn sind ISO-Datumsangaben (YYYY-MM-DD).
 */
export interface CreateRegionalEventInput {
  title: string;
  /** ISO-Datum (YYYY-MM-DD) */
  startsOn: string;
  /** ISO-Datum (YYYY-MM-DD) */
  endsOn?: string;
  hostOrg?: string;
  discipline?: string;
  location?: string;
  registrationUrl?: string;
  description?: string;
}

/** Überregionales Event ändern (is_club_trainer). null leert das jeweilige Feld. */
export interface UpdateRegionalEventInput {
  title?: string;
  startsOn?: string;
  endsOn?: string | null;
  hostOrg?: string | null;
  discipline?: string | null;
  location?: string | null;
  registrationUrl?: string | null;
  description?: string | null;
}

/* ---------- Repository-Slice der Batch-4-Module ---------- */

/**
 * Facade-Methoden der Batch-4-Module (Chat, Check-in, überregionale Events).
 * Ausgelagert aus lib/data/types.ts (< 400 Zeilen); DataRepository erbt davon.
 * Rechte SERVERSEITIG (RLS, Referenz 1.3) — die UI gatet nur zur Anzeige.
 */
export interface Batch4Repository {
  /* ---------- Chat ---------- */
  /** Meine Kanäle: alle Team-Kanäle (auch leere) + je Direkt-Peer die letzte Nachricht, lastMessageAt desc (nulls last). */
  listChatChannels(): Promise<ChatChannel[]>;
  /** Nachrichten eines Kanals, chronologisch aufsteigend (Team: Mitglied/Trainer; Direkt: nur Sender+Empfänger). */
  listChatMessages(query: ChatMessageQuery): Promise<ChatMessage[]>;
  /** Nachricht senden (Team-Kanal posten = NUR Team-Mitglied; Sender wird serverseitig abgeleitet, kein senderMemberId). */
  sendChatMessage(input: SendChatMessageInput): Promise<ChatMessage>;
  /** Nachricht soft-löschen — liefert die gelöschte ID zurück. */
  deleteChatMessage(messageId: Id): Promise<{ id: Id }>;

  /* ---------- Check-in ---------- */
  /** Check-ins des Vereins, optional nach Mitglied (RLS: Mitglied sieht nur eigene). */
  listCheckins(memberId?: Id): Promise<Checkin[]>;
  /** Check-in anlegen (eigenes Mitglied ODER Trainer). */
  createCheckin(input: CreateCheckinInput): Promise<Checkin>;
  /** Check-in soft-löschen — NUR Trainer (Mitglied kann den eigenen NICHT löschen). */
  deleteCheckin(checkinId: Id): Promise<{ id: Id }>;

  /* ---------- Überregionale Events ---------- */
  /** Überregionale Events des Vereins (frühestes zuerst). */
  listRegionalEvents(): Promise<RegionalEvent[]>;
  /** Überregionales Event anlegen (is_club_trainer). */
  createRegionalEvent(input: CreateRegionalEventInput): Promise<RegionalEvent>;
  /** Überregionales Event ändern (is_club_trainer). */
  updateRegionalEvent(eventId: Id, patch: UpdateRegionalEventInput): Promise<RegionalEvent>;
  /** Überregionales Event soft-löschen (is_club_trainer) — liefert die gelöschte ID zurück. */
  deleteRegionalEvent(eventId: Id): Promise<{ id: Id }>;
}
