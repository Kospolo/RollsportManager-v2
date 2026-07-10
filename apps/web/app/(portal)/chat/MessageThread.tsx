"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
import { DeleteMessageDialog } from "./DeleteMessageDialog";

/**
 * Nachrichten-Thread (rechte Spalte): Kopf mit Titel + Zurück (mobil), Verlauf
 * als Blasen und ein Eingabefeld unten. Senden hängt optimistisch an (temporäre
 * Blase), bei Fehler wird zurückgerollt (Blase weg, Text zurück, Toast). Eigene
 * Nachrichten sind über einen Bestätigungs-Dialog löschbar. Rechte sind
 * serverseitig (Referenz 1.3) — die UI reicht nur durch.
 */

const NO_MESSAGES: ChatMessage[] = [];

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

  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [toDelete, setToDelete] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Kanalwechsel setzt den State automatisch zurück: ChatClient rendert diese
  // Komponente mit key={selectedKey}, sie wird also je Kanal frisch gemountet
  // (Sende-Puffer + Entwurf leer) — kein Reset-Effekt nötig.
  const base = state.data ?? NO_MESSAGES;
  const messages = useMemo(() => {
    const ids = new Set(base.map((m) => m.id));
    return [...base, ...pending.filter((m) => !ids.has(m.id))];
  }, [base, pending]);

  // Nach jeder Änderung ans Ende des Verlaufs scrollen.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const title = channelName(channel) || (channel.channelType === "team" ? t("teamChannel") : t("directMessage"));
  const subtitle = channel.channelType === "team" ? t("teamChannel") : t("directMessage");

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      clubId: "",
      channelType: channel.channelType,
      teamId: channel.channelType === "team" ? channel.teamId : undefined,
      senderMemberId: currentMemberId,
      recipientMemberId: channel.channelType === "direct" ? channel.peerMemberId : undefined,
      body,
      createdAt: new Date().toISOString(),
    };
    const input: SendChatMessageInput =
      channel.channelType === "team"
        ? { channelType: "team", teamId: channel.teamId, body }
        : { channelType: "direct", recipientMemberId: channel.peerMemberId, body };

    setPending((p) => [...p, optimistic]);
    setDraft("");
    setSending(true);
    try {
      const saved = await data.sendChatMessage(input);
      // Temp-Blase durch die serverseitig bestätigte Nachricht ersetzen (kein Flackern).
      setPending((p) => p.map((m) => (m.id === tempId ? saved : m)));
      onActivity();
    } catch (caught) {
      setPending((p) => p.filter((m) => m.id !== tempId));
      setDraft(body);
      showToast(errorMessage(caught) || t("sendError"), { tone: "danger" });
    } finally {
      setSending(false);
    }
  };

  const onComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const handleDeleted = () => {
    const id = toDelete?.id;
    if (id) setPending((p) => p.filter((m) => m.id !== id));
    state.reload();
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
        <Button variant="ghost" size="sm" onClick={state.reload} className="flex-none">
          {t("refresh")}
        </Button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
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
              action={<Button onClick={state.reload}>{t("retry")}</Button>}
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
                  />
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {state.status !== "error" && (
        <form
          className="flex items-end gap-2 border-t border-line p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onComposerKeyDown}
            rows={1}
            aria-label={t("inputLabel")}
            placeholder={t("inputPlaceholder")}
            className="max-h-32 min-h-11 w-full flex-1 resize-none rounded-md border border-transparent bg-sunken px-4 py-2.5 text-body leading-[22px] text-ink placeholder:text-ink-faint"
          />
          <Button type="submit" icon="mail" disabled={!draft.trim() || sending} className="flex-none">
            {t("send")}
          </Button>
        </form>
      )}

      <DeleteMessageDialog
        message={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
