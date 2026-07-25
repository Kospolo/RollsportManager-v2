"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { data, errorMessage, type SendChatMessageInput } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { ChatChannel, ChatMessage, Id } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonText } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import { chatDict } from "./i18n";
import { channelKey, channelName, channelQuery } from "./helpers";
import { MessageBubble } from "./MessageBubble";
import { ChatComposer } from "./ChatComposer";
import { DeleteMessageDialog } from "./DeleteMessageDialog";
import { ReportMessageDialog } from "./ReportMessageDialog";

/**
 * Nachrichten-Thread (rechte Spalte): Kopf mit Titel + Zurück (mobil), Verlauf
 * als Blasen und die Verfassen-Leiste unten (Text + Bild-Anhang). Senden hängt
 * optimistisch an (temporäre Blase), bei Fehler wird zurückgerollt. Der offene
 * Thread aktualisiert sich live: alle 8 s per Polling und beim Fenster-Fokus
 * (neue Nachrichten anderer erscheinen ohne Neuladen). Eigene Nachrichten sind
 * über einen Bestätigungs-Dialog löschbar. Rechte sind serverseitig
 * (Referenz 1.3) — die UI reicht nur durch.
 */

const NO_MESSAGES: ChatMessage[] = [];
const POLL_INTERVAL_MS = 8000;
/** Ab wie vielen Pixeln über dem Ende gilt der Verlauf als „nicht ganz unten". */
const STICK_THRESHOLD_PX = 80;

export function MessageThread({
  channel,
  currentMemberId,
  nameOf,
  onBack,
  onActivity,
}: {
  channel: ChatChannel;
  currentMemberId: Id;
  nameOf: (id: Id) => string;
  onBack: () => void;
  onActivity: () => void;
}) {
  const t = useT(chatDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const key = channelKey(channel);

  const state = useData((repo) => repo.listChatMessages(channelQuery(channel)), [key]);
  const reload = state.reload;

  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [toDelete, setToDelete] = useState<ChatMessage | null>(null);
  const [toReport, setToReport] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Ob der Verlauf am Ende steht — steuert das Auto-Scrollen. So reißt ein
  // Polling-Neuladen den Blick nicht nach unten, während man oben mitliest.
  const atBottomRef = useRef(true);

  // Kanalwechsel setzt den State automatisch zurück: ChatClient rendert diese
  // Komponente mit key={selectedKey}, sie wird also je Kanal frisch gemountet
  // (Sende-Puffer leer) — kein Reset-Effekt nötig.
  const base = state.data ?? NO_MESSAGES;
  const messages = useMemo(() => {
    const ids = new Set(base.map((m) => m.id));
    return [...base, ...pending.filter((m) => !ids.has(m.id))];
  }, [base, pending]);

  // Live-Aktualisierung: offenen Thread pollen (nur bei sichtbarem Tab) und beim
  // Fenster-Fokus / Sichtbarwerden sofort neu laden. Sauber wieder aufräumen.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, POLL_INTERVAL_MS);
    const onFocus = () => reload();
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  // Merkt sich, ob der Nutzer (nahezu) am Ende steht.
  const onThreadScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
  };

  // Nach jeder Änderung ans Ende scrollen — aber nur, wenn man ohnehin unten war.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const title =
    channelName(channel) || (channel.channelType === "team" ? t("teamChannel") : t("directMessage"));
  const subtitle = channel.channelType === "team" ? t("teamChannel") : t("directMessage");

  const handleSend = async ({ body, imageUrl }: { body?: string; imageUrl?: string }) => {
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      clubId: "",
      channelType: channel.channelType,
      teamId: channel.channelType === "team" ? channel.teamId : undefined,
      senderMemberId: currentMemberId,
      recipientMemberId: channel.channelType === "direct" ? channel.peerMemberId : undefined,
      body,
      imageUrl,
      createdAt: new Date().toISOString(),
    };
    const input: SendChatMessageInput =
      channel.channelType === "team"
        ? { channelType: "team", teamId: channel.teamId, body, imageUrl }
        : { channelType: "direct", recipientMemberId: channel.peerMemberId, body, imageUrl };

    // Eigene Nachricht → dem Verlauf ans Ende folgen.
    atBottomRef.current = true;
    setPending((p) => [...p, optimistic]);
    try {
      const saved = await data.sendChatMessage(input);
      // Temp-Blase durch die serverseitig bestätigte Nachricht ersetzen (kein Flackern).
      setPending((p) => p.map((m) => (m.id === tempId ? saved : m)));
      onActivity();
    } catch (caught) {
      setPending((p) => p.filter((m) => m.id !== tempId));
      showToast(errorMessage(caught) || t("sendError"), { tone: "danger" });
      throw caught; // Composer stellt Entwurf + Bild wieder her.
    }
  };

  const handleDeleted = () => {
    const id = toDelete?.id;
    if (id) setPending((p) => p.filter((m) => m.id !== id));
    reload();
    onActivity();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("backToList")}
          className="grid h-9 w-9 flex-none place-items-center rounded-full text-ink-soft transition-colors duration-150 hover:bg-sunken lg:hidden"
        >
          <Icon name="chevronRight" className="ic h-4 w-4 rotate-180" />
        </button>
        <div className="grid min-w-0 flex-1">
          <b className="truncate font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
            {title}
          </b>
          <span className="truncate text-[12px] text-ink-faint">{subtitle}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={reload} className="flex-none">
          {t("refresh")}
        </Button>
      </header>

      <div
        ref={scrollRef}
        onScroll={onThreadScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
      >
        {state.status === "loading" ? (
          <div className="grid gap-3">
            <SkeletonText lines={2} className="max-w-[60%]" />
            <SkeletonText lines={2} className="ml-auto max-w-[60%]" />
            <SkeletonText lines={3} className="max-w-[70%]" />
          </div>
        ) : state.status === "error" ? (
          <div className="grid h-full place-items-center">
            <EmptyState
              icon="zap"
              title={t("loadErrorTitle")}
              body={errorMessage(state.error) || t("loadErrorBody")}
              action={<Button onClick={reload}>{t("retry")}</Button>}
            />
          </div>
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center">
            <EmptyState
              icon="mail"
              title={t("threadEmptyTitle")}
              body={
                channel.channelType === "team"
                  ? t("threadEmptyBodyTeam")
                  : t("threadEmptyBodyDirect", { name: title })
              }
            />
          </div>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {messages.map((m, i) => {
              const isOwn = m.senderMemberId === currentMemberId;
              const prev = messages[i - 1];
              const showSender =
                channel.channelType === "team" && !isOwn && prev?.senderMemberId !== m.senderMemberId;
              return (
                <li key={m.id}>
                  <MessageBubble
                    message={m}
                    isOwn={isOwn}
                    senderName={isOwn ? t("you") : nameOf(m.senderMemberId)}
                    showSender={showSender}
                    locale={locale}
                    onDelete={isOwn ? () => setToDelete(m) : undefined}
                    // Fremde Nachricht als Verstoss melden (nicht die eigene, und
                    // nicht die noch nicht gesendete optimistische Blase).
                    onReport={!isOwn && !m.id.startsWith("temp-") ? () => setToReport(m) : undefined}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {state.status !== "error" && <ChatComposer onSend={handleSend} />}

      <DeleteMessageDialog
        message={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={handleDeleted}
      />

      <ReportMessageDialog message={toReport} onClose={() => setToReport(null)} />
    </div>
  );
}
