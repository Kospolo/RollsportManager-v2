"use client";

import { useLocale, useT } from "@/lib/i18n";
import { dayDiff, formatDurationMs, formatEUR, formatTime, relativeDays } from "@/lib/format";
import { events, members, openInvoices, routines, sumOpenCents } from "@/lib/mock";
import type { Event } from "@/lib/types";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { ResponseBar } from "@/components/ui/ResponseBar";
import { Icon } from "@/components/shell/icons";
import { landingDict } from "./i18n";

/**
 * Stilisierte „Screenshot“-Karte im Hero: ein verdichteter Dashboard-
 * Ausschnitt mit echten Mock-Zahlen (Countdown, nächstes Training,
 * offene Posten) plus schwebender Kür-Karte (Honig = Musik-Kontext).
 */

function rsvpCounts(event: Event) {
  const roster = members.filter(
    (m) => m.role === "member" && m.teamIds.some((teamId) => event.teamIds.includes(teamId)),
  );
  const yes = event.rsvps.filter((r) => r.status === "going").length;
  const no = event.rsvps.filter((r) => r.status === "declined").length;
  return { yes, no, open: Math.max(roster.length - yes - no, 0) };
}

/** Kompakte Honig-Waveform (rein dekorativ — Text daneben trägt die Info). */
function MiniWave({ peaks }: { peaks: number[] }) {
  const bars = peaks.filter((_, i) => i % 3 === 0);
  const width = bars.length * 6;
  return (
    <svg viewBox={`0 0 ${width} 34`} className="h-[30px] w-full" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((p, i) => {
        const h = Math.max(3, p * 32);
        return (
          <rect
            key={i}
            x={i * 6 + 1}
            y={(34 - h) / 2}
            width={4}
            height={h}
            rx={2}
            className={i / bars.length < 0.55 ? "fill-honey" : "fill-wave-off"}
          />
        );
      })}
    </svg>
  );
}

export function HeroPreview() {
  const t = useT(landingDict);
  const { locale } = useLocale();

  const competition = events.find((e) => e.type === "competition");
  const nextTraining = events
    .filter((e) => e.type === "training" && e.rsvps.length > 0 && dayDiff(e.startsAt) >= 0)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const routine = routines[0];

  const counts = nextTraining ? rsvpCounts(nextTraining) : { yes: 0, no: 0, open: 0 };
  const going = nextTraining
    ? nextTraining.rsvps
        .filter((r) => r.status === "going")
        .map((r) => members.find((m) => m.id === r.memberId))
        .filter((m): m is (typeof members)[number] => Boolean(m))
        .map((m) => ({ personId: m.id, firstName: m.firstName, lastName: m.lastName }))
    : [];

  return (
    <div className="relative mx-auto w-full max-w-[430px] lg:mx-0">
      {/* warmer Schein hinter der Karte — statisch, kein Dauer-Effekt */}
      <div
        aria-hidden="true"
        className="absolute -inset-6 -z-10 rounded-[40px] bg-brand-soft/60 blur-2xl"
      />

      <div className="rounded-xl border border-line bg-surface p-5 shadow-pop">
        {/* Fenster-Kopf */}
        <div className="mb-4 flex items-center gap-2 border-b border-line pb-3.5">
          <span
            className="grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-gradient-to-br from-brand to-brand-strong font-display text-[11px] font-extrabold text-brand-contrast"
            aria-hidden="true"
          >
            R
          </span>
          <span className="truncate text-[12.5px] font-bold text-ink-soft">{t("previewClub")}</span>
          <span className="ml-auto flex gap-1.5" aria-hidden="true">
            <span className="h-2 w-2 rounded-full bg-line-strong" />
            <span className="h-2 w-2 rounded-full bg-line-strong" />
            <span className="h-2 w-2 rounded-full bg-line-strong" />
          </span>
        </div>

        {/* Countdown-Kachel (Heimspiel-Tonalität: brand-soft, Display-Zahl) */}
        {competition && (
          <div className="rounded-lg bg-brand-soft p-4">
            <span className="eyebrow !text-brand-ink">{t("previewCountdown")}</span>
            <div className="mt-1 font-display text-[30px] font-extrabold leading-9 tracking-tight text-brand-ink tabular-nums">
              {t("previewDays", { n: dayDiff(competition.startsAt) })}
            </div>
            <p className="mt-1 text-[13px] font-semibold text-ink">
              {competition.title}
              <span className="block font-normal text-ink-soft">
                {relativeDays(competition.startsAt, locale)} · {competition.location}
              </span>
            </p>
          </div>
        )}

        {/* Nächstes Training mit echten Antworten */}
        {nextTraining && (
          <div className="mt-3.5 rounded-lg border border-line bg-canvas p-4">
            <span className="eyebrow">{t("previewNextTraining")}</span>
            <p className="mt-1 text-[14px] font-bold text-ink">{nextTraining.title}</p>
            <p className="text-caption text-ink-faint">
              {relativeDays(nextTraining.startsAt, locale)} · {formatTime(nextTraining.startsAt, locale)}
            </p>
            <div className="mt-2.5 flex flex-wrap items-end justify-between gap-3">
              <ResponseBar yes={counts.yes} no={counts.no} open={counts.open} className="min-w-0 flex-1" />
              <AvatarStack people={going} max={4} size="s" />
            </div>
          </div>
        )}

        {/* Offene Posten — Seriositätszone: Mono, tabular, echtes − via formatEUR */}
        <div className="mt-3.5 flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas p-4">
          <div>
            <span className="eyebrow">{t("previewOpen")}</span>
            <p className="mt-0.5 text-caption text-ink-faint">
              {t("previewOpenSub", { n: openInvoices.length })}
            </p>
          </div>
          <span className="font-mono text-[19px] font-bold text-ink tabular-nums">
            {formatEUR(sumOpenCents, locale)}
          </span>
        </div>
      </div>

      {/* Schwebende Kür-Karte — Honig ausschließlich im Musik-Kontext */}
      <div className="relative z-10 -mt-5 ml-4 mr-auto flex w-[min(86%,340px)] items-center gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-pop sm:-ml-6">
        <span
          className="grid h-10 w-10 flex-none place-items-center rounded-full bg-brand-soft text-brand-ink"
          aria-hidden="true"
        >
          <Icon name="play" className="ic ml-0.5 h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="eyebrow">{t("previewRoutine")}</span>
          <MiniWave peaks={routine.waveformPeaks} />
        </div>
        <span className="flex-none text-right text-caption font-semibold text-ink-soft">
          {routine.title}
          <span className="block font-mono text-[12px] text-honey-deep tabular-nums">
            {formatDurationMs(routine.music.durationMs)}
          </span>
        </span>
      </div>
    </div>
  );
}
