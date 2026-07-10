"use client";

import { useMemo } from "react";
import type { Checkin, Id } from "@/lib/types";
import { checkinMethodLabels } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { checkinDict } from "../i18n";

/**
 * Wiederverwendbare Check-in-Liste (neueste zuerst): pro Zeile Erfassungsart
 * (QR/Manuell), optional Mitgliedsname (Vereins-Historie), Termin-Bezug und
 * Zeitpunkt. `onDelete` blendet die Löschen-Aktion ein — die zeigen wir NUR
 * Trainer:innen; die verbindliche Durchsetzung bleibt serverseitig (403).
 */
export function CheckinList({
  entries,
  eventTitle,
  memberName,
  onDelete,
  emptyTitle,
  emptyBody,
}: {
  entries: Checkin[];
  eventTitle: (eventId?: Id) => string | undefined;
  /** Gesetzt = Mitgliedsname anzeigen (Vereins-Historie der Trainer:innen). */
  memberName?: (memberId: Id) => string;
  /** Gesetzt = Löschen-Aktion anzeigen (nur Trainer:innen). */
  onDelete?: (checkin: Checkin) => void;
  emptyTitle: string;
  emptyBody: string;
}) {
  const t = useT(checkinDict);
  const { locale } = useLocale();

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt)),
    [entries],
  );

  if (sorted.length === 0) {
    return <EmptyState icon="clock" title={emptyTitle} body={emptyBody} />;
  }

  return (
    <ul className="grid list-none gap-3">
      {sorted.map((entry) => {
        const title = eventTitle(entry.eventId);
        return (
          <li
            key={entry.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-4 shadow-card"
          >
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex flex-wrap items-center gap-2">
                {memberName && (
                  <span className="truncate font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
                    {memberName(entry.memberId)}
                  </span>
                )}
                <Badge tone={entry.method === "qr" ? "info" : "neutral"}>
                  {checkinMethodLabels[entry.method][locale]}
                </Badge>
                {title && <Badge tone="neutral">{title}</Badge>}
              </div>
              <span className="text-caption text-ink-soft tabular-nums">
                {formatDateTime(entry.checkedInAt, locale)}
              </span>
            </div>

            {onDelete && (
              <Button size="sm" variant="ghost" onClick={() => onDelete(entry)}>
                {t("deleteAction")}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
