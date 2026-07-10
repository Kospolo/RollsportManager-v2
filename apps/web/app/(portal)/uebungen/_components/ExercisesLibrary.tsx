"use client";

import { useMemo, useState } from "react";
import type { Exercise, ExerciseCategory, Member } from "@/lib/types";
import { dataSource, errorMessage, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { CATEGORY_KEY, CATEGORY_ORDER, uebungenDict } from "../i18n";
import { ExerciseCard } from "./ExerciseCard";
import { ExerciseDetailDialog } from "./ExerciseDetailDialog";
import { ExerciseFormDialog, type ExerciseFormValue } from "./ExerciseFormDialog";
import { DeleteExerciseDialog } from "./DeleteExerciseDialog";

/**
 * Übungsbibliothek: Karten-Grid des Trainingskatalogs mit Kategorie-Filter,
 * Schwierigkeit, Video-Marker und Detailansicht. Anlegen/Bearbeiten/Löschen
 * nur für Trainer:innen (is_club_trainer) — Sichtbarkeit ist Komfort, die
 * verbindliche Durchsetzung bleibt serverseitig (RLS/API, 403 → Toast).
 *
 * Der mock-Modus hat keine echte Session; die eingeloggte Demo-Persona ist
 * eine Trainerin, damit die Schreibpfade dort erlebbar sind. Im api-Modus
 * zählt allein die echte Rolle.
 */

type CategoryFilter = "all" | ExerciseCategory;

const NO_EXERCISES: Exercise[] = [];
const NO_MEMBERS: Member[] = [];

export function ExercisesLibrary() {
  const t = useT(uebungenDict);

  const state = useData((repo) =>
    Promise.all([repo.listExercises(), repo.getMembers(), repo.getCurrentUser()] as const),
  );

  const exercises = state.data?.[0] ?? NO_EXERCISES;
  const members = state.data?.[1] ?? NO_MEMBERS;
  const currentUser = state.data?.[2] ?? null;

  const canManage = permissions(currentUser).isTrainer || dataSource === "mock";

  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [form, setForm] = useState<ExerciseFormValue | null>(null);
  const [toDelete, setToDelete] = useState<Exercise | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? exercises : exercises.filter((e) => e.category === filter)),
    [exercises, filter],
  );

  const filterOptions: FilterChipOption<CategoryFilter>[] = [
    { value: "all", label: t("filterAll"), count: exercises.length },
    ...CATEGORY_ORDER.map((cat) => ({
      value: cat,
      label: t(CATEGORY_KEY[cat]),
      count: exercises.filter((e) => e.category === cat).length,
    })),
  ];

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-5" aria-hidden="true">
        <Skeleton className="h-9 w-full max-w-2xl rounded-full" />
        <ul className="grid list-none gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <SkeletonCard lines={3} />
            </li>
          ))}
        </ul>
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
  } else if (exercises.length === 0) {
    body = (
      <EmptyState
        icon="sparkle"
        title={t("listEmptyTitle")}
        body={t("listEmptyBody")}
        action={
          canManage ? (
            <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
              {t("listEmptyCta")}
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    body = (
      <div className="grid gap-5">
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
          <ul className="grid list-none gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                members={members}
                onOpen={() => setDetail(exercise)}
              />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <SectionHeader
        level={1}
        title={t("pageTitle")}
        sub={t("pageSub")}
        action={
          canManage && state.status === "ready" && exercises.length > 0 ? (
            <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
              {t("newExercise")}
            </Button>
          ) : undefined
        }
      />

      {body}

      {detail && (
        <ExerciseDetailDialog
          key={detail.id}
          exercise={detail}
          members={members}
          canManage={canManage}
          onEdit={() => {
            const target = detail;
            setDetail(null);
            setForm({ mode: "edit", exercise: target });
          }}
          onDelete={() => {
            const target = detail;
            setDetail(null);
            setToDelete(target);
          }}
          onClose={() => setDetail(null)}
        />
      )}

      {form && (
        <ExerciseFormDialog
          key={form.mode === "edit" ? `edit-${form.exercise.id}` : "create"}
          value={form}
          onClose={() => setForm(null)}
          onSaved={state.reload}
        />
      )}

      <DeleteExerciseDialog
        exercise={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={state.reload}
      />
    </div>
  );
}
