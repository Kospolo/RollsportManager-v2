import type { Locale } from "@/lib/i18n";
import type { RegionalEvent } from "@/lib/types";

/**
 * Reine Ableitungen des Events-Screens — keine Facade-Aufrufe, kein State.
 * Die Datumsangaben (startsOn/endsOn) sind ISO-Kalendertage (YYYY-MM-DD) und
 * werden bewusst lokal geparst (nicht über new Date(iso), das UTC annimmt),
 * damit die Vergangen-Erkennung und die Anzeige zeitzonenfest sind.
 */

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

const EN_DASH = "–";

/** YYYY-MM-DD → lokales Date (ohne Zeitzonen-Verschiebung). */
function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Heutiger Kalendertag als YYYY-MM-DD (lokale Zeit) — Basis der Vergangen-Grenze. */
export function todayIso(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Vergangen = der letzte Tag des Events (endsOn, sonst startsOn) liegt VOR
 * heute. Ein heute noch laufendes Event gilt als kommend (nicht vergangen).
 */
export function isPastEvent(event: RegionalEvent, today: string): boolean {
  return (event.endsOn ?? event.startsOn) < today;
}

/**
 * Datum bzw. Zeitspanne lokalisiert: "15. Juli 2026" (eintägig) oder
 * "15. Juli 2026 – 16. Juli 2026" (mehrtägig, echter Halbgeviertstrich).
 */
export function formatEventDateSpan(
  startsOn: string,
  endsOn: string | undefined,
  locale: Locale,
): string {
  const formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const start = formatter.format(parseIsoDate(startsOn));
  if (!endsOn || endsOn === startsOn) return start;
  return `${start} ${EN_DASH} ${formatter.format(parseIsoDate(endsOn))}`;
}

/**
 * Freitext-URL absichern: nur echte http(s)-Links werden verlinkt
 * (schützt vor javascript:/data:-URLs aus Freitext). Sonst undefined.
 */
export function safeExternalUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}
