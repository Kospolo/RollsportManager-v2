"use client";

import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { ButtonLink } from "@/components/ui/Button";
import { landingDict } from "./i18n";

/**
 * Öffentliches Seiten-Chrome (Landing, Login, Rechtstexte):
 * Wortmarke, DE/EN-Sprachchip, Marketing-Topbar und Footer.
 * Gleiche Formensprache wie die Portal-Shell (mockup-final.html).
 */

/** Wortmarke: Beere-Kachel + Display-Schriftzug — verlinkt auf die Startseite. */
export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  const t = useT(landingDict);
  const tile =
    size === "lg"
      ? "h-10 w-10 rounded-[13px] text-[16px]"
      : "h-8 w-8 rounded-[10px] text-[13px]";
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-2.5 no-underline"
      aria-label={t("appName")}
    >
      <span
        className={`grid flex-none place-items-center bg-gradient-to-br from-brand to-brand-strong font-display font-extrabold text-brand-contrast ${tile}`}
        aria-hidden="true"
      >
        R
      </span>
      <span
        className={`font-display font-extrabold tracking-tight text-ink ${
          size === "lg" ? "text-[17px]" : "text-[15px]"
        }`}
      >
        {t("appName")}
      </span>
    </Link>
  );
}

/** DE/EN-Sprachchip — identische Anatomie wie in der Portal-Topbar. */
export function LanguageChip() {
  const t = useT(landingDict);
  const { locale, toggleLocale } = useLocale();
  return (
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
  );
}

/** Sticky Marketing-Topbar: Wortmarke, Anker-Navigation, Sprache, Theme, Anmelden. */
export function LandingTopbar() {
  const t = useT(landingDict);
  const anchors = [
    { href: "#funktionen", label: t("navFeatures") },
    { href: "#preise", label: t("navPricing") },
    { href: "#faq", label: t("navFaq") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:font-bold focus:text-brand-contrast"
      >
        {t("skipToContent")}
      </a>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <BrandMark />

        <nav aria-label={t("navLabel")} className="ml-6 hidden items-center gap-1 md:flex">
          {anchors.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-body font-semibold text-ink-soft no-underline transition-colors duration-150 hover:bg-sunken hover:text-ink"
            >
              {a.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <LanguageChip />
          {/* secondary — die EINE Beere-Primäraktion des Sichtbereichs gehört dem Hero-CTA */}
          <ButtonLink href="/login" variant="secondary" className="max-sm:px-4">
            {t("login")}
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}

/** Footer mit Produkt-Ankern und Rechtliches (Impressum/Datenschutz). */
export function LandingFooter() {
  const t = useT(landingDict);
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-2.5">
          <BrandMark />
          <p className="max-w-xs text-caption text-ink-soft">{t("footerTagline")}</p>
        </div>

        <nav aria-label={t("footerProduct")} className="grid content-start gap-1">
          <span className="eyebrow mb-1">{t("footerProduct")}</span>
          {/* /#anker statt #anker: funktioniert auch von /impressum & /datenschutz aus */}
          <Link href="/#funktionen" className="inline-flex min-h-9 items-center text-body font-semibold text-ink-soft no-underline hover:text-ink">
            {t("navFeatures")}
          </Link>
          <Link href="/#preise" className="inline-flex min-h-9 items-center text-body font-semibold text-ink-soft no-underline hover:text-ink">
            {t("navPricing")}
          </Link>
          <Link href="/login" className="inline-flex min-h-9 items-center text-body font-semibold text-ink-soft no-underline hover:text-ink">
            {t("login")}
          </Link>
        </nav>

        <nav aria-label={t("footerLegal")} className="grid content-start gap-1">
          <span className="eyebrow mb-1">{t("footerLegal")}</span>
          <Link href="/impressum" className="inline-flex min-h-9 items-center text-body font-semibold text-ink-soft no-underline hover:text-ink">
            {t("imprint")}
          </Link>
          <Link href="/datenschutz" className="inline-flex min-h-9 items-center text-body font-semibold text-ink-soft no-underline hover:text-ink">
            {t("privacy")}
          </Link>
          <Link href="/agb" className="inline-flex min-h-9 items-center text-body font-semibold text-ink-soft no-underline hover:text-ink">
            {t("terms")}
          </Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-caption text-ink-faint sm:px-6">
          {t("footerCopy", { year })}
        </p>
      </div>
    </footer>
  );
}
