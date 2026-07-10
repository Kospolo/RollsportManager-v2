"use client";

import { useMemo, useState } from "react";
import type { DutyEntry, DutyRequirement, Id, Member, Team } from "@/lib/types";
import { dataSource, errorMessage, fullName, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { pflichtstundenDict } from "../i18n";
import { computeProgress } from "../logic";
import { MyHoursCard } from "./MyHoursCard";
import { MyEntryList } from "./MyEntryList";
import { LogHoursSheet, type LogHoursValue } from "./LogHoursSheet";
import { DeleteEntryDialog } from "./DeleteEntryDialog";
import { PendingApprovals } from "./PendingApprovals";
import { ClubOverview } from "./ClubOverview";

/**
 * Pflichtstunden (Meine Stunden): oben Soll/Ist der angemeldeten Person plus
 * die eigenen Einträge und das „Stunden erfassen"-Sheet (Selbst-Service für
 * jedes Mitglied). Trainer:innen sehen zusätzlich offene Genehmigungen und die
 * Vereins-Übersicht. Sichtbarkeit ist Komfort — die verbindliche Durchsetzung
 * bleibt serverseitig (RLS/API/DB-Trigger, 403 → Toast + Rollback).
 *
 * Im mock-Modus ist die Demo-Persona eine Trainerin, damit alle Schreib- und
 * Genehmigungspfade erlebbar sind; im api-Modus zählt allein die echte Rolle.
 */

const NO_REQUIREMENTS: DutyRequirement[] = [];
const NO_ENTRIES: DutyEntry[] = [];
const NO_MEMBERS: Member[] = [];
const NO_TEAMS: Team[] = [];

export function PflichtstundenScreen() {
  const t = useT(pflichtstundenDict);

  const state = useData((repo) =>
    Promise.all([
      repo.listDutyRequirements(),
      repo.listDutyEntries(),
      repo.getMembers(),
      repo.getTeams(),
      repo.getCurrentUser(),
    ] as const),
  );

  const requirements = state.data?.[0] ?? NO_REQUIREMENTS;
  const entries = state.data?.[1] ?? NO_ENTRIES;
  const members = state.data?.[2] ?? NO_MEMBERS;
  const teams = state.data?.[3] ?? NO_TEAMS;
  const currentUser = state.data?.[4] ?? null;

  const canApprove =
    (currentUser != null && permissions(currentUser).isTrainer) || dataSource === "mock";

  const [sheet, setSheet] = useState<LogHoursValue | null>(null);
  const [toDelete, setToDelete] = useState<DutyEntry | null>(null);

  const myEntries = useMemo(
    () => (currentUser ? entries.filter((e) => e.memberId === currentUser.id) : NO_ENTRIES),
    [entries, currentUser],
  );

  const progress = useMemo(
    () => (currentUser ? computeProgress(currentUser, requirements, myEntries) : null),
    [currentUser, requirements, myEntries],
  );

  const pendingEntries = useMemo(() => entries.filter((e) => !e.approved), [entries]);

  const memberName = useMemo(() => {
    const map = new Map<Id, Member>(members.map((m) => [m.id, m]));
    return (memberId: Id): string => {
      const member = map.get(memberId);
      return member ? fullName(member) : t("unknownMember");
    };
  }, [members, t]);

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-6" aria-hidden="true">
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    );
  } else if (state.status === "error") {
    body = isNotImplemented(state.error) ? (
      <EmptyState icon="sparkle" title={t("notConnectedTitle")} body={t("notConnectedBody")} />
    ) : (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error) || t("loadErrorBody")}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else if (currentUser && progress) {
    body = (
      <div className="grid gap-8">
        <MyHoursCard progress={progress} />
        <MyEntryList
          entries={myEntries}
          onEdit={(entry) => setSheet({ mode: "edit", entry })}
          onDelete={setToDelete}
        />
        {canApprove && (
          <>
            <PendingApprovals
              entries={pendingEntries}
              memberName={memberName}
              onChanged={state.reload}
            />
            <ClubOverview
              members={members}
              requirements={requirements}
              entries={entries}
              teams={teams}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8">
      <SectionHeader
        level={1}
        title={t("pageTitle")}
        sub={t("pageSub")}
        action={
          state.status === "ready" && currentUser ? (
            <Button icon="plus" onClick={() => setSheet({ mode: "create" })}>
              {t("logCta")}
            </Button>
          ) : undefined
        }
      />

      {body}

      {sheet && currentUser && (
        <LogHoursSheet
          key={sheet.mode === "edit" ? `edit-${sheet.entry.id}` : "create"}
          value={sheet}
          memberId={currentUser.id}
          onClose={() => setSheet(null)}
          onSaved={state.reload}
        />
      )}

      <DeleteEntryDialog
        entry={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={state.reload}
      />
    </div>
  );
}
