"use client";

import type { ReactNode } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDateShort } from "@/lib/format";
import type { BankTransaction, Invoice } from "@/lib/types";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { bankabgleichDict } from "../i18n";
import { isMatchableIncoming } from "../derive";

/**
 * Bankumsatz-Tabelle (Seriositätszone, DESIGN-SYSTEM §3.3): Datum (Mono),
 * Betrag (Mono, echtes −, Eingang grün / Ausgang rot), Verwendungszweck,
 * Gegenpartei, Status-Chip (Wort + Farbe) und die Aktionen.
 *
 * Aktionen richten sich nach Status + Vorzeichen: nur unmatched-Eingänge
 * (amountCents > 0) bieten „Zuordnen"; jeder nicht-ignorierte Umsatz bietet
 * „Ignorieren". Bereits zugeordnete Zeilen zeigen die Rechnungsnummer und ein
 * „Ändern" (Re-Match); ignorierte Zeilen zeigen nur den Status-Chip. GoBD:
 * kein Löschen — die Wahrheit bleibt serverseitig (RLS).
 */
export function BankTable({
  transactions,
  invoices,
  onMatch,
  onIgnore,
  empty,
}: {
  transactions: BankTransaction[];
  invoices: Invoice[];
  onMatch: (transaction: BankTransaction) => void;
  onIgnore: (transaction: BankTransaction) => void;
  empty?: ReactNode;
}) {
  const t = useT(bankabgleichDict);
  const { locale } = useLocale();

  const invoiceNumber = (id?: string): string | undefined =>
    id ? invoices.find((invoice) => invoice.id === id)?.number : undefined;

  const amountCell = (tx: BankTransaction): ReactNode => (
    <span className={tx.amountCents > 0 ? "text-success" : "text-danger"}>
      {tx.amountCents > 0 ? "+" : ""}
      {formatEUR(tx.amountCents, locale)}
    </span>
  );

  const statusCell = (tx: BankTransaction): ReactNode => {
    if (tx.status === "matched") {
      const number = invoiceNumber(tx.matchedInvoiceId);
      return (
        <span className="grid gap-0.5">
          <Badge tone="success">{t("badgeMatched")}</Badge>
          {number && (
            <span className="font-mono text-[11.5px] tabular-nums text-ink-faint">
              {t("matchedInvoice", { number })}
            </span>
          )}
        </span>
      );
    }
    if (tx.status === "ignored") return <Badge tone="neutral">{t("badgeIgnored")}</Badge>;
    return <Badge tone="warn">{t("badgeUnmatched")}</Badge>;
  };

  const actionCell = (tx: BankTransaction): ReactNode => {
    if (tx.status === "ignored") {
      return (
        <span className="text-ink-faint" aria-hidden="true">
          —
        </span>
      );
    }
    if (tx.status === "matched") {
      return (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" icon="edit" onClick={() => onMatch(tx)}>
            {t("rematchAction")}
          </Button>
        </div>
      );
    }
    // unmatched
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {isMatchableIncoming(tx) && (
          <Button variant="secondary" size="sm" icon="check" onClick={() => onMatch(tx)}>
            {t("matchAction")}
          </Button>
        )}
        <Button variant="ghost" size="sm" icon="close" onClick={() => onIgnore(tx)}>
          {t("ignoreAction")}
        </Button>
      </div>
    );
  };

  const columns: Column<BankTransaction>[] = [
    {
      id: "date",
      header: t("colDate"),
      cell: (tx) => (
        <span className="whitespace-nowrap font-mono text-[12.5px] tabular-nums text-ink-faint">
          {formatDateShort(tx.bookedOn, locale)}
        </span>
      ),
    },
    { id: "amount", header: t("colAmount"), mono: true, cell: amountCell },
    {
      id: "purpose",
      header: t("colPurpose"),
      cell: (tx) =>
        tx.purpose ? (
          <span className="text-[14px] text-ink">{tx.purpose}</span>
        ) : (
          <span className="text-ink-faint">{t("noPurpose")}</span>
        ),
    },
    {
      id: "counterparty",
      header: t("colCounterparty"),
      cell: (tx) =>
        tx.counterparty ? (
          <span className="text-[14px] text-ink-soft">{tx.counterparty}</span>
        ) : (
          <span className="text-ink-faint">{t("noCounterparty")}</span>
        ),
    },
    { id: "status", header: t("colStatus"), cell: statusCell },
    {
      id: "action",
      header: <span className="sr-only">{t("colAction")}</span>,
      align: "right",
      cell: actionCell,
    },
  ];

  return (
    <DataTable<BankTransaction>
      columns={columns}
      rows={transactions}
      rowKey={(tx) => tx.id}
      caption={t("tableCaption")}
      empty={empty}
    />
  );
}
