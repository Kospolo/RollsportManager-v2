"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { errorMessage, fullName, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { chatReportStatusLabels, type Id, type Member } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { meldungenDict } from "../../i18n";
import { ReportSnapshotView } from "../../ReportSnapshotView";

/**
 * Druckoptimierte Meldungsansicht. Isoliert sich beim Drucken vom Portal-Rahmen
 * über eine reine @media-print-Regel (alles unsichtbar, nur der Beleg sichtbar).
 * Farben im Beleg sind bewusst fest (weißer Grund, dunkle Schrift), damit der
 * Ausdruck unabhängig vom Theme stimmt. Es gibt keinen Einzel-GET; die (club-
 * gescopte, admin-gegatete) Liste liefert die Meldung — RLS bleibt die Wahrheit.
 */
export function ReportPrint({ id }: { id: string }) {
  const t = useT(meldungenDict);
  const { locale } = useLocale();

  const loaded = useData(async (repo) => {
    const [currentUser, reports, members] = await Promise.all([
      repo.getCurrentUser(),
      repo.listChatReports(),
      repo.getMembers(),
    ]);
    return { currentUser, reports, members };
  }, [id]);

  const nameOf = useMemo(() => {
    const map = new Map<Id, string>();
    for (const m of loaded.data?.members ?? []) map.set(m.id, fullName(m));
    return (mid?: Id) => (mid ? (map.get(mid) ?? t("unknownMember")) : t("unknownMember"));
  }, [loaded.data, t]);

  if (loaded.status === "loading") {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (loaded.status === "error") {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <EmptyState icon="zap" title={t("printNotFound")} body={errorMessage(loaded.error)} />
      </div>
    );
  }

  const { currentUser, reports, members } = loaded.data;
  const perms = permissions(currentUser);
  const report = reports.find((r) => r.id === id) ?? null;

  if (!perms.isClubAdmin && !perms.isPlatformAdmin) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <EmptyState icon="lock" title={t("noAccessTitle")} body={t("noAccessBody")} />
      </div>
    );
  }
  if (!report) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <EmptyState icon="zap" title={t("printNotFound")} body={t("emptyBody")} />
      </div>
    );
  }

  const memberById = (mid?: Id): Member | undefined =>
    mid ? members.find((m) => m.id === mid) : undefined;
  const reporter = memberById(report.reporterMemberId);
  const reported = memberById(report.reportedMemberId);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* Werkzeugleiste — nur am Bildschirm */}
      <div className="rsm-print-hide mx-auto mb-4 flex w-full max-w-3xl items-center justify-between gap-3 px-6 pt-6">
        <Link
          href="/verwaltung/meldungen"
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-soft no-underline hover:text-ink"
        >
          <Icon name="chevronRight" className="ic h-4 w-4 rotate-180" />
          {t("printBack")}
        </Link>
        <Button icon="download" onClick={() => window.print()}>
          {t("print")}
        </Button>
      </div>

      {/* Der Beleg */}
      <div id="rsm-report-print" className="rsm-report-doc">
        <header className="rsm-doc-head">
          <span className="rsm-eyebrow">{t("printEyebrow")}</span>
          <h1 className="rsm-title">{t("printTitle")}</h1>
          <div className="rsm-meta">
            <span>
              {t("printReportId")}: <span className="rsm-mono">{report.id}</span>
            </span>
            <span>
              {t("statusLabel")}: {chatReportStatusLabels[report.status][locale]}
            </span>
          </div>
        </header>

        <p className="rsm-note">{t("printBoardNote")}</p>

        <section className="rsm-parties">
          <PrintPerson
            label={t("reporterLabel")}
            name={nameOf(report.reporterMemberId)}
            member={reporter}
            ipLabel={t("ipLabel")}
            ip={report.reporterIp ?? t("ipUnknown")}
          />
          <PrintPerson
            label={t("reportedLabel")}
            name={report.reportedMemberId ? nameOf(report.reportedMemberId) : t("unknownMember")}
            member={reported}
          />
        </section>

        <dl className="rsm-facts">
          <PrintFact label={t("reportedAtLabel")} value={formatDateTime(report.createdAt, locale)} />
          {report.snapshot.capturedAt && (
            <PrintFact
              label={t("capturedAtLabel")}
              value={formatDateTime(report.snapshot.capturedAt, locale)}
            />
          )}
          {report.handledAt && (
            <PrintFact
              label={t("statusLabel")}
              value={t("handledLabel", {
                name: nameOf(report.handledByMemberId) || t("unknownMember"),
                date: formatDateTime(report.handledAt, locale),
              })}
            />
          )}
        </dl>

        <section>
          <h2 className="rsm-section-title">{t("reasonLabel")}</h2>
          <p className="rsm-reason">{report.reason}</p>
        </section>

        <section>
          <h2 className="rsm-section-title">{t("snapshotHeading")}</h2>
          <ReportSnapshotView
            snapshot={report.snapshot}
            reportedMessageId={report.messageId}
            nameOf={nameOf}
            plain
          />
        </section>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function PrintPerson({
  label,
  name,
  member,
  ipLabel,
  ip,
}: {
  label: string;
  name: string;
  member: Member | undefined;
  ipLabel?: string;
  ip?: string;
}) {
  const lines = [member?.email, member?.phone, member?.postalAddress].filter(
    (x): x is string => Boolean(x),
  );
  return (
    <div className="rsm-person">
      <span className="rsm-label">{label}</span>
      <span className="rsm-person-name">{name}</span>
      {lines.map((line) => (
        <span key={line} className="rsm-person-line">
          {line}
        </span>
      ))}
      {ipLabel && (
        <span className="rsm-person-line">
          {ipLabel}: <span className="rsm-mono">{ip}</span>
        </span>
      )}
    </div>
  );
}

function PrintFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rsm-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

// Beleg-eigenes CSS: feste Papierfarben + Druck-Isolation. Bewusst als globaler
// <style>-Block, damit die @media-print-Regel den gesamten Rahmen unsichtbar
// schalten kann, ohne die App-Shell zu verändern (wie InvoicePrint).
const PRINT_CSS = `
.rsm-report-doc {
  --ink: #1a1a1a; --muted: #555; --line: #d8d8d8; --flag: #b23;
  color: var(--ink);
  background: #fff;
  max-width: 190mm;
  margin: 0 auto 3rem;
  padding: 14mm 16mm;
  border: 1px solid var(--line);
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.5;
}
.rsm-doc-head { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1.5px solid var(--line); }
.rsm-eyebrow { display: block; text-transform: uppercase; letter-spacing: .06em; font-size: 9.5px; color: var(--muted); }
.rsm-title { font-size: 18px; font-weight: 700; margin: 4px 0 8px; }
.rsm-meta { display: flex; flex-wrap: wrap; gap: 16px; color: var(--muted); }
.rsm-mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
.rsm-note { margin: 12px 0 18px; padding: 8px 10px; border-left: 3px solid var(--flag); background: #faf1f1; color: #7a1f2b; font-size: 11px; }
.rsm-parties { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 16px; }
.rsm-person { display: grid; gap: 1px; min-width: 200px; }
.rsm-label { text-transform: uppercase; letter-spacing: .05em; font-size: 9.5px; color: var(--muted); }
.rsm-person-name { font-weight: 700; font-size: 13px; }
.rsm-person-line { color: var(--muted); }
.rsm-facts { display: grid; gap: 3px; margin: 0 0 18px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; }
.rsm-fact { display: flex; justify-content: space-between; gap: 16px; }
.rsm-fact dt { color: var(--muted); }
.rsm-fact dd { margin: 0; font-weight: 600; text-align: right; }
.rsm-section-title { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin: 18px 0 6px; }
.rsm-reason { white-space: pre-wrap; word-break: break-word; }
.rsm-snap { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.rsm-snap-row { border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; }
.rsm-snap-target { border-color: var(--flag); background: #faf1f1; }
.rsm-snap-head { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.rsm-snap-name { font-weight: 700; font-size: 12px; }
.rsm-snap-time { color: var(--muted); font-size: 11px; display: inline-flex; gap: 8px; align-items: baseline; }
.rsm-snap-flag { color: var(--flag); font-weight: 700; text-transform: uppercase; font-size: 9.5px; letter-spacing: .04em; }
.rsm-snap-body { margin: 3px 0 0; white-space: pre-wrap; word-break: break-word; }
.rsm-snap-empty { margin: 3px 0 0; font-style: italic; color: var(--muted); }
.rsm-snap-img { margin: 3px 0 0; font-weight: 600; color: var(--muted); }
@media print {
  body * { visibility: hidden !important; }
  #rsm-report-print, #rsm-report-print * { visibility: visible !important; }
  #rsm-report-print { position: absolute; inset: 0; margin: 0; border: 0; border-radius: 0; padding: 0; max-width: none; }
  .rsm-print-hide { display: none !important; }
  @page { size: A4; margin: 16mm; }
}
`;
