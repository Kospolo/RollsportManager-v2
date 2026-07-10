"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { dayDiff, relativeDays } from "@/lib/format";
import {
  data,
  errorMessage,
  fullName,
  isForbidden,
  isNotImplemented,
  memberById,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Competition, Member, Task } from "@/lib/types";
import { dashboardDict } from "../i18n";

/**
 * Aufgabenliste: abhakbar (optimistisch, persistiert über die Facade),
 * erledigt = durchgestrichen, Fälligkeits-Chip immer Farbe + Wort.
 * Erledigen zeigt einen Toast mit „Rückgängig“ — nie stilles Handeln.
 * api-Modus: kein Task-Endpoint → Karte zeigt den Hinweis-Leerzustand.
 */

export function TasksCard({
  members,
  competitions,
}: {
  members: Member[];
  /** Für die Meta-Zeile; darf leer sein (api-Modus ohne Wettkampf-Endpoint). */
  competitions: Competition[];
}) {
  const t = useT(dashboardDict);
  const tasks = useData((repo) => repo.getTasks());

  if (tasks.status === "loading") return <SkeletonCard lines={6} />;

  if (tasks.status === "error") {
    return isNotImplemented(tasks.error) ? (
      <EmptyState
        icon="sparkle"
        title={t("notConnectedTitle")}
        body={t("notConnectedBody")}
      />
    ) : (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(tasks.error)}
        action={<Button onClick={tasks.reload}>{t("retry")}</Button>}
      />
    );
  }

  return <TasksLoaded tasks={tasks.data} members={members} competitions={competitions} />;
}

/* Getrennt, damit die Reihenfolge/Abhak-States erst mit fertig
   geladenen Aufgaben initialisiert werden (useState-Initializer). */
function TasksLoaded({
  tasks,
  members,
  competitions,
}: {
  tasks: Task[];
  members: Member[];
  competitions: Competition[];
}) {
  const t = useT(dashboardDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const competitionNameById = useMemo(
    () => new Map(competitions.map((c) => [c.id, c.name])),
    [competitions],
  );

  const taskMeta = (task: Task): string => {
    const assignee = task.assigneeId ? memberById(members, task.assigneeId) : undefined;
    return [
      assignee ? fullName(assignee) : undefined,
      task.competitionId ? competitionNameById.get(task.competitionId) : undefined,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  /* Reihenfolge einmal fixieren: offene nach Fälligkeit, erledigte unten. */
  const ordered = useMemo(() => {
    const open = tasks
      .filter((task) => !task.done)
      .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
    return [...open, ...tasks.filter((task) => task.done)];
  }, [tasks]);

  const [doneIds, setDoneIds] = useState<Set<string>>(
    () => new Set(tasks.filter((task) => task.done).map((task) => task.id)),
  );

  const setDone = (id: string, done: boolean) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (done) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  /* Optimistisch: sofort lokal setzen, dann über die Facade persistieren.
     api ohne Task-Endpoint → NotImplemented: lokal lassen + Hinweis-Toast.
     Echter Fehler → zurückrollen + Toast mit „Erneut versuchen“. */
  const applyDone = (task: Task, done: boolean) => {
    setDone(task.id, done);
    void data.setTaskDone(task.id, done).catch((error: unknown) => {
      if (isNotImplemented(error)) {
        showToast(t("taskLocalOnly"), { tone: "info" });
        return;
      }
      setDone(task.id, !done);
      showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => applyDone(task, done),
      });
    });
  };

  const toggle = (task: Task) => {
    const willBeDone = !doneIds.has(task.id);
    applyDone(task, willBeDone);
    if (willBeDone) {
      showToast(t("taskDoneToast"), {
        tone: "success",
        actionLabel: t("undo"),
        onAction: () => applyDone(task, false),
      });
    }
  };

  const openCount = ordered.length - doneIds.size;

  const dueChip = (task: Task): { tone: BadgeTone; text: string } | null => {
    if (!task.dueAt) return null;
    const diff = dayDiff(task.dueAt);
    if (diff < 0) return { tone: "danger", text: t("overdue") };
    const rel = relativeDays(task.dueAt, locale);
    if (diff === 0) return { tone: "brand", text: rel };
    if (diff <= 3) return { tone: "warn", text: rel };
    return { tone: "neutral", text: rel };
  };

  return (
    <Card>
      <CardHeader
        eyebrow={t("tasksEyebrow")}
        title={t("tasksTitle")}
        action={
          <Badge tone="neutral">
            {openCount === 1 ? t("tasksOpenOne") : t("tasksOpenMany", { n: openCount })}
          </Badge>
        }
      />

      <ul>
        {ordered.map((task) => {
          const done = doneIds.has(task.id);
          const chip = done ? null : dueChip(task);
          return (
            <li
              key={task.id}
              className="flex items-start gap-3 border-t border-dashed border-line py-3.5 first:border-t-0 first:pt-0 last:pb-0"
            >
              <button
                type="button"
                onClick={() => toggle(task)}
                aria-pressed={done}
                aria-label={t("taskToggleAria", { title: task.title })}
                className={`relative mt-0.5 grid h-[23px] w-[23px] flex-none place-items-center rounded-sm border-2 transition-colors duration-150 before:absolute before:-inset-2.5 before:content-[''] ${
                  done
                    ? "border-success bg-success text-canvas"
                    : "border-line-strong text-transparent hover:border-success"
                }`}
              >
                <Icon name="check" className="ic h-3.5 w-3.5" />
              </button>
              <span className="grid min-w-0 gap-px">
                <b
                  className={`text-[14px] font-semibold leading-snug ${
                    done ? "text-ink-faint line-through" : "text-ink"
                  }`}
                >
                  {task.title}
                </b>
                {taskMeta(task) && (
                  <small className="text-caption text-ink-faint">{taskMeta(task)}</small>
                )}
              </span>
              {chip && (
                <Badge tone={chip.tone} className="ml-auto mt-0.5 flex-none">
                  {chip.text}
                </Badge>
              )}
            </li>
          );
        })}
      </ul>

      <CardFooter>
        <span>{t("tasksFooter", { done: doneIds.size, total: ordered.length })}</span>
        <Link
          href="/wettkampf"
          className="font-bold text-brand no-underline hover:underline"
        >
          {t("tasksCompetitionLink")}
        </Link>
      </CardFooter>
    </Card>
  );
}
