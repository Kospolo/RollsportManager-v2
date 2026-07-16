"use client";

import Link from "next/link";
import { dataSource, errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/lib/format";
import type {
  PlatformEntitlement,
  PlatformPayment,
  PlatformStats,
  PlatformSubscriptionSummary,
  SupportTicket,
} from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Icon, type IconName } from "@/components/shell/icons";
import { OperatorGate } from "../OperatorGate";
import { ViewClubButton } from "../ViewClubButton";
import { STATUS_LABEL_KEY, STATUS_TONE, TIER_LABEL_KEY, TIER_TONE } from "../lizenzen/derive";
import { lizenzenDict } from "../lizenzen/i18n";
import {
  PRIORITY_KEY,
  PRIORITY_TONE,
  STATUS_KEY as TICKET_STATUS_KEY,
  STATUS_TONE as TICKET_STATUS_TONE,
  supportOpsDict,
} from "../support-tickets/i18n";
import { daysUntil, expiringTrials, pastDueClubs, ticketsAwaitingOperator } from "./dashboard";
import { plattformDict } from "./i18n";

/**
 * DAS BETREIBER-DASHBOARD — die Startseite der Konsole.
 *
 * Es beantwortet EINE Frage: was muss Marcel heute tun? Deshalb stehen hier
 * Testphasen, die auslaufen, überfällige Zahlungen und Tickets, die auf ihn
 * warten — und nicht mehr das Verzeichnis aller Vereine und Nutzer (das ist
 * nach /vereine gezogen und beantwortet „wer ist da?“).
 *
 * ### Woher jede Zahl kommt — und was fehlt ###
 *   /platform/stats     → Vereine, Nutzer, Mitgliedschaften, Teams, Termine,
 *                         offene Rechnungen. Server-gerechnet.
 *   /platform/payments  → subscription_summary (aktiv/Testphase/überfällig/
 *                         gekündigt) — ebenfalls SERVER-gerechnet (SQL in
 *                         platform-billing.ts), nicht hier. Dazu die letzten
 *                         Ereignisse.
 *   /platform/entitlements → Testphasen und Überfällige. status und valid_until
 *                         stehen je Verein in der Antwort; ./dashboard.ts
 *                         filtert und sortiert sie, es rechnet nichts.
 *   /platform/support/tickets → offene Tickets (Trupp B, Migration 0052).
 *
 * UMSATZ: fehlt — und das Dashboard SAGT das (RevenueGapCard), statt eine Zahl
 * zu raten. Ausführliche Begründung in ./dashboard.ts.
 *
 * Das Sicht-Gate steckt in OperatorGate (eine Stelle für alle (super)-Seiten);
 * der Schutz bleibt serverseitig (requirePlatformAdmin).
 */

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

export function PlatformConsoleClient() {
  return (
    <OperatorGate>
      <Dashboard />
    </OperatorGate>
  );
}

/* ------------------------------------------------------------------ */

