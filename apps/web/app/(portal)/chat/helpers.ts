import type { ChatMessageQuery } from "@/lib/data";
import type { ChatChannel } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { dayDiff, formatDateShort, formatTime } from "@/lib/format";

/**
 * Kleine reine Helfer für den Chat-Screen (keine i18n, keine Datenzugriffe).
 * Ein Kanal hat KEINE eigene id: Team-Kanäle identifiziert teamId,
 * Direkt-Kanäle peerMemberId (siehe ChatChannel-Read-Model).
 */

/** Stabiler Schlüssel eines Kanals (für React-key, Auswahl-Vergleich). */
export function channelKey(ch: ChatChannel): string {
  if (ch.channelType === "team") return `team:${ch.teamId ?? ""}`;
  if (ch.channelType === "broadcast") return "broadcast";
  return `direct:${ch.peerMemberId ?? ""}`;
}

/** Selektor für listChatMessages aus einem Kanal. */
export function channelQuery(ch: ChatChannel): ChatMessageQuery {
  if (ch.channelType === "team") return { channelType: "team", teamId: ch.teamId };
  if (ch.channelType === "broadcast") return { channelType: "broadcast" };
  return { channelType: "direct", peerMemberId: ch.peerMemberId };
}

/** Anzeigename eines Kanals (Team-Name bzw. Peer-Name), leer als Fallback.
 *  Broadcast trägt keinen Namen — der Titel „Ansagen" kommt aus der i18n. */
export function channelName(ch: ChatChannel): string {
  if (ch.channelType === "team") return ch.teamName ?? "";
  if (ch.channelType === "broadcast") return "";
  return ch.peerName ?? "";
}

/** Vollen Namen in Vor-/Nachnamen für Avatar-Initialen aufteilen. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "?", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

/** Heute → Uhrzeit (17:30), sonst kurzes Datum (15.07.2026). */
export function chatTimeShort(iso: string, locale: Locale, now: Date = new Date()): string {
  return dayDiff(iso, now) === 0 ? formatTime(iso, locale) : formatDateShort(iso, locale);
}
