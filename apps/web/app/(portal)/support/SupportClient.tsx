"use client";

import { useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { errorMessage } from "@/lib/data";
import { permissions } from "@/lib/data/permissions";
import { useData } from "@/lib/data/useData";
import { formatDateTime } from "@/lib/format";
import type { SupportTicket } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { supportDict } from "./i18n";
import { PRIORITY_KEY, PRIORITY_TONE, STATUS_KEY, STATUS_TONE } from "./labels";
import { NewTicketDialog } from "./NewTicketDialog";
import { TicketThread } from "./TicketThread";

/**
 * Support-Seite des VEREINS (Migration 0052): Anliegen aufmachen, eigene
 * Anliegen sehen, antworten. Die Betreiber-Oberfläche baut ein anderer Trupp.
 *
 * ### ZUGANG — und warum die Seite für die Demo-Persona gesperrt aussieht ###
 * Support ist dem VORSTAND vorbehalten (owner/admin/moderator), weil ein
 * Anliegen typischerweise Klartext-Probleme mit Namen von Mitgliedern enthält,
 * oft von Kindern. Durchgesetzt wird das serverseitig (RLS 0052 +
 * requireClubRoleDb in routes/support.ts) — permissions().isClubAdmin blendet
 * hier nur passend dazu aus, damit niemand in ein 403 läuft.
 *
 * Im MOCK-Modus (Default) ist die angemeldete Person Sandra Vogel, TRAINERIN —
 * die Seite zeigt dort also den Sperr-Zustand. Das ist kein Fehler der
 * Oberfläche, sondern genau das, was der Server einer Trainerin antwortet.
 * Zum Ausprobieren: NEXT_PUBLIC_DATA_SOURCE=api + Dev-Login als Vorstand.
 *
 * Liste und Verlauf teilen sich eine Seite (kein eigener Router-Pfad je
 * Ticket): der Verlauf ist eine Ansicht, kein Ziel — und ein Ticket-Link, den
 * man weitergibt, führt bei Kolleg:innen ohne Vorstandsrechte ohnehin ins 403.
 */
export function SupportClient() {
  const t = useT(supportDict);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const me = useData((repo) => repo.getCurrentUser());

  if (me.status === "loading") {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-9 w-56 rounded-lg" />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  if (me.status === "error") {
    return (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(me.error) || t("loadErrorBody")}
        action={<Button onClick={me.reload}>{t("retry")}</Button>}
      />
    );
  }

  if (!permissions(me.data).isClubAdmin) {
    return <EmptyState icon="lock" title={t("lockedTitle")} body={t("lockedBody")} />;
  }

  if (openTicketId !== null) {
    return <TicketThread ticketId={openTicketId} onBack={() => setOpenTicketId(null)} />;
  }

  return (
    <>
      <TicketList onOpen={setOpenTicketId} onCreate={() => setCreating(true)} />
      {creating && (
        <NewTicketDialog
          onClose={() => setCreating(false)}
          onCreated={(ticketId) => {
            setCreating(false);
            setOpenTicketId(ticketId);
          }}
        />
      )}
    </>
  );
}

function TicketList({
  onOpen,
  onCreate,
}: {
  onOpen: (ticketId: string) => void;
  onCreate: () => void;
}) {
  const t = useT(supportDict);
  const state = useData((repo) => repo.listSupportTickets());

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-4" aria-hidden="true">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    );
  } else if (state.status === "error") {
    body = (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error) || t("loadErrorBody")}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else if (state.data.length === 0) {
    body = (
      <EmptyState
        icon="sparkle"
        title={t("emptyTitle")}
        body={t("emptyBody")}
        action={<Button onClick={onCreate}>{t("emptyCta")}</Button>}
      />
    );
  } else {
    body = (
      <ul className="grid gap-3">
        {state.data.map((ticket) => (
          <li key={ticket.id}>
            <TicketRow ticket={ticket} onOpen={() => onOpen(ticket.id)} />
          </li>
        ))}
      </ul>
    );
  }

  const count = state.data?.length ?? 0;

  return (
    <div className="grid gap-5">
      <SectionHeader
        title={t("title")}
        sub={t("sub")}
        action={<Button onClick={onCreate}>{t("newTicket")}</Button>}
      />
      {count > 0 && (
        <p className="text-[13px] text-ink-soft">
          {count === 1 ? t("oneTicket") : t("ticketsCount", { n: count })}
        </p>
      )}
      {body}
    </div>
  );
}

function TicketRow({ ticket, onOpen }: { ticket: SupportTicket; onOpen: () => void }) {
  const t = useT(supportDict);
  const { locale } = useLocale();

  const activity =
    ticket.lastReplyAt !== undefined
      ? t("lastReply", { when: formatDateTime(ticket.lastReplyAt, locale) })
      : t("noReplyYet");

  return (
    // Die ganze Karte ist die Schaltfläche — ein <button> statt eines Links,
    // weil der Verlauf kein eigener Pfad ist (siehe Kopf).
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded-xl"
    >
      <Card className="transition-colors hover:border-brand/40">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[ticket.status]}>{t(STATUS_KEY[ticket.status])}</Badge>
            {/* Normale/niedrige Dringlichkeit ist der Regelfall — kein Lärm dafür. */}
            {(ticket.priority === "high" || ticket.priority === "urgent") && (
              <Badge tone={PRIORITY_TONE[ticket.priority]}>{t(PRIORITY_KEY[ticket.priority])}</Badge>
            )}
          </div>

          <h3 className="text-[15px] font-bold text-ink">{ticket.subject}</h3>

          <p className="text-[13px] text-ink-soft">
            {ticket.createdByName
              ? `${t("openedBy", { name: ticket.createdByName })} · ${activity}`
              : `${t("openedAt", { when: formatDateTime(ticket.createdAt, locale) })} · ${activity}`}
          </p>

          <p className="text-[13px] text-ink-soft">
            {ticket.messageCount === 1
              ? t("oneMessage")
              : t("messagesCount", { n: ticket.messageCount })}
          </p>

          {ticket.status === "waiting_on_club" && (
            <p className="text-[13px] font-bold text-warn">{t("waitingHint")}</p>
          )}
        </div>
      </Card>
    </button>
  );
}
