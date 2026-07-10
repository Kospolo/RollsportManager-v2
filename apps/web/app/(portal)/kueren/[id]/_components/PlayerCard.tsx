"use client";

import type { KeyboardEvent } from "react";
import type { Routine } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { formatDurationMs } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { kuerenDict } from "../../i18n";
import type { Playback } from "./usePlayback";
import { Waveform } from "./Waveform";
import { PauseIcon, Rewind5Icon, Forward5Icon, LoopIcon } from "./PlayerIcons";

/**
 * Trainings-Player (Signature-Komponente, DESIGN-SYSTEM §3.8):
 * Waveform + Transport + Countdown + A–B-Loop + Tempo mit Klartext-Folge.
 * Tastatur (nur bei Fokus im Player): Leertaste Start/Stopp · L Loop · ←/→ 5 s.
 */

const COUNTDOWN_OPTIONS = [0, 3, 5, 8] as const;
// Preset-Stufen laut DESIGN-SYSTEM („Tempo aus B“): 50/75/85/100 %.
const TEMPO_PRESETS = [50, 75, 85, 100] as const;
const SKIP_MS = 5_000;

export function PlayerCard({ routine, playback }: { routine: Routine; playback: Playback }) {
  const t = useT(kuerenDict);
  const { locale } = useLocale();
  const {
    posMs,
    playing,
    countdownLeft,
    countdownSetting,
    tempo,
    loopOn,
    loopA,
    loopB,
    durationMs,
    togglePlay,
    seek,
    skip,
    setTempoValue,
    toggleLoop,
    setLoopPointA,
    setLoopPointB,
    setCountdownSetting,
  } = playback;

  const isActive = playing || countdownLeft !== null;
  const total = formatDurationMs(durationMs);

  /* Klartext-Folge des Tempos — IMMER dynamisch berechnet. */
  const tempoNote =
    tempo === 100
      ? t("tempoNoteOriginal", { orig: total })
      : t("tempoNote", {
          tempo,
          slow: formatDurationMs(Math.round((durationMs * 100) / tempo)),
          orig: total,
        });
  const tempoFactor = `${new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(tempo / 100)}×`;

  /* Tastatur nur, wenn der Fokus im Player liegt (Events bubbeln hierher). */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const tag = target.tagName;
    const isFormControl = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (event.key === " ") {
      if (tag === "BUTTON" || tag === "A" || isFormControl) return; // native Aktivierung
      event.preventDefault();
      togglePlay();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (isFormControl) return; // Tempo-Slider behält seine Pfeile
      event.preventDefault();
      skip(event.key === "ArrowLeft" ? -SKIP_MS : SKIP_MS);
    } else if (event.key === "Home" || event.key === "End") {
      if (isFormControl) return;
      event.preventDefault();
      seek(event.key === "Home" ? 0 : durationMs);
    } else if (event.key === "l" || event.key === "L") {
      if (isFormControl) return;
      toggleLoop();
    }
  };

  return (
    <div onKeyDown={handleKeyDown}>
      <Card className="p-6 sm:p-7" padded={false}>
        {/* Kopf: Honig-Eyebrow + Loop-Chip + Demo-Hinweis */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow text-honey-deep">{t("playerEyebrow")}</span>
          {loopOn && (
            <Badge tone="honey">
              <LoopIcon className="ic h-[13px] w-[13px]" />
              {t("loopChip", {
                a: formatDurationMs(loopA, true),
                b: formatDurationMs(loopB, true),
              })}
            </Badge>
          )}
          <span className="ml-auto text-caption text-ink-faint">{t("demoHint")}</span>
        </div>

        <Waveform
          peaks={routine.waveformPeaks}
          durationMs={durationMs}
          posMs={posMs}
          loopA={loopA}
          loopB={loopB}
          loopOn={loopOn}
          countdownLeft={countdownLeft}
          onSeek={seek}
          label={t("waveLabel")}
          valueText={t("waveValueText", { pos: formatDurationMs(posMs), dur: total })}
        />

        {/* Zeitzeile: 0:00 · aktuelle Zeit groß · Gesamtlänge */}
        <div className="mt-3 flex items-baseline justify-between font-mono text-[12px] tabular-nums text-ink-faint">
          <span>0:00</span>
          <span className="text-[17px] font-bold text-ink">
            {countdownLeft !== null ? t("startingIn", { s: countdownLeft }) : formatDurationMs(posMs)}{" "}
            <span className="text-[12px] font-normal text-ink-faint">/ {total}</span>
          </span>
          <span>{total}</span>
        </div>

        {/* Transport: Countdown-Segment · ±5 s + Play · A–B-Loop */}
        <div className="mt-4 grid items-center gap-5 md:grid-cols-[1fr_auto_1fr]">
          <div className="grid justify-items-center gap-1.5 md:justify-items-start">
            <span className="eyebrow">{t("countdownEyebrow")}</span>
            <div
              role="group"
              aria-label={t("countdownGroupLabel")}
              className="inline-flex gap-0.5 rounded-full border border-line bg-sunken p-1"
            >
              {COUNTDOWN_OPTIONS.map((seconds) => {
                const active = countdownSetting === seconds;
                return (
                  <button
                    key={seconds}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCountdownSetting(seconds)}
                    className={`min-h-9 min-w-[46px] rounded-full px-2.5 text-[13px] font-bold tabular-nums transition-colors duration-150 ${
                      active ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {seconds === 0 ? t("countdownOff") : t("countdownSeconds", { s: seconds })}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label={t("skipBackLabel")}
              onClick={() => skip(-SKIP_MS)}
              className="grid h-12 w-12 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft transition-colors duration-150 hover:bg-sunken active:scale-[.96]"
            >
              <Rewind5Icon className="ic h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={isActive ? t("pauseLabel") : t("playLabel")}
              onClick={togglePlay}
              className="grid h-[68px] w-[68px] place-items-center rounded-full bg-brand text-brand-contrast shadow-pop transition-colors duration-150 hover:bg-brand-strong active:scale-[.96]"
            >
              {isActive ? (
                <PauseIcon className="ic h-[26px] w-[26px] fill-current stroke-none" />
              ) : (
                <Icon name="play" className="ic ml-[3px] h-[26px] w-[26px] fill-current stroke-none" />
              )}
            </button>
            <button
              type="button"
              aria-label={t("skipFwdLabel")}
              onClick={() => skip(SKIP_MS)}
              className="grid h-12 w-12 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft transition-colors duration-150 hover:bg-sunken active:scale-[.96]"
            >
              <Forward5Icon className="ic h-5 w-5" />
            </button>
          </div>

          <div className="grid justify-items-center gap-1.5 md:justify-items-end">
            <span className="eyebrow">{t("loopEyebrow")}</span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={setLoopPointA}
                aria-label={`${t("setLoopA")} (${formatDurationMs(loopA, true)})`}
                className="min-h-9 rounded-[10px] border border-line bg-sunken px-3 font-mono text-[12.5px] font-bold tabular-nums text-ink-soft transition-colors duration-150 hover:border-honey-deep hover:text-honey-deep"
              >
                A {formatDurationMs(loopA, true)}
              </button>
              <button
                type="button"
                onClick={setLoopPointB}
                aria-label={`${t("setLoopB")} (${formatDurationMs(loopB, true)})`}
                className="min-h-9 rounded-[10px] border border-line bg-sunken px-3 font-mono text-[12.5px] font-bold tabular-nums text-ink-soft transition-colors duration-150 hover:border-honey-deep hover:text-honey-deep"
              >
                B {formatDurationMs(loopB, true)}
              </button>
              <button
                type="button"
                aria-pressed={loopOn}
                aria-label={t("loopToggleLabel")}
                onClick={toggleLoop}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-extrabold transition-colors duration-150 ${
                  loopOn
                    ? "border-honey-deep/30 bg-honey-soft text-honey-deep"
                    : "border-line-strong bg-sunken text-ink-faint hover:text-ink-soft"
                }`}
              >
                <LoopIcon className="ic h-[15px] w-[15px]" />
                {loopOn ? t("loopOn") : t("loopOffWord")}
              </button>
            </div>
          </div>
        </div>

        {/* Tempo: Presets + Feinregler 0,5–2,0× — bidirektional synchron */}
        <div className="mt-5 flex flex-wrap items-center gap-x-3.5 gap-y-2.5 border-t border-line pt-4">
          <span className="eyebrow flex-none">{t("tempoEyebrow")}</span>
          <div role="group" aria-label={t("tempoGroupLabel")} className="inline-flex gap-1.5">
            {TEMPO_PRESETS.map((preset) => {
              const active = tempo === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTempoValue(preset)}
                  className={`min-h-9 rounded-full border px-3.5 text-[13.5px] font-bold tabular-nums transition-colors duration-150 ${
                    active
                      ? "border-brand bg-brand text-brand-contrast"
                      : "border-line-strong bg-surface text-ink-soft hover:bg-sunken"
                  }`}
                >
                  {preset} %
                </button>
              );
            })}
          </div>
          <input
            type="range"
            min={50}
            max={200}
            step={5}
            value={tempo}
            onChange={(event) => setTempoValue(Number(event.target.value))}
            aria-label={t("tempoSliderLabel", { tempo })}
            className="h-7 min-w-[140px] flex-1 accent-brand"
          />
          <span className="font-mono text-[12.5px] font-bold tabular-nums text-ink-soft">
            {tempoFactor}
          </span>
          <span className="w-full text-caption tabular-nums text-ink-faint sm:w-auto">
            {tempoNote}
          </span>
        </div>

        {/* Sichtbare Tastatur-Hinweise (DESIGN-SYSTEM §3.8) */}
        <p className="mt-4 text-center text-caption text-ink-faint">
          <kbd>{t("kbdSpace")}</kbd> {t("hintPlay")} · <kbd>L</kbd> {t("hintLoop")} ·{" "}
          <kbd>←</kbd>
          <kbd>→</kbd> {t("hintSeek")} <span className="text-ink-faint">({t("hintFocus")})</span>
        </p>
      </Card>
    </div>
  );
}
