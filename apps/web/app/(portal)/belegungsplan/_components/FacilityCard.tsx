"use client";

import type { Facility } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { belegungsplanDict } from "../i18n";
import { KIND_LABEL_KEY } from "../helpers";

/**
 * Hallen-Karte im Grid: Art-Chip, Name, Ort, Kapazität und die Zahl der
 * kommenden Buchungen. Die ganze Karte ist ein Button, der das Detail-Sheet
 * öffnet (kommende Buchungen nach Datum + „Hier buchen").
 */
export function FacilityCard({
  facility,
  upcomingCount,
  onOpen,
}: {
  facility: Facility;
  upcomingCount: number;
  onOpen: () => void;
}) {
  const t = useT(belegungsplanDict);

  const upcomingLabel =
    upcomingCount === 0
      ? t("upcomingNone")
      : upcomingCount === 1
        ? t("upcomingOne")
        : t("upcomingMany", { n: upcomingCount });

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={facility.name}
        className="group flex h-full w-full flex-col gap-3 rounded-xl border border-line bg-surface p-5 text-left shadow-card transition-all duration-150 hover:border-line-strong hover:shadow-pop"
      >
        <div className="flex items-center gap-2.5">
          <Badge tone="brand">{t(KIND_LABEL_KEY[facility.kind])}</Badge>
          {facility.capacity !== undefined && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-caption text-ink-soft">
              <Icon name="members" className="ic h-[15px] w-[15px] text-ink-faint" />
              <span className="tabular-nums">{t("capacityValue", { n: facility.capacity })}</span>
            </span>
          )}
        </div>

        <h3 className="font-display text-h3 tracking-[-0.01em] text-ink transition-colors duration-150 group-hover:text-brand-ink">
          {facility.name}
        </h3>

        {facility.address && (
          <p className="inline-flex items-start gap-1.5 text-caption text-ink-soft">
            <Icon name="globe" className="ic mt-px h-[15px] w-[15px] flex-none text-ink-faint" />
            <span className="line-clamp-2">{facility.address}</span>
          </p>
        )}

        <div className="mt-auto flex items-center gap-1.5 border-t border-line pt-3 text-caption text-ink-faint">
          <Icon name="clock" className="ic h-[15px] w-[15px]" />
          <span>{upcomingLabel}</span>
        </div>
      </button>
    </li>
  );
}
