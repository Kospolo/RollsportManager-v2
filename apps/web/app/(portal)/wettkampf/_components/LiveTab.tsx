"use client";

import { AvatarStack } from "@/components/ui/AvatarStack";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { formatDurationMs } from "@/lib/format";
import {
  formatScore,
  skaterNames,
  totalOf,
  type EnteredScore,
  type StartItem,
} from "../derive";
import { wettkampfDict } from "../i18n";
import { ScorePad } from "./ScorePad";

/* ---------- Rechenhelfer (rein lokal, kein Backend) ---------- */

function ranksOf(list: EnteredScore[]): Map<string, number> {
  const sorted = [...list].sort((a, b) => totalOf(b) - totalOf(a));
  return new Map(sorted.map((score, index) => [score.routineId, index + 1]));
}

/* ---------- Live-Modus-Vorschau ---------- */

export function LiveTab({
  order,
  entered,
  onEnteredChange,
}: {
  order: StartItem[];
  entered: EnteredScore[];
  onEnteredChange: (next: EnteredScore[]) => void;
}) {
  const t = useT(wettkampfDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const current = order[entered.length];
  const allScored = order.length > 0 && entered.length >= order.length;

  const itemById = new Map(order.map((item) => [item.routine.id, item]));
  const ranks = ranksOf(entered);
  const prevRanks = ranksOf(entered.slice(0, -1));
  const lastEnteredId = entered[entered.length - 1]?.routineId;

  type StandingRow = { item: StartItem; score: EnteredScore; rank: number };
  const standings: StandingRow[] = [...entered]
    .sort((a, b) => totalOf(b) - totalOf(a))
    .flatMap((score) => {
      const item = itemById.get(score.routineId);
      return item ? [{ item, score, rank: ranks.get(score.routineId) ?? 0 }] : [];
    });

  function handleSubmit(score: EnteredScore) {
    const item = itemById.get(score.routineId);
    onEnteredChange([...entered, score]);
    if (item) {
      showToast(
        t("scoreToast", {
          name: skaterNames(item.skaters),
          total: formatScore(totalOf(score), locale),
        }),
        { tone: "success" },
      );
    }
  }

  const changeCell = (row: StandingRow) => {
    if (row.score.routineId === lastEnteredId) {
      return <Badge tone="brand">{t("newBadge")}</Badge>;
    }
    const prev = prevRanks.get(row.score.routineId);
    const delta = prev === undefined ? 0 : prev - row.rank;
    if (delta > 0) {
      return (
        <Badge tone="success">
          <span aria-hidden="true">▲ {delta}</span>
          <span className="sr-only">{t("rankUpAria", { n: delta })}</span>
        </Badge>
      );
    }
    if (delta < 0) {
      return (
        <Badge tone="danger">
          <span aria-hidden="true">▼ {-delta}</span>
          <span className="sr-only">{t("rankDownAria", { n: -delta })}</span>
        </Badge>
      );
    }
    return (
      <Badge tone="neutral">
        <span aria-hidden="true">=</span>
        <span className="sr-only">{t("rankSameAria")}</span>
      </Badge>
    );
  };

  const standingsColumns: Column<StandingRow>[] = [
    {
      id: "rank",
      header: t("colRank"),
      cellClassName: "w-14",
      cell: (row) => (
        <span className="font-mono text-mono-table tabular-nums text-ink">{row.rank}.</span>
      ),
    },
    { id: "change", header: t("colChange"), cell: changeCell },
    {
      id: "skater",
      header: t("colSkater"),
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <AvatarStack
            people={row.item.skaters.map((skater) => ({
              personId: skater.id,
              firstName: skater.firstName,
              lastName: skater.lastName,
            }))}
            size="s"
          />
          <span className="grid min-w-0 gap-px">
            <b className="font-bold text-ink">{skaterNames(row.item.skaters)}</b>
            <span className="text-caption text-ink-faint">
              {row.item.routine.title} · {row.item.routine.category}
            </span>
          </span>
        </span>
      ),
    },
    {
      id: "technical",
      header: t("colTechnical"),
      mono: true,
      cell: (row) => formatScore(row.score.technical, locale),
    },
    {
      id: "components",
      header: t("colComponents"),
      mono: true,
      cell: (row) => formatScore(row.score.components, locale),
    },
    {
      id: "total",
      header: t("colTotal"),
      mono: true,
      cellClassName: "font-extrabold",
      cell: (row) => formatScore(totalOf(row.score), locale),
    },
  ];

  return (
    <div className="grid gap-5">
      {/* Vorschau-Hinweis + Zurücksetzen */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
        <Badge tone="info" icon="zap">
          {t("livePreview")}
        </Badge>
        <p className="min-w-0 flex-1 basis-64 text-caption text-ink-soft">{t("liveIntro")}</p>
        <Button
          variant="ghost"
          size="sm"
          disabled={entered.length === 0}
          onClick={() => onEnteredChange([])}
        >
          {t("resetLive")}
        </Button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
        {/* ---------- Startliste ---------- */}
        <Card>
          <CardHeader
            eyebrow={t("seedNote")}
            title={t("startlistTitle")}
            action={
              <span className="text-caption tabular-nums text-ink-faint">
                {entered.length}/{order.length}
              </span>
            }
          />
          <ol className="grid gap-2">
            {order.map((item, index) => {
              const isDone = index < entered.length;
              const isCurrent = index === entered.length;
              const isNext = index === entered.length + 1;
              const doneScore = isDone ? entered[index] : undefined;
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
                    <b className="text-[14px] font-bold text-ink">{skaterNames(item.skaters)}</b>
                    <span className="text-caption text-ink-faint">
                      {item.routine.title} · {item.routine.category}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-mono-table tabular-nums text-honey-deep">
                    <Icon name="clock" className="ic h-[14px] w-[14px]" />
                    <span className="sr-only">{t("srDuration")} </span>
                    {formatDurationMs(item.routine.music.durationMs)}
                  </span>
                  {isDone && doneScore ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="font-mono text-mono-table tabular-nums text-ink">
                        {formatScore(totalOf(doneScore), locale)}
                      </span>
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
                  ) : (
                    <Badge tone="neutral">{t("waiting")}</Badge>
                  )}
                </li>
              );
            })}
          </ol>
        </Card>

        {/* ---------- RollArt-Schnelleingabe ---------- */}
        {allScored || !current ? (
          <EmptyState
            icon="check"
            title={t("allScoredTitle")}
            body={t("allScoredBody")}
            action={
              <Button variant="ghost" onClick={() => onEnteredChange([])}>
                {t("resetLive")}
              </Button>
            }
          />
        ) : (
          <ScorePad
            key={current.routine.id}
            item={current}
            startNumber={entered.length + 1}
            locale={locale}
            onSubmit={handleSubmit}
          />
        )}
      </div>

      {/* ---------- Zwischenstand ---------- */}
      <Card padded={false} className="px-2 py-4 sm:px-4">
        <CardHeader
          className="px-3 pt-1 sm:px-2"
          title={allScored ? t("standingsFinalTitle") : t("standingsTitle")}
        />
        {standings.length === 0 ? (
          <div className="grid gap-1 px-3 pb-4 sm:px-2">
            <b className="text-[14.5px] font-bold text-ink">{t("standingsEmptyTitle")}</b>
            <p className="text-body text-ink-soft">{t("standingsEmptyBody")}</p>
          </div>
        ) : (
          <DataTable
            columns={standingsColumns}
            rows={standings}
            rowKey={(row) => row.score.routineId}
            caption={t("standingsCaption")}
          />
        )}
      </Card>
    </div>
  );
}
