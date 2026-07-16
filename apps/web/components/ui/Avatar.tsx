"use client";

import { useEffect, useState } from "react";
import { data } from "@/lib/data";
import { AVATAR_BG_CLASS, avatarInkClass, avatarTone, initials } from "@/lib/avatar";

/**
 * Größen. xl/2xl sind additiv für das Mitglieder-Verzeichnis („Menschen zuerst"
 * groß gedacht): Bei 22 von 24 Demo-Mitgliedern gibt es KEIN Foto — in dieser
 * Größe trägt deshalb das farbige Monogramm die Karte, nicht das Bild.
 */
const SIZE_CLASS = {
  s: "h-7 w-7 text-[10.5px]",
  m: "h-9 w-9 text-[12.5px]",
  l: "h-12 w-12 text-[16px]",
  xl: "h-20 w-20 text-[26px]",
  "2xl": "h-28 w-28 text-[38px]",
} as const;

/**
 * Media-Serving (`GET /media/<key>`) ist auth-/RLS-gated — ein nacktes
 * <img src> kann keinen Bearer-Token mitschicken (→ 401, kaputtes Bild).
 * Auth-pflichtige Foto-URLs werden daher über die Facade (data.loadMediaUrl)
 * zu einer nutzbaren Object-URL aufgelöst; data:/blob:/fremde URLs bleiben
 * direkt verwendbar. Liefert den Storage-Key einer Media-URL, sonst null.
 */
function mediaKeyOf(url: string): string | null {
  if (url.startsWith("data:") || url.startsWith("blob:")) return null;
  const marker = "/media/";
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const key = url.slice(at + marker.length);
  return key ? decodeURIComponent(key) : null;
}

/**
 * Personen-Avatar (Signatur-Komponente): zeigt ein Profilfoto (avatarUrl), wenn
 * vorhanden — sonst die farbigen Initialen (einer von sechs warmen Tönen,
 * deterministisch per Hash aus der personId; auf honey/moss dunkle Initialen,
 * Jury-Fix/AA-Kontrast).
 *
 * avatarUrl ist optional und additiv: bestehende Aufrufer ohne das Feld
 * verhalten sich unverändert (Initialen-Fallback). Auth-gated Media-URLs
 * werden clientseitig mit Bearer-Token nachgeladen (siehe mediaKeyOf).
 */
export function Avatar({
  personId,
  firstName,
  lastName,
  size = "m",
  avatarUrl,
}: {
  personId: string;
  firstName: string;
  lastName: string;
  size?: keyof typeof SIZE_CLASS;
  /** Profilfoto-URL; fehlt/leer → Initialen-Fallback. */
  avatarUrl?: string | null;
}) {
  // Direkt nutzbare URL (data:/blob:/fremd) sofort; Media-Keys erst nach Auth-Fetch.
  const directUrl = avatarUrl && mediaKeyOf(avatarUrl) === null ? avatarUrl : null;
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(directUrl);

  useEffect(() => {
    if (!avatarUrl) {
      setResolvedUrl(null);
      return;
    }
    const key = mediaKeyOf(avatarUrl);
    if (key === null) {
      setResolvedUrl(avatarUrl);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    setResolvedUrl(null);
    data
      .loadMediaUrl(key)
      .then((url) => {
        if (!active) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url.startsWith("blob:") ? url : null;
        setResolvedUrl(url);
      })
      .catch(() => {
        if (active) setResolvedUrl(null);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [avatarUrl]);

  if (resolvedUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Media-URLs sind
      // auth-/RLS-gated (Object-URL) bzw. Data-URIs; der Next-Image-Loader passt nicht.
      <img
        src={resolvedUrl}
        alt={`${firstName} ${lastName}`}
        className={`flex-none rounded-full bg-sunken object-cover ${SIZE_CLASS[size]}`}
        decoding="async"
      />
    );
  }

  const tone = avatarTone(personId);
  return (
    <span
      className={`grid flex-none place-items-center rounded-full font-display font-extrabold tracking-wide ${AVATAR_BG_CLASS[tone]} ${avatarInkClass(tone)} ${SIZE_CLASS[size]}`}
      aria-hidden="true"
    >
      {initials(firstName, lastName)}
    </span>
  );
}
