"use client";

import { useEffect, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { shellDict } from "@/lib/i18n/shell";
import { Icon } from "./icons";
import { NotificationBell } from "./NotificationBell";
import { SearchPalette } from "./SearchPalette";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

/**
 * Topbar: ⌘K-Suchfeld (öffnet die Befehls-/Suchpalette), Theme-Toggle,
 * DE/EN-Sprachchip (sichtbar, DESIGN-SYSTEM §3.5), Glocke, Avatar-Menü.
 */
export function Topbar() {
  const t = useT(shellDict);
  const { locale, toggleLocale } = useLocale();
  const [searchOpen, setSearchOpen] = useState(false);

  // Globaler ⌘K/Strg+K-Shortcut öffnet die Suchpalette von überall in der Shell.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-surface px-4 py-2.5 lg:px-7">
      {/* Wortmarke nur auf Mobile (dort gibt es keine Sidebar) */}
      <span
        className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-gradient-to-br from-brand to-brand-strong font-display text-[14px] font-extrabold text-brand-contrast lg:hidden"
        aria-hidden="true"
      >
        R
      </span>

      {/* Suchfeld: öffnet die Befehls-/Suchpalette */}
      <button
        type="button"
        aria-label={t("searchLabel")}
        aria-haspopup="dialog"
        aria-expanded={searchOpen}
        onClick={() => setSearchOpen(true)}
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

        {/* Benachrichtigungen: Glocke mit abgeleitetem Feed + Ungelesen-Zähler */}
        <NotificationBell />

        <UserMenu />
      </div>
      </header>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
