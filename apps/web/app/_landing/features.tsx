"use client";

import type { ReactNode } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { formatDurationMs, formatEUR, formatTime, relativeDays } from "@/lib/format";
import { dunningPipeline, events, memberById, members, routines } from "@/lib/mock";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, DunningBadge } from "@/components/ui/Badge";
import { ResponseBar } from "@/components/ui/ResponseBar";
import { Icon } from "@/components/shell/icons";
import { landingDict } from "./i18n";

/**
 * Drei Feature-Blöcke der Landingpage — Küren-Studio als USP zuerst.
 * Jeder Block: Text (Eyebrow → H2 → Punkte) + visuelle Produkt-Karte
 * mit echten Mock-Daten. Honig NUR im Musik-Block.
 */

const LOOP_START = 0.24;
const LOOP_END = 0.47;

function FeatureRow({
  eyebrow,
  title,
  body,
  points,
  visual,
  flip = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={flip ? "lg:order-2" : undefined}>
        <span className="eyebrow text-brand-ink">{eyebrow}</span>
        <h2 className="mt-2 font-display text-[24px] font-extrabold leading-8 tracking-tight text-ink sm:text-[27px] sm:leading-9">
          {title}
        </h2>
        <p className="mt-3 max-w-prose text-body leading-[24px] text-ink-soft">{body}</p>
        <ul className="mt-5 grid gap-3">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-2.5 text-body text-ink">
              <span
                className="mt-0.5 grid h-[21px] w-[21px] flex-none place-items-center rounded-full bg-success-soft text-success"
                aria-hidden="true"
              >
                <Icon name="check" className="ic h-3 w-3 [stroke-width:2.6]" />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? "lg:order-1" : undefined}>{visual}</div>
    </div>
  );
}

