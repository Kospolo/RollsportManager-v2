"use client";

import { useLocale, useT, type Dict } from "@/lib/i18n";
import { formatEUR, relativeDays } from "@/lib/format";
import {
  openInvoices,
  sumOpenCents,
  sumPaidCents,
  ledgerBalanceCents,
  memberById,
  fullName,
  routines,
} from "@/lib/mock";
import type { Invoice } from "@/lib/types";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, DunningBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Timeline } from "@/components/ui/Timeline";
import { Sparkline } from "@/components/ui/Sparkline";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ResponseBar } from "@/components/ui/ResponseBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Spec, SpecRow } from "./Spec";

const dict = {
  de: {
    kpis: "KpiTile",
    kpiOpen: "Offen gesamt",
    kpiOpenSub: "{n} Rechnungen",
    kpiPaid: "Eingegangen",
    kpiPaidSub: "aus bezahlten Rechnungen",
    kpiBalance: "Kassenbuch-Saldo",
    kpiBalanceSub: "fortlaufend aufsummiert",
    kpiScore: "RollArt Bestwert",
    kpiScoreSub: "Kür „{title}“",
    table: "DataTable (Seriositätszone)",
    tableCaption: "Offene Posten des RSV Neckarsulm",
    cardEyebrow: "Offene Posten",
    cardTitle: "Wer noch offen ist",
    colMember: "Mitglied",
    colInvoice: "Rechnung",
    colDue: "Fällig",
    colLevel: "Stufe",
    colAmount: "Betrag",
    since: "dabei seit {year}",
    shown: "{n} Posten",
    sumLabel: "Summe",
    microcopy: "Stufe 2+ wird nie automatisch versendet — Freigabe durch den Vorstand.",
    export: "Exportieren",
    timeline: "Timeline (Mahn-Automatik)",
    step1: "Freundliche Erinnerung",
    step2: "1. Mahnung",
    step3: "2. Mahnung",
    step4: "Übergabe-Vorschlag an den Vorstand",
    auto: "automatisch",
    autoPreview: "automatisch, mit Vorschau",
    manual: "nur mit manueller Freigabe",
    day7: "+7 Tage",
    day21: "+21 Tage",
    day35: "+35 Tage",
    day49: "+49 Tage",
    spark: "Sparkline (RollArt-Verlauf)",
    sparkLegend: "Wertung über die Saison — der Trend ist der motivierende Wert.",
    sparkLabel: "RollArt-Verlauf: {values} Punkte",
    sparkDelta: "{delta} seit Saisonstart",
    progress: "ProgressBar",
    progressText: "31 von 34 Umsätzen automatisch zugeordnet",
    response: "ResponseBar",
    responseNote: "Gestapelt: Zusagen / Absagen / offen — der Balken ist aria-hidden.",
    empty: "EmptyState",
    emptyTitle: "Noch keine Kür",
    emptyBody: "Lade die Kür-Musik hoch, um Zeitmarken und Tempo-Training zu nutzen.",
    emptyCta: "Musik hochladen",
    sectionHeader: "SectionHeader",
    shDemoEyebrow: "Verwaltung",
    shDemoTitle: "Beiträge & Finanzen",
    shDemoSub: "Stand: heute · Vereinskonto",
    shDemoAction: "Bericht öffnen",
  },
  en: {
    kpis: "KpiTile",
    kpiOpen: "Total open",
    kpiOpenSub: "{n} invoices",
    kpiPaid: "Received",
    kpiPaidSub: "from paid invoices",
    kpiBalance: "Cash book balance",
    kpiBalanceSub: "running total",
    kpiScore: "RollArt best score",
    kpiScoreSub: "Routine “{title}”",
    table: "DataTable (seriousness zone)",
    tableCaption: "Open items of RSV Neckarsulm",
    cardEyebrow: "Open items",
    cardTitle: "Who is still open",
    colMember: "Member",
    colInvoice: "Invoice",
    colDue: "Due",
    colLevel: "Stage",
    colAmount: "Amount",
    since: "member since {year}",
    shown: "{n} items",
    sumLabel: "Total",
    microcopy: "Stage 2+ is never sent automatically — board approval required.",
    export: "Export",
    timeline: "Timeline (dunning automation)",
    step1: "Friendly reminder",
    step2: "1st dunning",
    step3: "2nd dunning",
    step4: "Handover proposal to the board",
    auto: "automatic",
    autoPreview: "automatic, with preview",
    manual: "manual approval only",
    day7: "+7 days",
    day21: "+21 days",
    day35: "+35 days",
    day49: "+49 days",
    spark: "Sparkline (RollArt trend)",
    sparkLegend: "Scores across the season — the trend is the motivating value.",
    sparkLabel: "RollArt trend: {values} points",
    sparkDelta: "{delta} since season start",
    progress: "ProgressBar",
    progressText: "31 of 34 transactions matched automatically",
    response: "ResponseBar",
    responseNote: "Stacked: going / declined / open — the bar itself is aria-hidden.",
    empty: "EmptyState",
    emptyTitle: "No routine yet",
    emptyBody: "Upload the routine music to use time markers and tempo training.",
    emptyCta: "Upload music",
    sectionHeader: "SectionHeader",
    shDemoEyebrow: "Administration",
    shDemoTitle: "Fees & finances",
    shDemoSub: "As of today · club account",
    shDemoAction: "Open report",
  },
} satisfies Dict;

