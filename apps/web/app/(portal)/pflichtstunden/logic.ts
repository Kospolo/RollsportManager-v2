import type { Locale } from "@/lib/i18n";
import type { DutyEntry, DutyRequirement, Member } from "@/lib/types";

/**
 * Fachlogik der Pflichtstunden (Soll/Ist) — reine Funktionen ohne React, damit
 * sie testbar bleiben und i18n.ts schlank bleibt.
 *
 * Soll-Kaskade (migration 0010): Ein duty_requirement gilt für ein Mitglied
 * über die SPEZIFISCHSTE passende Ebene — Mitgliedsregel (memberId) schlägt
 * Teamregel (teamId ∈ member.teamIds) schlägt Vereinsregel (team+member leer).
 * Nur die Gewinner-Ebene zählt; Regeln DERSELBEN Ebene werden summiert. Der
 * Zeitraum (periodStart/-End) wird bewusst NICHT auf „heute" gefiltert — sonst
 * fiele eine abgelaufene Saison weg (siehe offene Punkte).
 */

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };
/** Schmales geschütztes Leerzeichen vor der Einheit (DESIGN-SYSTEM §2.4). */
const NARROW_NBSP = "\u202F";

/** Ebene, aus der das Soll eines Mitglieds abgeleitet wurde. */
export type SollLevel = "member" | "team" | "club" | "none";

export interface MemberSoll {
  /** Summe der Soll-Stunden der Gewinner-Ebene (0, wenn keine Regel greift). */
  hours: number;
  level: SollLevel;
  /** Saison-Label, falls genau eine Regel greift (sonst gemischt → undefined). */
  seasonLabel?: string;
}

/** Effektives Pflichtstunden-Soll eines Mitglieds über die Kaskade auflösen. */
export function resolveMemberSoll(
  member: Pick<Member, "id" | "teamIds">,
  requirements: DutyRequirement[],
): MemberSoll {
  const memberReqs = requirements.filter((r) => r.memberId === member.id);
  const teamReqs = requirements.filter(
    (r) => !r.memberId && r.teamId !== undefined && member.teamIds.includes(r.teamId),
  );
  const clubReqs = requirements.filter((r) => !r.memberId && r.teamId === undefined);

  let level: SollLevel = "none";
  let chosen: DutyRequirement[] = [];
  if (memberReqs.length > 0) {
    level = "member";
    chosen = memberReqs;
  } else if (teamReqs.length > 0) {
    level = "team";
    chosen = teamReqs;
  } else if (clubReqs.length > 0) {
    level = "club";
    chosen = clubReqs;
  }

  const hours = chosen.reduce((sum, r) => sum + r.requiredHours, 0);
  const seasonLabel = chosen.length === 1 ? chosen[0].seasonLabel : undefined;
  return { hours, level, seasonLabel };
}

/** Summe der Ist-Stunden einer Eintragsliste (alle Einträge, unabhängig von approved). */
export function sumHours(entries: Pick<DutyEntry, "hours">[]): number {
  return entries.reduce((sum, e) => sum + e.hours, 0);
}

/** Fortschritt eines Mitglieds: Soll, Ist (gesamt/genehmigt), Rest, erfüllt. */
export interface DutyProgress {
  soll: number;
  ist: number;
  istApproved: number;
  /** Anzahl noch nicht genehmigter Einträge. */
  pending: number;
  /** max(0, Soll − Ist). */
  rest: number;
  /** Soll gesetzt UND vollständig geleistet. */
  fulfilled: boolean;
  /** Soll-Ebene (für Anzeige „Vereinsregel/Teamregel …"). */
  level: SollLevel;
  seasonLabel?: string;
}

/** Fortschritt aus Soll-Auflösung + eigenen Einträgen berechnen. */
export function computeProgress(
  member: Pick<Member, "id" | "teamIds">,
  requirements: DutyRequirement[],
  entries: DutyEntry[],
): DutyProgress {
  const { hours: soll, level, seasonLabel } = resolveMemberSoll(member, requirements);
  const ist = sumHours(entries);
  const istApproved = sumHours(entries.filter((e) => e.approved));
  const pending = entries.filter((e) => !e.approved).length;
  const rest = Math.max(0, soll - ist);
  const fulfilled = soll > 0 && ist >= soll;
  return { soll, ist, istApproved, pending, rest, fulfilled, level, seasonLabel };
}

/** Stunden lokalisiert mit Einheit: „12,5 h" (de) / „12.5 h" (en). */
export function formatHours(value: number, locale: Locale): string {
  const n = new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${n}${NARROW_NBSP}h`;
}

/** Heutiges Datum als 'YYYY-MM-DD' in LOKALER Zeit (Wert für <input type="date">). */
export function todayISODate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
