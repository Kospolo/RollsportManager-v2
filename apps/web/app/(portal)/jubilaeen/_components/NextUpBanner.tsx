"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useLocale, useT } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import type { Anniversary } from "@/lib/types";
import { jubilaeenDict, kindLabelKey, milestoneLabelKey } from "../i18n";
import { JubileeIcon } from "./JubileeIcon";
import { KIND_STYLE, countdown, splitName } from "./parts";

/**
 * Festlicher „Als Nächstes"-Hero für das nächstgelegene Jubiläum: warmer
 * Verlauf, Konfetti-Glyph, große Person und Countdown. Setzt den Ton der Seite
 * (Heimspiel-Look) und bleibt rein lesend.
 */
export function NextUpBanner({ item }: { item: Anniversary }) {
  const t = useT(jubilaeenDict);
  const { locale } = useLocale();

  const style = KIND_STYLE[item.kind];
  const { firstName, lastName } = splitName(item.memberName);
  const count = countdown(item.daysUntil);
  const countText = t(count.key, count.params);

  return (
    <section
      className="relative overflow-hidden rounded-xl border border-line bg-gradient-to-br from-brand-soft via-surface to-warn-soft p-5 shadow-card sm:p-6"
      aria-label={t("nextUpEyebrow")}
    >
      <JubileeIcon
        name="confetti"
        className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 text-brand opacity-15"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span
          className={`grid h-14 w-14 flex-none place-items-center rounded-full ${style.iconWrap}`}
          aria-hidden="true"
        >
          <JubileeIcon name={style.icon} className="ic h-7 w-7" />
        </span>

        <div className="grid min-w-0 flex-1 gap-1.5">
          <span className="eyebrow text-brand-ink">{t("nextUpEyebrow")}</span>
          <div className="flex min-w-0 items-center gap-3">
            <Avatar personId={item.memberId} firstName={firstName} lastName={lastName} size="l" />
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-display text-h3 tracking-[-0.015em] text-ink">
                {item.memberName}
              </span>
              <span className="text-[14px] font-semibold text-ink-soft">
                {t(kindLabelKey(item.kind))}
                {item.years !== null ? ` · ${t(milestoneLabelKey(item.kind), { years: item.years })}` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-none items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
          <Badge tone={count.tone} className="text-[13px]">
            {countText}
          </Badge>
          <span className="font-mono text-[12px] tabular-nums text-ink-faint">
            {formatDate(item.date, locale)}
          </span>
        </div>
      </div>
    </section>
  );
}
