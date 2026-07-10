"use client";

import { useMemo, useState } from "react";
import { KpiTile } from "@/components/ui/KpiTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Tabs, TabPanel, type TabItem } from "@/components/ui/Tabs";
import { useLocale, useT } from "@/lib/i18n";
import { dayDiff, formatDateShort, relativeDays } from "@/lib/format";
import { club } from "@/lib/mock";
import {
  competitionTasks,
  entryStats,
  nextCompetition,
  pastCompetitions,
  starterEntries,
  startOrder,
  type EnteredScore,
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
 * und Druck-&-Export-Platzhalter. Alles lokal auf Mock-Daten.
 */
export function WettkampfClient() {
  const t = useT(wettkampfDict);
  const { locale } = useLocale();
  const [tab, setTab] = useState<WettkampfTab>("overview");

  const competition = nextCompetition;
  const entries = useMemo(
    () => (competition ? starterEntries(competition) : []),
    [competition],
  );
  const stats = useMemo(() => entryStats(entries), [entries]);
  const order = useMemo(
    () => (competition ? startOrder(competition) : []),
    [competition],
  );
  const tasks = useMemo(
    () => (competition ? competitionTasks(competition) : []),
    [competition],
  );

  /* Aufgaben: optimistischer lokaler Zustand über den Mock-Startwerten. */
  const [taskDone, setTaskDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(tasks.map((task) => [task.id, task.done])),
  );
  const openTaskCount = tasks.filter((task) => !taskDone[task.id]).length;

  function setTaskState(taskId: string, done: boolean) {
    setTaskDone((prev) => ({ ...prev, [taskId]: done }));
  }

  /* Meldeliste senden erledigt zugleich die passende Vorbereitungs-Aufgabe. */
  const [listSent, setListSent] = useState(false);
  function handleListSent() {
    setListSent(true);
    const sendTask = tasks.find((task) => task.title.toLowerCase().includes("meldeliste"));
    if (sendTask) setTaskState(sendTask.id, true);
  }

  /* Live-Modus- und Export-Zustand leben hier, damit Tab-Wechsel nichts verwerfen
     (TabPanel unmountet inaktive Panels). */
  const [entered, setEntered] = useState<EnteredScore[]>([]);
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
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <SectionHeader
        level={1}
        eyebrow={club.name}
        title={t("pageTitle")}
        sub={t("pageSub")}
      />

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
          pastCompetitions={pastCompetitions}
          stats={stats}
          entries={entries}
          tasks={tasks}
          taskDone={taskDone}
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
        <LiveTab order={order} entered={entered} onEnteredChange={setEntered} />
      </TabPanel>

      <TabPanel value="export" active={tab} idBase="wettkampf">
        <ExportTab notified={notified} onNotified={setNotified} />
      </TabPanel>
    </div>
  );
}
