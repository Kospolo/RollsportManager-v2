"use client";

import { useMemo } from "react";
import type { Routine } from "@/lib/types";
import { competitions } from "@/lib/mock";
import { useLocale, useT } from "@/lib/i18n";
import { Card, CardHeader, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/ui/Sparkline";
import { Icon } from "@/components/shell/icons";
import { kuerenDict, formatPoints, formatPointsDelta } from "../../i18n";

/**
 * RollArt-Verlauf (Jury-Übernahme aus B, DESIGN-SYSTEM §3.9):
 * warme Balken mit Mono-Werten pro Wettkampf, Bestwert in Beere,
 * Delta-Chip — der Trend ist der motivierende Wert, nicht die Einzelzahl.
 */

const BAR_MIN_PX = 44;
const BAR_MAX_PX = 92;

export function ScoreTrend({ routine }: { routine: Routine }) {
  const t = useT(kuerenDict);
  const { locale } = useLocale();
  const intl = locale === "de" ? "de-DE" : "en-GB";

  const scores = useMemo(
    () => [...routine.scores].sort((a, b) => a.date.localeCompare(b.date)),
    [routine.scores],
  );

  const eventName = (competitionId?: string) =>
    competitions.find((c) => c.id === competitionId)?.name ?? t("trainingScore");

  if (scores.length === 0) {
    return (
      <Card>
        <CardHeader eyebrow={t("scoreEyebrow")} title={t("scoreTitle")} />
        <div className="grid place-items-center gap-2 py-6 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-sunken text-ink-soft">
            <Icon name="sparkle" className="ic h-5 w-5" />
          </span>
          <p className="max-w-xs text-caption text-ink-soft">{t("scoreEmpty")}</p>
        </div>
      </Card>
    );
  }

  const totals = scores.map((s) => s.total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const range = max - min;
  const best = scores[totals.indexOf(max)];
  const delta = totals[totals.length - 1] - totals[0];
  const deltaTone = delta > 0 ? "success" : delta < 0 ? "danger" : "neutral";

  const monthYear = new Intl.DateTimeFormat(intl, { month: "short", year: "numeric" });
  const valuesText = totals.map((v) => formatPoints(v, locale)).join(" → ");

  return (
    <Card>
      <CardHeader
        eyebrow={t("scoreEyebrow")}
        title={t("scoreTitle")}
        action={<Sparkline values={totals} width={110} height={34} className="text-brand" />}
      />

      <div
        role="img"
        aria-label={t("sparkLabel", { values: valuesText })}
        className="flex items-end gap-3.5 pt-1"
      >
        {scores.map((score) => {
          const height =
            range > 0
              ? BAR_MIN_PX + ((score.total - min) / range) * (BAR_MAX_PX - BAR_MIN_PX)
              : (BAR_MIN_PX + BAR_MAX_PX) / 2;
          const isBest = score.id === best.id;
          return (
            <div key={score.id} className="grid min-w-0 flex-1 justify-items-center gap-1.5">
              <span className="font-mono text-[13.5px] font-bold tabular-nums text-ink">
                {formatPoints(score.total, locale)}
              </span>
              <div
                className={`w-full max-w-[68px] rounded-t-[9px] rounded-b-[5px] ${
                  isBest ? "bg-brand" : "bg-brand-soft"
                }`}
                style={{ height: `${Math.round(height)}px` }}
              />
              <span className="text-center text-[11.5px] leading-[1.35] text-ink-faint">
                {eventName(score.competitionId)}
                <br />
                {monthYear.format(new Date(score.date))}
              </span>
            </div>
          );
        })}
      </div>

      {/* Technik/Komponenten des letzten Laufs als Klartext */}
      <p className="mt-3 text-caption text-ink-soft">
        {t("technicalShort", { value: formatPoints(scores[scores.length - 1].technical, locale) })} ·{" "}
        {t("componentsShort", {
          value: formatPoints(scores[scores.length - 1].components, locale),
        })}
      </p>

      <CardFooter>
        <span className="inline-flex flex-wrap items-center gap-2">
          {scores.length > 1 ? (
            <>
              <Badge tone={deltaTone}>
                <span className="font-mono tabular-nums">{formatPointsDelta(delta, locale)}</span>
              </Badge>
              <span>{t("sinceFirstPlain")}</span>
            </>
          ) : (
            <Badge tone="neutral">{t("firstScore")}</Badge>
          )}
        </span>
        <span className="tabular-nums">{t("bestValue", { best: formatPoints(best.total, locale) })}</span>
      </CardFooter>
    </Card>
  );
}
