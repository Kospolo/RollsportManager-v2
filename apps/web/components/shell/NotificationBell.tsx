"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useT, type Dict, type Locale } from "@/lib/i18n";
import { dayDiff, formatTime, relativeDays } from "@/lib/format";
import {
  deriveNotifications,
  markAllRead,
  markRead,
  type NotificationFeed,
  type NotificationItem,
  type NotificationKind,
} from "@/lib/notifications";
import { IconTile, type IconTileTone } from "@/components/ui/IconTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { Icon, type IconName } from "./icons";

/**
 * Topbar-Glocke: Klick öffnet ein Panel mit dem abgeleiteten Feed
 * (lib/notifications) — heutige Termine, offene eigene Rückmeldungen,
 * überfällige eigene Rechnungen, neue Neuigkeiten, offene eigene Aufgaben.
 * Ungelesen-Zähler an der Glocke, „Alle gelesen" markiert den lokalen
 * Gelesen-Zustand (localStorage, verwaltet in lib/notifications).
 *
 * KEIN neuer Endpoint: der Feed fächert über die bestehenden, rollen-
 * gescopten Facade-Reads (RLS scoped serverseitig automatisch).
 */

/* ---------- kolokalisierte Strings (Muster wie Toast/Badge) ---------- */

const dict = {
  de: {
    open: "Benachrichtigungen",
    title: "Benachrichtigungen",
    unread: "{count} ungelesen",
    markAll: "Alle gelesen",
    emptyTitle: "Nichts Neues",
    emptyBody: "Du bist auf dem neuesten Stand.",
    loading: "Wird geladen …",
    kind_event_today: "Termin heute",
    kind_rsvp_open: "Rückmeldung offen",
    kind_invoice_overdue: "Rechnung überfällig",
    kind_news_new: "Neuigkeit",
    kind_task_open: "Aufgabe",
    kind_waitlist_new: "Warteliste",
    kind_chat_report: "Verstoss gemeldet",
  },
  en: {
    open: "Notifications",
    title: "Notifications",
    unread: "{count} unread",
    markAll: "Mark all read",
    emptyTitle: "Nothing new",
    emptyBody: "You are all caught up.",
    loading: "Loading …",
    kind_event_today: "Event today",
    kind_rsvp_open: "Response needed",
    kind_invoice_overdue: "Invoice overdue",
    kind_news_new: "News",
    kind_task_open: "Task",
    kind_waitlist_new: "Waitlist",
    kind_chat_report: "Report filed",
  },
} satisfies Dict;

type DictKey = keyof (typeof dict)["de"];

/* ---------- Zuordnung Kategorie → Symbol/Ton/Label ---------- */

const KIND_META: Record<NotificationKind, { icon: IconName; tone: IconTileTone; key: DictKey }> = {
  event_today: { icon: "events", tone: "info", key: "kind_event_today" },
  rsvp_open: { icon: "clock", tone: "warn", key: "kind_rsvp_open" },
  invoice_overdue: { icon: "finance", tone: "danger", key: "kind_invoice_overdue" },
  news_new: { icon: "sparkle", tone: "brand", key: "kind_news_new" },
  task_open: { icon: "check", tone: "neutral", key: "kind_task_open" },
  waitlist_new: { icon: "clock", tone: "warn", key: "kind_waitlist_new" },
  chat_report: { icon: "shield", tone: "danger", key: "kind_chat_report" },
};

/** Kompaktes Zeitlabel: heutige Einträge als Uhrzeit, sonst relativ in Tagen. */
function timeLabel(at: string | undefined, locale: Locale): string {
  if (!at) return "";
  return dayDiff(at) === 0 ? formatTime(at, locale) : relativeDays(at, locale);
}

export function NotificationBell() {
  const t = useT(dict);
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<NotificationFeed | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFeed(await deriveNotifications());
    } catch {
      setFeed({ items: [], unreadCount: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  // Erstladung für den Glocken-Zähler (SSR rendert feed=null → kein Punkt →
  // keine Hydration-Diskrepanz; der Punkt erscheint nach dem Effekt).
  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      if (!wasOpen) void load(); // beim Öffnen frisch ableiten
      return !wasOpen;
    });
  }, [load]);

  const onItemClick = useCallback((item: NotificationItem) => {
    markRead(item.id);
    setFeed((f) =>
      f
        ? {
            items: f.items.map((i) => (i.id === item.id ? { ...i, read: true } : i)),
            unreadCount: Math.max(0, f.unreadCount - (item.read ? 0 : 1)),
          }
        : f,
    );
    setOpen(false);
  }, []);

  const onMarkAll = useCallback(() => {
    setFeed((f) => {
      if (!f) return f;
      markAllRead(f.items);
      return { items: f.items.map((i) => ({ ...i, read: true })), unreadCount: 0 };
    });
  }, []);

  const items = feed?.items ?? [];
  const unread = feed?.unreadCount ?? 0;

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `${t("open")} — ${t("unread", { count: unread })}` : t("open")}
        onClick={toggle}
        className="relative grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-ink-soft transition-colors duration-150 hover:bg-sunken"
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-surface bg-brand px-1 text-[10px] font-extrabold leading-none text-brand-contrast"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label={t("title")}
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
        >
          {/* Kopf */}
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <span className="flex items-center gap-2">
              <b className="text-[14px] font-bold text-ink">{t("title")}</b>
              {unread > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-extrabold text-brand-contrast">
                  {unread}
                </span>
              )}
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={onMarkAll}
                className="rounded-full px-2.5 py-1 text-[12px] font-bold text-brand-ink transition-colors duration-150 hover:bg-brand-soft"
              >
                {t("markAll")}
              </button>
            )}
          </div>

          {/* Körper */}
          <div className="max-h-[min(70vh,26rem)] overflow-y-auto p-1.5">
            {loading && !feed ? (
              <ul className="grid gap-1" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center gap-3 px-2.5 py-2">
                    <Skeleton className="h-[38px] w-[38px] rounded-md" />
                    <span className="min-w-0 flex-1">
                      <Skeleton className="mb-2 h-3 w-2/5" />
                      <Skeleton className="h-3.5 w-4/5" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <div className="grid place-items-center px-6 py-10 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-sunken text-ink-soft">
                  <Icon name="bell" className="ic h-5 w-5" />
                </span>
                <b className="mt-3 text-[13.5px] font-bold text-ink">{t("emptyTitle")}</b>
                <p className="mt-1 text-caption text-ink-soft">{t("emptyBody")}</p>
              </div>
            ) : (
              <ul className="grid gap-0.5">
                {items.map((item) => {
                  const meta = KIND_META[item.kind];
                  const when = timeLabel(item.at, locale);
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={() => onItemClick(item)}
                        className="flex items-start gap-3 rounded-lg px-2.5 py-2 no-underline transition-colors duration-150 hover:bg-sunken"
                      >
                        <IconTile icon={meta.icon} tone={meta.tone} size="m" className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10.5px] font-bold uppercase tracking-wide text-ink-faint">
                            {t(meta.key)}
                          </span>
                          <span className="block truncate text-[13.5px] font-bold text-ink">
                            {item.title}
                          </span>
                          {item.detail && (
                            <span className="block truncate text-caption text-ink-soft">
                              {item.detail}
                            </span>
                          )}
                        </span>
                        <span className="flex flex-none flex-col items-end gap-1 pl-1">
                          {when && (
                            <time className="whitespace-nowrap text-[11px] text-ink-faint">{when}</time>
                          )}
                          {!item.read && (
                            <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
