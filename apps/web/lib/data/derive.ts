import type {
  DunningLevel,
  Event,
  Invoice,
  LedgerEntry,
  Member,
  Task,
} from "@/lib/types";

/**
 * Reine Ableitungs-Helfer — ersetzen die vorab berechneten Exporte aus
 * lib/mock (sumOpenCents, dunningPipeline, …). Sie arbeiten auf den vom
 * Repository geladenen Arrays und funktionieren dadurch für BEIDE
 * Datenquellen identisch.
 *
 * KONSISTENZ-REGEL bleibt: Summen IMMER hieraus ableiten, nie hart codieren.
 */

export function fullName(member: Pick<Member, "firstName" | "lastName">): string {
  return `${member.firstName} ${member.lastName}`;
}

export function memberById(members: Member[], id: string): Member | undefined {
  return members.find((m) => m.id === id);
}

/** Offene Rechnungen (Basis für alle „Offene Posten"-Zahlen). */
export function openInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter((i) => i.status === "open");
}

/** Offene Posten in Cents — Summe der offenen Rechnungen. */
export function sumOpenCents(invoices: Invoice[]): number {
  return openInvoices(invoices).reduce((sum, i) => sum + i.amountCents, 0);
}

export function sumPaidCents(invoices: Invoice[]): number {
  return invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amountCents, 0);
}

export interface DunningStage {
  level: DunningLevel;
  count: number;
  sumCents: number;
}

/** Eskalations-Pipeline: Anzahl + Summe pro Mahnstufe (4 Stufen-Kacheln). */
export function dunningPipeline(invoices: Invoice[]): DunningStage[] {
  const open = openInvoices(invoices);
  return ([0, 1, 2, 3] as const).map((level) => {
    const stage = open.filter((i) => i.dunningLevel === level);
    return {
      level,
      count: stage.length,
      sumCents: stage.reduce((sum, i) => sum + i.amountCents, 0),
    };
  });
}

/** Kassenbuch-Saldo (fortlaufend aufsummiert). */
export function ledgerBalanceCents(ledger: LedgerEntry[]): number {
  return ledger.reduce((sum, e) => sum + e.amountCents, 0);
}

/** Kommende Termine im Zeitfenster, aufsteigend sortiert. */
export function upcomingEvents(events: Event[], withinDays = 7): Event[] {
  const now = Date.now();
  const horizon = now + withinDays * 86_400_000;
  return events
    .filter((e) => {
      const t = new Date(e.startsAt).getTime();
      return t >= now && t <= horizon;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function openTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.done);
}
