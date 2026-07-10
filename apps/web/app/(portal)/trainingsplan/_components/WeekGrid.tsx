"use client";

import type { TrainingSlot } from "@/lib/types";
import { weekdayLabels } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { trainingsplanDict } from "../i18n";
import { todayWeekday, type SlotLookups, type WeekdayGroup } from "../helpers";
import { SlotCard } from "./SlotCard";

/**
 * Wochenraster Mo–So: sieben Spalten (auch leere) nebeneinander. Auf schmalen
 * Viewports scrollt das Raster horizontal (min-width) — die Listen-Ansicht ist
 * die vertikale Alternative. Die heutige Spalte wird hervorgehoben.
 */
export function WeekGrid({
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
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="grid min-w-[60rem] grid-cols-7 gap-3">
        {groups.map((group) => {
          const isToday = group.weekday === today;
          return (
            <section key={group.weekday} className="min-w-0">
              <header
                className={`mb-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${
                  isToday ? "bg-brand-soft text-brand-ink" : "bg-sunken text-ink-soft"
                }`}
              >
                <h3 className="truncate text-[13px] font-bold">
                  {weekdayLabels[group.weekday][locale]}
                </h3>
                {isToday && (
                  <Badge tone="brand" className="ml-1">
                    {t("today")}
                  </Badge>
                )}
                <span
                  className="ml-auto text-[11.5px] font-extrabold tabular-nums text-ink-faint"
                  aria-label={t("slotCountAria", { n: group.slots.length })}
                >
                  {group.slots.length}
                </span>
              </header>

              {group.slots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-caption text-ink-faint">
                  {t("emptyDay")}
                </p>
              ) : (
                <div className="grid gap-2.5">
                  {group.slots.map((slot) => (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      lookups={lookups}
                      canManage={canManage}
                      onEdit={() => onEdit(slot)}
                      onDelete={() => onDelete(slot)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
