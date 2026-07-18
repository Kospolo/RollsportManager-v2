"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { readOperatorClub, subscribeOperatorClub } from "@/lib/data/operator-club";
import { useLocale, useT, type Dict } from "@/lib/i18n";
import { THEME_MODES, useTheme, type ThemeMode } from "@/lib/theme";
import { Icon, type IconName } from "@/components/shell/icons";

/**
 * Betreiber-Chrome der Plattform-Ebene — bewusst getrennt von der Vereins-Shell
 * (keine Sidebar/BottomNav). Kennzeichnet klar die Betreiber-Ebene und bietet
 * Sprache, Theme und einen Rückweg ins Vereinsportal. Nur Token-Utilities +
 * components/shell/icons (wie components/ui es ebenfalls nutzt).
 *
 * ### Der Portal-Knopf ist kein starrer Link auf /dashboard ###
 * Der Betreiber hat KEINEN eigenen Verein — /dashboard braucht aber einen.
 * Deshalb folgt der Knopf dem angesehenen Verein (lib/data/operator-club):
 *   * steht bereits ein Verein in Einsicht → „Zum Vereinsportal" führt in DESSEN
 *     Portal (/dashboard mit gesetztem Kontext, lädt korrekt);
 *   * ist keiner gewählt → „Verein ansehen" führt zur Auswahl (/vereine), wo der
 *     „Ansehen"-Umschalter den protokollierten Einsicht-Kontext setzt.
 * So landet der Betreiber nie im leeren „Nicht angemeldet"-Fehler, und der
 * Auswahl-Weg (Audit, Migration 0051) bleibt der einzige Einstieg ins Portal.
 */

const chromeDict = {
  de: {
    wordmark: "RollsportManager",
    plane: "Betreiber-Ebene",
    back: "Zum Vereinsportal",
    choose: "Verein ansehen",
    langLabel: "Sprache umschalten",
    themeLight: "Hell",
    themeAuto: "Automatisch",
    themeDark: "Dunkel",
    themeLabel: "Farbschema",
  },
  en: {
    wordmark: "RollsportManager",
    plane: "Operator plane",
    back: "To club portal",
    choose: "View a club",
    langLabel: "Switch language",
    themeLight: "Light",
    themeAuto: "Auto",
    themeDark: "Dark",
    themeLabel: "Colour scheme",
  },
} satisfies Dict;

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

export function OperatorTopbar() {
  const t = useT(chromeDict);
  const { locale, toggleLocale } = useLocale();
  const { mode, setMode } = useTheme();

  // Folgt dem angesehenen Verein: ist einer aktiv → dessen Portal (/dashboard),
  // sonst → Auswahl (/vereine). SSR/erster Render: null → Auswahl (sicherer
  // Default, /dashboard ohne Verein liefe in den Anmeldefehler).
  const viewing = useSyncExternalStore(subscribeOperatorClub, readOperatorClub, () => null);
  const portalHref = viewing ? "/dashboard" : "/vereine";
  const portalLabel = viewing ? t("back") : t("choose");
  const portalIcon: IconName = viewing ? "chevronRight" : "teams";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 lg:px-8">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-brand-soft text-brand-ink">
          <Icon name="monitor" className="ic h-[18px] w-[18px]" />
        </span>
        <div className="grid min-w-0 gap-0.5">
          <span className="truncate font-display text-[15px] font-extrabold tracking-[-0.01em] text-ink">
            {t("wordmark")}
          </span>
          <span className="eyebrow flex items-center gap-1.5">
            <Icon name="lock" className="ic h-3 w-3" />
            {t("plane")}
          </span>
        </div>

        <div className="ml-auto flex flex-none items-center gap-2">
          <Link
            href={portalHref}
            className="hidden min-h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-bold text-ink no-underline transition-colors duration-150 hover:bg-sunken sm:inline-flex"
          >
            <Icon
              name={portalIcon}
              className={`ic h-4 w-4${viewing ? " rotate-180" : ""}`}
            />
            {portalLabel}
          </Link>

          <button
            type="button"
            onClick={toggleLocale}
            aria-label={t("langLabel")}
            className="grid h-9 min-w-9 place-items-center rounded-full border border-line bg-sunken px-2.5 text-[12px] font-extrabold uppercase tracking-[.06em] text-ink-soft transition-colors duration-150 hover:text-ink"
          >
            {locale}
          </button>

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
                  className={`grid h-7 w-8 place-items-center rounded-full transition-colors duration-150 ${
                    active ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  <Icon name={MODE_ICON[m]} className="ic h-4 w-4" />
                  <span className="sr-only">{t(MODE_LABEL_KEY[m])}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
