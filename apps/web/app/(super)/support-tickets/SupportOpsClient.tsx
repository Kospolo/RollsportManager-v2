"use client";

import { useMemo, useState } from "react";
import { dataSource, errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import type { Id, SupportTicket, SupportTicketStatus } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { OperatorGate } from "../OperatorGate";
import { TicketThread } from "./TicketThread";
import {
  PRIORITY_KEY,
  PRIORITY_TONE,
  STATUS_KEY,
  STATUS_OPTIONS,
  STATUS_TONE,
  supportOpsDict,
} from "./i18n";

/**
 * SUPPORT — die Betreiber-Sicht über ALLE Vereine.
 *
 * Gebaut gegen Trupp Bs Endpunkte (Migration 0052), nicht nachgebaut:
 *   GET /platform/support/tickets  → data.listAllSupportTickets(clubId?)
 * Der Vereinsfilter geht bewusst an den SERVER (Query-Parameter), nicht an eine
 * clientseitige Liste: bei 200 Vereinen ist „alles holen und lokal wegwerfen“
 * kein Filter, sondern eine unnötige Kopie fremder Daten im Browser.
 *
 * Der Status-Filter läuft dagegen lokal — den kennt der Endpunkt nicht, und ein
 * Filter zu erfinden, den der Server nicht anbietet, wäre eine Attrappe. Was
 * lokal gefiltert wird, filtert sichtbar über die schon geladene Liste.
 */

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

type StatusFilter = "all" | SupportTicketStatus;

export function SupportOpsClient() {
  return (
    <OperatorGate>
      <SupportOps />
    </OperatorGate>
  );
}

function SupportOps() {
  const t = useT(supportOpsDict);
  const [openId, setOpenId] = useState<Id | null>(null);
  const [clubId, setClubId] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  // Der Vereinsfilter ist Teil der Abfrage → useData lädt neu, wenn er sich
  // ändert (deps). Deshalb steht er hier und nicht in der Tabelle.
  const state = useData(
    (repo) =>
      Promise.all([
        repo.listAllSupportTickets(clubId === "all" ? undefined : clubId),
        repo.platformListClubs(),
      ] as const),
    [clubId],
  );

  if (openId !== null) {
    return <TicketThread ticketId={openId} onBack={() => setOpenId(null)} />;
  }

  if (state.status === "loading") {
    return (
      <div className="grid gap-5" aria-busy="true">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={8} />
      </div>
    );
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

  const [tickets, clubs] = state.data;

  return (
    <div className="grid gap-6">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={t("sub")}
        action={dataSource === "mock" ? <Badge tone="warn">{t("demoNote")}</Badge> : undefined}
      />

      <StatsGrid tickets={tickets} />

      <Card>
        <CardHeader eyebrow={t("listEyebrow")} title={t("listTitle")} />
        <div
          role="group"
          aria-label={t("filterLabel")}
          className="mb-4 grid gap-3 sm:grid-cols-2"
        >
          <Select label={t("clubLabel")} value={clubId} onChange={(e) => setClubId(e.target.value)}>
            <option value="all">{t("clubAll")}</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            label={t("statusLabel")}
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="all">{t("statusAll")}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(STATUS_KEY[s])}
              </option>
            ))}
          </Select>
        </div>

        <TicketsTable
          tickets={tickets}
          status={status}
          onOpen={setOpenId}
          onClearFilter={() => {
            setClubId("all");
            setStatus("all");
          }}
          filterActive={clubId !== "all" || status !== "all"}
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Auszählung der geladenen Liste — keine Hochrechnung, keine Erfindung. */
function StatsGrid({ tickets }: { tickets: SupportTicket[] }) {
  const t = useT(supportOpsDict);
  const { locale } = useLocale();
  const n = (v: number) => formatCount(v, locale);
  const count = (s: SupportTicketStatus) => tickets.filter((x) => x.status === s).length;
  const urgent = tickets.filter((x) => x.priority === "urgent" && x.status !== "closed").length;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label={t("kpiOpen")}
        value={n(count("open"))}
        tone={count("open") > 0 ? "info" : "success"}
      />
      <KpiTile label={t("kpiInProgress")} value={n(count("in_progress"))} tone="brand" />
      <KpiTile label={t("kpiWaiting")} value={n(count("waiting_on_club"))} tone="warn" />
      <KpiTile label={t("kpiUrgent")} value={n(urgent)} tone={urgent > 0 ? "danger" : "success"} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TicketsTable({
  tickets,
  status,
  onOpen,
  onClearFilter,
  filterActive,
}: {
  tickets: SupportTicket[];
  status: StatusFilter;
  onOpen: (id: Id) => void;
  onClearFilter: () => void;
  filterActive: boolean;
}) {
  const t = useT(supportOpsDict);
  const { locale } = useLocale();

  const rows = useMemo(
    () => (status === "all" ? tickets : tickets.filter((x) => x.status === status)),
    [tickets, status],
  );

  const columns: Column<SupportTicket>[] = [
    {
      id: "subject",
      header: t("colSubject"),
      footer: t("ticketsCount", { n: rows.length }),
      cell: (x) => (
        <span className="grid min-w-0">
          <span className="truncate text-[14px] font-bold text-ink">{x.subject}</span>
          {x.createdByName ? (
            <span className="truncate text-[12px] text-ink-faint">{x.createdByName}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "club",
      header: t("colClub"),
      cell: (x) => <span className="text-[14px] text-ink-soft">{x.clubName ?? x.clubId}</span>,
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (x) => <Badge tone={STATUS_TONE[x.status]}>{t(STATUS_KEY[x.status])}</Badge>,
    },
    {
      id: "priority",
      header: t("colPriority"),
      cell: (x) => <Badge tone={PRIORITY_TONE[x.priority]}>{t(PRIORITY_KEY[x.priority])}</Badge>,
    },
    {
      id: "messages",
      header: t("colMessages"),
      mono: true,
      cell: (x) => String(x.messageCount),
    },
    {
      id: "lastReply",
      header: t("colLastReply"),
      cell: (x) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {formatDateTime(x.lastReplyAt ?? x.createdAt, locale)}
        </span>
      ),
    },
    {
      id: "action",
      header: "",
      align: "right",
      cell: (x) => (
        <span className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpen(x.id)}>
            {t("openTicket")}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(x) => x.id}
      caption={t("listCaption")}
      empty={
        filterActive ? (
          <EmptyState
            icon="search"
            title={t("noMatch")}
            body={t("noMatchBody")}
            action={<Button onClick={onClearFilter}>{t("clearFilter")}</Button>}
          />
        ) : (
          <EmptyState icon="mail" title={t("empty")} body={t("emptyBody")} />
        )
      }
    />
  );
}
