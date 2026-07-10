"use client";

import { useMemo, type PointerEvent } from "react";

/**
 * Waveform aus statischen Peaks (Signature-Komponente, DESIGN-SYSTEM §3.8):
 * Honig = Musik — gespielter Teil `honey`, ungespielter `wave-off`,
 * Playhead in Tinte. Klickbar/ziehbar zum Springen; als Slider mit
 * Wertansage ausgezeichnet (Pfeiltasten behandelt der Player-Container).
 */

const VIEW_W = 1000;
const VIEW_H = 132;

export function Waveform({
  peaks,
  durationMs,
  posMs,
  loopA,
  loopB,
  loopOn,
  countdownLeft,
  onSeek,
  label,
  valueText,
}: {
  peaks: number[];
  durationMs: number;
  posMs: number;
  loopA: number;
  loopB: number;
  loopOn: boolean;
  /** Sekunden bis zum Start — rendert das visuelle 3-2-1 über der Waveform */
  countdownLeft: number | null;
  onSeek: (ms: number) => void;
  label: string;
  valueText: string;
}) {
  /* Geometrie ist statisch — nur die Füllfarbe wechselt mit der Position. */
  const bars = useMemo(() => {
    const gap = VIEW_W / peaks.length;
    const barW = gap * 0.62;
    return peaks.map((peak, i) => {
      const h = Math.max(0.09, Math.min(1, peak)) * (VIEW_H - 18);
      return {
        x: i * gap + (gap - barW) / 2,
        y: (VIEW_H - h) / 2,
        w: barW,
        h,
        rx: barW / 2,
      };
    });
  }, [peaks]);

  const frac = durationMs > 0 ? posMs / durationMs : 0;
  const playedUntil = Math.floor(peaks.length * frac);
  const loopLeft = (loopA / durationMs) * 100;
  const loopWidth = (Math.max(0, loopB - loopA) / durationMs) * 100;

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onSeek(ratio * durationMs);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationMs / 1000)}
      aria-valuenow={Math.round(posMs / 1000)}
      aria-valuetext={valueText}
      onPointerDown={(event) => {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* synthetische Events ohne aktiven Pointer — Seek geht trotzdem */
        }
        seekFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons & 1) seekFromPointer(event);
      }}
      className="relative mx-0.5 mt-4 h-[132px] cursor-pointer touch-none select-none rounded-sm"
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x.toFixed(2)}
            y={bar.y.toFixed(2)}
            width={bar.w.toFixed(2)}
            height={bar.h.toFixed(2)}
            rx={bar.rx.toFixed(2)}
            className={i <= playedUntil ? "fill-honey" : "fill-wave-off"}
            stroke="none"
          />
        ))}
      </svg>

      {/* A–B-Loop-Region: Honig-Tint mit beschrifteten Griffen */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-2 -top-2 rounded-[10px] border-x-[2.5px] border-honey-deep bg-honey/15 transition-opacity duration-150 ${
          loopOn ? "opacity-100" : "opacity-30"
        }`}
        style={{ left: `${loopLeft}%`, width: `${loopWidth}%` }}
      >
        <span className="absolute -top-[13px] left-0 -translate-x-1/2 rounded-[7px] bg-honey-deep px-2 py-px font-mono text-[10.5px] font-extrabold tracking-[.03em] text-surface">
          A
        </span>
        <span className="absolute -top-[13px] left-full -translate-x-1/2 rounded-[7px] bg-honey-deep px-2 py-px font-mono text-[10.5px] font-extrabold tracking-[.03em] text-surface">
          B
        </span>
      </div>

      {/* Playhead */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-2 -top-2 w-[2.5px] rounded-[2px] bg-ink"
        style={{ left: `${Math.min(100, frac * 100)}%` }}
      >
        <span className="absolute -top-[5px] left-1/2 h-[11px] w-[11px] -translate-x-1/2 rounded-full border-[2.5px] border-surface bg-ink" />
      </div>

      {/* Countdown 3-2-1 vor dem Start (visuell) */}
      {countdownLeft !== null && (
        <div aria-hidden="true" className="absolute inset-0 grid place-items-center">
          <span className="grid h-16 w-16 place-items-center rounded-full border border-line bg-surface/90 font-display text-[34px] font-extrabold tabular-nums text-honey-deep shadow-pop">
            {countdownLeft}
          </span>
        </div>
      )}
    </div>
  );
}
