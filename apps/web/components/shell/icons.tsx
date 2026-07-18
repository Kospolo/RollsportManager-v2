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
  | "chevronDown"
  | "chevronRight"
  | "close"
  | "check"
  | "plus"
  | "play"
  | "clock"
  | "zap"
  | "lock"
  | "bank"
  | "mail"
  | "image"
  | "download"
  | "edit"
  | "pin"
  | "dots"
  | "shield"
  | "teams"
  | "globe"
  | "share"
  | "link"
  | "copy"
  | "trash"
  | "car"
  | "phone";

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
  chevronRight: <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M4.5 12.8l4.6 4.6L19.5 7" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  play: (
    <path d="M8 5.3v13.4c0 .8.9 1.3 1.6.9l10.4-6.7c.6-.4.6-1.4 0-1.8L9.6 4.4C8.9 4 8 4.5 8 5.3z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.4 2.2" />
    </>
  ),
  zap: <path d="M13 2.5 4.5 14H11l-1 7.5L18.5 10H13z" />,
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
    </>
  ),
  bank: (
    <>
      <path d="M3.5 9.3 12 4l8.5 5.3" />
      <path d="M5.2 9.5v9M9.7 9.5v9M14.3 9.5v9M18.8 9.5v9M3.5 20.5h17" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m3.5 7.5 8.5 6 8.5-6" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="8.75" cy="9.5" r="1.6" />
      <path d="m4.5 17 4.5-4.5 3 3 3.5-3.5 4 4" />
    </>
  ),
  download: <path d="M12 4v10.5M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />,
  edit: <path d="M16.8 3.7l3.5 3.5L8.5 19 3.8 20.2 5 15.5z" />,
  pin: (
    <>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </>
  ),
  dots: (
    <>
      <circle cx="5.5" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.4 5.5 6v5.6c0 4.2 2.8 6.8 6.5 8.4 3.7-1.6 6.5-4.2 6.5-8.4V6L12 3.4Z" />
      <path d="M9.2 12.1l2 2 3.6-3.9" />
    </>
  ),
  teams: (
    <>
      <circle cx="12" cy="6.8" r="2.4" />
      <circle cx="6.4" cy="10.4" r="2.1" />
      <circle cx="17.6" cy="10.4" r="2.1" />
      <path d="M12 11.6c2.7 0 4.3 1.6 4.7 4.1H7.3c.4-2.5 2-4.1 4.7-4.1Z" />
      <path d="M6.4 14.2c-1.6.1-2.6 1-2.9 2.7M17.6 14.2c1.6.1 2.6 1 2.9 2.7" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.3" />
      <path d="M3.7 12h16.6" />
      <path d="M12 3.7c2.4 2.3 3.7 5.2 3.7 8.3S14.4 18 12 20.3C9.6 18 8.3 15.1 8.3 12S9.6 6 12 3.7Z" />
    </>
  ),
  share: (
    <>
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="17.5" cy="6" r="2.6" />
      <circle cx="17.5" cy="18" r="2.6" />
      <path d="M8.3 10.8 15.2 7.2M8.3 13.2l6.9 3.6" />
    </>
  ),
  link: (
    <>
      <path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.3 1.3" />
      <path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.3-1.3" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.4" />
      <path d="M15 9V6.4A2.4 2.4 0 0 0 12.6 4H6.4A2.4 2.4 0 0 0 4 6.4v6.2A2.4 2.4 0 0 0 6.4 15H9" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7" />
      <path d="M6.5 7l.8 11.2A1.8 1.8 0 0 0 9.1 20h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" />
      <path d="M10 11v5M14 11v5" />
    </>
  ),
  car: (
    <>
      <path d="M4 16.5v2a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-1.2M20 16.5v2a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1.2" />
      <path d="M3.5 16.5v-4l2-5.3A2 2 0 0 1 7.4 6h9.2a2 2 0 0 1 1.9 1.2l2 5.3v4z" />
      <path d="M5.5 12.5h13M7 15h1.5M15.5 15H17" />
    </>
  ),
  phone: (
    <path d="M7.2 3.8h3l1.2 3.4-1.9 1.5a11.5 11.5 0 0 0 5.3 5.3l1.5-1.9 3.4 1.2v3a2 2 0 0 1-2.2 2C10.9 17.6 6.4 13.1 5.2 6A2 2 0 0 1 7.2 3.8Z" />
  ),
};

export function Icon({ name, className = "ic" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
