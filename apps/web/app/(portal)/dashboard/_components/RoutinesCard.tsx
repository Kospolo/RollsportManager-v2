"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Sparkline } from "@/components/ui/Sparkline";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { formatDurationMs } from "@/lib/format";
import { memberById } from "@/lib/data";
import type { Member, Routine } from "@/lib/types";
import { dashboardDict, type DashboardKey } from "../i18n";
import { recentRoutines } from "../derive";

/**
 * Küren-Schnellzugriff: „Zuletzt geübt“ — Kachel-Grid mit Link zu
 * /kueren/[id]. Honig gehört der Musik (Kürzeiten in honey-deep),
 * der RollArt-Trend ist der motivierende Wert (Sparkline).
 */

const STATUS_TONE: Partial<Record<Routine["status"], BadgeTone>> = {
  competition: "brand",
  ready: "success",
  draft: "neutral",
};

const STATUS_KEY: Partial<Record<Routine["status"], DashboardKey>> = {
  competition: "statusCompetition",
  ready: "statusReady",
  draft: "statusDraft",
};

function skaterNames(
  routine: Routine,
  members: Member[],
): { first: Member | undefined; label: string } {
  const skaters = routine.memberIds
    .map((id) => memberById(members, id))
    .filter((m): m is Member => Boolean(m));
  const first = skaters[0];
  const label =
    skaters.length > 1
      ? skaters.map((m) => m.firstName).join(" & ")
      : first
        ? `${first.firstName} ${first.lastName}`
        : "";
  return { first, label };
}

export function RoutinesCard({
  routines,
  members,
}: {
  routines: Routine[];
  members: Member[];
}) {
  const t = useT(dashboardDict);
  const { locale } = useLocale();
  const recent = recentRoutines(routines, 3);

  const scoreFormat = new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Card>
      <CardHeader
        eyebrow={t("routinesEyebrow")}
        title={t("routinesTitle")}
        action={
          <ButtonLink variant="ghost" size="sm" href="/kueren">
            {t("routinesAll")}
          </ButtonLink>
        }
      />

      <div className="grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
        {recent.map((routine) => {
          const { first, label } = skaterNames(routine, members);
          const totals = routine.scores.map((s) => s.total);
          const latest = totals[totals.length - 1];
          const tone = STATUS_TONE[routine.status] ?? "neutral";
          const statusKey = STATUS_KEY[routine.status];

          return (
            <Link
              key={routine.id}
              href={`/kueren/${routine.id}`}
              className="group grid content-start gap-3 rounded-lg border border-line bg-canvas p-4 no-underline transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-card"
            >
              <span className="flex items-center gap-2.5">
                {first && (
                  <Avatar
                    personId={first.id}
                    firstName={first.firstName}
                    lastName={first.lastName}
                    size="s"
                  />
                )}
                <b className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{label}</b>
                {statusKey && (
                  <Badge tone={tone} className="flex-none">
                    {t(statusKey)}
                  </Badge>
                )}
              </span>

              <span className="grid gap-0.5">
                <h4 className="font-display text-[16px] font-extrabold tracking-[-0.01em] text-ink">
                  {routine.title}
                </h4>
                <span className="truncate text-caption text-ink-faint">{routine.category}</span>
              </span>

              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 flex-none place-items-center rounded-full bg-brand-soft text-brand-ink transition-colors duration-150 group-hover:bg-brand group-hover:text-brand-contrast"
                >
                  <Icon name="play" className="ic ml-0.5 h-4 w-4" />
                </span>
                <small className="min-w-0 text-[12.5px] leading-[1.45] text-ink-faint">
                  <span className="font-mono font-semibold text-honey-deep tabular-nums">
                    {formatDurationMs(routine.music.durationMs)}
                  </span>
                  {routine.music.bpm ? <> · {t("bpm", { n: routine.music.bpm })}</> : null}
                  <br />
                  {latest !== undefined
                    ? t("lastScore", { score: scoreFormat.format(latest) })
                    : t("markersCount", { n: routine.markers.length })}
                </small>
                {totals.length >= 2 && (
                  <Sparkline
                    values={totals}
                    width={60}
                    height={24}
                    className="ml-auto flex-none text-brand"
                    label={t("trendAria", { title: routine.title })}
                  />
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
