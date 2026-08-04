"use client";

import { useEffect, useState } from "react";
import { data } from "@/lib/data";

/**
 * Löst eine auth-/RLS-gated Media-URL ('/media/{key}') über die Facade zu einer
 * nutzbaren Object-URL auf (Bearer-Token nötig; ein nacktes <img>/<audio> kann
 * ihn nicht mitschicken). data:/blob:/leer bleiben unverändert. Gibt die Bytes
 * beim Wechsel/Unmount wieder frei (kein Leak). Muster wie components/ui/Avatar.
 *
 * Geteilt zwischen RoutineMediaCard (Bild/Audio-Vorschau) und dem
 * Trainings-Player (usePlayback braucht dieselbe Object-URL für echtes Abspielen).
 */
export function useAuthedMedia(url: string | null): string | null {
  const marker = "/media/";
  // Direkt nutzbar (data:/blob:/fremd) ohne Auth-Fetch -> unverändert anzeigen.
  const isDirect =
    url != null && (url.startsWith("data:") || url.startsWith("blob:") || !url.includes(marker));
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (url == null || isDirect) return; // nichts zu laden, kein setState im Effektkörper
    const at = url.indexOf(marker);
    const key = decodeURIComponent(url.slice(at + marker.length));
    let active = true;
    let objectUrl: string | null = null;
    data
      .loadMediaUrl(key)
      .then((next) => {
        if (!active) {
          if (next.startsWith("blob:")) URL.revokeObjectURL(next);
          return;
        }
        objectUrl = next.startsWith("blob:") ? next : null;
        setBlobUrl(next); // setState nur in der async-Callback (Regel-konform)
      })
      .catch(() => {
        if (active) setBlobUrl(null);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, isDirect]);
  return isDirect ? url : blobUrl;
}
