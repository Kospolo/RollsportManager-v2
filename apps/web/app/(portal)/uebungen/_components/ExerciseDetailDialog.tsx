"use client";

import type { Exercise, Member } from "@/lib/types";
import { memberById } from "@/lib/data";
import { useLocale, useT } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import {
  CATEGORY_KEY,
  formatDurationSeconds,
  uebungenDict,
} from "../i18n";
import { DifficultyDots } from "./DifficultyDots";

/**
 * Detailansicht einer Übung: Kategorie, Schwierigkeit, Dauer, Beschreibung,
 * Anleitung und optionaler Video-Link. Für Trainer:innen (canManage) unten
 * Bearbeiten/Löschen — die Sichtbarkeit ist nur Komfort, die Wahrheit bleibt
 * serverseitig (RLS/API, 403 → Toast im jeweiligen Dialog).
 */
export function ExerciseDetailDialog({
  exercise,
  members,
  canManage,
  onEdit,
  onDelete,
  onClose,
}: {
  exercise: Exercise;
  members: Member[];
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useT(uebungenDict);
  const { locale } = useLocale();
  const author = memberById(members, exercise.createdByMemberId);
  const authorName = author ? `${author.firstName} ${author.lastName}` : t("unknownAuthor");

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={t("detailEyebrow")}
      title={exercise.name}
      footer={
        canManage ? (
          <>
            <Button variant="danger" onClick={onDelete}>
              {t("deleteAction")}
            </Button>
            <Button icon="edit" onClick={onEdit}>
              {t("editAction")}
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            {t("close")}
          </Button>
        )
      }
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Badge tone="brand">{t(CATEGORY_KEY[exercise.category])}</Badge>
          <span className="inline-flex items-center gap-2 text-caption text-ink-soft">
            {t("difficultyLabel")}
            <DifficultyDots value={exercise.difficulty} />
          </span>
          {exercise.durationSeconds !== undefined && (
            <span className="inline-flex items-center gap-1.5 text-caption text-ink-soft">
              <Icon name="clock" className="ic h-[15px] w-[15px] text-ink-faint" />
              <span className="font-mono text-mono-table tabular-nums">
                {formatDurationSeconds(exercise.durationSeconds)}
              </span>
              <span className="text-ink-faint">{t("durationUnit")}</span>
            </span>
          )}
        </div>

        {exercise.description && (
          <section className="grid gap-1">
            <h3 className="eyebrow">{t("descriptionHeading")}</h3>
            <p className="text-body text-ink">{exercise.description}</p>
          </section>
        )}

        {exercise.instructions && (
          <section className="grid gap-1">
            <h3 className="eyebrow">{t("instructionsHeading")}</h3>
            <p className="whitespace-pre-line text-body text-ink">{exercise.instructions}</p>
          </section>
        )}

        {exercise.videoUrl && (
          <a
            href={exercise.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 self-start rounded-full bg-brand-soft px-4 py-2 font-bold text-brand-ink no-underline transition-colors duration-150 hover:bg-brand hover:text-brand-contrast"
          >
            <Icon name="play" className="ic h-[17px] w-[17px]" />
            {t("videoOpen")}
            <span className="sr-only">— {t("videoHint")}</span>
          </a>
        )}

        <p className="border-t border-line pt-3 text-caption text-ink-faint">
          {t("detailAuthor", { name: authorName })} · {formatDate(exercise.createdAt, locale)}
        </p>
      </div>
    </Modal>
  );
}