/** Kür-Waveform mit A–B-Loop-Region — kondensierte Fassung des Studios. */
function RoutineStudioVisual() {
  const t = useT(landingDict);
  const routine = routines[0];
  const playedRatio = 0.31;
  const barWidth = 1000 / routine.waveformPeaks.length;

  const loopedMarkers = routine.markers.filter((m) => {
    const pos = m.timeMs / routine.music.durationMs;
    return pos >= LOOP_START && pos <= LOOP_END;
  });

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span
          className="grid h-11 w-11 flex-none place-items-center rounded-full bg-brand text-brand-contrast"
          aria-hidden="true"
        >
          <Icon name="play" className="ic ml-0.5 h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <b className="block truncate font-display text-[16px] font-extrabold tracking-tight text-ink">
            {routine.title}
          </b>
          <span className="block truncate text-caption text-ink-faint">
            {routine.music.artist} ·{" "}
            <span className="font-mono tabular-nums">{formatDurationMs(routine.music.durationMs)}</span>
          </span>
        </div>
        <Badge tone="honey" className="ml-auto">
          {routine.category}
        </Badge>
      </div>

      {/* Waveform (dekorativ — Label liefert die Bildbeschreibung) */}
      <div
        role="img"
        aria-label={t("f1WaveLabel", { title: routine.title })}
        className="relative mx-1 mt-6 h-[92px]"
      >
        <svg viewBox="0 0 1000 92" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
          {routine.waveformPeaks.map((peak, i) => {
            const h = Math.max(5, peak * 88);
            return (
              <rect
                key={i}
                x={i * barWidth + 1}
                y={(92 - h) / 2}
                width={barWidth - 2}
                height={h}
                rx={2}
                className={i / routine.waveformPeaks.length < playedRatio ? "fill-honey" : "fill-wave-off"}
              />
            );
          })}
        </svg>
        {/* A–B-Loop-Region mit beschrifteten Griffen */}
        <div
          aria-hidden="true"
          className="absolute -inset-y-1.5 rounded-[10px] border-x-[2.5px] border-honey-deep bg-honey/15"
          style={{ left: `${LOOP_START * 100}%`, width: `${(LOOP_END - LOOP_START) * 100}%` }}
        >
          <span className="absolute -top-3 left-0 -translate-x-1/2 rounded-[7px] bg-honey-deep px-2 py-px font-mono text-[10.5px] font-bold text-surface">
            A {formatDurationMs(routine.music.durationMs * LOOP_START, true)}
          </span>
          <span className="absolute -top-3 right-0 translate-x-1/2 rounded-[7px] bg-honey-deep px-2 py-px font-mono text-[10.5px] font-bold text-surface">
            B {formatDurationMs(routine.music.durationMs * LOOP_END, true)}
          </span>
        </div>
        {/* Playhead */}
        <div
          aria-hidden="true"
          className="absolute -inset-y-1.5 w-[2.5px] rounded-full bg-ink"
          style={{ left: `${playedRatio * 100}%` }}
        />
      </div>

      {/* Zeitmarken mit RollArt-Kürzeln */}
      <ul className="mt-5 grid gap-1">
        {routine.markers.slice(0, 3).map((marker) => {
          const inLoop = loopedMarkers.includes(marker);
          return (
            <li key={marker.id} className="flex min-h-9 items-center gap-2.5 text-[13px] text-ink">
              <span className="w-11 flex-none font-mono text-[12px] font-bold text-honey-deep tabular-nums">
                {formatDurationMs(marker.timeMs)}
              </span>
              <span className="truncate font-semibold">{marker.label}</span>
              {marker.elementCode && (
                <span className="rounded-sm bg-sunken px-1.5 py-px font-mono text-[11px] font-bold text-ink-soft">
                  {marker.elementCode}
                </span>
              )}
              {inLoop && (
                <Badge tone="honey" className="ml-auto">
                  {t("f1InLoop")}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Termin-Karte mit echten Antworten + Absage-Blase (Signatur „Menschen zuerst“). */
function AttendanceVisual() {
  const t = useT(landingDict);
  const { locale } = useLocale();
  const event = events.find((e) => e.id === "e-07") ?? events[6];
  const roster = members.filter(
    (m) => m.role === "member" && m.teamIds.some((teamId) => event.teamIds.includes(teamId)),
  );
  const yes = event.rsvps.filter((r) => r.status === "going").length;
  const no = event.rsvps.filter((r) => r.status === "declined").length;
  const open = Math.max(roster.length - yes - no, 0);
  const decline = event.rsvps.find((r) => r.status === "declined" && r.comment);
  const declineMember = decline ? memberById(decline.memberId) : undefined;

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="eyebrow">{t("previewNextTraining")}</span>
          <b className="mt-1 block font-display text-[16px] font-extrabold tracking-tight text-ink">
            {event.title}
          </b>
          <span className="block text-caption text-ink-faint">
            {relativeDays(event.startsAt, locale)} · {formatTime(event.startsAt, locale)} · {event.location}
          </span>
        </div>
      </div>

      <ResponseBar yes={yes} no={no} open={open} className="mt-4" />

      {decline && declineMember && (
        <figure className="mt-4 flex items-start gap-3">
          <Avatar
            personId={declineMember.id}
            firstName={declineMember.firstName}
            lastName={declineMember.lastName}
            size="m"
          />
          <blockquote className="rounded-md rounded-tl-[4px] bg-sunken px-3.5 py-2.5 text-[13px] leading-[19px] text-ink">
            „{decline.comment}“
            <figcaption className="mt-0.5 text-caption font-semibold text-ink-faint">
              {declineMember.firstName} {declineMember.lastName}
            </figcaption>
          </blockquote>
        </figure>
      )}
    </div>
  );
}

/** Mahnstufen-Treppe mit konsistenten Summen aus der Mock-Pipeline. */
function DunningVisual() {
  const t = useT(landingDict);
  const { locale } = useLocale();
  const edge = ["border-l-line-strong", "border-l-info", "border-l-warn", "border-l-danger"] as const;

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {dunningPipeline.map((stage) => (
          <div
            key={stage.level}
            className={`rounded-lg border border-line bg-canvas p-3.5 pl-4 border-l-4 ${edge[stage.level]}`}
          >
            <DunningBadge level={stage.level} />
            <div className="mt-2.5 flex items-baseline justify-between gap-2">
              <span className="text-caption font-semibold text-ink-soft">
                {t("f3InvoicesWord", { n: stage.count })}
              </span>
              <span className="text-right font-mono text-mono-table text-ink tabular-nums">
                {formatEUR(stage.sumCents, locale)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-2 border-t border-line pt-3.5 text-caption text-ink-faint">
        <Icon name="lock" className="ic mt-px h-[14px] w-[14px] flex-none" />
        {t("f3Microcopy")}
      </p>
    </div>
  );
}

export function FeatureSections() {
  const t = useT(landingDict);
  const routine = routines[0];
  const normal = formatDurationMs(routine.music.durationMs);
  const slowed = formatDurationMs(routine.music.durationMs / 0.85);

  return (
    <section id="funktionen" className="scroll-mt-24">
      <div className="mx-auto grid max-w-6xl gap-16 px-4 py-16 sm:px-6 lg:gap-24 lg:py-24">
        <FeatureRow
          eyebrow={t("f1Eyebrow")}
          title={t("f1Title")}
          body={t("f1Body")}
          points={[
            t("f1Point1"),
            t("f1Point2", { title: routine.title, slowed, normal }),
            t("f1Point3"),
          ]}
          visual={<RoutineStudioVisual />}
        />
        <FeatureRow
          flip
          eyebrow={t("f2Eyebrow")}
          title={t("f2Title")}
          body={t("f2Body")}
          points={[t("f2Point1"), t("f2Point2"), t("f2Point3")]}
          visual={<AttendanceVisual />}
        />
        <FeatureRow
          eyebrow={t("f3Eyebrow")}
          title={t("f3Title")}
          body={t("f3Body")}
          points={[t("f3Point1"), t("f3Point2"), t("f3Point3")]}
          visual={<DunningVisual />}
        />
      </div>
    </section>
  );
}
