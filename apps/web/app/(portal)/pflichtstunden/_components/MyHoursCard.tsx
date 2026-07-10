"use client";

import { useT, useLocale } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { pflichtstundenDict, SOLL_LEVEL_KEY } from "../i18n";
import { formatHours, type DutyProgress } from "../logic";

/**
 * „Meine Stunden": Soll (aus der Pflichtstunden-Kaskade) gegen Ist (Summe der
 * eigenen Einträge) als Fortschrittsbalken plus Rest. Ohne aktive Regel zeigt
 * die Karte einen Hinweis statt eines leeren Balkens — geleistete Stunden
 * werden trotzdem beziffert.
 */
export function MyHoursCard({ progress }: { progress: DutyProgress }) {
  const t = useT(pflichtstundenDict);
  const { locale } = useLocale();

  const { soll, ist, istApproved, pending, rest, fulfilled, level, seasonLabel } = progress;

  const levelText =
    level === "none"
      ? undefined
      : [t(SOLL_LEVEL_KEY[level]), seasonLabel].filter(Boolean).join(" · ");

  const pendingText =
    pending > 0
      ? t(pending === 1 ? "pendingNote" : "pendingNotePlural", { n: pending })
      : undefined;

  return (
    <section className="grid gap-4">
      <SectionHeader level={2} title={t("mineTitle")} sub={t("mineSub")} />

      {soll <= 0 ? (
        <div className="grid gap-3 rounded-xl border border-line bg-surface p-5 shadow-card sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="grid gap-1">
            <span className="font-display text-h3 tracking-[-0.01em] text-ink">
              {t("sollNoneTitle")}
            </span>
            <p className="max-w-md text-caption text-ink-soft">{t("sollNoneBody")}</p>
          </div>
          <div className="grid gap-0.5 sm:text-right">
            <span className="eyebrow">{t("kpiIst")}</span>
            <span className="font-display text-[24px] font-extrabold leading-7 tracking-[-0.015em] text-ink tabular-nums">
              {formatHours(ist, locale)}
            </span>
            {pendingText && <span className="text-caption text-ink-faint">{pendingText}</span>}
          </div>
        </div>
      ) : (
        <>
          <ul className="grid list-none gap-3 sm:grid-cols-3">
            <li>
              <KpiTile
                label={t("kpiSoll")}
                value={formatHours(soll, locale)}
                sub={levelText}
                tone="neutral"
              />
            </li>
            <li>
              <KpiTile
                label={t("kpiIst")}
                value={formatHours(ist, locale)}
                sub={
                  istApproved < ist
                    ? t("istApprovedNote", { hours: formatHours(istApproved, locale) })
                    : undefined
                }
                tone="info"
              />
            </li>
            <li>
              <KpiTile
                label={t("kpiRest")}
                value={formatHours(rest, locale)}
                sub={pendingText}
                tone={fulfilled ? "success" : "warn"}
              />
            </li>
          </ul>

          <div className="grid gap-2 rounded-xl border border-line bg-surface p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-caption font-semibold text-ink-soft tabular-nums">
                {t("progressLabel", {
                  done: formatHours(ist, locale),
                  target: formatHours(soll, locale),
                })}
              </span>
              <Badge tone={fulfilled ? "success" : "neutral"}>
                {fulfilled ? t("fulfilledBadge") : t("openBadge")}
              </Badge>
            </div>
            <ProgressBar
              value={ist}
              max={soll}
              tone={fulfilled ? "success" : "brand"}
              label={t("progressLabel", {
                done: formatHours(ist, locale),
                target: formatHours(soll, locale),
              })}
            />
          </div>
        </>
      )}
    </section>
  );
}
