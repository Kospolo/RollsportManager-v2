import type { BadgeTone } from "@/components/ui/Badge";
import type { Locale } from "@/lib/i18n";
import type { AnniversaryKind } from "@/lib/types";
import type { JubileeIconName } from "./JubileeIcon";
import type { JubilaeenKey } from "../i18n";

/**
 * Geteilte Darstellungs-Helfer der Jubiläen-Seite (Karte + „Als Nächstes"-Hero).
 * Reine Funktionen, keine UI — die Komponenten reichen die Schlüssel an t().
 */

/** „Anna-Lena Böhm" → { firstName: "Anna-Lena", lastName: "Böhm" } (erstes Wort = Vorname). */
export function splitName(memberName: string): { firstName: string; lastName: string } {
  const trimmed = memberName.trim();
  const gap = trimmed.indexOf(" ");
  if (gap < 0) return { firstName: trimmed, lastName: "" };
  return { firstName: trimmed.slice(0, gap), lastName: trimmed.slice(gap + 1) };
}

/** Festliche Farbwelt je Art: Geburtstag = Beere/Torte, Vereinsjubiläum = Gold/Rosette. */
export const KIND_STYLE: Record<
  AnniversaryKind,
  { chipTone: BadgeTone; iconWrap: string; icon: JubileeIconName }
> = {
  birthday: { chipTone: "brand", iconWrap: "bg-brand-soft text-brand-ink", icon: "cake" },
  membership: { chipTone: "warn", iconWrap: "bg-warn-soft text-warn", icon: "rosette" },
};

/**
 * Countdown → Dictionary-Schlüssel + Dringlichkeits-Ton. „heute"/„morgen"
 * feiern (brand), die nächste Woche warm (warn), danach dezent (neutral).
 */
export function countdown(daysUntil: number): {
  key: JubilaeenKey;
  params?: Record<string, number>;
  tone: BadgeTone;
} {
  if (daysUntil <= 0) return { key: "countToday", tone: "brand" };
  if (daysUntil === 1) return { key: "countTomorrow", tone: "brand" };
  return { key: "countDays", params: { n: daysUntil }, tone: daysUntil <= 7 ? "warn" : "neutral" };
}

/** ISO-Datum (YYYY-MM-DD) lokal-mitternacht parsen — timezone-fest, kein Tages-Versatz. */
function localDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}

/** Gruppierungs-Schlüssel „2026-07" direkt aus der ISO-Zeichenkette (timezone-fest). */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** „Juli 2026" (de) / „July 2026" (en). */
export function monthLabel(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", {
    month: "long",
    year: "numeric",
  }).format(localDate(iso));
}
