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
  return ch.channelType === "team" ? `team:${ch.teamId ?? ""}` : `direct:${ch.peerMemberId ?? ""}`;
}

/** Selektor für listChatMessages aus einem Kanal. */
export function channelQuery(ch: ChatChannel): ChatMessageQuery {
  return ch.channelType === "team"
    ? { channelType: "team", teamId: ch.teamId }
    : { channelType: "direct", peerMemberId: ch.peerMemberId };
}

/** Anzeigename eines Kanals (Team-Name bzw. Peer-Name), leer als Fallback. */
export function channelName(ch: ChatChannel): string {
  return (ch.channelType === "team" ? ch.teamName : ch.peerName) ?? "";
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
