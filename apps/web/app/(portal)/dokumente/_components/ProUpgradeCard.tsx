"use client";

import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { useT } from "@/lib/i18n";
import type { ClubEntitlement, EntitlementTier } from "@/lib/types";
import { documentsDict } from "../i18n";

/**
 * Upgrade-Hinweis, wenn der Verein kein aktives PRO/Premium-Entitlement hat
 * (getClubEntitlement().pro === false bzw. HTTP 402 club_pro_required). Rein
 * informativ — das Gate ist serverseitig verbindlich. Kein Aktions-Button, um
 * keinen toten Link zu erzeugen; das Freischalten ist eine Admin-Aufgabe.
 */
export function ProUpgradeCard({ entitlement }: { entitlement?: ClubEntitlement }) {
  const t = useT(documentsDict);

  const tierKey: Record<EntitlementTier, "tierFree" | "tierPro" | "tierPremium"> = {
    free: "tierFree",
    pro: "tierPro",
    premium: "tierPremium",
  };
  const tierLabel = entitlement ? t(tierKey[entitlement.tier]) : t("tierFree");

  const bullets = [t("proBullet1"), t("proBullet2"), t("proBullet3")];

  return (
    <section className="grid gap-5 rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-warn-soft text-warn">
          <Icon name="lock" className="ic h-6 w-6" />
        </span>
        <div className="grid min-w-0 gap-1">
          <span className="eyebrow flex items-center gap-2">
            {t("proEyebrow")}
            <Badge tone="warn">{t("proBadge")}</Badge>
          </span>
          <h2 className="font-display text-h2 tracking-[-0.015em] text-ink">{t("proTitle")}</h2>
        </div>
      </div>

      <p className="max-w-2xl text-body text-ink-soft">{t("proBody")}</p>

      <ul className="grid gap-2">
        {bullets.map((line) => (
          <li key={line} className="flex items-start gap-2.5 text-body text-ink">
            <Icon name="check" className="ic mt-0.5 h-4 w-4 flex-none text-success" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Badge tone="neutral">{t("proCurrentTier", { tier: tierLabel })}</Badge>
        <p className="text-caption text-ink-faint">{t("proHint")}</p>
      </div>
    </section>
  );
}