function Dashboard() {
  const t = useT(plattformDict);

  const state = useData((repo) =>
    Promise.all([
      repo.platformStats(),
      repo.platformListEntitlements(),
      repo.platformListPayments({ limit: 5 }),
      repo.listAllSupportTickets(),
    ] as const),
  );

  if (state.status === "loading") {
    return (
      <div className="grid gap-5" aria-busy="true">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={6} />
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

  const [stats, entitlements, payments, tickets] = state.data;

  return (
    <div className="grid gap-6">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={t("sub")}
        action={dataSource === "mock" ? <Badge tone="warn">{t("demoNote")}</Badge> : undefined}
      />

      <StatsGrid stats={stats} />
      <SubscriptionsCard summary={payments.subscriptionSummary} />
      <TrialsCard entitlements={entitlements} />
      <PastDueCard entitlements={entitlements} />
      <TicketsCard tickets={tickets} />
      <EventsCard events={payments.events} />
      <RevenueGapCard />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatsGrid({ stats }: { stats: PlatformStats }) {
  const t = useT(plattformDict);
  const { locale } = useLocale();
  const n = (value: number) => formatCount(value, locale);
  return (
    <section className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiTile label={t("kpiClubs")} value={n(stats.clubs)} tone="brand" />
        <KpiTile label={t("kpiUsers")} value={n(stats.users)} tone="info" />
        <KpiTile
          label={t("kpiMembers")}
          value={n(stats.members)}
          tone="neutral"
          sub={t("activeSub")}
          delta={{ text: n(stats.activeMembers), tone: "success" }}
        />
        <KpiTile label={t("kpiTeams")} value={n(stats.teams)} tone="info" />
        <KpiTile label={t("kpiEvents")} value={n(stats.events)} tone="neutral" />
        <KpiTile
          label={t("kpiOpenInvoices")}
          value={n(stats.openInvoices)}
          tone={stats.openInvoices > 0 ? "warn" : "success"}
        />
      </div>
      <CardLink href="/vereine" icon="teams" label={t("toClubs")} />
    </section>
  );
}

/* ------------------------------------------------------------------ */

/** Kleiner Fuß-Link unter einem Block — immer gleich, damit er auffindbar ist. */
function CardLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-9 w-fit items-center gap-1.5 text-[13.5px] font-bold text-brand-ink no-underline"
    >
      <Icon name={icon} className="ic h-4 w-4" />
      {label}
      <Icon name="chevronRight" className="ic h-3.5 w-3.5" />
    </Link>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Abo-Zustände. Diese fünf Zahlen kommen als subscription_summary FERTIG vom
 * Server (platform-billing.ts zählt sie in SQL) — hier wird nichts addiert.
 */
function SubscriptionsCard({ summary }: { summary: PlatformSubscriptionSummary }) {
  const t = useT(plattformDict);
  const { locale } = useLocale();
  const n = (v: number) => formatCount(v, locale);
  return (
    <Card>
      <CardHeader eyebrow={t("subsEyebrow")} title={t("subsTitle")} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile label={t("subsActive")} value={n(summary.active)} tone="success" />
        <KpiTile label={t("subsTrial")} value={n(summary.trial)} tone="info" />
        <KpiTile
          label={t("subsPastDue")}
          value={n(summary.pastDue)}
          tone={summary.pastDue > 0 ? "danger" : "success"}
        />
        <KpiTile label={t("subsCanceled")} value={n(summary.canceled)} tone="neutral" />
        <KpiTile label={t("subsLicensed")} value={n(summary.licensedClubs)} tone="brand" />
      </div>
      <div className="mt-4">
        <CardLink href="/lizenzen" icon="shield" label={t("toLicenses")} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function TrialsCard({ entitlements }: { entitlements: PlatformEntitlement[] }) {
  const t = useT(plattformDict);
  const tLic = useT(lizenzenDict);
  const { locale } = useLocale();
  const rows = expiringTrials(entitlements);

  const columns: Column<PlatformEntitlement>[] = [
    {
      id: "club",
      header: t("colClub"),
      cell: (r) => (
        <span className="grid min-w-0">
          <span className="truncate text-[14px] font-bold text-ink">{r.clubName}</span>
          {r.shortName ? (
            <span className="truncate text-[12px] text-ink-faint">{r.shortName}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "tier",
      header: t("colTier"),
      cell: (r) =>
        r.tier ? <Badge tone={TIER_TONE[r.tier]}>{tLic(TIER_LABEL_KEY[r.tier])}</Badge> : "—",
    },
    {
      id: "members",
      header: t("colMembers"),
      mono: true,
      cell: (r) => formatCount(r.memberCount, locale),
    },
    {
      id: "ends",
      header: t("colEnds"),
      cell: (r) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {r.validUntil ? formatDate(r.validUntil, locale) : "—"}
        </span>
      ),
    },
    {
      id: "days",
      header: t("colDays"),
      cell: (r) => {
        if (!r.validUntil) return "—";
        const d = daysUntil(r.validUntil);
        // Abgelaufen, aber immer noch „trial“: genau der Fall, den er sehen MUSS.
        if (d < 0) return <Badge tone="danger">{t("expired")}</Badge>;
        if (d === 0) return <Badge tone="warn">{t("today")}</Badge>;
        return <Badge tone={d <= 7 ? "warn" : "neutral"}>{String(d)}</Badge>;
      },
    },
    {
      id: "action",
      header: "",
      align: "right",
      cell: (r) => (
        <span className="flex justify-end">
          <ViewClubButton
            club={{
              id: r.clubId,
              name: r.clubName,
              ...(r.shortName ? { shortName: r.shortName } : {}),
            }}
          />
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader eyebrow={t("trialsEyebrow")} title={t("trialsTitle")} />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.clubId}
        caption={t("trialsCaption")}
        empty={<EmptyState icon="check" title={t("trialsEmpty")} body={t("trialsEmptyBody")} />}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function PastDueCard({ entitlements }: { entitlements: PlatformEntitlement[] }) {
  const t = useT(plattformDict);
  const tLic = useT(lizenzenDict);
  const { locale } = useLocale();
  const rows = pastDueClubs(entitlements);

  const columns: Column<PlatformEntitlement>[] = [
    {
      id: "club",
      header: t("colClub"),
      cell: (r) => <span className="truncate text-[14px] font-bold text-ink">{r.clubName}</span>,
    },
    {
      id: "tier",
      header: t("colTier"),
      cell: (r) =>
        r.tier ? <Badge tone={TIER_TONE[r.tier]}>{tLic(TIER_LABEL_KEY[r.tier])}</Badge> : "—",
    },
    {
      id: "status",
      header: "",
      cell: (r) =>
        r.status ? (
          <Badge tone={STATUS_TONE[r.status]}>{tLic(STATUS_LABEL_KEY[r.status])}</Badge>
        ) : null,
    },
    {
      id: "members",
      header: t("colMembers"),
      mono: true,
      cell: (r) => formatCount(r.memberCount, locale),
    },
    {
      id: "action",
      header: "",
      align: "right",
      cell: (r) => (
        <span className="flex justify-end">
          <ViewClubButton
            club={{
              id: r.clubId,
              name: r.clubName,
              ...(r.shortName ? { shortName: r.shortName } : {}),
            }}
          />
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader eyebrow={t("pastDueEyebrow")} title={t("pastDueTitle")} />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.clubId}
        caption={t("pastDueCaption")}
        empty={<EmptyState icon="check" title={t("pastDueEmpty")} body={t("pastDueEmptyBody")} />}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function TicketsCard({ tickets }: { tickets: SupportTicket[] }) {
  const t = useT(plattformDict);
  const tSup = useT(supportOpsDict);
  const { locale } = useLocale();
  const rows = ticketsAwaitingOperator(tickets).slice(0, 5);

  const columns: Column<SupportTicket>[] = [
    {
      id: "subject",
      header: t("colSubject"),
      cell: (x) => (
        <span className="grid min-w-0">
          <span className="truncate text-[14px] font-bold text-ink">{x.subject}</span>
          <span className="truncate text-[12px] text-ink-faint">{x.clubName ?? x.clubId}</span>
        </span>
      ),
    },
    {
      id: "status",
      header: "",
      cell: (x) => (
        <Badge tone={TICKET_STATUS_TONE[x.status]}>{tSup(TICKET_STATUS_KEY[x.status])}</Badge>
      ),
    },
    {
      id: "priority",
      header: t("colPriority"),
      cell: (x) => <Badge tone={PRIORITY_TONE[x.priority]}>{tSup(PRIORITY_KEY[x.priority])}</Badge>,
    },
    {
      id: "lastReply",
      header: t("colLastReply"),
      align: "right",
      cell: (x) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {formatDateTime(x.lastReplyAt ?? x.createdAt, locale)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader eyebrow={t("supportEyebrow")} title={t("supportTitle")} />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(x) => x.id}
        caption={t("supportCaption")}
        empty={<EmptyState icon="check" title={t("supportEmpty")} body={t("supportEmptyBody")} />}
      />
      <p className="mt-4 text-caption text-ink-faint">{t("supportNote")}</p>
      <div className="mt-3">
        <CardLink href="/support-tickets" icon="mail" label={t("toSupport")} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function EventsCard({ events }: { events: PlatformPayment[] }) {
  const t = useT(plattformDict);
  const { locale } = useLocale();

  const columns: Column<PlatformPayment>[] = [
    {
      id: "provider",
      header: t("colProvider"),
      cell: (e) => <Badge tone="neutral">{e.provider}</Badge>,
    },
    {
      id: "event",
      header: t("colEvent"),
      cell: (e) => (
        <span className="grid min-w-0">
          <span className="truncate text-[14px] text-ink">{e.eventType ?? e.eventId}</span>
          {e.error ? <span className="truncate text-[12px] text-danger">{e.error}</span> : null}
        </span>
      ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (e) => (
        <Badge
          tone={e.status === "failed" ? "danger" : e.status === "processed" ? "success" : "neutral"}
        >
          {e.status}
        </Badge>
      ),
    },
    {
      id: "received",
      header: t("colReceived"),
      align: "right",
      cell: (e) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {formatDateTime(e.receivedAt, locale)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader eyebrow={t("eventsEyebrow")} title={t("eventsTitle")} />
      <DataTable
        columns={columns}
        rows={events}
        rowKey={(e) => e.id}
        caption={t("eventsCaption")}
        empty={<EmptyState icon="bank" title={t("eventsEmpty")} body={t("eventsEmptyBody")} />}
      />
      <div className="mt-4">
        <CardLink href="/zahlungen" icon="bank" label={t("toPayments")} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Die Lücke, die AUF dem Dashboard steht statt in einer Fußnote.
 *
 * Der Auftrag verlangte „Umsatz“. Ihn zu raten wäre leicht gewesen und hätte
 * gut ausgesehen. Diese Karte ist die ehrliche Antwort — und sie sagt dem
 * Nutzer zugleich, was fehlt, damit er es beim Backend bestellen kann.
 */
function RevenueGapCard() {
  const t = useT(plattformDict);
  return (
    <Card>
      <CardHeader eyebrow={t("revenueEyebrow")} title={t("revenueTitle")} />
      <p className="-mt-1 max-w-prose text-body text-ink-soft">{t("revenueBody")}</p>
    </Card>
  );
}
