"use client";

import { useT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { formatTime } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";
import { chatDict } from "./i18n";
import { ChatImage } from "./ChatImage";

/**
 * Eine Chat-Blase: eigene Nachrichten rechts (Beere-soft), fremde links
 * (Sunken). In Team-Kanälen steht der Sendername über der ersten Blase einer
 * Folge (showSender). Eigene Nachrichten sind über „Löschen" entfernbar — die
 * eigentliche Bestätigung passiert im übergeordneten Dialog (onDelete öffnet ihn).
 */
export function MessageBubble({
  message,
  isOwn,
  senderName,
  showSender,
  locale,
  onDelete,
  onReport,
}: {
  message: ChatMessage;
  isOwn: boolean;
  senderName: string;
  showSender: boolean;
  locale: Locale;
  onDelete?: () => void;
  onReport?: () => void;
}) {
  const t = useT(chatDict);

  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
      {showSender && (
        <span className="mb-0.5 px-1 text-[11px] font-bold text-ink-faint">{senderName}</span>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 sm:max-w-[70%] ${
          isOwn ? "bg-brand-soft text-brand-ink" : "bg-sunken text-ink"
        }`}
      >
        {message.imageUrl && (
          <ChatImage
            imageUrl={message.imageUrl}
            alt={t("imageAlt")}
            failedLabel={t("imageFailed")}
          />
        )}
        {message.body && (
          <p className="whitespace-pre-wrap break-words text-[14px] leading-[20px]">
            {message.body}
          </p>
        )}
        <time
          dateTime={message.createdAt}
          className={`mt-1 block text-[10.5px] ${isOwn ? "text-brand-ink/70" : "text-ink-faint"}`}
        >
          {formatTime(message.createdAt, locale)}
        </time>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mt-0.5 rounded px-1 text-[11px] font-semibold text-ink-faint transition-colors duration-150 hover:text-danger"
        >
          {t("delete")}
        </button>
      )}
      {onReport && (
        <button
          type="button"
          onClick={onReport}
          className="mt-0.5 rounded px-1 text-[11px] font-semibold text-ink-faint transition-colors duration-150 hover:text-danger"
        >
          {t("report")}
        </button>
      )}
    </div>
  );
}
