import { data, fullName, permissions } from "@/lib/data";
import type { NotificationPrefs } from "@/lib/types";

/**
 * Client-seitiger Benachrichtigungs-Deriver der Topbar-Glocke. KEIN eigener
 * Endpoint — er leitet aus den BESTEHENDEN, rollen-gescopten Facade-Reads ab:
 *
 *   • heutige Termine            (getEvents)
 *   • eigene überfällige Rechnungen (getInvoices, memberId = self)
 *   • offene eigene RSVPs        (getEvents, ohne eigene Antwort, in der Zukunft)
 *   • neue Neuigkeiten           (listNews, jünger als NEWS_WINDOW_DAYS)
 *   • offene eigene Aufgaben     (getTasks, assigneeId = self, nicht erledigt)
 *   • wartende Wartelisten-Einträge (listWaitlists, status=waiting) — NUR Trainer+
 *   • offene Chat-Meldungen      (listChatReports, status=open) — NUR Vorstand/Betreiber
 *
 * Die Kategorien werden über die eigenen notifications-Präferenzen gefiltert
 * (getMyPreferences → Glocken-Flags). Der Gelesen-Zustand liegt lokal im
 * localStorage (pro Eintrags-ID) — es gibt dafür keinen Serverzustand.
 */

export type NotificationKind =
  | "event_today"
  | "invoice_overdue"
  | "rsvp_open"
  | "news_new"
  | "task_open"
  | "waitlist_new"
  | "chat_report";

export interface NotificationItem {
  /** Stabile ID `${kind}:${entityId}` — Basis des Gelesen-Zustands. */
  id: string;
  kind: NotificationKind;
  title: string;
  detail?: string;
  /** Zielroute beim Klick. */
  href: string;
  /** Relevanter Zeitpunkt (Terminbeginn, Fälligkeit, Veröffentlichung) — ISO. */
  at?: string;
  read: boolean;
}

export interface NotificationFeed {
  items: NotificationItem[];
  unreadCount: number;
}

const NEWS_WINDOW_DAYS = 14;
const READ_STORAGE_KEY = "rsm.notifications.read";

/* ---------- Gelesen-Zustand (localStorage, SSR-sicher) ---------- */

function readIdSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((x): x is string => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function persistIdSet(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Speicher voll / privater Modus — Gelesen-Zustand ist dann nur flüchtig.
  }
}

/** Einen oder mehrere Einträge als gelesen markieren. */
export function markRead(id: string | string[]): void {
  const ids = readIdSet();
  for (const one of Array.isArray(id) ? id : [id]) ids.add(one);
  persistIdSet(ids);
}

/** Alle übergebenen Einträge als gelesen markieren (z. B. „alle gelesen"). */
export function markAllRead(items: NotificationItem[]): void {
  markRead(items.map((i) => i.id));
}

/** Gelesen-Zustand vollständig zurücksetzen. */
export function clearReadState(): void {
  persistIdSet(new Set());
}

/* ---------- Ableitung ---------- */

const DAY_MS = 86_400_000;
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

function prefEnabled(prefs: NotificationPrefs | null, flag: keyof NotificationPrefs): boolean {
  // Ohne ladbare Präferenzen (oder undefiniertes Flag) ist die Kategorie an.
  return prefs?.[flag] ?? true;
}

/**
 * Baut den Benachrichtigungs-Feed aus den Facade-Reads.
 * @param opts.newsWindowDays  Fenster „neuer" News in Tagen (Default 14)
 */
