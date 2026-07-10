"use client";

import { useT } from "@/lib/i18n";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { landingDict } from "./i18n";

/**
 * Preis-Sektion: drei Vereins-Pakete (9 / 29 / 59 € monatlich),
 * „Mitglieder & Eltern immer kostenlos“ prominent, genau EINE
 * Beere-Primäraktion (Pro) — die Nachbarn bleiben Ghost.
 */

type TierKey = "p1" | "p2" | "p3";

const TIERS: { key: TierKey; features: string[]; highlighted?: boolean }[] = [
  { key: "p1", features: ["p1F1", "p1F2", "p1F3", "p1F4"] },
  { key: "p2", features: ["p2F1", "p2F2", "p2F3", "p2F4", "p2F5"], highlighted: true },
  { key: "p3", features: ["p3F1", "p3F2", "p3F3", "p3F4", "p3F5"] },
];

type LandingKey = keyof (typeof landingDict)["de"];

export function PricingSection() {
  const t = useT(landingDict);

  return (
    <section id="preise" className="scroll-mt-24 border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow text-brand-ink">{t("pricingEyebrow")}</span>
          <h2 className="mt-2 font-display text-[26px] font-extrabold leading-9 tracking-tight text-ink sm:text-[30px]">
            {t("pricingTitle")}
          </h2>
          <p className="mt-3 text-body text-ink-soft">{t("pricingSub")}</p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-success-soft px-4 py-2 text-[13.5px] font-bold text-success">
            <Icon name="check" className="ic h-4 w-4 [stroke-width:2.4]" />
            {t("alwaysFree")}
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {TIERS.map(({ key, features, highlighted }) => (
            <article
              key={key}
              className={`relative flex flex-col rounded-xl bg-canvas p-6 ${
                highlighted
                  ? "border-2 border-brand shadow-pop"
                  : "border border-line shadow-card"
              }`}
            >
              {highlighted && (
                <Badge tone="brand" className="absolute -top-3 left-6">
                  {t("popular")}
                </Badge>
              )}
              <h3 className="font-display text-[17px] font-extrabold tracking-tight text-ink">
                {t(`${key}Name` as LandingKey)}
              </h3>
              <p className="mt-0.5 text-caption text-ink-faint">
                {t(`${key}Audience` as LandingKey)}
              </p>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-[34px] font-extrabold leading-10 tracking-tight text-ink tabular-nums">
                  {t(`${key}Price` as LandingKey)}
                </span>
                <span className="text-caption text-ink-faint">{t("perMonth")}</span>
              </p>
              <ul className="mt-5 grid gap-2.5 border-t border-line pt-5">
                {features.map((featureKey) => (
                  <li key={featureKey} className="flex items-start gap-2.5 text-[13.5px] leading-[20px] text-ink">
                    <span
                      className="mt-px grid h-[19px] w-[19px] flex-none place-items-center rounded-full bg-success-soft text-success"
                      aria-hidden="true"
                    >
                      <Icon name="check" className="ic h-[11px] w-[11px] [stroke-width:2.6]" />
                    </span>
                    {t(featureKey as LandingKey)}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex-1" aria-hidden="true" />
              <ButtonLink
                href="/login"
                variant={highlighted ? "primary" : "ghost"}
                className="w-full"
              >
                {t("tierCta")}
              </ButtonLink>
            </article>
          ))}
        </div>

        <p className="mt-6 text-center text-caption text-ink-faint">{t("vatNote")}</p>
      </div>
    </section>
  );
}
