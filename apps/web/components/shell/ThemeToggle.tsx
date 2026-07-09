"use client";

import { useT } from "@/lib/i18n";
import { shellDict } from "@/lib/i18n/shell";
import { THEME_MODES, useTheme, type ThemeMode } from "@/lib/theme";
import { Icon, type IconName } from "./icons";

const MODE_ICON: Record<ThemeMode, IconName> = {
  light: "sun",
  auto: "monitor",
  dark: "moon",
};

const MODE_LABEL_KEY = {
  light: "themeLight",
  auto: "themeAuto",
  dark: "themeDark",
} as const;

/** Drei-Wege-Theme-Schalter Hell/Auto/Dunkel (Segment auf bg-sunken). */
export function ThemeToggle() {
  const t = useT(shellDict);
  const { mode, setMode } = useTheme();

  return (
    <div
      role="group"
      aria-label={t("themeLabel")}
      className="inline-flex gap-0.5 rounded-full border border-line bg-sunken p-1"
    >
      {THEME_MODES.map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={active}
            title={t(MODE_LABEL_KEY[m])}
            className={`grid h-8 w-9 place-items-center rounded-full transition-colors duration-150 ${
              active
                ? "bg-surface text-ink shadow-[0_1px_3px_rgba(60,32,16,.14)]"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <Icon name={MODE_ICON[m]} className="ic h-[17px] w-[17px]" />
            <span className="sr-only">{t(MODE_LABEL_KEY[m])}</span>
          </button>
        );
      })}
    </div>
  );
}
