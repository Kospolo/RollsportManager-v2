"use client";

import { useT } from "@/lib/i18n";
import { shellDict, type ShellKey } from "@/lib/i18n/shell";
import { EmptyState } from "@/components/ui/EmptyState";
import type { IconName } from "./icons";

/**
 * Platzhalter-Seite für die sechs Portal-Routen: Display-Überschrift +
 * Untertitel + EmptyState mit Handlung. Wird von den Screen-Teams
 * durch die echten Inhalte ersetzt.
 */
export function PlaceholderPage({
  titleKey,
  subKey,
  icon,
  showCta = true,
}: {
  titleKey: ShellKey;
  subKey: ShellKey;
  icon: IconName;
  showCta?: boolean;
}) {
  const t = useT(shellDict);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <header className="grid gap-1">
        <h1 className="font-display text-display text-ink">{t(titleKey)}</h1>
        <p className="text-[14px] text-ink-soft">{t(subKey)}</p>
      </header>
      <EmptyState
        icon={icon}
        title={t("emptyTitle")}
        body={t("emptyBody")}
        ctaHref={showCta ? "/dashboard" : undefined}
        ctaLabel={showCta ? t("emptyCta") : undefined}
      />
    </div>
  );
}
