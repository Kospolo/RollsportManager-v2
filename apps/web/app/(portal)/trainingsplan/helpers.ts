import type { Id, TrainingSlot, Weekday } from "@/lib/types";

/**
 * Reine Ableitungen des Trainingsplans — Wochentags-Reihenfolge, Zeit-/Weekday-
 * Umrechnung und die Gruppierung der Slots je Wochentag. Keine Facade-/lib-mock-
 * Zugriffe; alle Daten kommen als Parameter aus dem Screen (Facade @/lib/data).
 *
 * ACHTUNG Weekday: 0 = Montag … 6 = Sonntag (Backend, migration 0010) — NICHT
 * `Date.getDay()` (dort 0 = Sonntag). Mapping via todayWeekday().
 */

/** Anzeige-Reihenfolge Mo … So (deckt sich mit der Backend-Konvention 0..6). */
export const WEEKDAY_ORDER: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** JS `Date.getDay()` (0 = So … 6 = Sa) → Backend-Weekday (0 = Mo … 6 = So). */
export function todayWeekday(now: Date = new Date()): Weekday {
  return ((now.getDay() + 6) % 7) as Weekday;
}

/** 'HH:MM:SS' | 'HH:MM' → 'HH:MM' (Sekunden abschneiden). */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

/** Zeitspanne eines Slots als 'HH:MM–HH:MM' (echter Halbgeviertstrich). */
export function slotTimeRange(slot: TrainingSlot): string {
  return `${hhmm(slot.startsTime)}–${hhmm(slot.endsTime)}`;
}

/** Slots nach Wochentag, dann Startzeit sortieren. */
export function sortSlots(slots: TrainingSlot[]): TrainingSlot[] {
  return [...slots].sort(
    (a, b) => a.weekday - b.weekday || a.startsTime.localeCompare(b.startsTime),
  );
}

export type WeekdayGroup = { weekday: Weekday; slots: TrainingSlot[] };

/**
 * Slots je Wochentag (Mo..So) gruppieren. `includeEmpty` = true liefert alle
 * sieben Tage (auch leere) — für das Wochenraster; false nur belegte Tage —
 * für die Listen-Ansicht.
 */
export function groupByWeekday(slots: TrainingSlot[], includeEmpty: boolean): WeekdayGroup[] {
  const map = new Map<Weekday, TrainingSlot[]>();
  for (const slot of sortSlots(slots)) {
    const bucket = map.get(slot.weekday);
    if (bucket) bucket.push(slot);
    else map.set(slot.weekday, [slot]);
  }
  const groups: WeekdayGroup[] = [];
  for (const weekday of WEEKDAY_ORDER) {
    const list = map.get(weekday) ?? [];
    if (includeEmpty || list.length > 0) groups.push({ weekday, slots: list });
  }
  return groups;
}

/** Namens-Nachschlagetabellen für Team/Halle/Trainer:in (im Screen aufgebaut). */
export interface SlotLookups {
  teamNames: Map<Id, string>;
  facilityNames: Map<Id, string>;
  memberNames: Map<Id, string>;
}
