"use client";

import { useMemo, type ReactNode } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDateShort } from "@/lib/format";
import { fullName } from "@/lib/data";
import type { Invoice, LedgerEntry } from "@/lib/types";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { IconTile } from "@/components/ui/IconTile";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { kassenbuchDict } from "../i18n";
import { sumLedgerRows, type LedgerRow } from "../derive";
import { invoiceNumberById, orgIcon } from "../../derive";

/**
 * Kassenbuch-Tabelle (Seriositätszone, DESIGN-SYSTEM §3.3): Datum, Buchung
 * (Mensch = Avatar, Organisation = Icon-Kachel — nie Monogramme), Kategorie,
 * Betrag (Mono, echtes −, Einnahme grün), laufender Saldo und die Storno-Aktion.
 *
 * Der Saldo ist der ECHTE Kontostand nach der jeweiligen Buchung (über das
 * gesamte Kassenbuch gerechnet, siehe derive) — Filter blenden nur Zeilen aus.
 * GoBD: kein Löschen/Bearbeiten. Nur nicht-stornierte Originalbuchungen bieten
 * „Stornieren"; Storno-Gegenbuchungen und bereits stornierte Zeilen zeigen
 * stattdessen einen Status-Chip. Die Summenzeile rechnet über die SICHTBAREN
 * (gefilterten) Zeilen.
 */
export function LedgerTable({
  rows,
  invoices,
  onReverse,
  onCorrect,
  empty,
}: {
  rows: LedgerRow[];
  invoices: Invoice[];
  onReverse: (entry: LedgerEntry) => void;
  /** Ein-Klick-Korrektur (GoBD): Storno + vorbefülltes Neu-Erfassen. */
  onCorrect: (entry: LedgerEntry) => void;
  empty?: ReactNode;
}) {
  const t = useT(kassenbuchDict);
  const { locale } = useLocale();

  const sums = useMemo(() => sumLedgerRows(rows), [rows]);

  const entryCell = (row: LedgerRow): ReactNode => {
    const cp = row.entry.counterparty;
    const invoiceNumber = row.entry.invoiceId
      ? invoiceNumberById(invoices, row.entry.invoiceId)
      : undefined;
    const secondary = row.isReversal
      ? t("reversalOf")
      : invoiceNumber
        ? t("linkedInvoice", { number: invoiceNumber })
        : cp.kind === "org"
          ? cp.name
          : row.member
            ? fullName(row.member)
            : "";
    return (
      <span className="flex min-w-0 items-center gap-3">
        {cp.kind === "person" && row.member ? (
          <Avatar
            personId={row.member.id}
            firstName={row.member.firstName}
            lastName={row.member.lastName}
            size="s"
          />
        ) : (
          <IconTile icon={orgIcon(cp.kind === "org" ? cp.name : "")} size="s" />
        )}
        <span className="grid min-w-0 gap-0.5">
          <span
            className={`truncate text-[14px] ${row.reversed ? "text-ink-faint line-through" : "text-ink"}`}
          >
            {row.entry.description}
          </span>
          <span className="truncate text-caption text-ink-faint">{secondary}</span>
        </span>
      </span>
    );
  };

  const categoryCell = (row: LedgerRow): ReactNode => {
    const name = row.entry.categoryName ?? row.entry.category;
    if (!name) return <span className="text-ink-faint">{t("noCategory")}</span>;
    return (
      <Badge tone={row.entry.categoryKind === "income" ? "success" : "neutral"}>{name}</Badge>
    );
  };

  const amountCell = (row: LedgerRow): ReactNode => {
    const cents = row.entry.amountCents;
    const className = row.reversed
      ? "text-ink-faint line-through"
      : cents > 0
        ? "text-success"
        : undefined;
    return (
      <span className={className}>
        {cents > 0 ? "+" : ""}
        {formatEUR(cents, locale)}
      </span>
    );
  };

  const actionCell = (row: LedgerRow): ReactNode => {
    if (row.isReversal) return <Badge tone="info">{t("badgeReversal")}</Badge>;
    if (row.reversed) return <Badge tone="neutral">{t("badgeReversed")}</Badge>;
    return (
      <span className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" icon="edit" onClick={() => onCorrect(row.entry)}>
          {t("correctAction")}
        </Button>
        <Button variant="ghost" size="sm" icon="close" onClick={() => onReverse(row.entry)}>
          {t("reverseAction")}
        </Button>
      </span>
    );
  };

  const columns: Column<LedgerRow>[] = [
    {
      id: "date",
      header: t("colDate"),
      cell: (row) => (
        <span className="whitespace-nowrap font-mono text-[12.5px] tabular-nums text-ink-faint">
          {formatDateShort(row.entry.date, locale)}
        </span>
      ),
      footer: t("footCount", { n: rows.length }),
    },
    { id: "entry", header: t("colEntry"), cell: entryCell },
    {
      id: "category",
      header: t("colCategory"),
      cell: categoryCell,
      footer: t("footNet"),
    },
    {
      id: "amount",
      header: t("colAmount"),
      mono: true,
      cell: amountCell,
      footer: formatEUR(sums.netCents, locale),
    },
    {
      id: "balance",
      header: t("colBalance"),
      mono: true,
      cellClassName: "text-ink-faint",
      cell: (row) => formatEUR(row.balanceCents, locale),
    },
    {
      id: "action",
      header: <span className="sr-only">{t("colAction")}</span>,
      align: "right",
      cell: actionCell,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.entry.id}
      caption={t("tableCaption")}
      empty={empty}
    />
  );
}
