/**
 * Inline-SVG-Icons im Stroke-Stil des Mockups (keine Icon-Library).
 * Standardklasse .ic (globals.css): 20px, stroke currentColor, 1.8, round.
 */

export type IconName =
  | "dashboard"
  | "events"
  | "members"
  | "routines"
  | "competition"
  | "finance"
  | "search"
  | "bell"
  | "sun"
  | "moon"
  | "monitor"
  | "user"
  | "settings"
  | "signout"
  | "sparkle"
  | "chevronDown";

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (
    <>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-5.5h5V20" />
    </>
  ),
  events: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17" />
    </>
  ),
  members: (
    <>
      <circle cx="9" cy="8.2" r="3.4" />
      <path d="M3.5 19.8c.5-3.2 2.7-5 5.5-5s5 1.8 5.5 5" />
      <circle cx="17.3" cy="9.2" r="2.6" />
      <path d="M16.6 15.2c2.3.4 3.7 1.9 4 4.2" />
    </>
  ),
  routines: (
    <>
      <path d="M9.5 17.8V6.2l10-1.9v11.4" />
      <circle cx="7" cy="18" r="2.6" />
      <circle cx="17" cy="15.8" r="2.6" />
    </>
  ),
  competition: (
    <>
      <path d="M8 4h8v5.2a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5.2H4.8A3.2 3.2 0 0 0 8 8.9M16 5.2h3.2A3.2 3.2 0 0 1 16 8.9" />
      <path d="M12 13.2v3.3M9.5 20a2.5 2.5 0 0 1 5 0M7.5 20h9" />
    </>
  ),
  finance: (
    <>
      <path d="M4.5 8A2.5 2.5 0 0 1 7 5.5h11V8" />
      <rect x="4.5" y="8" width="16" height="11.5" rx="2.5" />
      <circle cx="16.3" cy="13.8" r="1.1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.4-3.4" />
    </>
  ),
  bell: (
    <>
      <path d="M6.2 9.5a5.8 5.8 0 0 1 11.6 0c0 4.6 1.8 5.7 1.8 5.7H4.4s1.8-1.1 1.8-5.7Z" />
      <path d="M10 19a2.1 2.1 0 0 0 4 0" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
  moon: <path d="M19.5 13.8A7.8 7.8 0 1 1 10.2 4.5a6.3 6.3 0 0 0 9.3 9.3Z" />,
  monitor: (
    <>
      <rect x="3.5" y="4.5" width="17" height="12" rx="2" />
      <path d="M9 20h6M12 16.5V20" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.8 20c.7-3.7 3.6-5.7 7.2-5.7s6.5 2 7.2 5.7" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7.3h8.5M18.5 7.3H20M4 16.7h1.5M11.5 16.7H20" />
      <circle cx="15.5" cy="7.3" r="2.2" />
      <circle cx="8.5" cy="16.7" r="2.2" />
    </>
  ),
  signout: (
    <>
      <path d="M9.5 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h2.5" />
      <path d="m15.5 8 4 4-4 4M19 12H9.5" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 4 1.7 4.5L18.5 10l-4.8 1.5L12 16.5l-1.7-5L5.5 10l4.8-1.5Z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
    </>
  ),
  chevronDown: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
};

export function Icon({ name, className = "ic" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
