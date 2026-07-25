"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { errorMessage, isNotImplemented, memberById, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import type { Achievement, Medal, Member } from "@/lib/types";
import { medaillenDict, type MedalFilter } from "../i18n";
import { AchievementCard } from "./AchievementCard";
import { AchievementFormSheet } from "./AchievementFormSheet";
import { DeleteAchievementDialog } from "./DeleteAchievementDialog";
import { MineSummary } from "./MineSummary";

/** Stabiler Leer-Fallback, solange die Facade noch lädt (kein useMemo-Flackern). */
const NO_ACHIEVEMENTS: Achievement[] = [];
const NO_MEMBERS: Member[] = [];

/**
 * Medaillen-Screen („Meine Erfolge“): liest Erfolge, Mitglieder und den
 * aktuellen Nutzer über die Facade. Oben prominent „Meine Medaillen“ (Erfolge
 * des eingeloggten Mitglieds) mit Gold-/Silber-/Bronze-Zähler, darunter „Alle
 * Erfolge im Verein“ mit Medaillen-Filter. Trainer+ (is_club_trainer) sehen
 * „Erfolg vergeben“ sowie Bearbeiten/Löschen — die Sichtbarkeit ist kosmetisch,
 * die Durchsetzung bleibt serverseitig (RLS); ein 403 wird als Toast behandelt.
 */
export function MedaillenScreen() {
  const t = useT(medaillenDict);

  const core = useData(async (repo) => {
    const [achievements, members, currentUser] = await Promise.all([
      repo.listAchievements(),
      repo.getMembers(),
      repo.getCurrentUser(),
    ]);
    return { achievements, members, currentUser };
  });

  const [filter, setFilter] = useState<MedalFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Achievement | null>(null);

  const achievements = core.status === "ready" ? core.data.achievements : NO_ACHIEVEMENTS;
  const members = core.status === "ready" ? core.data.members : NO_MEMBERS;
  const currentUser = core.status === "ready" ? core.data.currentUser : null;
  const canManage = permissions(currentUser).isTrainer;

  const mine = useMemo(
    () => (currentUser ? achievements.filter((a) => a.memberId === currentUser.id) : []),
    [achievements, currentUser],
  );

  const visible = useMemo(
    () => achievements.filter((a) => matchesFilter(a, filter)),
    [achievements, filter],
  );

  const filterOptions: FilterChipOption<MedalFilter>[] = [
    { value: "all", label: t("filterAll"), count: achievements.length },
    { value: "gold", label: t("filterGold"), count: countMedal(achievements, "gold") },
    { value: "silver", label: t("filterSilver"), count: countMedal(achievements, "silver") },
    { value: "bronze", label: t("filterBronze"), count: countMedal(achievements, "bronze") },
    { value: "none", label: t("filterNone"), count: countMedal(achievements, undefined) },
  ];

  function award() {
    setEditing(null);
    setFormOpen(true);
  }
  function startEdit(item: Achievement) {
    setEditing(item);
    setFormOpen(true);
  }

  const memberOf = (item: Achievement) => memberById(members, item.memberId);

  const header = (
    <SectionHeader
      level={1}
      eyebrow={t("pageEyebrow")}
      title={t("pageTitle")}
      sub={t("pageSub")}
      action={
        canManage ? (
          <Button icon="plus" disabled={core.status !== "ready"} onClick={award}>
            {t("award")}
          </Button>
        ) : undefined
      }
    />
  );

  if (core.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
        {header}
        {isNotImplemented(core.error) ? (
          <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
        ) : (
          <EmptyState
            icon="zap"
            title={t("loadErrorTitle")}
            body={errorMessage(core.error)}
            action={
              <Button variant="secondary" onClick={core.reload}>
                {t("retry")}
              </Button>
            }
          />
        )}
      </div>
    );
  }

  if (core.status === "loading") {
    return (
      <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
        {header}
        <Skeleton className="h-24 w-full max-w-md rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl content-start gap-8">
      {header}

      {achievements.length === 0 ? (
        <EmptyState
          icon="sparkle"
          title={t("emptyTitle")}
          body={canManage ? t("emptyBodyTrainer") : t("emptyBodyMember")}
          action={
            canManage ? (
              <Button icon="plus" onClick={award}>
                {t("emptyCta")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <section className="grid gap-4">
            <SectionHeader level={2} title={t("mineTitle")} sub={t("mineSub")} />
            {mine.length === 0 ? (
              <EmptyState icon="sparkle" title={t("mineEmptyTitle")} body={t("mineEmptyBody")} />
            ) : (
              <div className="grid gap-4">
                <MineSummary achievements={mine} />
                <div className="grid gap-3 sm:grid-cols-2">
                  {mine.map((item) => (
                    <AchievementCard
                      key={item.id}
                      achievement={item}
                      member={memberOf(item)}
                      canWrite={canManage}
                      showMember={false}
                      onEdit={() => startEdit(item)}
                      onDelete={() => setDeleteTarget(item)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="grid gap-4">
            <SectionHeader level={2} title={t("clubTitle")} sub={t("clubSub")} />
            <FilterChips
              options={filterOptions}
              value={filter}
              onChange={setFilter}
              label={t("filterLabel")}
            />
            {visible.length === 0 ? (
              <EmptyState
                icon="search"
                title={t("filterEmptyTitle")}
                body={t("filterEmptyBody")}
                action={
                  <Button variant="secondary" onClick={() => setFilter("all")}>
                    {t("filterEmptyCta")}
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {visible.map((item) => (
                  <AchievementCard
                    key={item.id}
                    achievement={item}
                    member={memberOf(item)}
                    canWrite={canManage}
                    showMember
                    onEdit={() => startEdit(item)}
                    onDelete={() => setDeleteTarget(item)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <AchievementFormSheet
        open={formOpen}
        editing={editing}
        members={members}
        onClose={() => setFormOpen(false)}
        onSaved={core.reload}
      />

      <DeleteAchievementDialog
        achievement={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={core.reload}
      />
    </div>
  );
}

/** Zählt Erfolge einer Medaille; `undefined` = Teilnahme ohne Medaille. */
function countMedal(list: Achievement[], medal: Medal | undefined): number {
  return list.filter((a) => (a.medal ?? undefined) === medal).length;
}

/** Filter-Prädikat für die Vereins-Vitrine. */
function matchesFilter(a: Achievement, filter: MedalFilter): boolean {
  if (filter === "all") return true;
  if (filter === "none") return a.medal == null;
  return a.medal === filter;
}
