"use client";

import { useLocale, useT } from "@/lib/i18n";
import { shellDict } from "@/lib/i18n/shell";
import { Icon } from "./icons";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

/**
 * Topbar: ⌘K-Suchfeld-Stub (Sunken-Pill), Theme-Toggle, DE/EN-Sprachchip
 * (sichtbar, DESIGN-SYSTEM §3.5), Glocke, Avatar-Menü.
 */
export function Topbar() {
  const t = useT(shellDict);
  const { locale, toggleLocale } = useLocale();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-surface px-4 py-2.5 lg:px-7">
      {/* Wortmarke nur auf Mobile (dort gibt es keine Sidebar) */}
      <span
        className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-gradient-to-br from-brand to-brand-strong font-display text-[14px] font-extrabold text-brand-contrast lg:hidden"
        aria-hidden="true"
      >
        R
      </span>

      {/* Suchfeld-Stub */}
      <button
        type="button"
        aria-label={t("searchLabel")}
        className="flex min-h-11 w-full max-w-sm items-center gap-2.5 rounded-full bg-sunken px-4 text-left text-[13.5px] text-ink-faint transition-colors duration-150 hover:text-ink-soft"
      >
        <Icon name="search" className="ic h-[17px] w-[17px]" />
        <span className="truncate">{t("searchPlaceholder")}</span>
        <kbd className="ml-auto hidden md:inline-block">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="hidden sm:block">
          <ThemeToggle />
        </div>

        {/* Sprach-Chip DE/EN */}
        <button
          type="button"
          onClick={toggleLocale}
          aria-label={t("languageLabel")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-bold text-ink-soft transition-colors duration-150 hover:bg-sunken"
        >
          {locale === "de" ? (
            <>
              DE <small className="text-[12px] font-semibold text-ink-faint">EN</small>
            </>
          ) : (
            <>
              EN <small className="text-[12px] font-semibold text-ink-faint">DE</small>
            </>
          )}
        </button>

        {/* Benachrichtigungen (Stub) */}
        <button
          type="button"
          aria-label={t("notifications")}
          className="relative grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-ink-soft transition-colors duration-150 hover:bg-sunken"
        >
          <Icon name="bell" />
          <span
            className="absolute right-2.5 top-2 h-2 w-2 rounded-full border-2 border-surface bg-brand"
            aria-hidden="true"
          />
        </button>

        <UserMenu />
      </div>
    </header>
  );
}
