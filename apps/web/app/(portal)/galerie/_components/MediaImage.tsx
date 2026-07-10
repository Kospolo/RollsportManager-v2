"use client";

import { useEffect, useState } from "react";
import { data } from "@/lib/data";
import { Skeleton } from "@/components/ui/Skeleton";
import { MehrIcon } from "../../mehr/MehrIcon";

/**
 * Auth-geschütztes Media-Serving fürs UI: GET /media/{key} braucht einen
 * Bearer-Token, ist also NICHT direkt als <img src> nutzbar. Der Hook lädt die
 * Bytes über die Facade (loadMediaUrl → im api-Modus fetch+Object-URL, im
 * Mock-Modus die data:-URL unverändert) und gibt die fertige URL zurück. Beim
 * Wechsel des storageKey oder beim Unmount wird eine erzeugte blob:-URL wieder
 * freigegeben (data:-URLs aus dem Mock brauchen kein revoke).
 */
export function useMediaUrl(storageKey: string): { url: string | null; failed: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let created: string | null = null;

    setUrl(null);
    setFailed(false);

    data
      .loadMediaUrl(storageKey)
      .then((resolved) => {
        if (!active) {
          if (resolved.startsWith("blob:")) URL.revokeObjectURL(resolved);
          return;
        }
        created = resolved;
        setUrl(resolved);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (created && created.startsWith("blob:")) URL.revokeObjectURL(created);
    };
  }, [storageKey]);

  return { url, failed };
}

/** Platzhalter, wenn ein Medium nicht geladen werden kann (statt kaputtem Bild). */
function FallbackTile({ className = "" }: { className?: string }) {
  return (
    <div
      className={`grid h-full w-full place-items-center bg-sunken text-ink-faint ${className}`.trim()}
      aria-hidden="true"
    >
      <MehrIcon name="gallery" className="ic h-7 w-7" />
    </div>
  );
}

/**
 * Bild-Element für einen opaken storageKey — füllt seinen (relativen) Eltern-
 * Container. Zeigt einen ruhigen Skeleton, solange geladen wird, und einen
 * Icon-Platzhalter bei Fehlern. Für Thumbnails (thumbnailKey) und Vollbilder
 * gleichermaßen nutzbar.
 */
export function MediaImage({
  storageKey,
  alt,
  className = "",
}: {
  storageKey: string;
  alt: string;
  className?: string;
}) {
  const { url, failed } = useMediaUrl(storageKey);

  if (failed) return <FallbackTile className={className} />;
  if (!url) return <Skeleton className={`h-full w-full ${className}`.trim()} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Blob/Data-URL, kein Loader
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={`h-full w-full object-cover ${className}`.trim()}
    />
  );
}