export function SectionsData() {
  const t = useT(dict);
  const { locale } = useLocale();
  const intlLocale = locale === "de" ? "de-DE" : "en-GB";

  const points = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const signedPoints = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "always",
  });

  // RollArt-Verlauf aus den Mock-Küren — nie hart codiert.
  const scored = routines.find((routine) => routine.scores.length >= 2) ?? routines[0];
  const totals = scored.scores.map((score) => score.total);
  const best = Math.max(...totals);
  const delta = totals[totals.length - 1] - totals[0];

  const columns: Column<Invoice>[] = [
    {
      id: "member",
      header: t("colMember"),
      footer: t("shown", { n: openInvoices.length }),
      cell: (invoice) => {
        const member = memberById(invoice.memberId);
        if (!member) return null;
        return (
          <span className="flex items-center gap-2.5">
            <Avatar
              personId={member.id}
              firstName={member.firstName}
              lastName={member.lastName}
              size="m"
            />
            <span className="grid min-w-0">
              <span className="truncate text-[14px] font-bold leading-tight text-ink">
                {fullName(member)}
              </span>
              <span className="text-[12px] text-ink-faint">
                {t("since", { year: new Date(member.joinedAt).getFullYear() })}
              </span>
            </span>
          </span>
        );
      },
    },
    {
      id: "invoice",
      header: t("colInvoice"),
      cell: (invoice) => (
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-[14px] font-semibold text-ink">{invoice.title}</span>
          <span className="font-mono text-[11.5px] text-ink-faint">{invoice.number}</span>
        </span>
      ),
    },
    {
      id: "due",
      header: t("colDue"),
      cell: (invoice) => (
        <span className="whitespace-nowrap text-ink-soft">{relativeDays(invoice.dueAt, locale)}</span>
      ),
    },
    {
      id: "level",
      header: t("colLevel"),
      cell: (invoice) => <DunningBadge level={invoice.dunningLevel} />,
    },
    {
      id: "amount",
      header: t("colAmount"),
      mono: true,
      footer: `${t("sumLabel")}: ${formatEUR(sumOpenCents, locale)}`,
      cell: (invoice) => formatEUR(invoice.amountCents, locale),
    },
  ];

  return (
    <div className="grid gap-5">
      <Spec title={t("kpis")} importPath='import { KpiTile } from "@/components/ui/KpiTile"'>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label={t("kpiOpen")}
            value={formatEUR(sumOpenCents, locale)}
            sub={t("kpiOpenSub", { n: openInvoices.length })}
          />
          <KpiTile
            label={t("kpiPaid")}
            value={formatEUR(sumPaidCents, locale)}
            sub={t("kpiPaidSub")}
            tone="success"
          />
          <KpiTile
            label={t("kpiBalance")}
            value={formatEUR(ledgerBalanceCents, locale)}
            sub={t("kpiBalanceSub")}
            tone="info"
          />
          <KpiTile
            label={t("kpiScore")}
            value={points.format(best)}
            sub={t("kpiScoreSub", { title: scored.title })}
            tone="brand"
            delta={{ text: signedPoints.format(delta), tone: delta >= 0 ? "success" : "danger" }}
          />
        </div>
      </Spec>

      <Spec
        title={t("table")}
        importPath='import { DataTable, type Column } from "@/components/ui/DataTable" · in Card mit CardHeader/CardFooter'
      >
        <Card padded={false} className="p-5 sm:p-6">
          <CardHeader
            eyebrow={t("cardEyebrow")}
            title={t("cardTitle")}
            action={
              <Button size="sm" variant="ghost" icon="download">
                {t("export")}
              </Button>
            }
          />
          <DataTable
            columns={columns}
            rows={openInvoices}
            rowKey={(invoice) => invoice.id}
            caption={t("tableCaption")}
          />
          <CardFooter>
            <span>{t("microcopy")}</span>
          </CardFooter>
        </Card>
      </Spec>

      <Spec title={t("timeline")} importPath='import { Timeline } from "@/components/ui/Timeline"'>
        <Timeline
          steps={[
            {
              id: "s1",
              day: t("day7"),
              title: t("step1"),
              chip: (
                <Badge tone="success" icon="zap">
                  {t("auto")}
                </Badge>
              ),
            },
            {
              id: "s2",
              day: t("day21"),
              title: t("step2"),
              chip: (
                <Badge tone="success" icon="zap">
                  {t("autoPreview")}
                </Badge>
              ),
            },
            {
              id: "s3",
              day: t("day35"),
              title: t("step3"),
              chip: (
                <Badge tone="warn" icon="lock">
                  {t("manual")}
                </Badge>
              ),
            },
            {
              id: "s4",
              day: t("day49"),
              title: t("step4"),
              chip: (
                <Badge tone="warn" icon="lock">
                  {t("manual")}
                </Badge>
              ),
            },
          ]}
        />
      </Spec>

      <div className="grid gap-5 lg:grid-cols-2">
        <Spec title={t("spark")} importPath='import { Sparkline } from "@/components/ui/Sparkline"'>
          <SpecRow label={t("sparkLegend")}>
            <Sparkline
              values={totals}
              width={140}
              height={40}
              label={t("sparkLabel", { values: totals.map((v) => points.format(v)).join(" → ") })}
            />
            <span className="font-mono text-mono-table text-ink tabular-nums">
              {totals.map((v) => points.format(v)).join(" → ")}
            </span>
            <Badge tone="success">{t("sparkDelta", { delta: signedPoints.format(delta) })}</Badge>
          </SpecRow>
        </Spec>

        <Spec title={t("progress")} importPath='import { ProgressBar } from "@/components/ui/ProgressBar"'>
          <div className="grid max-w-sm gap-2">
            <span className="text-[13px] font-semibold text-ink-soft">{t("progressText")}</span>
            <ProgressBar value={31} max={34} label={t("progressText")} />
          </div>
        </Spec>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Spec title={t("response")} importPath='import { ResponseBar } from "@/components/ui/ResponseBar"'>
          <ResponseBar yes={9} no={1} open={4} />
          <p className="text-caption text-ink-faint">{t("responseNote")}</p>
        </Spec>

        <Spec title={t("sectionHeader")} importPath='import { SectionHeader } from "@/components/ui/SectionHeader"'>
          <SectionHeader
            eyebrow={t("shDemoEyebrow")}
            title={t("shDemoTitle")}
            sub={t("shDemoSub")}
            action={
              <Button size="sm" variant="ghost" icon="finance">
                {t("shDemoAction")}
              </Button>
            }
          />
        </Spec>
      </div>

      <Spec title={t("empty")} importPath='import { EmptyState } from "@/components/ui/EmptyState"'>
        <EmptyState
          icon="routines"
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <Button variant="secondary" icon="plus">
              {t("emptyCta")}
            </Button>
          }
        />
      </Spec>
    </div>
  );
}
