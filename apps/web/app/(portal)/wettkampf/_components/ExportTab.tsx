"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useToast } from "@/components/ui/Toast";
import type { IconName } from "@/components/shell/icons";
import { useT } from "@/lib/i18n";
import { wettkampfDict, type WettkampfKey } from "../i18n";

type Feature = {
  id: string;
  icon: IconName;
  titleKey: WettkampfKey;
  bodyKey: WettkampfKey;
};

const FEATURES: Feature[] = [
  { id: "certificates", icon: "download", titleKey: "certTitle", bodyKey: "certBody" },
  { id: "federation", icon: "mail", titleKey: "fedTitle", bodyKey: "fedBody" },
];

/** Platzhalter: Urkunden-Druck & Verbandsmeldung-Export — „Bald verfügbar“. */
export function ExportTab({
  notified,
  onNotified,
}: {
  notified: Record<string, boolean>;
  onNotified: (next: Record<string, boolean>) => void;
}) {
  const t = useT(wettkampfDict);
  const { showToast } = useToast();

  function handleNotify(feature: Feature) {
    onNotified({ ...notified, [feature.id]: true });
    showToast(t("notifyToast", { feature: t(feature.titleKey) }), { tone: "success" });
  }

  return (
    <div className="grid gap-4">
      <SectionHeader title={t("exportTitle")} sub={t("exportSub")} />
      <div className="grid items-start gap-5 md:grid-cols-2">
        {FEATURES.map((feature) => (
          <EmptyState
            key={feature.id}
            icon={feature.icon}
            title={t(feature.titleKey)}
            body={t(feature.bodyKey)}
            action={
              <span className="flex flex-col items-center gap-3">
                <Badge tone="info" icon="clock">
                  {t("soon")}
                </Badge>
                {notified[feature.id] ? (
                  <Button variant="ghost" icon="check" disabled>
                    {t("notified")}
                  </Button>
                ) : (
                  <Button variant="ghost" icon="bell" onClick={() => handleNotify(feature)}>
                    {t("notify")}
                  </Button>
                )}
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
}
