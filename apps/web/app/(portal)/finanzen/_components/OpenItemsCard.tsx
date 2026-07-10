"use client";

import { useState } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, relativeDays } from "@/lib/format";
import { fullName } from "@/lib/data";
import { Card, CardHeader, CardFooter } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { DunningBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { financeDict } from "../i18n";
import { levelToFilter, sumCents, type LevelFilter, type OpenItem } from "../derive";

/**
 * Offene-Posten-Tabelle (Seriositätszone): Filter-Chips aktualisieren die
 * Summenzeile im Footer; „Gesamt offen" ist IMMER die Summe aller Posten
 * und damit deckungsgleich mit der KPI-Kachel (gleiche Datenbasis).
 */
export function OpenItemsCard({
  items,
  onRemind,
  onViewDunning,
}: {
  items: OpenItem[];
  /** Stufe 0 → 1 setzen (optimistisch, lokal) */
  onRemind: (item: OpenItem) => void;
  /** Mahn-E-Mail der Stufe ansehen (Modal) */
  onViewDunning: (item: OpenItem) => void;
}) {
  const t = useT(financeDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<LevelFilter>("all");

  const filtered =
    filter === "all" ? items : items.filter((item) => levelToFilter(item.level) === filter);
  const totalCents = sumCents(items);
  const openCount = items.filter((item) => item.level === 0).length;

  const filterOptions: FilterChipOption<LevelFilter>[] = [
    { value: "all", label: t("fAll"), count: items.length },
    { value: "open", label: t("fOpen"), count: items.filter((i) => i.level === 0).length },
    { value: "reminded", label: t("fReminded"), count: items.filter((i) => i.level === 1).length },
    { value: "dunned", label: t("fDunned"), count: items.filter((i) => i.level >= 2).length },
  ];

  const dueCell = (item: OpenItem) => (
    <span className="whitespace-nowrap text-[13.5px] text-ink-soft">
      {item.overdueDays >= 1
        ? t(item.overdueDays === 1 ? "dueSinceOne" : "dueSinceMany", { n: item.overdueDays })
        : relativeDays(item.invoice.dueAt, locale)}
    </span>
  );

  const actionCell = (item: OpenItem) => {
    if (item.level === 0) {
      return (
        <Button
          variant="secondary"
          size="sm"
          icon="mail"
          onClick={() => {
            onRemind(item);
            showToast(t("remindToast", { name: fullName(item.member) }), { tone: "success" });
          }}
        >
          {t("actionRemind")}
        </Button>
      );
    }
    if (item.level === 1) {
      return (
        <Button
          variant="ghost"
          size="sm"
          icon="mail"
          onClick={() =>
            showToast(t("remindAgainToast", { name: fullName(item.member) }), { tone: "success" })
          }
        >
          {t("actionRemindAgain")}
        </Button>
      );
    }
    return (
      <Button variant="ghost" size="sm" onClick={() => onViewDunning(item)}>
        {t("actionViewDunning")}
      </Button>
    );
  };

  const columns: Column<OpenItem>[] = [
    {
      id: "member",
      header: t("colMember"),
      cell: (item) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar
            personId={item.member.id}
            firstName={item.member.firstName}
            lastName={item.member.lastName}
          />
          <span className="grid min-w-0 gap-0.5">
            <span className="truncate text-[14px] font-bold leading-tight text-ink">
              {fullName(item.member)}
            </span>
            <span className="text-caption text-ink-faint">
              {t("memberSince", { year: item.member.joinedAt.slice(0, 4) })}
            </span>
          </span>
        </span>
      ),
      footer: t("shownCount", { n: filtered.length }),
    },
    {
      id: "invoice",
      header: t("colInvoice"),
      cell: (item) => (
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate text-[14px] text-ink">{item.invoice.title}</span>
          <span className="font-mono text-[11.5px] tabular-nums text-ink-faint">
            {item.invoice.number}
          </span>
        </span>
      ),
    },
    { id: "due", header: t("colDue"), cell: dueCell },
    { id: "level", header: t("colLevel"), cell: (item) => <DunningBadge level={item.level} /> },
    {
      id: "amount",
      header: t("colAmount"),
      mono: true,
      cell: (item) => formatEUR(item.invoice.amountCents, locale),
      footer: formatEUR(sumCents(filtered), locale),
    },
    {
      id: "action",
      header: t("colAction"),
      align: "right",
      cell: (item) => <span className="flex justify-end">{actionCell(item)}</span>,
    },
  ];

  return (
    <Card>
      <CardHeader
        eyebrow={t("openEyebrow")}
        title={t("openTitle")}
        action={
          <Button
            variant="ghost"
            size="sm"
            icon="mail"
            disabled={openCount === 0}
            onClick={() =>
              showToast(t("bulkRemindToast", { n: openCount }), { tone: "info" })
            }
          >
            {t("bulkRemind")}
          </Button>
        }
      />
      <FilterChips
        options={filterOptions}
        value={filter}
        onChange={setFilter}
        label={t("filterLabel")}
        className="mb-4"
      />
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(item) => item.invoice.id}
        caption={t("tableCaption")}
        empty={
          <EmptyState
            icon="check"
            title={t("emptyFilterTitle")}
            body={t("emptyFilterBody")}
            action={
              <Button variant="ghost" onClick={() => setFilter("all")}>
                {t("emptyFilterCta")}
              </Button>
            }
          />
        }
      />
      <CardFooter>
        <span className="flex flex-wrap items-center gap-2">
          {t("footTotalLabel")}
          <span className="font-mono text-mono-table font-bold tabular-nums text-ink">
            {formatEUR(totalCents, locale)}
          </span>
          · {t("footTotalCount", { n: items.length })}
        </span>
        <span>{t("footMicro")}</span>
      </CardFooter>
    </Card>
  );
}
