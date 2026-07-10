"use client";

import type { RoutineMarker } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { formatDurationMs } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { kuerenDict } from "../../i18n";
import { LoopIcon } from "./PlayerIcons";

/**
 * Zeitmarken-Liste (DESIGN-SYSTEM §3.8): Mono-Zeit-Badge in Honig,
 * Elementname + RollArt-Kürzel-Chip, Klick = Sprung („ab hier abspielen").
 * Marker innerhalb des aktiven A–B-Loops tragen den Honig-Chip „im Loop".
 */

export function MarkerList({
  markers,
  loopOn,
  loopA,
  loopB,
  onJump,
  onAdd,
}: {
  markers: RoutineMarker[];
  loopOn: boolean;
  loopA: number;
  loopB: number;
  onJump: (ms: number) => void;
  onAdd: () => void;
}) {
  const t = useT(kuerenDict);

  return (
    <Card>
      <CardHeader
        eyebrow={t("markersEyebrow")}
        title={t("markersTitle")}
        action={
          <Button variant="ghost" size="sm" icon="plus" onClick={onAdd}>
            {t("addMarker")}
          </Button>
        }
      />
      <ul className="grid gap-0.5">
        {markers.map((marker) => {
          const time = formatDurationMs(marker.timeMs);
          const inLoop = loopOn && marker.timeMs >= loopA && marker.timeMs <= loopB;
          return (
            <li key={marker.id}>
              <button
                type="button"
                onClick={() => onJump(marker.timeMs)}
                aria-label={`${t("playFrom", { time })} — ${marker.label}`}
                className="group flex min-h-14 w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-sunken"
              >
                <span className="flex-none rounded-sm bg-honey-soft px-2 py-1 font-mono text-[12.5px] font-bold tabular-nums text-honey-deep">
                  {time}
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <span className="text-[14px] font-semibold text-ink">{marker.label}</span>
                  {marker.elementCode && <Badge tone="neutral">{marker.elementCode}</Badge>}
                  {inLoop && (
                    <Badge tone="honey">
                      <LoopIcon className="ic h-[13px] w-[13px]" />
                      {t("inLoop")}
                    </Badge>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full border border-line text-ink-faint transition-colors duration-150 group-hover:border-transparent group-hover:bg-brand-soft group-hover:text-brand-ink"
                >
                  <Icon name="play" className="ic ml-px h-[13px] w-[13px] fill-current stroke-none" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
