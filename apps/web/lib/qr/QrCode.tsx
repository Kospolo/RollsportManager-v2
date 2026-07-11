"use client";

import { useMemo } from "react";
import { encodeQr } from "./index";

/**
 * QR-Code als Inline-SVG (Signatur-Komponente). Kodiert `value` selbst
 * (lib/qr, keine externe Abhängigkeit) und zeichnet ein scharfes Vektor-Raster.
 *
 * QR muss dunkel-auf-hell bleiben, damit jeder Scanner ihn liest — Vorder-/
 * Hintergrund sind daher bewusst themenunabhängig (heller Grund, dunkle Module),
 * überschreibbar via `dark`/`light`. Der Quiet-Zone-Rand (4 Module) ist Pflicht.
 */
export function QrCode({
  value,
  size = 220,
  margin = 4,
  dark = "#101215",
  light = "#ffffff",
  className,
  title,
}: {
  /** Zu kodierender Inhalt (URL/ID). */
  value: string;
  /** Kantenlänge des gerenderten SVG in Pixeln. */
  size?: number;
  /** Quiet-Zone-Rand in Modulen (Standard 4, Spezifikationsminimum). */
  margin?: number;
  /** Farbe dunkler Module. */
  dark?: string;
  /** Hintergrund-/Quiet-Zone-Farbe. */
  light?: string;
  className?: string;
  /** Barrierefreies Label (Default = value). */
  title?: string;
}) {
  const result = useMemo(() => {
    try {
      return { matrix: encodeQr(value), error: null as string | null };
    } catch (err) {
      return { matrix: null, error: err instanceof Error ? err.message : "QR-Fehler" };
    }
  }, [value]);

  if (result.error || !result.matrix) {
    return (
      <div
        role="img"
        aria-label={title ?? value}
        className={className}
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
          background: light,
          color: dark,
          borderRadius: 8,
          fontSize: 12,
          textAlign: "center",
          padding: 8,
        }}
      >
        {result.error}
      </div>
    );
  }

  const { size: count, modules } = result.matrix;
  const total = count + margin * 2;

  // Alle dunklen Module als ein Pfad — kompaktes, gut skalierendes SVG.
  let path = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (modules[r][c]) path += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }

  return (
    <svg
      role="img"
      aria-label={title ?? value}
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={total} height={total} fill={light} />
      <path d={path} fill={dark} />
    </svg>
  );
}
