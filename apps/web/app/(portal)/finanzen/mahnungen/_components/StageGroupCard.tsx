"use client";

import { useT, useLocale } from "@/lib/i18n";
import { formatEUR, relativeDays } from "@/lib/format";
import { fullName } from "@/lib/data";
import type { Id } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DunningBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { mahnungenDict, type MahnungenKey } from "../i18n";
import { mailStageForLevel, type DunningItem, type StageBucket } from "../derive";
import type { MailStage } from "../../_components/MailPreviewModal";

/**
 * Ampel-Gruppe einer Mahnstufe (0–3): Kopf mit Stufen-Badge, Anzahl und
 * Summe (Mono), darunter die offenen Posten dieser Stufe. Leere Stufen zeigen
 * eine dezente Zeile statt einer Tabelle — die Treppe bleibt sichtbar.
 */

const STAGE_TITLE: Record<0 | 1 | 2 | 3, MahnungenKey> = {
  0: "stage0Title",
  1: "stage1Title",
  2: "stage2Title",
  3: "stage3Title",
};

export function StageGroupCard({
  bucket,
  onPreviewMail,
}: {
  bucket: StageBucket;
  /** Mahn-E-Mail eines Postens ansehen (Modal, nur Lesen). */
  onPreviewMail: (invoiceId: Id, stage: MailStage) => void;
}) {
  const t = useT(mahnungenDict);
  const { locale } = useLocale();

  const dueCell = (item: DunningItem) => (
    <span className="whitespace-nowrap text-[13.5px] text-ink-soft">
      {item.overdue
        ? t(item.overdueDays === 1 ? "dueOverdueOne" : "dueOverdueMany", {
            n: item.overdueDays,
          })
        : relativeDays(item.invoice.dueAt, locale)}
    </span>
  );

  const columns: Column<DunningItem>[] = [
    {
      id: "member",
      header: t("colMember"),
      cell: (item) => (
        <span className="flex min-w-0 items-center gap-3">
          {item.member ? (
            <Avatar
              personId={item.member.id}
              firstName={item.member.firstName}
              lastName={item.member.lastName}
            />
          ) : null}
          <span className="grid min-w-0 gap-0.5">
            <span className="truncate text-[14px] font-bold leading-tight text-ink">
              {item.member ? fullName(item.member) : "—"}
            </span>
            {item.member && (
              <span className="text-caption text-ink-faint">
                {t("memberSince", { year: item.member.joinedAt.slice(0, 4) })}
              </span>
            )}
          </span>
        </span>
      ),
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
    {
      id: "amount",
      header: t("colAmount"),
      mono: true,
      cell: (item) => formatEUR(item.invoice.amountCents, locale),
    },
    {
      id: "action",
      header: "",
      align: "right",
      cell: (item) => (
        <span className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            icon="mail"
            onClick={() => onPreviewMail(item.invoice.id, mailStageForLevel(item.level))}
            aria-label={t("previewMailAria", {
              name: item.member ? fullName(item.member) : item.invoice.number,
            })}
          >
            {t("previewMail")}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader
        eyebrow={t("stageEyebrow", { n: bucket.level })}
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            <DunningBadge level={bucket.level} />
            {t(STAGE_TITLE[bucket.level])}
          </span>
        }
        action={
          <span className="text-[13.5px] text-ink-soft">
            {t("stageMeta", {
              n: bucket.items.length,
              sum: formatEUR(bucket.sumCents, locale),
            })}
          </span>
        }
      />
      {bucket.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-canvas px-4 py-3 text-[13.5px] text-ink-faint">
          {t("stageEmpty")}
        </p>
      ) : (
        <DataTable
          columns={columns}
          rows={bucket.items}
          rowKey={(item) => item.invoice.id}
          caption={t(STAGE_TITLE[bucket.level])}
        />
      )}
    </Card>
  );
}
