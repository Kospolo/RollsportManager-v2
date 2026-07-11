"use client";

import { useEffect, useState } from "react";
import { data } from "@/lib/data";
import { Skeleton } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";

/**
 * Bild einer Chat-Blase. Das Media-Serving (`GET /media/<key>`) ist auth-/RLS-
 * gated — ein nacktes <img src> kann keinen Bearer-Token mitschicken (→ 401).
 * Darum wird die als imageUrl gespeicherte Media-URL über die Facade
 * (data.loadMediaUrl) zu einer nutzbaren Object-URL aufgelöst; data:/blob:/
 * fremde URLs (Mock) bleiben direkt verwendbar. Solange geladen wird, steht ein
 * ruhiger Skeleton, bei Fehlern ein Icon-Platzhalter statt eines kaputten Bilds.
 */

/** Storage-Key einer Media-URL (sonst null → URL direkt verwendbar). */
function mediaKeyOf(url: string): string | null {
  if (url.startsWith("data:") || url.startsWith("blob:")) return null;
  const marker = "/media/";
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const key = url.slice(at + marker.length);
  return key ? decodeURIComponent(key) : null;
}

const IMG_CLASS = "mb-1.5 max-h-64 w-full max-w-full rounded-lg object-cover";

/** Platzhalter, wenn das Bild nicht geladen werden kann (statt kaputtem Bild). */
function FailedTile({ label }: { label: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-sunken px-3 py-2 text-[12px] text-ink-faint">
      <Icon name="image" className="ic h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}

/**
 * Auflöser für einen auth-gated Storage-Key. Wird von ChatImage mit key={mediaKey}
 * gemountet, sodass ein Key-Wechsel frisch mountet (State-Reset via Remount, kein
 * synchrones setState im Effekt). Der Effekt lädt nur asynchron nach.
 */
function MediaKeyImage({
  mediaKey,
  alt,
  failedLabel,
}: {
  mediaKey: string;
  alt: string;
  failedLabel: string;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    data
      .loadMediaUrl(mediaKey)
      .then((url) => {
        if (!active) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url.startsWith("blob:") ? url : null;
        setResolvedUrl(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaKey]);

  if (failed) return <FailedTile label={failedLabel} />;
  if (!resolvedUrl) return <Skeleton className="mb-1.5 h-40 w-56 max-w-full rounded-lg" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Object-/Data-URL, kein Next-Loader
    <img src={resolvedUrl} alt={alt} loading="lazy" decoding="async" className={IMG_CLASS} />
  );
}

export function ChatImage({
  imageUrl,
  alt,
  failedLabel,
}: {
  imageUrl: string;
  alt: string;
  failedLabel: string;
}) {
  const mediaKey = mediaKeyOf(imageUrl);

  // Direkt nutzbare URL (data:/blob:/fremd, z. B. Mock) sofort anzeigen.
  if (mediaKey === null) {
    // eslint-disable-next-line @next/next/no-img-element -- Object-/Data-URL, kein Next-Loader
    return <img src={imageUrl} alt={alt} loading="lazy" decoding="async" className={IMG_CLASS} />;
  }

  return <MediaKeyImage key={mediaKey} mediaKey={mediaKey} alt={alt} failedLabel={failedLabel} />;
}
