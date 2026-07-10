"use client";

import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, formatDateShort } from "@/lib/format";
import { fullName, ledgerBalanceCents } from "@/lib/mock";
import { Card, CardHeader, CardFooter } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { IconTile } from "@/components/ui/IconTile";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { financeDict } from "../i18n";
import { CATEGORY_KEY, invoiceNumberById, ledgerRows, orgIcon, type LedgerRow } from "../derive";

/**
 * Kassenbuch-Auszug (Seriositätszone): Menschen = Avatar, Organisationen =
 * Icon-Kachel (radius-org, nie Monogramme). Beträge Mono mit echtem −,
 * laufender Saldo in ink-faint — neueste Buchung zuerst.
 */
export function LedgerCard() {
  const t = useT(financeDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const categoryLabel = (category: string) => {
    const key = CATEGORY_KEY[category];
    return key ? t(key as keyof (typeof financeDict)["de"]) : category;
  };

  const entryCell = (row: LedgerRow) => {
    const cp = row.entry.counterparty;
    const invoiceNumber = row.entry.invoiceId
      ? invoiceNumberById(row.entry.invoiceId)
      : undefined;
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
          <span className="truncate text-[14px] text-ink">{row.entry.description}</span>
          <span className="truncate text-caption text-ink-faint">
            {invoiceNumber
              ? t("linkedInvoice", { number: invoiceNumber })
              : cp.kind === "org"
                ? cp.name
                : row.member
                  ? fullName(row.member)
                  : ""}
          </span>
        </span>
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
      footer: t("ledgerFootCount", { n: ledgerRows.length }),
    },
    { id: "entry", header: t("colEntry"), cell: entryCell },
    {
      id: "category",
      header: t("colCategory"),
      cell: (row) => <Badge tone="neutral">{categoryLabel(row.entry.category)}</Badge>,
      footer: t("footNet"),
    },
    {
      id: "amount",
      header: t("colAmount"),
      mono: true,
      cell: (row) => (
        <span className={row.entry.amountCents > 0 ? "text-success" : undefined}>
          {row.entry.amountCents > 0 ? "+" : ""}
          {formatEUR(row.entry.amountCents, locale)}
        </span>
      ),
      footer: formatEUR(ledgerBalanceCents, locale),
    },
    {
      id: "balance",
      header: t("colBalance"),
      mono: true,
      cellClassName: "text-ink-faint",
      cell: (row) => formatEUR(row.balanceCents, locale),
    },
  ];

  return (
    <Card>
      <CardHeader
        eyebrow={t("ledgerEyebrow")}
        title={t("ledgerTitle")}
        action={
          <>
            <Badge tone="neutral">
              {t("ledgerBalanceLabel")}
              <span className="font-mono text-mono-table font-bold tabular-nums">
                {formatEUR(ledgerBalanceCents, locale)}
              </span>
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              icon="download"
              onClick={() => showToast(t("ledgerExportToast"), { tone: "success" })}
            >
              {t("ledgerExport")}
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={ledgerRows}
        rowKey={(row) => row.entry.id}
        caption={t("ledgerCaption")}
      />
      <CardFooter>
        <span>{t("ledgerFootLeft")}</span>
        <span>{t("ledgerFootRight")}</span>
      </CardFooter>
    </Card>
  );
}
