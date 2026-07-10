/**
 * Player-spezifische Icons (Pause, ±5 s, Loop) im Stroke-Stil des Mockups —
 * lokal kolokalisiert, weil components/shell/icons.tsx für Screen-Teams
 * read-only ist. Pfade 1:1 aus design/final/mockup-final.html.
 */

type IconProps = { className?: string };

export function PauseIcon({ className = "ic" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <rect x="6" y="4.5" width="4.2" height="15" rx="1.4" />
      <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" />
    </svg>
  );
}

export function Rewind5Icon({ className = "ic" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M4.5 8.7A8.2 8.2 0 1 1 3.8 15" />
      <path d="M4.5 3.8v4.9h4.9" />
      <text
        x="12"
        y="15.6"
        fontSize="7.5"
        fontWeight="800"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        5
      </text>
    </svg>
  );
}

export function Forward5Icon({ className = "ic" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M19.5 8.7A8.2 8.2 0 1 0 20.2 15" />
      <path d="M19.5 3.8v4.9h-4.9" />
      <text
        x="12"
        y="15.6"
        fontSize="7.5"
        fontWeight="800"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
      >
        5
      </text>
    </svg>
  );
}

export function LoopIcon({ className = "ic" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M17 2.5l3.5 3.5L17 9.5" />
      <path d="M3.5 11V9.7A3.7 3.7 0 0 1 7.2 6h13.3" />
      <path d="M7 21.5 3.5 18 7 14.5" />
      <path d="M20.5 13v1.3a3.7 3.7 0 0 1-3.7 3.7H3.5" />
    </svg>
  );
}
