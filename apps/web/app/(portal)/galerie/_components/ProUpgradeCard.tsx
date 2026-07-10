"use client";

import { Icon } from "@/components/shell/icons";
import { Badge } from "@/components/ui/Badge";
import { useT } from "@/lib/i18n";
import type { EntitlementTier } from "@/lib/types";
import { galerieDict } from "../i18n";

/**
 * Upgrade-Karte, wenn der Verein kein aktives PRO-Entitlement hat (statt der
 * Galerie). Das eigentliche Gate ist serverseitig (HTTP 402 club_pro_required);
 * diese Karte erklärt das Feature freundlich und zeigt den aktuellen Tarif.
 * Es gibt (noch) keinen Self-Service-Kauf — daher ein Hinweis statt eines
 * ins Leere führenden Kauf-Buttons.
 */
export function ProUpgradeCard({ tier }: { tier: EntitlementTier }) {
  const t = useT(galerieDict);

  const tierLabel =
    tier === "premium" ? t("tierPremium") : tier === "pro" ? t("tierPro") : t("tierFree");

  const features = [t("proFeature1"), t("proFeature2"), t("proFeature3")];

  return (
    <section className="grid place-items-center rounded-xl border border-line bg-surface px-6 py-12 text-center shadow-card">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand-ink">
        <Icon name="lock" className="ic h-7 w-7" />
      </span>

      <div className="mt-4 flex items-center gap-2">
        <span className="eyebrow">{t("proEyebrow")}</span>
        <Badge tone="brand" icon="sparkle">
          {t("proBadge")}
        </Badge>
      </div>

      <h3 className="mt-1 font-display text-h2 tracking-[-0.015em] text-ink">{t("proTitle")}</h3>
      <p className="mt-2 max-w-md text-body text-ink-soft">{t("proBody")}</p>

      <ul className="mt-5 grid gap-2 text-left">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5 text-body text-ink">
            <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-success-soft text-success">
              <Icon name="check" className="ic h-3.5 w-3.5" />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-2 rounded-lg border border-line bg-sunken px-5 py-4">
        <span className="flex items-center justify-center gap-2 text-caption text-ink-soft">
          {t("proTierLabel")}:
          <Badge tone="neutral">{tierLabel}</Badge>
        </span>
        <p className="max-w-md text-caption text-ink-faint">{t("proHint")}</p>
      </div>
    </section>
  );
}
