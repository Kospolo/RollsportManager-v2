import type { ReactNode } from "react";

/**
 * Lokale Stroke-Glyphen für die Jubiläen-Seite (Geburtstag = Torte,
 * Vereinsjubiläum = Rosette, dazu ein Konfetti-Glyph für die festliche Optik).
 * Bewusst NICHT im geteilten Shell-Icon-Set (icons.tsx bleibt unangetastet,
 * damit parallel arbeitende Teams keine Merge-Konflikte im Enum bekommen).
 * Stil wie das Mockup: 24er-Viewbox, .ic (stroke currentColor, 1.8, round).
 */

export type JubileeIconName = "cake" | "rosette" | "confetti";

const PATHS: Record<JubileeIconName, ReactNode> = {
  cake: (
    <>
      <path d="M4.5 20.5h15" />
      <path d="M6 20.5v-6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6" />
      <path d="M6 15.2c1.15 1.15 2.35 1.15 3.5 0s2.35-1.15 3.5 0 2.35 1.15 3.5 0" />
      <path d="M12 12.2V8.5" />
      <path d="M12 4.8c1 .8 1 2 0 2.9-1-.9-1-2.1 0-2.9z" />
    </>
  ),
  rosette: (
    <>
      <circle cx="12" cy="9.5" r="5" />
      <path d="M12 6.9l.85 1.72 1.9.28-1.37 1.34.32 1.9L12 11.94l-1.7.9.32-1.9L9.25 9.6l1.9-.28z" />
      <path d="M9.6 13.9 8 20.8l4-2.1 4 2.1-1.6-6.9" />
    </>
  ),
  confetti: (
    <>
      <path d="M5 5.5l1.6 1.6M9.5 4v2.2M14.2 4.6l-1 1.7M18.6 4.4l1.4 1.4M20.5 8.6l-1.9.6" />
      <path d="M6.4 12.2l.02.02M11 10.6l.02.02M16.8 11.4l.02.02M8.6 16.6l.02.02M14.4 17.4l.02.02M19.4 14.6l.02.02" />
    </>
  ),
};

export function JubileeIcon({
  name,
  className = "ic",
}: {
  name: JubileeIconName;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
