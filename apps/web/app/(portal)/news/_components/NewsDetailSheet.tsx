"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Modal";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { formatDate, relativeDays } from "@/lib/format";
import { fullName } from "@/lib/data";
import type { Member, News } from "@/lib/types";
import { newsDict } from "../i18n";

/**
 * Detail-Ansicht einer Neuigkeit als rechtes Sheet: Chips, Autor mit Avatar,
 * Datum + relative Angabe, vollständiger Text (Zeilenumbrüche erhalten).
 * Trainer+ (canWrite) bekommen im Fuß Bearbeiten/Löschen; die Durchsetzung
 * bleibt serverseitig (RLS), ein 403 wird oben im Screen als Toast behandelt.
 */
export function NewsDetailSheet({
  news,
  author,
  canWrite,
  onClose,
  onEdit,
  onDelete,
}: {
  news: News;
  author?: Member;
  canWrite: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT(newsDict);
  const { locale } = useLocale();

  const authorName = author ? fullName(author) : t("unknownAuthor");
  const dateIso = news.publishedAt ?? news.createdAt;

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("detailEyebrow")}
      title={news.title}
      footer={
        canWrite ? (
          <>
            <Button variant="ghost" icon="edit" onClick={onEdit}>
              {t("edit")}
            </Button>
            <Button variant="danger" onClick={onDelete}>
              {t("delete")}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="grid gap-4">
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

        <div className="flex items-center gap-3">
          {author ? (
            <Avatar
              personId={author.id}
              firstName={author.firstName}
              lastName={author.lastName}
              size="s"
            />
          ) : (
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-sunken text-ink-faint">
              <Icon name="user" className="ic h-3.5 w-3.5" />
            </span>
          )}
          <div className="grid min-w-0">
            <span className="text-[13.5px] font-bold text-ink">{authorName}</span>
            <span className="text-caption text-ink-faint">
              {formatDate(dateIso, locale)} · {relativeDays(dateIso, locale)}
            </span>
          </div>
        </div>

        <p className="whitespace-pre-wrap text-body leading-[23px] text-ink">{news.body}</p>
      </div>
    </Sheet>
  );
}
