"use client";

import { useEffect, useState } from "react";
import { data } from "@/lib/data";
import { avatarInkClass, avatarTone, initials, type AvatarTone } from "@/lib/avatar";

/**
 * PortraitTile — die großformatige Porträt-Kachel des Design-Systems „Heimspiel".
 *
 * Warum es diesen Baustein gibt: Bei einem VISUELLEN Sport (Rollkunstlauf) ist
 * das Gesicht der Person der Kern. Ein Foto soll darum groß und schön wirken —
 * der NORMALFALL ist aber „kein Foto" (Demo hat fast keine, Kinderfotos
 * brauchen Einwilligung). Deshalb ist das FEHLENDE Foto hier kein Loch und kein
 * kaputtes Bild-Icon, sondern ein gestaltetes Monogramm im Heimspiel-Charakter:
 * warmer Verlauf im Avatar-Ton der Person (derselbe Hash wie beim runden
 * <Avatar> — „Lina ist plum, überall"), Hallenlicht-Highlight, Craft-Textur
 * (feines Raster) und großes Display-Monogramm.
 *
 * Wiederverwendbar & app-weit gedacht: liegt in components/ui, kennt nur
 * personId/Namen/avatarUrl. Wird heute von der Mitglieder-Karte genutzt,
 * taugt aber überall, wo ein Mensch groß gezeigt wird (Steckbrief-Held,
 * Team-Aufstellung, Vereinsleben-Karte).
 *
 * @accessibility Die Kachel ist rein dekorativ (aria-hidden): Wer die Person
 * ist, trägt der zugehörige Name-Link der Karte — ein zweites Vorlesen von
 * „Foto von …" wäre Doppelung. Deshalb kein alt-Text, kein role.
 */

/** Avatar-Ton → CSS-Variable, damit der Verlauf generisch aus EINEM Ton baut. */
const TONE_VAR: Record<AvatarTone, string> = {
  berry: "--av-berry",
  coral: "--av-coral",
  honey: "--av-honey",
  moss: "--av-moss",
  plum: "--av-plum",
  petrol: "--av-petrol",
};

/**
 * Media-Auflösung — SPIEGELT bewusst die Logik aus components/ui/Avatar.tsx
 * (dort die Quelle der Wahrheit). `GET /media/<key>` ist auth-/RLS-gated: ein
 * nacktes <img src> kann keinen Bearer-Token mitschicken (→ 401). data:/blob:/
 * fremde URLs sind direkt nutzbar; /media/-Keys werden über die Facade zu einer
 * Object-URL aufgelöst. Bewusst dupliziert (~12 Zeilen), um den stabilen
 * runden Avatar nicht anzufassen.
 */
function mediaKeyOf(url: string): string | null {
  if (url.startsWith("data:") || url.startsWith("blob:")) return null;
  const marker = "/media/";
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const key = url.slice(at + marker.length);
  return key ? decodeURIComponent(key) : null;
}

export function PortraitTile({
  personId,
  firstName,
  lastName,
  avatarUrl,
  className = "",
}: {
  personId: string;
  firstName: string;
  lastName: string;
  /** Profilfoto-URL; fehlt/leer → gestaltetes Monogramm. */
  avatarUrl?: string | null;
  /** Zusatzklassen (Größe/Radius kommen vom Aufrufer bzw. dessen Clipping). */
  className?: string;
}) {
  // Direkt nutzbare URL (data:/blob:/fremd) wird im Render abgeleitet;
  // Media-Keys erst nach Auth-Fetch. Das async aufgelöste Ergebnis wird mit
  // SEINEM Key getaggt — wechselt der Key, verwirft die Render-Ableitung es
  // automatisch (kein synchrones setState im Effekt).
  const key = avatarUrl ? mediaKeyOf(avatarUrl) : null;
  const directUrl = avatarUrl && key === null ? avatarUrl : null;
  const [fetched, setFetched] = useState<{ key: string; url: string } | null>(null);

  useEffect(() => {
    if (!avatarUrl || key === null) return; // direkt nutzbar oder kein Foto
    let active = true;
    let objectUrl: string | null = null;
    data
      .loadMediaUrl(key)
      .then((url) => {
        if (!active) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url.startsWith("blob:") ? url : null;
        setFetched({ key, url });
      })
      .catch(() => {
        /* Fehlschlag → Fallback bleibt das Monogramm */
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [avatarUrl, key]);

  const resolvedUrl = directUrl ?? (fetched && fetched.key === key ? fetched.url : null);

  if (resolvedUrl) {
    // Media-URLs sind auth-/RLS-gated (Object-URL) bzw. Data-URIs; der
    // Next-Image-Loader passt hier nicht.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedUrl}
        alt=""
        aria-hidden="true"
        className={`h-full w-full object-cover ${className}`}
        decoding="async"
      />
    );
  }

  const tone = avatarTone(personId);

  // Verläufe generisch aus EINEM Ton (color-mix): Hallenlicht-Highlight oben
  // links, Tiefe unten rechts, Grund-Diagonale. Keine externen Assets (CSP).
  const surface: React.CSSProperties = {
    ["--tone" as string]: `var(${TONE_VAR[tone]})`,
    backgroundImage: [
      "radial-gradient(88% 74% at 22% 14%, rgba(255,255,255,0.30), rgba(255,255,255,0) 60%)",
      "radial-gradient(120% 118% at 100% 104%, color-mix(in oklab, var(--tone) 58%, #000 42%), rgba(0,0,0,0) 58%)",
      "linear-gradient(148deg, color-mix(in oklab, var(--tone) 70%, #fff 30%) 0%, var(--tone) 50%, color-mix(in oklab, var(--tone) 76%, #000 24%) 100%)",
    ].join(", "),
  };

  return (
    <span
      aria-hidden="true"
      style={surface}
      className={`relative grid h-full w-full place-items-center overflow-hidden ${className}`}
    >
      {/* Craft-Textur: feines Punktraster, wie durchscheinendes Gewebe. */}
      <span
        className="pointer-events-none absolute inset-0 opacity-60 mix-blend-soft-light"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.9) 1px, rgba(255,255,255,0) 1.4px)",
          backgroundSize: "13px 13px",
        }}
      />
      {/* Monogramm — Display-Schrift, groß; Ton-abhängige Tinte (Jury-Fix:
          honey/moss tragen dunkle Initialen, sonst reicht Weiß unter AA nicht). */}
      <span
        className={`relative font-display text-[46px] font-extrabold leading-none tracking-[0.01em] ${avatarInkClass(
          tone,
        )} [text-shadow:0_1px_2px_rgba(40,20,10,0.16)]`}
      >
        {initials(firstName, lastName)}
      </span>
    </span>
  );
}
