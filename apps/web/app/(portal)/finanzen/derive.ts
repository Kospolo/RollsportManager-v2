import { invoices, ledger, memberById, members, openInvoices, dateFromNow } from "@/lib/mock";
import { dayDiff } from "@/lib/format";
import type { DunningLevel, Invoice, LedgerEntry, Member } from "@/lib/types";
import type { IconName } from "@/components/shell/icons";

/**
 * Abgeleitete Ansichten der Finanz-Mocks (Seriositätszone).
 * KONSISTENZ-REGEL: Alle Summen entstehen aus DENSELBEN Datensätzen —
 * KPI „Offene Posten" und Tabellen-Footer rechnen beide über `OpenItem[]`.
 */

/* ---------- Offene Posten ---------- */

export type LevelFilter = "all" | "open" | "reminded" | "dunned";

export type OpenItem = {
  invoice: Invoice;
  member: Member;
  /** Effektive Stufe — Mock-Stufe plus lokale, optimistische Überschreibung */
  level: DunningLevel;
  /** Tage überfällig (positiv) bzw. negativ = noch nicht fällig */
  overdueDays: number;
};

export function levelToFilter(level: DunningLevel): LevelFilter {
  if (level === 0) return "open";
  if (level === 1) return "reminded";
  return "dunned";
}

/** Offene Posten mit lokalem Zustand (Stufen-Overrides + bezahlt markierte). */
export function deriveOpenItems(
  levelOverrides: Record<string, DunningLevel>,
  paidIds: ReadonlySet<string>,
): OpenItem[] {
  return openInvoices
    .filter((invoice) => !paidIds.has(invoice.id))
    .map((invoice) => {
      const member = memberById(invoice.memberId);
      if (!member) return null;
      return {
        invoice,
        member,
        level: levelOverrides[invoice.id] ?? invoice.dunningLevel,
        overdueDays: -dayDiff(invoice.dueAt),
      };
    })
    .filter((item): item is OpenItem => item !== null)
    .sort((a, b) => b.level - a.level || b.overdueDays - a.overdueDays);
}

export function sumCents(items: readonly OpenItem[]): number {
  return items.reduce((sum, item) => sum + item.invoice.amountCents, 0);
}

/** Absenderin aller Mahn-Mails: die Kassenwartin des Vereins. */
export const treasurer: Member =
  members.find((m) => m.role === "treasurer") ?? members[0];

/* ---------- Einnahmen der letzten 30 Tage (KPI) ---------- */

const incomeEntries = ledger.filter(
  (entry) => entry.amountCents > 0 && dayDiff(entry.date) >= -30,
);

export const income30d = {
  sumCents: incomeEntries.reduce((sum, entry) => sum + entry.amountCents, 0),
  count: incomeEntries.length,
};

/* ---------- Kassenbuch mit laufendem Saldo ---------- */

export type LedgerRow = {
  entry: LedgerEntry;
  /** Laufender Saldo des Auszugs NACH dieser Buchung */
  balanceCents: number;
  member?: Member;
};

/** Neueste Buchung zuerst — Saldo läuft chronologisch auf (wie ein Kontoauszug). */
export const ledgerRows: LedgerRow[] = (() => {
  const ascending = [...ledger].sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  const rows = ascending.map((entry) => {
    running += entry.amountCents;
    return {
      entry,
      balanceCents: running,
      member:
        entry.counterparty.kind === "person"
          ? memberById(entry.counterparty.memberId)
          : undefined,
    };
  });
  return rows.reverse();
})();

export function invoiceNumberById(id: string): string | undefined {
  return invoices.find((invoice) => invoice.id === id)?.number;
}

/** Kategorie → i18n-Key (Mock-Kategorien sind deutsch gepflegt). */
export const CATEGORY_KEY: Record<string, string> = {
  Beiträge: "catFees",
  Miete: "catRent",
  Lizenzen: "catLicenses",
  Wettkampf: "catCompetition",
  Trainingslager: "catCamp",
  Material: "catEquipment",
};

/** Organisationen: Icon-Kachel statt Monogramm (radius-org, Jury-Fix). */
export function orgIcon(name: string): IconName {
  if (name.startsWith("Stadt")) return "bank";
  if (name === "GEMA") return "routines";
  if (name.startsWith("DRIV")) return "competition";
  if (name.startsWith("SEPA")) return "zap";
  if (name.startsWith("Sportbedarf")) return "settings";
  return "bank";
}

/* ---------- Bankabgleich ---------- */

export const BANK_TOTAL = 34;
export const BANK_AUTO_MATCHED = 31;

export type BankSuggestion = {
  id: string;
  invoice: Invoice;
  member: Member;
  /** Auftraggeber-Zeile aus dem Kontoumsatz (Bankdaten, verbatim) */
  payer: string;
  /** Verwendungszweck aus dem Kontoumsatz (Bankdaten, verbatim) */
  reference: string;
  /** Buchungsdatum des Umsatzes (ISO) */
  dateIso: string;
  confidence: "high" | "medium";
};

const SUGGESTION_SEEDS: Array<
  Pick<BankSuggestion, "payer" | "reference" | "confidence"> & {
    invoiceId: string;
    daysAgo: number;
  }
> = [
  {
    invoiceId: "i-04",
    payer: "ÖHLER, LUKAS",
    reference: "TRAININGSLAGER HERBST ANZAHLUNG",
    confidence: "high",
    daysAgo: -1,
  },
  {
    invoiceId: "i-02",
    payer: "MÜLLER, STEFANIE",
    reference: "BEITRAG FAMILIE MÜLLER",
    confidence: "high",
    daysAgo: -2,
  },
  {
    invoiceId: "i-03",
    payer: "KÖHLER, FRANK",
    reference: "FINN BEZIRKSMEISTERSCHAFT",
    confidence: "medium",
    daysAgo: -2,
  },
];

/** Die 3 offenen Zuordnungs-Vorschläge — verweisen auf echte offene Rechnungen. */
export function buildSuggestions(): BankSuggestion[] {
  return SUGGESTION_SEEDS.map((seed) => {
    const invoice = openInvoices.find((i) => i.id === seed.invoiceId);
    const member = invoice ? memberById(invoice.memberId) : undefined;
    if (!invoice || !member) return null;
    return {
      id: `sug-${seed.invoiceId}`,
      invoice,
      member,
      payer: seed.payer,
      reference: seed.reference,
      dateIso: dateFromNow(seed.daysAgo),
      confidence: seed.confidence,
    };
  }).filter((s): s is BankSuggestion => s !== null);
}
