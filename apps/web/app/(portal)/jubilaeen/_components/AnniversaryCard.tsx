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
 * Eine Zeile der Jubiläums-Liste: festliches Art-Glyph, Personen-Avatar, Name,
 * Art + Meilenstein und rechts Datum samt Countdown-Pille. Rein lesend.
 */
export function AnniversaryCard({ item }: { item: Anniversary }) {
  const t = useT(jubilaeenDict);
  const { locale } = useLocale();

  const style = KIND_STYLE[item.kind];
  const { firstName, lastName } = splitName(item.memberName);
  const count = countdown(item.daysUntil);
  const countText = t(count.key, count.params);
  const dateText = formatDate(item.date, locale);

  return (
    <li className="flex items-center gap-3.5 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card sm:gap-4 sm:px-5">
      <span
        className={`grid h-11 w-11 flex-none place-items-center rounded-full ${style.iconWrap}`}
        aria-hidden="true"
      >
        <JubileeIcon name={style.icon} className="ic h-[22px] w-[22px]" />
      </span>

      <Avatar personId={item.memberId} firstName={firstName} lastName={lastName} size="m" />

      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
          {item.memberName}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink-soft">
          <Badge tone={style.chipTone}>{t(kindLabelKey(item.kind))}</Badge>
          <span className="font-semibold text-ink-soft">
            {t(milestoneLabelKey(item.kind), { years: item.years })}
          </span>
        </span>
      </div>

      <div className="flex flex-none flex-col items-end gap-1 text-right">
        <span
          className="whitespace-nowrap font-mono text-[12px] tabular-nums text-ink-faint"
          aria-hidden="true"
        >
          {dateText}
        </span>
        <Badge tone={count.tone}>
          <span aria-label={t("countAria", { count: countText, date: dateText })}>{countText}</span>
        </Badge>
      </div>
    </li>
  );
}
