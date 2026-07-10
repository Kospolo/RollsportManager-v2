import type { Checkin, Event, Member } from "@/lib/types";

/**
 * Fachlogik des Check-in-Moduls (QR-Ersatz im Web) — reine Funktionen ohne
 * React, damit sie testbar bleiben und i18n.ts/Screens schlank bleiben.
 *
 * Rechte sind SERVERSEITIG (RLS, Referenz 1.3): eigenen Check-in legt jedes
 * Mitglied an, andere einchecken + Vereins-Historie darf nur der Trainerstab,
 * (soft-)löschen NUR Trainer:innen. Diese Datei rechnet nur Anzeigezustände.
 */

/* ---------- „Mein QR-Code" (deterministisches Muster) ---------- */

/**
 * Kompakter QR-Payload einer Mitglieds-Identität — Format angelehnt an v1
 * (rsm_member): `RSM|member|<clubId>|<memberId>`. Deterministisch, damit der
 * angezeigte Code für ein Mitglied stabil bleibt.
 */
export function memberQrPayload(member: Pick<Member, "id" | "clubId">): string {
  return `RSM|member|${member.clubId}|${member.id}`;
}

const QR_GRID = 25;

/** 32-Bit-FNV-1a-Hash → Seed für den PRNG. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministischer PRNG (mulberry32) — gleicher Seed ⇒ gleiches Muster. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let h = Math.imul(state ^ (state >>> 15), 1 | state);
    h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
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

/**
 * SVG-Pfad eines QR-ähnlichen Musters (25×25) aus einem Seed-Schlüssel. Mit
 * Finder-Ecken und Timing-Linien wie bei einem echten QR — es wird bewusst
 * NICHT dekodiert, der Klartext (Payload/ID) steht daneben.
 */
export function buildQrPath(seedKey: string): string {
  const random = mulberry32(fnv1a(seedKey));
  let path = "";
  for (let y = 0; y < QR_GRID; y += 1) {
    for (let x = 0; x < QR_GRID; x += 1) {
      const finder =
        inFinder(x, y, 0, 0) ??
        inFinder(x, y, QR_GRID - 7, 0) ??
        inFinder(x, y, 0, QR_GRID - 7);
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

/** Viewbox-Kantenlänge des QR-Musters (für das <svg viewBox>). */
export const QR_VIEWBOX = QR_GRID;

/* ---------- Termin-Auswahl für das Einchecken ---------- */

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Beginnt der ISO-Zeitstempel am selben Kalendertag wie `now`? */
export function isSameDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Termine, in die man sich einchecken kann: ab heute 00:00 bis `horizonDays`
 * in der Zukunft, frühester zuerst. Heutige Termine stehen so ganz vorne.
 */
export function selectableEvents(events: Event[], now: Date, horizonDays = 14): Event[] {
  const start = startOfDay(now).getTime();
  const horizon = start + horizonDays * 86_400_000;
  return events
    .filter((event) => {
      const at = new Date(event.startsAt).getTime();
      return at >= start && at <= horizon;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Vorbelegter Termin des Einchecken-Formulars: der erste heutige, sonst keiner. */
export function defaultEventId(events: Event[], now: Date): string {
  const today = selectableEvents(events, now).find((event) => isSameDay(event.startsAt, now));
  return today?.id ?? "";
}

/** Hat das Mitglied heute bereits (irgend)einen Check-in? */
export function hasCheckinToday(checkins: Checkin[], now: Date): boolean {
  return checkins.some((checkin) => isSameDay(checkin.checkedInAt, now));
}

/* ---------- Vereins-Statistik (Trainer-Ansicht) ---------- */

function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const shift = (day.getDay() + 6) % 7; // Montag = 0
  day.setDate(day.getDate() - shift);
  return day;
}

export interface CheckinStats {
  total: number;
  thisWeek: number;
  thisMonth: number;
}

/** Kennzahlen der Vereins-Check-ins: gesamt, diese Woche (ab Mo), diesen Monat. */
export function checkinStats(checkins: Checkin[], now: Date): CheckinStats {
  const weekStart = startOfWeek(now).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let thisWeek = 0;
  let thisMonth = 0;
  for (const checkin of checkins) {
    const at = new Date(checkin.checkedInAt).getTime();
    if (at >= weekStart) thisWeek += 1;
    if (at >= monthStart) thisMonth += 1;
  }
  return { total: checkins.length, thisWeek, thisMonth };
}
