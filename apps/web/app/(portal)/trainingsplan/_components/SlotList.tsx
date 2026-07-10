"use client";

import type { TrainingSlot } from "@/lib/types";
import { weekdayLabels } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { trainingsplanDict } from "../i18n";
import { todayWeekday, type SlotLookups, type WeekdayGroup } from "../helpers";
import { SlotCard } from "./SlotCard";

/**
 * Listen-Ansicht: nur belegte Wochentage als Abschnitte untereinander, je
 * Abschnitt ein responsives Karten-Raster. Vertikale (mobil-freundliche)
 * Alternative zum Wochenraster. Der heutige Tag wird markiert.
 */
export function SlotList({
  groups,
  lookups,
  canManage,
  onEdit,
  onDelete,
}: {
  groups: WeekdayGroup[];
  lookups: SlotLookups;
  canManage: boolean;
  onEdit: (slot: TrainingSlot) => void;
  onDelete: (slot: TrainingSlot) => void;
}) {
  const t = useT(trainingsplanDict);
  const { locale } = useLocale();
  const today = todayWeekday();

  return (
    <div className="grid gap-6">
      {groups.map((group) => {
        const isToday = group.weekday === today;
        return (
          <section key={group.weekday} className="grid gap-3">
            <header className="flex items-center gap-2 border-b border-line pb-2">
              <h3 className="font-display text-h3 tracking-[-0.01em] text-ink">
                {weekdayLabels[group.weekday][locale]}
              </h3>
              {isToday && <Badge tone="brand">{t("today")}</Badge>}
              <span
                className="ml-auto text-caption font-extrabold tabular-nums text-ink-faint"
                aria-label={t("slotCountAria", { n: group.slots.length })}
              >
                {group.slots.length}
              </span>
            </header>

            <ul className="grid list-none gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.slots.map((slot) => (
                <li key={slot.id} className="min-w-0">
                  <SlotCard
                    slot={slot}
                    lookups={lookups}
                    canManage={canManage}
                    onEdit={() => onEdit(slot)}
                    onDelete={() => onDelete(slot)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
