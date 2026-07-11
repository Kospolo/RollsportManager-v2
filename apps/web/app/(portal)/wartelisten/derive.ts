import { isNotImplemented } from "@/lib/data";
import type { Locale } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import type {
  Equipment,
  Event,
  Facility,
  Team,
  WaitlistEntry,
  WaitlistKind,
  WaitlistStatus,
} from "@/lib/types";
import type { IconName } from "@/components/shell/icons";
import type { BadgeTone } from "@/components/ui/Badge";
import { STATUS_ORDER } from "./i18n";

/**
 * Reine Ableitungs-Helfer für den Wartelisten-Screen — arbeiten ausschließlich
 * auf den per Facade (lib/data) geladenen Arrays, damit Mock- und api-Modus
 * identisch rechnen. Self-contained (kein Import aus fremden Routen-Ordnern).
 */

/* ---------- NotImplemented-Weichzeichner ---------- */

/**
 * Für Nebendaten (Teams/Hallen/Ausrüstung/Termine, nur zum Auflösen der
 * Ziel-Labels): eine bekannte Contract-Lücke (NotImplementedError) wird zu
 * `null` — der Screen fällt auf ein neutrales „Ziel"-Label zurück, statt zu
 * scheitern. Alle anderen Fehler laufen normal weiter (Fehlerzustand + Retry).
 */
export async function softNotImplemented<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (isNotImplemented(error)) return null;
    throw error;
  }
}

/* ---------- Status/Art → Ton & Icon ---------- */

export const STATUS_TONE: Record<WaitlistStatus, BadgeTone> = {
  waiting: "info",
  offered: "warn",
  fulfilled: "success",
  cancelled: "neutral",
};

export const KIND_ICON: Record<WaitlistKind, IconName> = {
  facility: "pin",
  equipment: "settings",
  team: "teams",
  event: "events",
};

/* ---------- Ziel-Auflösung ---------- */

/** Nebendaten zum Auflösen der targetId je Art (null = nicht angebunden). */
export interface TargetSources {
  teams: Team[] | null;
  facilities: Facility[] | null;
  equipment: Equipment[] | null;
  events: Event[] | null;
}

/** Eine wählbare Ziel-Option im Eintragen-Dialog. */
export interface TargetOption {
  id: string;
  label: string;
}

/**
 * Menschlich lesbares Ziel-Label eines Eintrags. `null` = allgemeiner Eintrag
 * (kein targetId). `undefined` = targetId gesetzt, aber (noch) nicht auflösbar
 * → der Screen zeigt ein neutrales „Ziel"-Label.
 */
export function resolveTargetLabel(
  entry: WaitlistEntry,
  sources: TargetSources,
  locale: Locale,
): string | null | undefined {
  if (!entry.targetId) return null;
  switch (entry.kind) {
    case "team":
      return sources.teams?.find((t) => t.id === entry.targetId)?.name;
    case "facility":
      return sources.facilities?.find((f) => f.id === entry.targetId)?.name;
    case "equipment":
      return sources.equipment?.find((e) => e.id === entry.targetId)?.name;
    case "event": {
      const ev = sources.events?.find((e) => e.id === entry.targetId);
      return ev ? `${ev.title} · ${formatDateShort(ev.startsAt, locale)}` : undefined;
    }
  }
}

/** Auswählbare Ziele einer Art für den Eintragen-Dialog (leer = keine Quelle). */
export function targetOptions(
  kind: WaitlistKind,
  sources: TargetSources,
  locale: Locale,
): TargetOption[] {
  switch (kind) {
    case "team":
      return (sources.teams ?? []).map((t) => ({ id: t.id, label: t.name }));
    case "facility":
      return (sources.facilities ?? []).map((f) => ({ id: f.id, label: f.name }));
    case "equipment":
      return (sources.equipment ?? []).map((e) => ({ id: e.id, label: e.name }));
    case "event":
      return [...(sources.events ?? [])]
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
        .map((e) => ({ id: e.id, label: `${e.title} · ${formatDateShort(e.startsAt, locale)}` }));
  }
}

/* ---------- Sortierung & Gruppierung ---------- */

/** Status zuerst (aktiv → erledigt), dann jüngste zuerst. */
export function sortEntries(entries: WaitlistEntry[]): WaitlistEntry[] {
  return [...entries].sort((a, b) => {
    const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (byStatus !== 0) return byStatus;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** Anzahl je Art (für die Filter-Chips der Warteschlange). */
export function countByKind(entries: WaitlistEntry[]): Record<WaitlistKind, number> {
  const base: Record<WaitlistKind, number> = { facility: 0, equipment: 0, team: 0, event: 0 };
  for (const entry of entries) base[entry.kind] += 1;
  return base;
}
