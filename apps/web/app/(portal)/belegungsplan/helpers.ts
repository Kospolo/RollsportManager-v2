import type { BadgeTone } from "@/components/ui/Badge";
import type { BookingStatus, FacilityBooking, FacilityKind } from "@/lib/types";
import type { belegungsplanDict } from "./i18n";

/**
 * Reine Ableitungen des Belegungsplans — Enum-Zuordnungen, Überschneidungs-
 * und Gruppierungslogik. Keine Facade-/lib-mock-Zugriffe; alle Daten kommen
 * als Parameter aus dem Screen (Facade @/lib/data).
 */

export type BelegungKey = keyof (typeof belegungsplanDict)["de"];

/* ---------- FacilityKind ---------- */

/** Anzeige-Reihenfolge der Hallen-Arten (Referenz). */
export const KIND_ORDER: readonly FacilityKind[] = ["hall", "room", "outdoor", "other"];

/** FacilityKind → i18n-Schlüssel des Labels. */
export const KIND_LABEL_KEY: Record<FacilityKind, BelegungKey> = {
  hall: "kindHall",
  room: "kindRoom",
  outdoor: "kindOutdoor",
  other: "kindOther",
};

/* ---------- BookingStatus ---------- */

/** BookingStatus → i18n-Schlüssel des Labels. */
export const STATUS_LABEL_KEY: Record<BookingStatus, BelegungKey> = {
  confirmed: "statusConfirmed",
  pending: "statusPending",
  cancelled: "statusCancelled",
};

/** BookingStatus → Chip-Ton (Bestätigt=grün, Angefragt=gelb, Storniert=neutral). */
export const STATUS_TONE: Record<BookingStatus, BadgeTone> = {
  confirmed: "success",
  pending: "warn",
  cancelled: "neutral",
};

/* ---------- Überschneidungen ---------- */

/**
 * Zwei ISO-Zeiträume [aStart,aEnd) und [bStart,bEnd) überschneiden sich, wenn
 * aStart < bEnd und bStart < aEnd. Alle Zeitstempel sind UTC-ISO — der
 * lexikografische Vergleich entspricht dem chronologischen.
 */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Bestehende Buchungen derselben Halle, die den vorgeschlagenen Slot
 * überschneiden — stornierte und (im Edit-Fall) die eigene Buchung ausgenommen.
 * Überschneidungen sind NICHT DB-erzwungen (Index (facility_id, starts_at)),
 * die App weist sie deshalb selbst als Hinweis aus.
 */
export function conflictingBookings(
  bookings: FacilityBooking[],
  facilityId: string,
  startsAt: string,
  endsAt: string,
  excludeId?: string,
): FacilityBooking[] {
  return bookings.filter(
    (b) =>
      b.facilityId === facilityId &&
      b.status !== "cancelled" &&
      b.id !== excludeId &&
      overlaps(startsAt, endsAt, b.startsAt, b.endsAt),
  );
}

/** Überschneidet diese Buchung eine andere aktive Buchung derselben Halle? */
export function hasConflict(booking: FacilityBooking, all: FacilityBooking[]): boolean {
  if (booking.status === "cancelled") return false;
  return conflictingBookings(all, booking.facilityId, booking.startsAt, booking.endsAt, booking.id)
    .length > 0;
}

/* ---------- Kommende Buchungen & Tages-Gruppen ---------- */

/** Kommende/laufende Buchungen (endsAt >= jetzt), chronologisch aufsteigend. */
export function upcomingBookings(
  bookings: FacilityBooking[],
  nowMs: number = Date.now(),
): FacilityBooking[] {
  return bookings
    .filter((b) => new Date(b.endsAt).getTime() >= nowMs)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export type BookingDayGroup = { key: string; iso: string; bookings: FacilityBooking[] };

/** Buchungen nach Kalendertag (lokale Zeit) gruppieren, aufsteigend sortiert. */
export function groupBookingsByDay(list: FacilityBooking[]): BookingDayGroup[] {
  const groups = new Map<string, BookingDayGroup>();
  const sorted = [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const booking of sorted) {
    const d = new Date(booking.startsAt);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const group = groups.get(key);
    if (group) group.bookings.push(booking);
    else groups.set(key, { key, iso: booking.startsAt, bookings: [booking] });
  }
  return [...groups.values()];
}
