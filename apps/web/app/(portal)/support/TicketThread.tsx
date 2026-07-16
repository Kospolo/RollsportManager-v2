"use client";

import { useState } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { data, errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { formatDateTime } from "@/lib/format";
import type { SupportMessage } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Textarea } from "@/components/ui/Field";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { supportDict } from "./i18n";
import { PRIORITY_KEY, PRIORITY_TONE, STATUS_KEY, STATUS_TONE } from "./labels";

/**
 * Der Verlauf EINES Anliegens plus Antwortfeld.
 *
 * Die Seiten sind optisch getrennt (Verein rechtsbündig/Beere, Support-Team
 * linksbündig/neutral) — im Support-Verlauf ist die häufigste Verwechslung
 * „wer hat das eigentlich gesagt?", und genau die kostet Vertrauen.
 *
 * Betreiber-Nachrichten tragen NIE einen Klarnamen (authorName ist dort immer
 * leer, siehe routes/support.ts) — sie laufen unter „Support-Team".
 *
 * Status/Priorität sind hier NUR Anzeige: sie zu setzen ist Sache des
 * Betreibers (RLS 0052). Es gibt deshalb bewusst kein Bedienelement dafür.
 */
export function TicketThread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const t = useT(supportDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const state = useData((repo) => repo.getSupportTicket(ticketId), [ticketId]);

  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (sending) return;
    const trimmed = reply.trim();
    if (trimmed === "") {
      setReplyError(t("fRequired"));
      return;
    }
    setSending(true);
    try {
      await data.replySupportTicket(ticketId, { body: trimmed });
      showToast(t("repliedToast"), { tone: "success" });
      setReply("");
      state.reload();
    } catch (error) {
      showToast(errorMessage(error) || t("genericError"), { tone: "danger" });
    } finally {
      setSending(false);
    }
  };

  if (state.status === "loading") {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <EmptyState
        icon="zap"
        title={t("detailErrorTitle")}
        body={errorMessage(state.error) || t("detailErrorBody")}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  }

  const ticket = state.data;

  return (
    <div className="grid gap-5">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          {t("back")}
        </Button>
      </div>

      <SectionHeader
        eyebrow={t("threadEyebrow")}
        title={ticket.subject}
        sub={
          ticket.createdByName
            ? `${t("openedBy", { name: ticket.createdByName })} · ${formatDateTime(ticket.createdAt, locale)}`
            : formatDateTime(ticket.createdAt, locale)
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[ticket.status]}>{t(STATUS_KEY[ticket.status])}</Badge>
        <Badge tone={PRIORITY_TONE[ticket.priority]}>{t(PRIORITY_KEY[ticket.priority])}</Badge>
      </div>

      {ticket.status === "waiting_on_club" && (
        <Card className="border-warn/40 bg-warn-soft">
          <p className="text-[14px] font-bold text-warn">{t("waitingHint")}</p>
        </Card>
      )}
      {ticket.status === "closed" && (
        <Card>
          <p className="text-[14px] text-ink-soft">{t("closedHint")}</p>
        </Card>
      )}

      <ol className="grid gap-3">
        {ticket.messages.map((message) => (
          <li key={message.id}>
            <MessageBubble message={message} />
          </li>
        ))}
      </ol>

      <Card>
        <div className="grid gap-3">
          <Textarea
            label={t("fReply")}
            value={reply}
            onChange={(event) => {
              setReply(event.target.value);
              if (replyError) setReplyError(undefined);
            }}
            placeholder={t("fReplyPlaceholder")}
            rows={4}
            maxLength={10000}
            error={replyError}
          />
          <p className="text-[13px] text-ink-soft">{t("noMailHint")}</p>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={sending}>
              {sending ? t("replying") : t("reply")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** Eine Nachricht. Die Seite bestimmt Ausrichtung, Farbe und Absendername. */
function MessageBubble({ message }: { message: SupportMessage }) {
  const t = useT(supportDict);
  const { locale } = useLocale();

  const fromPlatform = message.authorKind === "platform";
  const author = fromPlatform
    ? t("authorPlatform")
    : (message.authorName ?? t("authorClubFallback"));

  return (
    <div className={`flex ${fromPlatform ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[42rem] rounded-xl border px-4 py-3 ${
          fromPlatform ? "border-line bg-sunken" : "border-brand/30 bg-brand-soft"
        }`}
      >
        <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={`text-[13px] font-bold ${fromPlatform ? "text-ink" : "text-brand-ink"}`}>
            {author}
          </span>
          <span className="text-[12px] text-ink-soft">
            {formatDateTime(message.createdAt, locale)}
          </span>
        </div>
        {/* whitespace-pre-wrap: Absätze der schreibenden Person bleiben erhalten. */}
        <p className="whitespace-pre-wrap text-body text-ink">{message.body}</p>
      </div>
    </div>
  );
}
