"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, isForbidden } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT } from "@/lib/i18n";
import type { Competition, CompetitionStandings } from "@/lib/types";
import {
  formatScore,
  groupStartByCategory,
  skaterNames,
  totalOf,
  type EnteredScore,
  type StartItem,
} from "../derive";
import { wettkampfDict } from "../i18n";
import { LiveStandings } from "./LiveStandings";
import { ScorePad } from "./ScorePad";
import { StartList } from "./StartList";

/** ISO-Datum (YYYY-MM-DD) von heute — Wertungsdatum für saveRoutineScore. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Live-Modus (das USP): führt den Trainerstab durch die Startliste, erfasst
 * jede RollArt-Wertung ECHT über die Facade (`saveRoutineScore`) und zeigt die
 * Live-Rangliste (`getCompetitionStandings`) mit Rang + Delta-Chips. Schreiben
 * ist is_club_trainer+ (`canScore`); Mitglieder sehen die Rangliste lesend.
 * Der Fortschritt (`scored`) lebt in der Client-Session, damit ein Tab-Wechsel
 * nichts verwirft; die Rangliste ist die Wahrheit vom Server.
 */
export function LiveTab({
  competition,
  order,
  canScore,
  scored,
  onScored,
  onReset,
}: {
  competition: Competition | undefined;
  order: StartItem[];
  canScore: boolean;
  scored: string[];
  onScored: (routineId: string) => void;
  onReset: () => void;
}) {
  const t = useT(wettkampfDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const competitionId = competition?.id;
  const standings = useData(
    (repo) =>
      competitionId
        ? repo.getCompetitionStandings(competitionId)
        : Promise.resolve<CompetitionStandings | null>(null),
    [competitionId],
  );

  const groups = useMemo(() => groupStartByCategory(order), [order]);
  const totalByRoutine = useMemo(() => {
    const map = new Map<string, number | null>();
    if (standings.status === "ready" && standings.data) {
      for (const row of standings.data.rows) map.set(row.routineId, row.totalScore);
    }
    return map;
  }, [standings]);

  const pointer = scored.length;
  const current = order[pointer];
  const allScored = order.length > 0 && pointer >= order.length;

  async function handleSubmit(score: EnteredScore) {
    if (!competitionId || !current || submitting) return;
    setSubmitting(true);
    const total = totalOf(score);
    try {
      await data.saveRoutineScore(score.routineId, {
        scoredOn: todayIso(),
        technicalScore: score.technical,
        componentsScore: score.components,
        totalScore: total,
        competitionId,
      });
      onScored(score.routineId);
      standings.reload();
      showToast(
        t("scoreToast", {
          name: skaterNames(current.skaters),
          total: formatScore(total, locale),
        }),
        { tone: "success" },
      );
    } catch (error: unknown) {
      showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void handleSubmit(score),
      });
    } finally {
      setSubmitting(false);
    }
  }

  /* Kein Wettkampf / keine gemeldeten Küren → freundlicher Hinweis. */
  if (!competition || order.length === 0) {
    return (
      <EmptyState
        icon="competition"
        title={t("liveNoStartlistTitle")}
        body={t("liveNoStartlistBody")}
      />
    );
  }

  const intro = (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
      <Badge tone="brand" icon="zap">
        {t("liveBadge")}
      </Badge>
      <p className="min-w-0 flex-1 basis-64 text-caption text-ink-soft">
        {canScore ? t("liveTrainerIntro") : t("liveMemberIntro")}
      </p>
      {canScore && (
        <span className="flex items-center gap-3">
          <span className="text-caption tabular-nums text-ink-faint">
            {t("liveProgress", { done: pointer, total: order.length })}
          </span>
          <Button variant="ghost" size="sm" disabled={pointer === 0} onClick={onReset}>
            {t("resetLive")}
          </Button>
        </span>
      )}
    </div>
  );

  /* Mitglieder: Rangliste lesend zuerst, Startliste als Referenz darunter. */
  if (!canScore) {
    return (
      <div className="grid gap-5">
        {intro}
        <LiveStandings state={standings} />
        <StartList groups={groups} pointer={-1} total={order.length} interactive={false} />
      </div>
    );
  }

  /* Trainerstab: Startliste + Schnelleingabe, darunter die Live-Rangliste. */
  return (
    <div className="grid gap-5">
      {intro}
      <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
        <StartList
          groups={groups}
          pointer={pointer}
          total={order.length}
          interactive
          totalByRoutine={totalByRoutine}
        />
        {allScored || !current ? (
          <EmptyState
            icon="check"
            title={t("allScoredTitle")}
            body={t("allScoredBody")}
            action={
              <Button variant="ghost" onClick={onReset}>
                {t("resetLive")}
              </Button>
            }
          />
        ) : (
          <ScorePad
            key={current.routine.id}
            item={current}
            startNumber={pointer + 1}
            locale={locale}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        )}
      </div>
      <LiveStandings state={standings} />
    </div>
  );
}
