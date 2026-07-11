"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiTile } from "@/components/ui/KpiTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { Tabs, TabPanel, type TabItem } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useLocale, useT } from "@/lib/i18n";
import { dayDiff, formatDateShort, relativeDays } from "@/lib/format";
import { data, errorMessage, isForbidden, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import {
  competitionTasks,
  entryStats,
  liveStartOrder,
  loadWettkampfData,
  nextCompetition,
  pastCompetitions,
  starterEntries,
  type WettkampfData,
} from "./derive";
import { wettkampfDict } from "./i18n";
import { OverviewTab } from "./_components/OverviewTab";
import { EntriesTab } from "./_components/EntriesTab";
import { LiveTab } from "./_components/LiveTab";
import { ExportTab } from "./_components/ExportTab";

export type WettkampfTab = "overview" | "entries" | "live" | "export";

/**
 * Wettkampf-Modul: Übersicht (Karten + Aufgaben), Meldungen (Tabelle),
 * Live-Modus-Vorschau (Startliste, RollArt-Schnelleingabe, Zwischenstand)
 * und Druck-&-Export-Platzhalter. Daten kommen aus der Facade (lib/data);
 * der Live-Scoring-Zustand bleibt bewusst lokal auf diesem Gerät.
 */
export function WettkampfClient() {
  const t = useT(wettkampfDict);
  const loaded = useData(loadWettkampfData);

  if (loaded.status === "loading") {
    return (
      <PageFrame title={t("pageTitle")} sub={t("pageSub")}>
        <WettkampfSkeleton />
      </PageFrame>
    );
  }

  if (loaded.status === "error") {
    return (
      <PageFrame title={t("pageTitle")} sub={t("pageSub")}>
        {isNotImplemented(loaded.error) ? (
          <EmptyState
            icon="sparkle"
            title={t("notConnectedTitle")}
            body={t("notConnectedBody")}
          />
        ) : (
          <EmptyState
            icon="zap"
            title={t("loadErrorTitle")}
            body={errorMessage(loaded.error)}
            action={<Button onClick={loaded.reload}>{t("retry")}</Button>}
          />
        )}
      </PageFrame>
    );
  }

  return <WettkampfReady wettkampf={loaded.data} />;
}

/* ---------- Rahmen: Kopf + Inhalt (identisch in allen drei Zuständen) ---------- */

function PageFrame({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow?: string;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <SectionHeader level={1} eyebrow={eyebrow} title={title} sub={sub} />
      {children}
    </div>
  );
}

/** Lade-Platzhalter in Seiten-Optik: KPI-Reihe, Tab-Leiste, zwei Karten. */
function WettkampfSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="rounded-lg border border-line bg-surface px-5 py-[18px] shadow-card"
          >
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="mt-3 h-7 w-2/5" />
            <Skeleton className="mt-2.5 h-3 w-4/5" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-sm rounded-full" />
      <div className="grid items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    </div>
  );
}

/* ---------- Geladener Zustand: sämtliche Interaktivität ---------- */

