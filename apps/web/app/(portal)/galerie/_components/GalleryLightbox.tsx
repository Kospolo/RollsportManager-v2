"use client";

import { Icon } from "@/components/shell/icons";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { fullName } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { useLocale, useT } from "@/lib/i18n";
import { galleryKindLabels, type GalleryItem, type Id, type Member } from "@/lib/types";
import { galerieDict } from "../i18n";
import { useMediaUrl } from "./MediaImage";
import { downloadName } from "./media";
import { PhotoTagSection } from "./PhotoTagSection";

/**
 * Lightbox/Detail eines Galerie-Objekts als Modal: Vollbild bzw. Video-Player
 * (auth-geschützt über die Facade geladen), darunter Album, Titel, Uploader +
 * Datum und ein Download-Link. Bilder werden object-contain gezeigt (nie
 * beschnitten), Videos mit nativen Steuerelementen.
 */
export function GalleryLightbox({
  item,
  author,
  members,
  canTag,
  currentMemberId,
  onClose,
}: {
  item: GalleryItem;
  /** Aufgelöstes Mitglied zu uploadedByMemberId (kann fehlen) */
  author?: Member;
  /** Redigierte Mitgliederliste — Auswahlquelle der Markierung (RLS-gescoped). */
  members: Member[];
  /** Darf der Betrachter markieren (Staff, ohne Kassenwart)? Nur Sichtbarkeit. */
  canTag: boolean;
  /** Eigene member_id (für „eigene Markierung entfernen") — kann null sein. */
  currentMemberId: Id | null;
  onClose: () => void;
}) {
  const t = useT(galerieDict);
  const { locale } = useLocale();
  const { url, failed } = useMediaUrl(item.storageKey);
  const isVideo = item.kind === "video";

  const authorName = author ? fullName(author) : t("unknownAuthor");

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={galleryKindLabels[item.kind][locale]}
      title={item.title}
      maxWidthClass="max-w-3xl"
      footer={
        url && !failed ? (
          <a
            href={url}
            download={downloadName(item.title, item.contentType)}
            className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent bg-brand-soft px-5 text-[14px] font-bold text-brand-ink no-underline transition-colors duration-150 hover:bg-brand hover:text-brand-contrast"
          >
            <Icon name="download" className="ic h-[17px] w-[17px]" />
            {t("download")}
          </a>
        ) : undefined
      }
    >
      <div className="grid gap-4">
        <div className="relative grid max-h-[70vh] min-h-[220px] place-items-center overflow-hidden rounded-lg bg-sunken">
          {failed ? (
            <p className="px-4 py-10 text-body text-ink-soft">{t("mediaError")}</p>
          ) : !url ? (
            <div className="grid w-full place-items-center gap-2 py-10">
              <Skeleton className="h-40 w-4/5" />
              <span className="text-caption text-ink-faint">{t("mediaLoading")}</span>
            </div>
          ) : isVideo ? (
            <video
              src={url}
              controls
              autoPlay
              playsInline
              className="max-h-[70vh] w-full bg-black"
            >
              {t("videoUnsupported")}
            </video>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- Blob/Data-URL, kein Loader
            <img
              src={url}
              alt={item.title}
              className="max-h-[70vh] w-auto max-w-full object-contain"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-ink-soft">
          {item.album && <Badge tone="brand">{item.album}</Badge>}
          <span className="inline-flex items-center gap-1.5">
            <Icon name="user" className="ic h-[14px] w-[14px] text-ink-faint" />
            {t("uploadedBy", { name: authorName })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" className="ic h-[14px] w-[14px] text-ink-faint" />
            {formatDate(item.createdAt, locale)}
          </span>
        </div>

        <PhotoTagSection
          itemId={item.id}
          members={members}
          canTag={canTag}
          currentMemberId={currentMemberId}
        />
      </div>
    </Modal>
  );
}
