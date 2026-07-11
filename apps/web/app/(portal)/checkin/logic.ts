import type { Checkin, Event } from "@/lib/types";

/**
 * Fachlogik des Check-in-Moduls — reine Funktionen ohne React, damit sie
 * testbar bleiben und i18n.ts/Screens schlank bleiben.
 *
 * Der QR-Vertrag „Mein QR-Code" (memberQrPayload/parseMemberQr) liegt geteilt
 * in lib/member-qr.ts; kodiert/dekodiert wird über die self-contained Utility
 * lib/qr. Rechte sind SERVERSEITIG (RLS, Referenz 1.3): eigenen Check-in legt
 * jedes Mitglied an, andere einchecken (auch per Scan) + Vereins-Historie darf
 * nur der Trainerstab, (soft-)löschen NUR Trainer:innen. Diese Datei rechnet nur
 * Anzeigezustände.
 */

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