function WettkampfReady({ wettkampf }: { wettkampf: WettkampfData }) {
  const t = useT(wettkampfDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [tab, setTab] = useState<WettkampfTab>("overview");

  const competition = useMemo(
    () => nextCompetition(wettkampf.competitions),
    [wettkampf],
  );
  const past = useMemo(() => pastCompetitions(wettkampf.competitions), [wettkampf]);
  const entries = useMemo(
    () => (competition ? starterEntries(competition, wettkampf) : []),
    [competition, wettkampf],
  );
  const stats = useMemo(() => entryStats(entries), [entries]);
  const order = useMemo(
    () =>
      competition ? liveStartOrder(competition, wettkampf.routines, wettkampf.members) : [],
    [competition, wettkampf],
  );
  /* Live-Wertung schreibt nur der Trainerstab (is_club_trainer+); Mitglieder
     sehen die Rangliste lesend. Serverseitig verbindlich (RLS/403). */
  const canScore = useMemo(
    () => permissions(wettkampf.currentUser).isTrainer,
    [wettkampf.currentUser],
  );
  const tasks = useMemo(
    () => (competition ? competitionTasks(competition, wettkampf.tasks) : []),
    [competition, wettkampf],
  );

  /* Aufgaben: optimistischer lokaler Zustand über den geladenen Startwerten;
     Persistenz über die Facade (mock: No-op — api: Fehler → Rollback + Toast). */
  const [taskDone, setTaskDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tasks.map((task) => [task.id, task.done])),
  );
  const openTaskCount = tasks.filter((task) => !taskDone[task.id]).length;

  function setTaskState(taskId: string, done: boolean) {
    setTaskDone((prev) => ({ ...prev, [taskId]: done }));
    void data.setTaskDone(taskId, done).catch((error: unknown) => {
      setTaskDone((prev) => ({ ...prev, [taskId]: !done }));
      showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => setTaskState(taskId, done),
      });
    });
  }

  /* Meldeliste senden erledigt zugleich die passende Vorbereitungs-Aufgabe. */
  const [listSent, setListSent] = useState(false);
  function handleListSent() {
    setListSent(true);
    const sendTask = tasks.find((task) => task.title.toLowerCase().includes("meldeliste"));
    if (sendTask) setTaskState(sendTask.id, true);
  }

  /* Live-Modus- und Export-Zustand leben hier, damit Tab-Wechsel nichts verwerfen
     (TabPanel unmountet inaktive Panels). `liveScored` hält die Reihenfolge der
     in dieser Session gewerteten Küren (der „Jetzt läuft"-Zeiger). */
  const [liveScored, setLiveScored] = useState<string[]>([]);
  const [notified, setNotified] = useState<Record<string, boolean>>({});

  const tabs: TabItem<WettkampfTab>[] = [
    { value: "overview", label: t("tabOverview") },
    { value: "entries", label: t("tabEntries"), count: stats.starters },
    { value: "live", label: t("tabLive") },
    { value: "export", label: t("tabExport") },
  ];

  const deadline = competition?.registrationDeadline;
  const deadlineDiff = deadline ? dayDiff(deadline) : undefined;

  return (
    <PageFrame eyebrow={wettkampf.club.name} title={t("pageTitle")} sub={t("pageSub")}>
      {competition && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label={t("kpiNext")}
            value={relativeDays(competition.startsAt, locale)}
            sub={competition.name}
            tone="brand"
          />
          {deadline && (
            <KpiTile
              label={t("kpiDeadline")}
              value={relativeDays(deadline, locale)}
              sub={formatDateShort(deadline, locale)}
              tone={deadlineDiff !== undefined && deadlineDiff <= 3 ? "warn" : "neutral"}
            />
          )}
          <KpiTile
            label={t("kpiStarters")}
            value={String(stats.starters)}
            sub={
              stats.missing > 0
                ? t("kpiStartersSub", { ready: stats.ready, missing: stats.missing })
                : t("kpiAllReady")
            }
            tone={stats.missing > 0 ? "info" : "success"}
          />
          <KpiTile
            label={t("kpiTasks")}
            value={String(openTaskCount)}
            sub={t("kpiTasksSub")}
            tone={openTaskCount > 0 ? "info" : "success"}
          />
        </div>
      )}

      <Tabs
        tabs={tabs}
        value={tab}
        onChange={setTab}
        label={t("tabsLabel")}
        idBase="wettkampf"
        className="self-start"
      />

      <TabPanel value="overview" active={tab} idBase="wettkampf">
        <OverviewTab
          competition={competition}
          pastCompetitions={past}
          stats={stats}
          entries={entries}
          tasks={tasks}
          taskDone={taskDone}
          members={wettkampf.members}
          routines={wettkampf.routines}
          onTaskState={setTaskState}
          onSwitchTab={setTab}
        />
      </TabPanel>

      <TabPanel value="entries" active={tab} idBase="wettkampf">
        <EntriesTab
          competition={competition}
          entries={entries}
          stats={stats}
          listSent={listSent}
          onListSent={handleListSent}
        />
      </TabPanel>

      <TabPanel value="live" active={tab} idBase="wettkampf">
        <LiveTab
          competition={competition}
          order={order}
          canScore={canScore}
          scored={liveScored}
          onScored={(routineId) => setLiveScored((prev) => [...prev, routineId])}
          onReset={() => setLiveScored([])}
        />
      </TabPanel>

      <TabPanel value="export" active={tab} idBase="wettkampf">
        <ExportTab
          competition={competition}
          entries={entries}
          notified={notified}
          onNotified={setNotified}
        />
      </TabPanel>
    </PageFrame>
  );
}
