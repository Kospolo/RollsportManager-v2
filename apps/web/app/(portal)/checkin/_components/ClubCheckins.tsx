"use client";

import { useMemo } from "react";
import type { Checkin, Id } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { checkinDict } from "../i18n";
import { checkinStats } from "../logic";
import { CheckinList } from "./CheckinList";

/**
 * Vereins-Check-ins (nur Trainer:innen): Kennzahlen (gesamt/Woche/Monat) plus
 * die vollständige Historie des Vereins mit Mitgliedsname, Termin und Löschen.
 * Rein lesend aufgebaut; das Löschen läuft über den Bestätigungs-Dialog des
 * Screens (die Facade setzt das Trainer-Recht serverseitig durch, 403 → Toast).
 */
export function ClubCheckins({
  checkins,
  memberName,
  eventTitle,
  now,
  onDelete,
}: {
  checkins: Checkin[];
  memberName: (memberId: Id) => string;
  eventTitle: (eventId?: Id) => string | undefined;
  now: Date;
  onDelete: (checkin: Checkin) => void;
}) {
  const t = useT(checkinDict);
  const stats = useMemo(() => checkinStats(checkins, now), [checkins, now]);

  return (
    <section className="grid gap-4">
      <SectionHeader level={2} title={t("clubTitle")} sub={t("clubSub")} />

      <ul className="grid list-none gap-3 sm:grid-cols-3">
        <li>
          <KpiTile label={t("kpiTotal")} value={String(stats.total)} tone="neutral" />
        </li>
        <li>
          <KpiTile label={t("kpiWeek")} value={String(stats.thisWeek)} tone="info" />
        </li>
        <li>
          <KpiTile label={t("kpiMonth")} value={String(stats.thisMonth)} tone="success" />
        </li>
      </ul>

      <CheckinList
        entries={checkins}
        eventTitle={eventTitle}
        memberName={memberName}
        onDelete={onDelete}
        emptyTitle={t("clubEmptyTitle")}
        emptyBody={t("clubEmptyBody")}
      />
    </section>
  );
}
