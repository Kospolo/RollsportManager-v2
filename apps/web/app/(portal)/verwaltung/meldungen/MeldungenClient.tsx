"use client";

import { useMemo, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { errorMessage, fullName, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { chatReportStatusLabels, type Id } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { meldungenDict } from "./i18n";
import { REPORT_STATUS_TONE } from "./derive";
import { ReportDetail } from "./ReportDetail";

/**
 * Meldungen-Verwaltung: die Warteschlange gemeldeter Chat-Verstösse. Sichtbar
 * NUR für den Vereinsvorstand (owner/admin/moderator) und den Betreiber — die
 * UI gatet zur Anzeige, die Wahrheit ist die RLS (GET /chat/reports antwortet
 * einem einfachen Mitglied mit 403). Klick öffnet die Meldung (ReportDetail):
 * Snapshot, Kontaktdaten, Status ändern, drucken, Nachricht an Melder/Gemeldete.
 */
export function MeldungenClient() {
  const t = useT(meldungenDict);
  const { locale } = useLocale();

  const me = useData((repo) => repo.getCurrentUser());
  const members = useData((repo) => repo.getMembers());
  const reports = useData((repo) => repo.listChatReports());

  const [selectedId, setSelectedId] = useState<Id | null>(null);

  const nameOf = useMemo(() => {
    const map = new Map<Id, string>();
    for (const m of members.data ?? []) map.set(m.id, fullName(m));
    return (id?: Id) => (id ? (map.get(id) ?? t("unknownMember")) : t("unknownMember"));
  }, [members.data, t]);

  const memberById = useMemo(() => {
    const map = new Map(members.data?.map((m) => [m.id, m] as const) ?? []);
    return (id?: Id) => (id ? map.get(id) : undefined);
  }, [members.data]);

  const perms = permissions(me.data ?? null);
  const mayView = perms.isClubAdmin || perms.isPlatformAdmin;

  const selected = useMemo(
    () => (reports.data ?? []).find((r) => r.id === selectedId) ?? null,
    [reports.data, selectedId],
  );

  let body: React.ReactNode;
  if (me.status === "loading" || reports.status === "loading") {
    body = (
      <div className="grid gap-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  } else if (!mayView) {
    body = (
      <EmptyState
        icon="lock"
        title={t("noAccessTitle")}
        body={t("noAccessBody")}
        ctaHref="/dashboard"
        ctaLabel={t("noAccessCta")}
      />
    );
  } else if (reports.status === "error") {
    body = (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(reports.error) || t("loadErrorBody")}
        action={<Button onClick={reports.reload}>{t("retry")}</Button>}
      />
    );
  } else if (reports.data.length === 0) {
    body = <EmptyState icon="shield" title={t("emptyTitle")} body={t("emptyBody")} />;
  } else {
    body = (
      <ul className="grid gap-2">
        {reports.data.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSelectedId(r.id)}
              aria-label={t("openDetail")}
              className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-colors duration-150 hover:border-line-strong hover:bg-sunken"
            >
              <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-danger-soft text-danger">
                <Icon name="shield" className="ic h-5 w-5" />
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="font-display text-[14.5px] font-bold tracking-[-0.01em] text-ink">
                    {t("cardTitle")}
                  </b>
                  <Badge tone={REPORT_STATUS_TONE[r.status]}>
                    {chatReportStatusLabels[r.status][locale]}
                  </Badge>
                </span>
                <span className="truncate text-[13px] text-ink-soft">
                  {t("reportedBy", { name: nameOf(r.reporterMemberId) })} ·{" "}
                  {t("against", { name: nameOf(r.reportedMemberId) })}
                </span>
                <span className="truncate text-[13px] text-ink-faint">{r.reason}</span>
              </span>
              <span className="flex flex-none flex-col items-end gap-1 pl-1">
                <time className="whitespace-nowrap text-[11px] text-ink-faint">
                  {formatDateTime(r.createdAt, locale)}
                </time>
                <Icon name="chevronRight" className="ic h-4 w-4 text-ink-faint" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <SectionHeader
        level={1}
        eyebrow={t("eyebrow")}
        title={t("title")}
        sub={t("sub")}
        action={
          mayView ? (
            <Button variant="ghost" size="sm" onClick={reports.reload}>
              {t("refresh")}
            </Button>
          ) : undefined
        }
      />
      {body}

      {selected && (
        <ReportDetail
          report={selected}
          memberById={memberById}
          nameOf={nameOf}
          onClose={() => setSelectedId(null)}
          onChanged={reports.reload}
        />
      )}
    </div>
  );
}
