"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/lib/i18n";
import type { Event } from "@/lib/types";
import { termineDict } from "../i18n";

/**
 * QR-Check-in (Trainer-Aktion): Platzhalter-Code als deterministisch
 * generiertes SVG-Muster (FNV-Hash des Termin-Schlüssels → PRNG) mit
 * Finder-Ecken wie bei einem echten QR — plus Erklärtext und Microcopy.
 * Reiner Mock: es wird nichts gescannt oder übertragen.
 */

const GRID = 25;

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 7×7-Finder-Muster (Rahmen + 3×3-Kern) an einer Ecke. */
function inFinder(x: number, y: number, ox: number, oy: number): boolean | undefined {
  const dx = x - ox;
  const dy = y - oy;
  if (dx < 0 || dx > 6 || dy < 0 || dy > 6) return undefined;
  const ring = dx === 0 || dx === 6 || dy === 0 || dy === 6;
  const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
  return ring || core;
}

function buildPath(seedKey: string): string {
  const random = mulberry32(fnv1a(seedKey));
  let path = "";
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const finder =
        inFinder(x, y, 0, 0) ?? inFinder(x, y, GRID - 7, 0) ?? inFinder(x, y, 0, GRID - 7);
      let filled: boolean;
      if (finder !== undefined) {
        filled = finder;
      } else if (y === 6 || x === 6) {
        filled = (x + y) % 2 === 0; // Timing-Linien
      } else {
        filled = random() < 0.46;
      }
      if (filled) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return path;
}

export function QrCheckinModal({
  open,
  onClose,
  event,
}: {
  open: boolean;
  onClose: () => void;
  event: Event;
}) {
  const t = useT(termineDict);
  const path = useMemo(() => buildPath(`${event.id}:${event.startsAt}`), [event]);
  const code = `RSM-CHK-${event.id.replace(/[^a-z0-9]/gi, "").toUpperCase()}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={event.title}
      title={t("qrTitle")}
      maxWidthClass="max-w-sm"
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("qrDone")}
        </Button>
      }
    >
      <div className="grid justify-items-center gap-4 text-center">
        <div className="rounded-lg border border-line bg-surface p-4 text-ink shadow-card">
          <svg
            viewBox={`0 0 ${GRID} ${GRID}`}
            role="img"
            aria-label={t("qrCodeLabel", { title: event.title })}
            shapeRendering="crispEdges"
            className="block h-44 w-44"
          >
            <path d={path} fill="currentColor" />
          </svg>
        </div>
        <span className="font-mono text-[13px] font-semibold tracking-[0.08em] text-ink-soft">
          {code}
        </span>
        <p className="text-[14px] leading-[21px] text-ink-soft">{t("qrBody")}</p>
        <p className="text-caption leading-[18px] text-ink-faint">{t("qrMicro")}</p>
      </div>
    </Modal>
  );
}
