"use client";

import type { TrainingSlot } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { trainingsplanDict } from "../i18n";
import { slotTimeRange, type SlotLookups } from "../helpers";

/**
 * Eine Trainingszeit als Karte: Zeitspanne (prominent), Team-Chip, Ort
 * (Halle und/oder Freitext), Trainer:in und optionale Notiz. Für Trainer:innen
 * erscheinen kompakte Bearbeiten-/Löschen-Aktionen — die Sichtbarkeit ist nur
 * Komfort, die Durchsetzung bleibt serverseitig (RLS/API, 403 → Toast).
 *
 * Wochentag-agnostisch: der Tag steht in der Spalten-/Abschnitts-Überschrift.
 */
export function SlotCard({
  slot,
  lookups,
  canManage,
  onEdit,
  onDelete,
}: {
  slot: TrainingSlot;
  lookups: SlotLookups;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT(trainingsplanDict);

  const teamName = slot.teamId ? lookups.teamNames.get(slot.teamId) : undefined;
  const facilityName = slot.facilityId ? lookups.facilityNames.get(slot.facilityId) : undefined;
  const coachName = slot.coachMemberId ? lookups.memberNames.get(slot.coachMemberId) : undefined;

  // Ort: Halle bevorzugt, Freitext ergänzend (beides möglich).
  const place = [facilityName, slot.location].filter(Boolean).join(" · ");

  return (
    <article className="grid gap-2 rounded-xl border border-line bg-surface p-3.5 shadow-card">
      <div className="flex items-start gap-2">
        <span className="inline-flex items-center gap-1.5 font-display text-[15px] font-bold tabular-nums tracking-[-0.01em] text-ink">
          <Icon name="clock" className="ic h-[15px] w-[15px] text-brand-ink" />
          {slotTimeRange(slot)}
        </span>
        {canManage && (
          <span className="ml-auto flex flex-none items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              aria-label={t("editAction")}
              className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-soft transition-colors duration-150 hover:bg-sunken hover:text-ink"
            >
              <Icon name="edit" className="ic h-[15px] w-[15px]" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={t("deleteAction")}
              className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink-soft transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
            >
              <Icon name="close" className="ic h-[15px] w-[15px]" />
            </button>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {slot.teamId ? (
          <Badge tone="brand" icon="teams">
            {teamName ?? t("fTeam")}
          </Badge>
        ) : (
          <Badge tone="neutral" icon="members">
            {t("metaWholeClub")}
          </Badge>
        )}
      </div>

      {place && (
        <p className="inline-flex items-start gap-1.5 text-caption text-ink-soft">
          <Icon name="pin" className="ic mt-px h-[14px] w-[14px] flex-none text-ink-faint" />
          <span className="min-w-0 break-words">{place}</span>
        </p>
      )}

      {coachName && (
        <p className="inline-flex items-center gap-1.5 text-caption text-ink-soft">
          <Icon name="user" className="ic h-[14px] w-[14px] flex-none text-ink-faint" />
          <span className="min-w-0 truncate">{coachName}</span>
        </p>
      )}

      {slot.note && <p className="text-caption leading-[18px] text-ink-faint">{slot.note}</p>}
    </article>
  );
}
