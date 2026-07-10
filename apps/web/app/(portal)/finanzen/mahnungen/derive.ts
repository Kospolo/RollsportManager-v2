import { memberById } from "@/lib/data";
import { dayDiff } from "@/lib/format";
import type { DunningLevel, InvoiceDetail, Member } from "@/lib/types";
import type { MailStage } from "../_components/MailPreviewModal";

/**
 * Abgeleitete Ansichten des Mahnwesen-Screens (Seriositätszone).
 * Alle Funktionen sind PUR und arbeiten auf den von der Facade geladenen
 * Arrays (listInvoices/getMembers) — dadurch identisch für mock UND api.
 *
 * KONSISTENZ-REGEL: KPI-Kacheln und Stufen-Gruppen rechnen über DENSELBEN
 * `DunningItem[]`, damit die Summen quer über den Screen aufgehen.
 */

/** Ein offener Posten mit abgeleiteter Mahn-Information. */
export type DunningItem = {
  invoice: InvoiceDetail;
  member?: Member;
  /** Aktuelle Mahnstufe (0–3). */
  level: DunningLevel;
  /** Tage überfällig (positiv) bzw. ≤ 0 = noch nicht fällig. */
  overdueDays: number;
  overdue: boolean;
  /** Zielstufe des nächsten Laufs: 1=Erinnerung · 2/3=Mahnung · 4=Übergabe. */
  nextStage: number;
};

/** Offene Rechnungen → DunningItem[], höchste Stufe & älteste zuerst. */
export function buildDunningItems(
  invoices: InvoiceDetail[],
  members: Member[],
): DunningItem[] {
  return invoices
    .filter((invoice) => invoice.status === "open")
    .map((invoice) => {
      const overdueDays = -dayDiff(invoice.dueAt);
      return {
        invoice,
        member: memberById(members, invoice.memberId),
        level: invoice.dunningLevel,
        overdueDays,
        overdue: overdueDays >= 1,
        nextStage: invoice.dunningLevel + 1,
      };
    })
    .sort((a, b) => b.level - a.level || b.overdueDays - a.overdueDays);
}

export function sumCents(items: readonly DunningItem[]): number {
  return items.reduce((sum, item) => sum + item.invoice.amountCents, 0);
}

/** Anzahl + Summe je Mahnstufe (0–3) — die vier Ampel-Gruppen. */
export type StageBucket = {
  level: DunningLevel;
  items: DunningItem[];
  sumCents: number;
};

export function groupByStage(items: DunningItem[]): StageBucket[] {
  return ([0, 1, 2, 3] as const).map((level) => {
    const bucket = items.filter((item) => item.level === level);
    return { level, items: bucket, sumCents: sumCents(bucket) };
  });
}

/**
 * Die Mahn-E-Mail, die zur aktuellen Stufe eines Postens passt (1–3).
 * Stufe 0 (noch nicht gemahnt) zeigt die anstehende Erinnerung (1).
 */
export function mailStageForLevel(level: DunningLevel): MailStage {
  return (level === 0 ? 1 : level) as MailStage;
}

/**
 * Ein anzuwendender Schritt des Mahnlaufs (nur überfällige Posten).
 * `targetStage` = nextStage; ab 2 braucht es die ausdrückliche Freigabe.
 */
export type RunPlanItem = DunningItem & {
  targetStage: number;
  needsApproval: boolean;
};

export function buildRunPlan(items: DunningItem[]): RunPlanItem[] {
  return items
    .filter((item) => item.overdue)
    .map((item) => ({
      ...item,
      targetStage: item.nextStage,
      needsApproval: item.nextStage >= 2,
    }))
    .sort((a, b) => a.targetStage - b.targetStage || b.overdueDays - a.overdueDays);
}
