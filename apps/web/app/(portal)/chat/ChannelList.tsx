"use client";

import { useLocale, useT } from "@/lib/i18n";
import type { ChatChannel, Id } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/shell/icons";
import { chatDict } from "./i18n";
import { channelKey, channelName, chatTimeShort, splitName } from "./helpers";

/**
 * Kanalliste (linke Spalte): meine Team-Kanäle + Direkt-Konversationen mit
 * letzter Nachricht und Zeit. Reihenfolge kommt serverseitig sortiert
 * (lastMessageAt desc, nulls last) — hier wird nur gerendert. Der aktive Kanal
 * ist hervorgehoben; ein Klick meldet die Auswahl nach oben.
 */
export function ChannelList({
  channels,
  selectedKey,
  onSelect,
  nameOf,
  currentMemberId,
}: {
  channels: ChatChannel[];
  selectedKey: string | null;
  onSelect: (channel: ChatChannel) => void;
  nameOf: (id: Id) => string;
  currentMemberId: Id;
}) {
  const t = useT(chatDict);
  const { locale } = useLocale();

  return (
    <ul className="grid gap-1">
      {channels.map((ch) => {
        const key = channelKey(ch);
        const active = key === selectedKey;
        const title = channelName(ch) || (ch.channelType === "team" ? t("teamChannel") : t("directMessage"));
        const preview = previewText();
        const time = ch.lastMessageAt ? chatTimeShort(ch.lastMessageAt, locale) : "";

        function previewText(): string {
          if (!ch.lastMessageAt) return t("noMessagesYet");
          const text = ch.lastBody ?? t("imageMessage");
          const own = ch.lastSenderMemberId === currentMemberId;
          if (own) return t("previewYou", { text });
          if (ch.channelType === "team")
            return t("previewOther", { name: nameOf(ch.lastSenderMemberId ?? ""), text });
          return text;
        }

        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(ch)}
              aria-current={active ? "true" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 ${
                active ? "bg-brand-soft" : "hover:bg-sunken"
              }`}
            >
              <ChannelGlyph channel={ch} />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex items-baseline gap-2">
                  <b className="min-w-0 flex-1 truncate font-display text-[14px] font-bold tracking-[-0.01em] text-ink">
                    {title}
                  </b>
                  {time && <span className="flex-none text-[11px] text-ink-faint">{time}</span>}
                </span>
                <span className="truncate text-[12.5px] text-ink-soft">{preview}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Führendes Glyph: Team-Kanal = getönte Icon-Kachel, Direkt-Peer = Avatar. */
function ChannelGlyph({ channel }: { channel: ChatChannel }) {
  if (channel.channelType === "team") {
    return (
      <span
        className="grid h-9 w-9 flex-none place-items-center rounded-full bg-info-soft text-info"
        aria-hidden="true"
      >
        <Icon name="teams" className="ic h-[18px] w-[18px]" />
      </span>
    );
  }
  const { firstName, lastName } = splitName(channel.peerName ?? "");
  return (
    <Avatar personId={channel.peerMemberId ?? "?"} firstName={firstName} lastName={lastName} size="m" />
  );
}
