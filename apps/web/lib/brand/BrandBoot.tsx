"use client";

import { useEffect, useRef } from "react";
import { data, dataSource } from "@/lib/data";
import { resolveBrandTheme } from "./derive";
import { applyBrandCss, isDefaultBrand, renderBrandCss, storeBrandSelection } from "./runtime";

/**
 * Boot-Hydration der Markenfarbe. Das Inline-Script (brandInitScript) hat den
 * localStorage-Spiegel bereits VOR dem ersten Paint angewandt (kein Flash).
 * Hier gleichen wir EINMAL nach dem Laden gegen die Quelle der Wahrheit ab:
 *
 *   - api-Modus: getClub() ist maßgeblich → Style + Spiegel überschreiben
 *     (ein neues Gerät übernimmt die Vereins-Einstellung; leer ⇒ Override weg).
 *   - mock-Modus: der In-Memory-Store lebt nur pro Sitzung und startet leer;
 *     hat der Verein eine Farbe (nach Speichern in dieser Sitzung), anwenden —
 *     sonst NICHTS tun, damit der localStorage-Spiegel (Beta-Persistenz) bleibt.
 *
 * Rendert nichts.
 */
export function BrandBoot(): null {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    let active = true;
    data
      .getClub()
      .then((club) => {
        if (!active) return;
        const color = club.brandColor ?? null;
        const preset = club.brandPreset ?? null;

        if (isDefaultBrand(color, preset)) {
          // Kein Vereins-Override. Im api-Modus heißt das ausdrücklich „Standard"
          // → alles zurücksetzen. Im mock-Modus den localStorage-Spiegel behalten.
          if (dataSource === "api") {
            applyBrandCss(null);
            storeBrandSelection(null);
          }
          return;
        }

        const css = renderBrandCss(resolveBrandTheme(color, preset));
        applyBrandCss(css);
        storeBrandSelection(css == null ? null : { color, preset, css });
      })
      .catch(() => {
        // best effort — bei Fehler bleibt der vom Boot-Script gesetzte Zustand.
        done.current = false;
      });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
