import type { Locale } from "@/lib/i18n";

/**
 * Lokalisierte Formatierung (DE = de-DE, EN = en-GB).
 * Regeln aus DESIGN-SYSTEM §2.4: echtes Minuszeichen (−),
 * schmales Leerzeichen vor €, Beträge immer aus Cents.
 */

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

const NARROW_NBSP = " ";
const REAL_MINUS = "−";

/** Cents → "1.234,56 €" (de) / "€1,234.56" (en) — mit echtem Minus und schmalem Leerzeichen. */
export function formatEUR(amountCents: number, locale: Locale): string {
  const formatted = new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
  return formatted
    .replace(/-/g, REAL_MINUS)
    .replace(/[\s ]€/g, `${NARROW_NBSP}€`);
}

/** ISO → "Mi., 15. Juli" (de) / "Wed 15 July" (en) */
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

/** ISO → "15.07.2026" (de) / "15/07/2026" (en) */
export function formatDateShort(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

/** ISO → "17:30" (de) / "17:30" (en, 24 h im Vereinskontext) */
export function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** ISO → "Mi., 15. Juli, 17:30" */
export function formatDateTime(iso: string, locale: Locale): string {
  return `${formatDate(iso, locale)}, ${formatTime(iso, locale)}`;
}

/** Kalendertag-Differenz (lokale Zeit): 0 = heute, 1 = morgen, −1 = gestern … */
export function dayDiff(iso: string, now: Date = new Date()): number {
  const target = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(target) - startOf(now)) / 86_400_000);
}

/** Relative Tage: "heute" / "morgen" / "in 9 Tagen" / "vor 42 Tagen" (bzw. EN). */
export function relativeDays(iso: string, locale: Locale, now: Date = new Date()): string {
  const diff = dayDiff(iso, now);
  return new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "auto" }).format(diff, "day");
}

/** Millisekunden → Kürzeit "2:30" bzw. mit Zehntel "0:38,2" (Mono rendern). */
export function formatDurationMs(ms: number, withTenths = false): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  if (withTenths) {
    const whole = Math.floor(seconds);
    const tenths = Math.floor((seconds - whole) * 10);
    return `${minutes}:${String(whole).padStart(2, "0")},${tenths}`;
  }
  return `${minutes}:${String(Math.round(seconds)).padStart(2, "0")}`;
}
