"use client";

import { useT } from "@/lib/i18n";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { HeroPreview } from "./HeroPreview";
import { landingDict } from "./i18n";

/**
 * Hero der Landingpage: Klartext-Nutzenversprechen links, stilisierte
 * Produkt-Karte (HeroPreview mit echten Mock-Zahlen) rechts.
 * Genau EINE Beere-Primäraktion im Sichtbereich: „Kostenlos testen".
 */
export function Hero() {
  const t = useT(landingDict);

  return (
    <section className="overflow-x-clip">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 lg:pb-24 lg:pt-20">
        <div>
          <span className="eyebrow text-brand-ink">{t("heroEyebrow")}</span>
          <h1 className="mt-3 max-w-xl font-display text-[32px] font-extrabold leading-[38px] tracking-tight text-ink sm:text-[40px] sm:leading-[47px]">
            {t("heroTitle")}
          </h1>
          <p className="mt-4 max-w-xl text-[15.5px] leading-[25px] text-ink-soft">
            {t("heroSub")}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ButtonLink href="/login" variant="primary" className="px-6">
              {t("heroCtaPrimary")}
            </ButtonLink>
            <ButtonLink href="#funktionen" variant="ghost">
              {t("heroCtaSecondary")}
            </ButtonLink>
          </div>

          <p className="mt-4 flex items-center gap-2 text-caption font-semibold text-ink-faint">
            <span
              className="grid h-[19px] w-[19px] flex-none place-items-center rounded-full bg-success-soft text-success"
              aria-hidden="true"
            >
              <Icon name="check" className="ic h-[11px] w-[11px] [stroke-width:2.6]" />
            </span>
            {t("heroFreeNote")}
          </p>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}
