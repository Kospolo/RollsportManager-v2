"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiTile } from "@/components/ui/KpiTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { errorMessage, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { formatEUR, formatPercent } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n";
import type { ReportsSummary } from "@/lib/types";
import { auswertungDict, roleLabelKey } from "../i18n";
import { BarList, type BarDatum } from "./BarList";
import { MedalTally } from "./MedalTally";
import { UpcomingEventsCard } from "./UpcomingEventsCard";

/**
 * Auswertungs-Screen: lädt den aktuellen Nutzer (für die Sichtbarkeit) und —
 * sofern berechtigt — die Vereins-Kennzahlen über data.getReportsSummary().
 * Nur Trainerstab (is_club_trainer) und Vereinsleitung (is_club_admin) sehen
 * das Dashboard; alle anderen erhalten einen freundlichen Hinweis. Die
 * Sichtbarkeit ist kosmetisch — der Server scoped und schützt verbindlich
 * (requireClubRole + 403), ein 403 landet im Fehlerzweig.
 */
export function AuswertungScreen() {
  const t = useT(auswertungDict);
  const { locale } = useLocale();

  const me = useData((repo) => repo.getCurrentUser());
  const currentUser = me.status === "ready" ? me.data : null;
  const allowed = useMemo(() => {
    const perms = permissions(currentUser);
    return perms.isTrainer || perms.isClubAdmin;
  }, [currentUser]);

  const summary = useData(
    (repo) => (allowed ? repo.getReportsSummary() : Promise.resolve<ReportsSummary | null>(null)),
    [allowed],
  );

  const header = (
    <SectionHeader
      level={1}
      eyebrow={t("pageEyebrow")}
      title={t("pageTitle")}
      sub={t("pageSub")}
    />
  );

  // 1) Nutzer wird noch geladen → ruhiger Skeleton.
  if (me.status === "loading") {
    return (
      <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
        {header}
        <LoadingBody />
      </div>
    );
  }

  // 2) Nutzer konnte nicht geladen werden.
  if (me.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
        {header}
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(me.error)}
          action={
            <Button variant="secondary" onClick={me.reload}>
              {t("retry")}
            </Button>
          }
        />
      </div>
    );
  }

  // 3) Angemeldet, aber ohne Trainer-/Admin-Recht → freundlicher Hinweis.
  if (!allowed) {
    return (
      <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
        {header}
        <EmptyState icon="lock" title={t("noAccessTitle")} body={t("noAccessBody")} />
      </div>
    );
  }

  // 4) Berechtigt: Kennzahlen laden.
  if (summary.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
        {header}
        {isNotImplemented(summary.error) ? (
          <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
        ) : (
          <EmptyState
            icon="zap"
            title={t("loadErrorTitle")}
            body={errorMessage(summary.error)}
            action={
              <Button variant="secondary" onClick={summary.reload}>
                {t("retry")}
              </Button>
            }
          />
        )}
      </div>
    );
  }

  // Noch am Laden oder (nach dem Rechte-Flip) transient null → Skeleton.
  if (summary.status === "loading" || summary.data == null) {
    return (
      <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
        {header}
        <LoadingBody />
      </div>
    );
  }

  const s = summary.data;

  const rolesData: BarDatum[] = s.membersByRole.map((r) => ({
    key: r.role,
    label: t(roleLabelKey(r.role)),
    value: r.count,
  }));
  const teamsData: BarDatum[] = s.membersByTeam.map((tm) => ({
    key: tm.teamId,
    label: tm.teamName,
    value: tm.memberCount,
  }));

  const openSub =
    s.openInvoicesCount === 0
      ? t("kpiOpenSubNone")
      : s.openInvoicesCount === 1
        ? t("kpiOpenSubOne")
        : t("kpiOpenSubMany", { n: s.openInvoicesCount });
  const eventsSub =
    s.upcomingEvents.length === 0
      ? t("kpiEventsSubNone")
      : t("kpiEventsSub", { n: s.upcomingEvents.length });

  return (
    <div className="mx-auto grid w-full max-w-5xl content-start gap-8">
      {header}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          tone="brand"
          label={t("kpiMembers")}
          value={String(s.membersTotal)}
          sub={t("kpiMembersSub", { n: s.membersActive })}
        />
        <KpiTile
          tone="success"
          label={t("kpiAttendance")}
          value={formatPercent(s.attendanceRate, locale)}
          sub={t("kpiAttendanceSub")}
        />
        <KpiTile
          tone={s.openInvoicesCount > 0 ? "warn" : "success"}
          label={t("kpiOpen")}
          value={formatEUR(s.openInvoicesTotalCents, locale)}
          sub={openSub}
        />
        <KpiTile
          tone="info"
          label={t("kpiEvents")}
          value={String(s.upcomingEventsCount)}
          sub={eventsSub}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <BarList
          eyebrow={t("roleEyebrow")}
          title={t("roleTitle")}
          data={rolesData}
          tone="brand"
          unit={t("roleUnit")}
          emptyLabel={t("distEmpty")}
          ariaTemplate={t("barValueAria")}
        />
        <BarList
          eyebrow={t("teamEyebrow")}
          title={t("teamTitle")}
          data={teamsData}
          tone="info"
          unit={t("teamUnit")}
          emptyLabel={t("distEmpty")}
          ariaTemplate={t("barValueAria")}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <MedalTally medals={s.medals} />
        <UpcomingEventsCard events={s.upcomingEvents} total={s.upcomingEventsCount} />
      </section>
    </div>
  );
}

/** Gemeinsamer Lade-Platzhalter (KPI-Reihe + zwei Kartenpaare). */
function LoadingBody() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[104px] w-full rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}
