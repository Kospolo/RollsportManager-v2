"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { fullName } from "@/lib/data";
import type { Member, News } from "@/lib/types";
import { newsDict } from "../i18n";

/**
 * Neuigkeits-Karte (Schwarzes Brett): Angepinnt-/Entwurf-Chip, Titel,
 * Autor + Datum, Text-Anriss (drei Zeilen). Ein randabdeckender Overlay-Button
 * öffnet die Detail-Ansicht (44-px-Ziel, keine verschachtelten Buttons — der
 * Inhalt liegt darunter). Trainer+ sehen darüber (z-20) eine Aktionsleiste
 * (Bearbeiten/Löschen). Autor/Datum kommen aufgelöst als Props aus der Facade.
 */
export function NewsCard({
  news,
  author,
  canWrite,
  onOpen,
  onEdit,
  onDelete,
}: {
  news: News;
  /** Aufgelöstes Mitglied zu authorMemberId (kann fehlen, z. B. Ex-Mitglied) */
  author?: Member;
  /** Trainer+ (is_club_trainer) — blendet die Aktionsleiste ein */
  canWrite: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT(newsDict);
  const { locale } = useLocale();

  const authorName = author ? fullName(author) : t("unknownAuthor");
  const dateIso = news.publishedAt ?? news.createdAt;

  return (
    <article className="group relative grid gap-3 rounded-xl border border-line bg-surface p-5 shadow-card transition-colors duration-150 hover:border-line-strong">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("openAria", { title: news.title })}
        className="absolute inset-0 z-10 rounded-xl"
      />

      <div className="grid gap-2">
        {(news.isPinned || !news.publishedAt) && (
          <div className="flex flex-wrap items-center gap-2">
            {news.isPinned && (
              <Badge tone="brand" icon="pin">
                {t("pinnedBadge")}
              </Badge>
            )}
            {!news.publishedAt && <Badge tone="warn">{t("draftBadge")}</Badge>}
          </div>
        )}

        <h3 className="text-[15.5px] font-bold text-ink transition-colors duration-150 group-hover:text-brand-ink">
          {news.title}
        </h3>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="user" className="ic h-[14px] w-[14px] text-ink-faint" />
            {t("byAuthor", { name: authorName })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" className="ic h-[14px] w-[14px] text-ink-faint" />
            {formatDate(dateIso, locale)}
          </span>
        </div>

        <p className="line-clamp-3 whitespace-pre-wrap text-body leading-[22px] text-ink-soft">
          {news.body}
        </p>
      </div>

      {canWrite && (
        <div className="relative z-20 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button
            variant="ghost"
            size="sm"
            icon="edit"
            aria-label={t("editAria", { title: news.title })}
            onClick={onEdit}
          >
            {t("edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="!text-danger hover:!bg-danger-soft"
            aria-label={t("deleteAria", { title: news.title })}
            onClick={onDelete}
          >
            {t("delete")}
          </Button>
        </div>
      )}
    </article>
  );
}
