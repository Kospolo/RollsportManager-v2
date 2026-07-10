import type { Member, SepaMandate, SepaMandateStatus } from "@/lib/types";

/**
 * Reine Ableitungs-Helfer des SEPA-Screens (keine Client-Imports) — arbeiten
 * auf den vom Repository geladenen Arrays und funktionieren dadurch für BEIDE
 * Datenquellen (mock|api) identisch. Konsistenz-Regel: Zählungen/Reihenfolge
 * IMMER hier ableiten, nie im JSX hart codieren.
 */

/** Status-Filter der Leiste — „all" plus die beiden echten Mandats-Status. */
export type StatusFilter = "all" | SepaMandateStatus;

/** Ein Tabellen-Datensatz: Mandat plus aufgelöster Mitgliedsname (null = unbekannt). */
export interface MandateRow {
  mandate: SepaMandate;
  /** Aufgelöster „Vorname Nachname" oder null, wenn das Mitglied fehlt. */
  memberName: string | null;
}

/** Aktive Mandate zuerst, widerrufene danach. */
const STATUS_RANK: Record<SepaMandateStatus, number> = { active: 0, revoked: 1 };

/**
 * Baut die Anzeige-Zeilen: Mitgliedsname auflösen, dann aktive vor
 * widerrufenen, innerhalb der Gruppe nach Name und Referenz sortieren.
 */
export function buildMandateRows(mandates: SepaMandate[], members: Member[]): MandateRow[] {
  const nameById = new Map(members.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));
  return mandates
    .map((mandate) => ({ mandate, memberName: nameById.get(mandate.memberId) ?? null }))
    .sort((a, b) => {
      const byStatus = STATUS_RANK[a.mandate.status] - STATUS_RANK[b.mandate.status];
      if (byStatus !== 0) return byStatus;
      const byName = (a.memberName ?? "").localeCompare(b.memberName ?? "");
      if (byName !== 0) return byName;
      return a.mandate.mandateReference.localeCompare(b.mandate.mandateReference);
    });
}

/** Filtert die Zeilen auf einen Status (all = unverändert). */
export function filterMandateRows(rows: MandateRow[], status: StatusFilter): MandateRow[] {
  return status === "all" ? rows : rows.filter((row) => row.mandate.status === status);
}

/** Kennzahlen für den Seitenkopf. */
export interface MandateCounts {
  active: number;
  revoked: number;
  total: number;
}

/** Zählt aktive/widerrufene Mandate (Basis für den Untertitel). */
export function countMandates(mandates: SepaMandate[]): MandateCounts {
  let active = 0;
  for (const mandate of mandates) {
    if (mandate.status === "active") active += 1;
  }
  return { active, revoked: mandates.length - active, total: mandates.length };
}
