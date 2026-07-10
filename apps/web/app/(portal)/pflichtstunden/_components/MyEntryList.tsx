"use client";

import { useMemo } from "react";
import type { DutyEntry } from "@/lib/types";
import { dutyKindLabels } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { pflichtstundenDict, DUTY_KIND_TONE } from "../i18n";
import { formatHours } from "../logic";

/**
 * „Meine Einträge": die selbst erfassten Stunden — neueste zuerst. Jede Zeile
 * zeigt Datum, Art (farbige Pille), Stundenzahl und Status (genehmigt/offen).
 * Eigene Einträge lassen sich bearbeiten oder löschen (Facade, eigene ODER
 * Trainer; ein 403 kommt als Toast + Rollback aus der jeweiligen Aktion).
 */
export function MyEntryList({
  entries,
  onEdit,
  onDelete,
}: {
  entries: DutyEntry[];
  onEdit: (entry: DutyEntry) => void;
  onDelete: (entry: DutyEntry) => void;
}) {
  const t = useT(pflichtstundenDict);
  const { locale } = useLocale();

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.activityDate.localeCompare(a.activityDate)),
    [entries],
  );

  return (
    <section className="grid gap-3">
      <SectionHeader level={2} title={t("listTitle")} sub={t("listSub")} />
      {sorted.length === 0 ? (
        <EmptyState icon="clock" title={t("listEmptyTitle")} body={t("listEmptyBody")} />
      ) : (
        <ul className="grid list-none gap-3">
          {sorted.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-4 shadow-card"
            >
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[15px] font-bold tabular-nums text-ink">
                    {formatHours(entry.hours, locale)}
                  </span>
                  <Badge tone={DUTY_KIND_TONE[entry.kind]}>
                    {dutyKindLabels[entry.kind][locale]}
                  </Badge>
                  <Badge tone={entry.approved ? "success" : "neutral"}>
                    {entry.approved ? t("statusApproved") : t("statusPending")}
                  </Badge>
                </div>
                <span className="text-caption text-ink-soft">
                  {formatDate(entry.activityDate, locale)}
                  {entry.note ? ` · ${entry.note}` : ""}
                </span>
              </div>

              <div className="flex flex-none flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" icon="edit" onClick={() => onEdit(entry)}>
                  {t("editAction")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDelete(entry)}>
                  {t("deleteAction")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
