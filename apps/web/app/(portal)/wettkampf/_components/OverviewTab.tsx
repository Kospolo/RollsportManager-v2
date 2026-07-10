"use client";

import Link from "next/link";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { dayDiff, formatDate, formatTime, relativeDays } from "@/lib/format";
import { fullName, memberById } from "@/lib/data";
import type { Competition, CompetitionStatus, Member, Routine, Task } from "@/lib/types";
import {
  formatScore,
  formatScoreDelta,
  pastResults,
  skaterNames,
  type StarterEntry,
} from "../derive";
import { wettkampfDict, type WettkampfKey } from "../i18n";
import type { WettkampfTab } from "../WettkampfClient";

const STATUS_TONE: Record<CompetitionStatus, BadgeTone> = {
  upcoming: "brand",
  running: "success",
  done: "neutral",
};

const STATUS_KEY: Record<CompetitionStatus, WettkampfKey> = {
  upcoming: "statusUpcoming",
  running: "statusRunning",
  done: "statusDone",
};

type Stats = {
  starters: number;
  ready: number;
  missing: number;
  routines: number;
  feePaid: number;
  feeOpen: number;
  feeNone: number;
};

export function OverviewTab({
  competition,
  pastCompetitions,
  stats,
  entries,
  tasks,
  taskDone,
  members,
  routines,
  onTaskState,
  onSwitchTab,
}: {
  competition?: Competition;
  pastCompetitions: Competition[];
  stats: Stats;
  entries: StarterEntry[];
  tasks: Task[];
  taskDone: Record<string, boolean>;
  /** Geladene Stammdaten für Namens-/Kür-Auflösung (aus der Facade) */
  members: Member[];
  routines: Routine[];
  onTaskState: (taskId: string, done: boolean) => void;
  onSwitchTab: (tab: WettkampfTab) => void;
}) {
  const t = useT(wettkampfDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  function toggleTask(task: Task) {
    const nowDone = !taskDone[task.id];
    onTaskState(task.id, nowDone);
    if (nowDone) {
      showToast(t("taskDoneToast", { title: task.title }), {
        tone: "success",
        actionLabel: t("undo"),
        onAction: () => onTaskState(task.id, false),
      });
    }
  }

  const openCount = tasks.filter((task) => !taskDone[task.id]).length;

  return (
    <div className="grid gap-6">
      <div className="grid items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* ---------- Kommender Wettkampf ---------- */}
        <section aria-label={t("upcomingTitle")} className="grid gap-5">
          <h2 className="sr-only">{t("upcomingTitle")}</h2>
          {competition && (
            <Card>
              <CardHeader
                eyebrow={`${formatDate(competition.startsAt, locale)} · ${relativeDays(competition.startsAt, locale)}`}
                title={competition.name}
                action={
                  <Badge tone={STATUS_TONE[competition.status]}>
                    {t(STATUS_KEY[competition.status])}
                  </Badge>
                }
              />

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-ink-soft">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="pin" className="ic h-[14px] w-[14px] text-ink-faint" />
                  {competition.location}
                </span>
                {competition.endsAt && (
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Icon name="clock" className="ic h-[14px] w-[14px] text-ink-faint" />
                    {t("timeRange", {
                      start: formatTime(competition.startsAt, locale),
                      end: formatTime(competition.endsAt, locale),
                    })}
                  </span>
                )}
                {competition.registrationDeadline && (
                  <Badge
                    tone={dayDiff(competition.registrationDeadline) <= 3 ? "warn" : "info"}
                  >
                    {t("deadlineBadge", {
                      rel: relativeDays(competition.registrationDeadline, locale),
                    })}
                  </Badge>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <AvatarStack
                  people={entries.map((entry) => ({
                    personId: entry.member.id,
                    firstName: entry.member.firstName,
                    lastName: entry.member.lastName,
                  }))}
                  max={6}
                  size="m"
                  label={t("startersLine", {
                    starters: stats.starters,
                    routines: stats.routines,
                  })}
                />
                <span className="text-[14px] font-semibold text-ink-soft">
                  {t("startersLine", { starters: stats.starters, routines: stats.routines })}
                </span>
              </div>

              <div className="mt-4 grid gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-caption font-semibold text-ink-soft">
                    {t("feeLine", { paid: stats.feePaid, total: stats.starters })}
                  </span>
                  {stats.feeNone > 0 && (
                    <span className="text-caption text-ink-faint">
                      {t("feeNoneHint", { n: stats.feeNone })}
                    </span>
                  )}
                </div>
                <ProgressBar
                  value={stats.feePaid}
                  max={stats.starters}
                  tone="success"
                  label={t("feeLine", { paid: stats.feePaid, total: stats.starters })}
                />
              </div>

              <CardFooter>
                <span>{t("startlistNote")}</span>
                <span className="flex flex-wrap items-center gap-2.5">
                  <Button variant="secondary" size="sm" onClick={() => onSwitchTab("entries")}>
                    {t("openEntries")}
                  </Button>
                  <Button variant="ghost" size="sm" icon="play" onClick={() => onSwitchTab("live")}>
                    {t("openLive")}
                  </Button>
                </span>
              </CardFooter>
            </Card>
          )}
        </section>

        {/* ---------- Aufgaben ---------- */}
        <Card>
          <CardHeader
            eyebrow={t("tasksEyebrow")}
            title={t("tasksTitle")}
            action={
              openCount > 0 ? (
                <Badge tone="info">{t("tasksOpenBadge", { n: openCount })}</Badge>
              ) : (
                <Badge tone="success" icon="check">
                  {t("tasksAllDoneBadge")}
                </Badge>
              )
            }
          />
          {tasks.length === 0 ? (
            <p className="text-body text-ink-soft">{t("tasksEmpty")}</p>
          ) : (
            <ul className="grid gap-1">
              {tasks.map((task) => {
                const done = Boolean(taskDone[task.id]);
                const assignee = task.assigneeId ? memberById(members, task.assigneeId) : undefined;
                const dueSoon = task.dueAt !== undefined && dayDiff(task.dueAt) <= 2;
                return (
                  <li key={task.id} className="flex items-start gap-2.5 border-b border-line py-2.5 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggleTask(task)}
                      aria-pressed={done}
                      aria-label={t(done ? "taskReopenAria" : "taskToggleAria", {
                        title: task.title,
                      })}
                      className="-m-2 grid h-11 w-11 flex-none place-items-center"
                    >
                      <span
                        className={`grid h-[23px] w-[23px] place-items-center rounded-sm border transition-colors duration-150 ${
                          done
                            ? "border-success bg-success text-canvas"
                            : "border-line-strong bg-surface"
                        }`}
                      >
                        {done && <Icon name="check" className="ic h-[14px] w-[14px]" />}
                      </span>
                    </button>
                    <div className="grid min-w-0 gap-0.5 pt-0.5">
                      <span
                        className={`text-[14px] font-semibold ${
                          done ? "text-ink-faint line-through" : "text-ink"
                        }`}
                      >
                        {task.title}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-ink-faint">
                        {assignee && (
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar
                              personId={assignee.id}
                              firstName={assignee.firstName}
                              lastName={assignee.lastName}
                              size="s"
                            />
                            {fullName(assignee)}
                          </span>
                        )}
                        {task.dueAt && !done && (
                          <span className={dueSoon ? "font-semibold text-warn" : undefined}>
                            {t("taskDue", { rel: relativeDays(task.dueAt, locale) })}
                          </span>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ---------- Vergangene Wettkämpfe ---------- */}
      {pastCompetitions.length > 0 && (
        <section aria-label={t("pastTitle")} className="grid gap-4">
          <h2 className="font-display text-h2 tracking-[-0.015em] text-ink">{t("pastTitle")}</h2>
          {pastCompetitions.map((past) => {
            const results = pastResults(past, routines, members);
            return (
              <Card key={past.id}>
                <CardHeader
                  eyebrow={`${formatDate(past.startsAt, locale)} · ${relativeDays(past.startsAt, locale)}`}
                  title={past.name}
                  action={<Badge tone={STATUS_TONE[past.status]}>{t(STATUS_KEY[past.status])}</Badge>}
                />
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-ink-soft">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="pin" className="ic h-[14px] w-[14px] text-ink-faint" />
                    {past.location}
                  </span>
                  <span>{t("pastMeta", { n: results.length })}</span>
                </div>
                <ul className="grid gap-1">
                  {results.map((result) => {
                    const delta =
                      result.previous !== undefined
                        ? result.score.total - result.previous.total
                        : undefined;
                    return (
                      <li
                        key={result.routine.id}
                        className="flex min-h-14 flex-wrap items-center gap-3 border-b border-line py-2 last:border-b-0"
                      >
                        <AvatarStack
                          people={result.skaters.map((skater) => ({
                            personId: skater.id,
                            firstName: skater.firstName,
                            lastName: skater.lastName,
                          }))}
                          size="s"
                        />
                        <div className="grid min-w-0 gap-0.5">
                          <span className="text-[14px] font-bold text-ink">
                            {skaterNames(result.skaters)}
                          </span>
                          <Link
                            href={`/kueren/${result.routine.id}`}
                            className="text-caption font-semibold"
                          >
                            {result.routine.title} · {result.routine.category}
                          </Link>
                        </div>
                        <span className="ml-auto flex items-center gap-2.5">
                          {delta === undefined ? (
                            <Badge tone="neutral">{t("firstScore")}</Badge>
                          ) : (
                            <Badge tone={delta >= 0 ? "success" : "danger"}>
                              {t("deltaPoints", { delta: formatScoreDelta(delta, locale) })}
                            </Badge>
                          )}
                          <span className="font-mono text-[15px] font-bold tabular-nums text-ink">
                            {formatScore(result.score.total, locale)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
