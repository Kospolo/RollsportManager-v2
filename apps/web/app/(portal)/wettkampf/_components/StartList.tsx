"use client";

import { AvatarStack } from "@/components/ui/AvatarStack";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { formatDurationMs } from "@/lib/format";
import { formatScore, skaterNames, type StartGroup } from "../derive";
import { wettkampfDict } from "../i18n";

/**
 * Startliste je Kategorie — mit „Jetzt läuft"-Hervorhebung im Live-Modus.
 * `pointer` ist der globale Startindex der laufenden Kür (Anzahl gewerteter
 * Starts); im Nur-Lese-Modus (`interactive: false`, für Mitglieder) entfällt
 * die Zeiger-Logik und die Liste dient als reine Referenz. `totalByRoutine`
 * liefert die gespeicherte Gesamtwertung (Server) für bereits gewertete Starts.
 */
export function StartList({
  groups,
  pointer,
  total,
  interactive,
  totalByRoutine,
}: {
  groups: StartGroup[];
  pointer: number;
  total: number;
  interactive: boolean;
  totalByRoutine?: Map<string, number | null>;
}) {
  const t = useT(wettkampfDict);
  const { locale } = useLocale();

  return (
    <Card>
      <CardHeader
        eyebrow={t("seedNote")}
        title={t("startlistTitle")}
        action={
          interactive ? (
            <span className="text-caption tabular-nums text-ink-faint">
              {pointer}/{total}
            </span>
          ) : undefined
        }
      />
      <div className="grid gap-4">
        {groups.map((group) => (
          <div key={group.category || "—"} className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
              <span className="eyebrow">{group.category || t("colCategory")}</span>
              <span className="text-caption tabular-nums text-ink-faint">
                {group.items.length === 1
                  ? t("footerStartersOne")
                  : t("footerStartersMany", { n: group.items.length })}
              </span>
            </div>
            <ol className="grid gap-2">
              {group.items.map(({ item, index }) => {
                const isDone = interactive && index < pointer;
                const isCurrent = interactive && index === pointer;
                const isNext = interactive && index === pointer + 1;
                const doneTotal = isDone ? totalByRoutine?.get(item.routine.id) : undefined;
                return (
                  <li
                    key={item.routine.id}
                    aria-current={isCurrent ? "step" : undefined}
                    className={`flex min-h-14 flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors duration-150 ${
                      isCurrent ? "border-brand bg-brand-soft" : "border-line bg-canvas"
                    }`}
                  >
                    <span className="w-7 text-center font-mono text-[15px] font-bold tabular-nums text-ink-faint">
                      {index + 1}
                    </span>
                    <AvatarStack
                      people={item.skaters.map((skater) => ({
                        personId: skater.id,
                        firstName: skater.firstName,
                        lastName: skater.lastName,
                      }))}
                      size="s"
                    />
                    <span className="grid min-w-0 flex-1 gap-px">
                      <b className="text-[14px] font-bold text-ink">
                        {skaterNames(item.skaters)}
                      </b>
                      <span className="text-caption text-ink-faint">{item.routine.title}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-mono text-mono-table tabular-nums text-honey-deep">
                      <Icon name="clock" className="ic h-[14px] w-[14px]" />
                      <span className="sr-only">{t("srDuration")} </span>
                      {formatDurationMs(item.routine.music.durationMs)}
                    </span>
                    {isDone ? (
                      <span className="inline-flex items-center gap-2">
                        {doneTotal != null && (
                          <span className="font-mono text-mono-table tabular-nums text-ink">
                            {formatScore(doneTotal, locale)}
                          </span>
                        )}
                        <Badge tone="success" icon="check">
                          {t("scoredBadge")}
                        </Badge>
                      </span>
                    ) : isCurrent ? (
                      <Badge tone="brand" icon="play">
                        {t("nowRunning")}
                      </Badge>
                    ) : isNext ? (
                      <Badge tone="info">{t("upNext")}</Badge>
                    ) : interactive ? (
                      <Badge tone="neutral">{t("waiting")}</Badge>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </Card>
  );
}
