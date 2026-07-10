"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { DutyEntry, Id } from "@/lib/types";
import { dutyKindLabels } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { pflichtstundenDict, DUTY_KIND_TONE } from "../i18n";
import { formatHours } from "../logic";

/**
 * Offene Genehmigungen (nur Trainer:innen): alle noch nicht freigegebenen
 * Einträge des Vereins mit „Genehmigen"-Aktion (data.updateDutyEntry approved).
 * Serverseitig darf `approved` NUR der Trainerstab setzen (DB-Trigger + 403) —
 * ein 403 kommt hier als Klartext-Toast, die Liste bleibt unverändert.
 */
export function PendingApprovals({
  entries,
  memberName,
  onChanged,
}: {
  /** bereits auf approved === false gefiltert */
  entries: DutyEntry[];
  memberName: (memberId: Id) => string;
  onChanged: () => void;
}) {
  const t = useT(pflichtstundenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<Id | null>(null);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.activityDate.localeCompare(a.activityDate)),
    [entries],
  );

  const approve = async (entry: DutyEntry) => {
    if (busyId) return;
    setBusyId(entry.id);
    try {
      await data.updateDutyEntry(entry.id, { approved: true });
      showToast(t("approvedToast"), { tone: "success" });
      onChanged();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("approveForbidden") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="grid gap-3">
      <SectionHeader level={2} title={t("approvalsTitle")} sub={t("approvalsSub")} />
      {sorted.length === 0 ? (
        <EmptyState
          icon="check"
          title={t("approvalsEmptyTitle")}
          body={t("approvalsEmptyBody")}
        />
      ) : (
        <ul className="grid list-none gap-3">
          {sorted.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-4 shadow-card"
            >
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
                    {memberName(entry.memberId)}
                  </span>
                  <span className="font-mono text-[15px] font-bold tabular-nums text-ink">
                    {formatHours(entry.hours, locale)}
                  </span>
                  <Badge tone={DUTY_KIND_TONE[entry.kind]}>
                    {dutyKindLabels[entry.kind][locale]}
                  </Badge>
                </div>
                <span className="text-caption text-ink-soft">
                  {formatDate(entry.activityDate, locale)}
                  {entry.note ? ` · ${entry.note}` : ""}
                </span>
              </div>

              <Button
                size="sm"
                icon="check"
                disabled={busyId === entry.id}
                onClick={() => approve(entry)}
              >
                {t("approveAction")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