export async function deriveNotifications(opts?: {
  newsWindowDays?: number;
}): Promise<NotificationFeed> {
  const windowDays = opts?.newsWindowDays ?? NEWS_WINDOW_DAYS;
  const now = new Date();
  const today = isoDate(now);
  const nowMs = now.getTime();

  const [self, prefs, events, invoices, news, tasks, waitlists, members] = await Promise.all([
    data.getCurrentUser(),
    data.getMyPreferences().catch(() => null),
    data.getEvents().catch(() => []),
    data.getInvoices().catch(() => []),
    data.listNews().catch(() => []),
    data.getTasks().catch(() => []),
    data.listWaitlists().catch(() => []),
    data.getMembers().catch(() => []),
  ]);

  const flags = prefs?.notifications ?? null;
  const wantEvents = prefEnabled(flags, "events");
  const wantInvoices = prefEnabled(flags, "invoices");
  const wantNews = prefEnabled(flags, "news");

  const read = readIdSet();
  const items: NotificationItem[] = [];
  const push = (partial: Omit<NotificationItem, "read">): void => {
    items.push({ ...partial, read: read.has(partial.id) });
  };

  if (wantEvents) {
    for (const e of events) {
      // Heutige Termine
      if (e.startsAt.slice(0, 10) === today) {
        push({
          id: `event_today:${e.id}`,
          kind: "event_today",
          title: e.title,
          detail: e.location || undefined,
          href: "/termine",
          at: e.startsAt,
        });
      }
      // Offene eigene RSVPs (zukünftige Termine ohne eigene Antwort)
      const inFuture = new Date(e.startsAt).getTime() >= nowMs;
      const answered = e.rsvps.some((r) => r.memberId === self.id);
      if (inFuture && !answered) {
        push({
          id: `rsvp_open:${e.id}`,
          kind: "rsvp_open",
          title: e.title,
          detail: e.location || undefined,
          href: "/termine",
          at: e.startsAt,
        });
      }
    }
  }

  if (wantInvoices) {
    for (const inv of invoices) {
      if (inv.memberId === self.id && inv.status === "open" && inv.dueAt < today) {
        push({
          id: `invoice_overdue:${inv.id}`,
          kind: "invoice_overdue",
          title: inv.number,
          detail: inv.title,
          href: "/finanzen/rechnungen",
          at: inv.dueAt,
        });
      }
    }
  }

  if (wantNews) {
    for (const n of news) {
      const at = n.publishedAt ?? n.createdAt;
      if (n.publishedAt && nowMs - new Date(at).getTime() <= windowDays * DAY_MS) {
        push({
          id: `news_new:${n.id}`,
          kind: "news_new",
          title: n.title,
          href: "/news",
          at,
        });
      }
    }
  }

  // Aufgaben haben kein eigenes Präferenz-Flag → immer sichtbar.
  for (const t of tasks) {
    if (!t.done && t.assigneeId === self.id) {
      push({
        id: `task_open:${t.id}`,
        kind: "task_open",
        title: t.title,
        href: "/wettkampf",
        at: t.dueAt,
      });
    }
  }

  // Wartelisten (Trainer+): jeder wartende Eintrag der Vereins-Warteschlange.
  // Kein eigenes Präferenz-Flag (wie Aufgaben). Die RLS liefert Trainer:innen
  // ohnehin die ganze Queue; der isTrainer-Gate hier ist die zusätzliche
  // clientseitige Sicht-Grenze (analog WartelistenClient). Titel = Mitgliedsname.
  if (permissions(self).isTrainer) {
    const memberName = new Map(members.map((m) => [m.id, fullName(m)] as const));
    for (const w of waitlists) {
      if (w.status === "waiting") {
        push({
          id: `waitlist_new:${w.id}`,
          kind: "waitlist_new",
          title: memberName.get(w.memberId) ?? w.memberId,
          href: "/wartelisten",
          at: w.createdAt,
        });
      }
    }
  }

  // Chat-Meldungen (Vorstand/Betreiber): jede OFFENE Meldung. Kein eigenes
  // Präferenz-Flag (wie Aufgaben/Warteliste). Nur laden, wenn berechtigt — für
  // ein einfaches Mitglied wäre GET /chat/reports ein sicheres 403 pro
  // Ableitung. Titel = die gemeldete Person (Kategorie-Wort kommt aus der
  // Glocke, KIND_META), Ziel = die Meldungen-Seite.
  const perms = permissions(self);
  if (perms.isClubAdmin || perms.isPlatformAdmin) {
    const reports = await data.listChatReports().catch(() => []);
    const memberName = new Map(members.map((m) => [m.id, fullName(m)] as const));
    for (const r of reports) {
      if (r.status !== "open") continue;
      const concerns = r.reportedMemberId ? memberName.get(r.reportedMemberId) : undefined;
      push({
        id: `chat_report:${r.id}`,
        kind: "chat_report",
        title: concerns ?? r.reason,
        detail: r.reason,
        href: "/verwaltung/meldungen",
        at: r.createdAt,
      });
    }
  }

  // Neueste/relevante zuerst (mit Zeitstempel vor solchen ohne).
  items.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  const unreadCount = items.reduce((n, i) => n + (i.read ? 0 : 1), 0);
  return { items, unreadCount };
}
