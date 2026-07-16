"use client";

import { useState } from "react";
import { data, errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import type {
  Id,
  SupportMessage,
  SupportTicketDetail,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import {
  PRIORITY_KEY,
  PRIORITY_OPTIONS,
  PRIORITY_TONE,
  STATUS_KEY,
  STATUS_OPTIONS,
  STATUS_TONE,
  supportOpsDict,
} from "./i18n";

/**
 * Ein Ticket samt Verlauf — die Betreiber-Sicht.
 *
 * Gegen Trupp Bs Endpunkte (Migration 0052), NICHT nachgebaut:
 *   GET   /support/tickets/{id}           → data.getSupportTicket
 *   POST  /support/tickets/{id}/messages  → data.replySupportTicket
 *   PATCH /support/tickets/{id}           → data.updateSupportTicket (Betreiber-Vorbehalt)
 *
 * author_kind schickt der Client NIE mit: der Server leitet die Seite aus dem
 * Token ab und die DB prüft sie nach. Genau deshalb steht hier kein
 * „als … antworten“-Auswahlfeld — es gäbe eine Wahl vor, die es nicht gibt.
 */

export function TicketThread({ ticketId, onBack }: { ticketId: Id; onBack: () => void }) {
  const t = useT(supportOpsDict);

  const state = useData((repo) => repo.getSupportTicket(ticketId), [ticketId]);

  if (state.status === "loading") {
    return <SkeletonCard lines={8} />;
  }

  if (state.status === "error") {
    return (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error)}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  }

  return <Thread ticket={state.data} reload={state.reload} onBack={onBack} />;
}

/* ------------------------------------------------------------------ */

function Thread({
  ticket,
  reload,
  onBack,
}: {
  ticket: SupportTicketDetail;
  reload: () => void;
  onBack: () => void;
}) {
  const t = useT(supportOpsDict);
  const { showToast } = useToast();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const closed = ticket.status === "closed";

  async function send() {
    const text = body.trim();
    if (text === "" || busy) return;
    setBusy(true);
    try {
      await data.replySupportTicket(ticket.id, { body: text });
      setBody("");
      showToast(t("replySent"), { tone: "success" });
      reload();
    } catch (err) {
      showToast(errorMessage(err), { tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: SupportTicketStatus) {
    if (status === ticket.status || busy) return;
    setBusy(true);
    try {
      await data.updateSupportTicket(ticket.id, { status });
      showToast(t("statusSaved", { status: t(STATUS_KEY[status]) }), { tone: "success" });
      reload();
    } catch (err) {
      showToast(errorMessage(err), { tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function setPriority(priority: SupportTicketPriority) {
    if (priority === ticket.priority || busy) return;
    setBusy(true);
    try {
      await data.updateSupportTicket(ticket.id, { priority });
      showToast(t("prioSaved", { prio: t(PRIORITY_KEY[priority]) }), { tone: "success" });
      reload();
    } catch (err) {
      showToast(errorMessage(err), { tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-bold text-ink transition-colors duration-150 hover:bg-sunken"
      >
        <Icon name="chevronRight" className="ic h-4 w-4 rotate-180" />
        {t("backToList")}
      </button>

      <Card>
        <CardHeader
          eyebrow={`${t("threadEyebrow")} · ${ticket.clubName ?? ticket.clubId}`}
          title={ticket.subject}
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[ticket.status]}>{t(STATUS_KEY[ticket.status])}</Badge>
          <Badge tone={PRIORITY_TONE[ticket.priority]}>{t(PRIORITY_KEY[ticket.priority])}</Badge>
        </div>

        {/* Betreiber-Vorbehalt: Status/Dringlichkeit setzt laut 0052 NUR die
            Plattform (support_tickets_update = app.is_platform_admin()). Auf
            der Vereins-Seite gibt es diese Felder deshalb gar nicht. */}
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <Select
            label={t("setStatus")}
            value={ticket.status}
            disabled={busy}
            onChange={(e) => void setStatus(e.target.value as SupportTicketStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(STATUS_KEY[s])}
              </option>
            ))}
          </Select>
          <Select
            label={t("setPriority")}
            value={ticket.priority}
            disabled={busy}
            onChange={(e) => void setPriority(e.target.value as SupportTicketPriority)}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {t(PRIORITY_KEY[p])}
              </option>
            ))}
          </Select>
        </div>

        <ol className="grid gap-3">
          {ticket.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </ol>

        <p className="mt-4 text-caption text-ink-faint">{t("appendOnlyNote")}</p>
      </Card>

      <Card>
        {closed ? (
          <p className="rounded-lg bg-sunken px-4 py-3 text-body text-ink-soft">{t("closedNote")}</p>
        ) : (
          <>
            <Textarea
              label={t("replyLabel")}
              placeholder={t("replyPlaceholder")}
              rows={5}
              value={body}
              disabled={busy}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button icon="mail" onClick={() => void send()} disabled={busy || body.trim() === ""}>
                {busy ? t("sending") : t("send")}
              </Button>
              {/* Kein Mailversand — und diese Oberfläche behauptet es nirgends. */}
              <span className="text-caption text-ink-faint">{t("noMailNote")}</span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Eine Nachricht. Betreiber-Nachrichten tragen NIE einen Personennamen — der
 * Server liefert für sie keinen (der Betreiber hat keine Mitgliedszeile, und
 * welcher Mensch geantwortet hat, geht den Verein nichts an). „Support-Team“
 * ist deshalb keine Beschönigung, sondern genau das, was da steht.
 */
function MessageBubble({ message }: { message: SupportMessage }) {
  const t = useT(supportOpsDict);
  const { locale } = useLocale();
  const fromPlatform = message.authorKind === "platform";

  return (
    <li
      className={`rounded-lg border px-4 py-3 ${
        fromPlatform ? "border-brand-soft bg-brand-soft/40" : "border-line bg-sunken"
      }`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
          <Icon name={fromPlatform ? "monitor" : "teams"} className="ic h-3.5 w-3.5" />
          {fromPlatform ? t("supportTeam") : (message.authorName ?? t("byClub"))}
        </span>
        <span className="text-[11.5px] text-ink-faint tabular-nums">
          {formatDateTime(message.createdAt, locale)}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-body text-ink-soft">{message.body}</p>
    </li>
  );
}
