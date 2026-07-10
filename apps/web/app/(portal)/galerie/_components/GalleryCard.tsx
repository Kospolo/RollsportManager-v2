"use client";

import { Icon } from "@/components/shell/icons";
import { useT } from "@/lib/i18n";
import type { GalleryItem } from "@/lib/types";
import { galerieDict } from "../i18n";
import { MediaImage } from "./MediaImage";

/**
 * Galerie-Kachel im Raster: quadratisch-liegendes Vorschaubild (4:3,
 * object-cover) mit Titel-Overlay am unteren Rand. Videos bekommen ein
 * zentrales Play-Overlay; als Vorschau dient thumbnailKey, sonst der storageKey
 * selbst. Ein randabdeckender Button öffnet die Lightbox (44-px-Ziel, keine
 * verschachtelten Buttons — Overlays sind pointer-events-none). Trainer+ sehen
 * oben rechts (z-20) den Lösch-Button.
 */
export function GalleryCard({
  item,
  canWrite,
  onOpen,
  onDelete,
}: {
  item: GalleryItem;
  /** Trainer+ (mit PRO) — blendet den Lösch-Button ein */
  canWrite: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const t = useT(galerieDict);
  const previewKey = item.thumbnailKey ?? item.storageKey;
  const isVideo = item.kind === "video";

  return (
    <figure className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-sunken shadow-card transition-colors duration-150 hover:border-line-strong">
      <MediaImage
        storageKey={previewKey}
        alt={item.title}
        className="transition-transform duration-200 group-hover:scale-[1.03]"
      />

      {/* Verlauf + Titel unten (dekorativ, Klicks fallen auf den Öffnen-Button) */}
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] grid gap-0.5 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-3 pb-2.5 pt-8">
        {item.album && (
          <span className="truncate text-[11px] font-bold uppercase tracking-wide text-white/75">
            {item.album}
          </span>
        )}
        <span className="truncate text-[14px] font-bold text-white drop-shadow-sm">
          {item.title}
        </span>
      </figcaption>

      {/* Video-Kennzeichnung: zentrales Play + Badge */}
      {isVideo && (
        <>
          <span className="pointer-events-none absolute inset-0 z-[1] grid place-items-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/40 backdrop-blur-sm transition-transform duration-150 group-hover:scale-105">
              <Icon name="play" className="ic h-5 w-5 translate-x-[1px]" />
            </span>
          </span>
          <span className="pointer-events-none absolute left-2.5 top-2.5 z-[1] inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-[3px] text-[11px] font-bold text-white">
            <Icon name="play" className="ic h-3 w-3" />
            {t("kindVideo")}
          </span>
        </>
      )}

      <button
        type="button"
        onClick={onOpen}
        aria-label={t("openAria", { title: item.title })}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline focus-visible:outline-2"
      />

      {canWrite && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("deleteAria", { title: item.title })}
          className="absolute right-2.5 top-2.5 z-20 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity duration-150 hover:bg-danger focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Icon name="close" className="ic h-4 w-4" />
        </button>
      )}
    </figure>
  );
}
