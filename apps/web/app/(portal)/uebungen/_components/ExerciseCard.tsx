"use client";

import type { Exercise, Member } from "@/lib/types";
import { memberById } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { CATEGORY_KEY, formatDurationSeconds, uebungenDict } from "../i18n";
import { DifficultyDots } from "./DifficultyDots";

/**
 * Übungs-Karte im Grid: Kategorie-Chip, Name, Schwierigkeit, optionale
 * Dauer/Video-Marker und Autor:in. Die ganze Karte ist ein Button, der die
 * Detailansicht öffnet (Anleitung/Dauer/Video im Dialog).
 */
export function ExerciseCard({
  exercise,
  members,
  onOpen,
}: {
  exercise: Exercise;
  members: Member[];
  onOpen: () => void;
}) {
  const t = useT(uebungenDict);
  const author = memberById(members, exercise.createdByMemberId);
  const authorName = author ? `${author.firstName} ${author.lastName}` : t("unknownAuthor");

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={exercise.name}
        className="group flex h-full w-full flex-col gap-3 rounded-xl border border-line bg-surface p-5 text-left shadow-card transition-all duration-150 hover:border-line-strong hover:shadow-pop"
      >
        <div className="flex items-center gap-2.5">
          <Badge tone="brand">{t(CATEGORY_KEY[exercise.category])}</Badge>
          {exercise.videoUrl && (
            <Badge tone="info" icon="play" className="ml-auto">
              {t("videoBadge")}
            </Badge>
          )}
        </div>

        <h3 className="font-display text-h3 tracking-[-0.01em] text-ink transition-colors duration-150 group-hover:text-brand-ink">
          {exercise.name}
        </h3>

        {exercise.description && (
          <p className="line-clamp-2 text-caption text-ink-soft">{exercise.description}</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
          <DifficultyDots value={exercise.difficulty} />
          {exercise.durationSeconds !== undefined && (
            <span className="inline-flex items-center gap-1.5 text-ink-soft">
              <Icon name="clock" className="ic h-[15px] w-[15px] text-ink-faint" />
              <span className="font-mono text-mono-table tabular-nums">
                {formatDurationSeconds(exercise.durationSeconds)}
              </span>
            </span>
          )}
          <span className="ml-auto truncate text-caption text-ink-faint">
            {t("createdByShort", { name: authorName })}
          </span>
        </div>
      </button>
    </li>
  );
}
