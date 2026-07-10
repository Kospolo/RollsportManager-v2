import type { ReactNode } from "react";

/**
 * Lokale Stroke-Icons für die „Mehr"-Kacheln, deren Bereiche noch keinen
 * Eintrag im gemeinsamen Shell-Icon-Set haben (icons.tsx bleibt unangetastet,
 * damit die parallel arbeitenden Fach-Teams keine Merge-Konflikte im geteilten
 * Enum bekommen). Gleicher Stil wie das Mockup: 24er-Viewbox, .ic (20 px,
 * stroke currentColor, 1.8, round). Bereits gebaute Bereiche (Termine,
 * Mitglieder, Küren, Wettkampf, Finanzen, Verwaltung) nutzen weiter die
 * geteilten Shell-Icons — nur diese Zusatz-Glyphen leben hier.
 */

export type MehrIconName =
  | "news"
  | "note"
  | "exercise"
  | "family"
  | "chat"
  | "trainingplan"
  | "facility"
  | "equipment"
  | "medal"
  | "hours"
  | "checkin"
  | "regevents"
  | "gallery"
  | "document"
  | "chart";

const PATHS: Record<MehrIconName, ReactNode> = {
  news: (
    <>
      <path d="M4 5.5h11a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M16 9h2.5a1.5 1.5 0 0 1 1.5 1.5v6a2 2 0 0 1-2 2" />
      <path d="M7 9h6M7 12h6M7 15h4" />
    </>
  ),
  note: (
    <>
      <path d="M6 4h9a1.5 1.5 0 0 1 1.5 1.5V13l-4.5 4.5H6A1.5 1.5 0 0 1 4.5 16V5.5A1.5 1.5 0 0 1 6 4z" />
      <path d="M16.5 13H13.5a1.5 1.5 0 0 0-1.5 1.5v3" />
      <path d="M8 9h6M8 12h4" />
    </>
  ),
  exercise: (
    <>
      <path d="M4.5 9.5v5M7 8v8M17 8v8M19.5 9.5v5" />
      <path d="M7 12h10" />
    </>
  ),
  family: (
    <>
      <circle cx="8" cy="7.5" r="2.4" />
      <circle cx="16" cy="7.5" r="2.4" />
      <circle cx="12" cy="13" r="2" />
      <path d="M4 18.5c.4-2.2 1.9-3.4 4-3.4" />
      <path d="M20 18.5c-.4-2.2-1.9-3.4-4-3.4" />
      <path d="M9 20c.3-1.7 1.4-2.7 3-2.7s2.7 1 3 2.7" />
    </>
  ),
  chat: (
    <>
      <path d="M4.5 11.5c0-3.6 3.2-6 7.5-6s7.5 2.4 7.5 6-3.2 6-7.5 6c-.9 0-1.8-.1-2.6-.3L5 20l1-3.2C5.1 15.6 4.5 13.7 4.5 11.5z" />
      <path d="M9 11h6M9 13.5h4" />
    </>
  ),
  trainingplan: (
    <>
      <rect x="5.5" y="4.5" width="13" height="15.5" rx="2" />
      <path d="M9.5 3.5h5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1z" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </>
  ),
  facility: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M12 5v6M4 11h8M12 14.5h8M12 11v8" />
    </>
  ),
  equipment: (
    <>
      <path d="M5 6.5h5.5l1.4 5H18a2 2 0 0 1 2 2V16H5z" />
      <path d="M5 6.5V16" />
      <circle cx="8.5" cy="18.5" r="1.5" />
      <circle cx="16" cy="18.5" r="1.5" />
    </>
  ),
  medal: (
    <>
      <path d="M9.5 3.5l2.5 6M14.5 3.5l-2.5 6" />
      <circle cx="12" cy="15" r="5" />
      <path d="M12 12.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 14.6l2-.3z" />
    </>
  ),
  hours: (
    <>
      <path d="M7 4h10M7 20h10" />
      <path d="M8 4v2.5L12 11l4-4.5V4" />
      <path d="M8 20v-2.5L12 13l4 4.5V20" />
    </>
  ),
  checkin: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5z" />
    </>
  ),
  regevents: (
    <>
      <circle cx="12" cy="12" r="8" />
      <ellipse cx="12" cy="12" rx="3.4" ry="8" />
      <path d="M4.2 12h15.6" />
    </>
  ),
  gallery: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4.5 16.5l4-4 3 3 3.5-3.5L20 15.5" />
    </>
  ),
  document: (
    <>
      <path d="M6.5 3.5h6.5L18 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V5A1.5 1.5 0 0 1 6.5 3.5z" />
      <path d="M13 3.5V8.5h5" />
      <path d="M8.5 12.5h7M8.5 15.5h5" />
    </>
  ),
  chart: (
    <>
      <path d="M4.5 4v15.5H20" />
      <path d="M8.5 16.5v-3.5M12.5 16.5v-7M16.5 16.5v-5" />
    </>
  ),
};

export function MehrIcon({ name, className = "ic" }: { name: MehrIconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
