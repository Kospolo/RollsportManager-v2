"use client";

import { useMemo, useState } from "react";
import type { Equipment, EquipmentReservation, Member } from "@/lib/types";
import { errorMessage, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { ausruestungDict } from "../i18n";
import { EquipmentCard } from "./EquipmentCard";
import { ReserveSheet } from "./ReserveSheet";
import { EquipmentFormDialog, type EquipmentFormValue } from "./EquipmentFormDialog";
import { DeleteEquipmentDialog } from "./DeleteEquipmentDialog";
import { MyReservations } from "./MyReservations";

/**
 * Ausrüstung (Geräte & Material): Inventar-Grid mit Zustand-Badge und
 * Verfügbarkeit, „Reservieren"-Sheet (Selbst-Service für jedes Mitglied) und
 * dem Abschnitt „Meine Reservierungen". Trainer:innen pflegen zusätzlich den
 * Bestand (anlegen/bearbeiten/löschen). Sichtbarkeit ist Komfort — die
 * verbindliche Durchsetzung bleibt serverseitig (RLS/API, 403 → Toast + Rollback).
 *
 * Im mock-Modus ist die Demo-Persona eine Trainerin, damit alle Schreibpfade
 * erlebbar sind; im api-Modus zählt allein die echte Rolle.
 */

const UNCATEGORIZED = "__uncat__";

const NO_EQUIPMENT: Equipment[] = [];
const NO_RESERVATIONS: EquipmentReservation[] = [];
const NO_MEMBERS: Member[] = [];

export function EquipmentScreen() {
  const t = useT(ausruestungDict);

  const state = useData((repo) =>
    Promise.all([
      repo.listEquipment(),
      repo.listReservations(),
      repo.getMembers(),
      repo.getCurrentUser(),
    ] as const),
  );

  const equipment = state.data?.[0] ?? NO_EQUIPMENT;
  const reservations = state.data?.[1] ?? NO_RESERVATIONS;
  const members = state.data?.[2] ?? NO_MEMBERS;
  const currentUser = state.data?.[3] ?? null;

  const canManage = currentUser != null && permissions(currentUser).isTrainer;

  const [filter, setFilter] = useState<string>("all");
  const [reserveTarget, setReserveTarget] = useState<Equipment | null>(null);
  const [form, setForm] = useState<EquipmentFormValue | null>(null);
  const [toDelete, setToDelete] = useState<Equipment | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of equipment) if (item.category) set.add(item.category);
    return [...set].sort((a, b) => a.localeCompare(b, "de"));
  }, [equipment]);
  const hasUncategorized = useMemo(() => equipment.some((e) => !e.category), [equipment]);
  const showFilter = categories.length + (hasUncategorized ? 1 : 0) >= 2;

  const visible = useMemo(() => {
    if (!showFilter || filter === "all") return equipment;
    if (filter === UNCATEGORIZED) return equipment.filter((e) => !e.category);
    return equipment.filter((e) => e.category === filter);
  }, [equipment, filter, showFilter]);

  const filterOptions: FilterChipOption<string>[] = [
    { value: "all", label: t("filterAll"), count: equipment.length },
    ...categories.map((category) => ({
      value: category,
      label: category,
      count: equipment.filter((e) => e.category === category).length,
    })),
    ...(hasUncategorized
      ? [
          {
            value: UNCATEGORIZED,
            label: t("filterUncategorized"),
            count: equipment.filter((e) => !e.category).length,
          },
        ]
      : []),
  ];

  const myReservations = useMemo(
    () =>
      currentUser ? reservations.filter((r) => r.reservedByMemberId === currentUser.id) : [],
    [reservations, currentUser],
  );

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
  } else if (equipment.length === 0) {
    body = (
      <EmptyState
        icon="sparkle"
        title={t("listEmptyTitle")}
        body={canManage ? t("listEmptyBody") : t("listEmptyMember")}
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
        {showFilter && (
          <FilterChips
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            label={t("filterLabel")}
          />
        )}
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
            {visible.map((item) => (
              <EquipmentCard
                key={item.id}
                equipment={item}
                canManage={canManage}
                onReserve={() => setReserveTarget(item)}
                onEdit={() => setForm({ mode: "edit", equipment: item })}
                onDelete={() => setToDelete(item)}
              />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8">
      <SectionHeader
        level={1}
        title={t("pageTitle")}
        sub={t("pageSub")}
        action={
          canManage && state.status === "ready" && equipment.length > 0 ? (
            <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
              {t("newEquipment")}
            </Button>
          ) : undefined
        }
      />

      {body}

      {state.status === "ready" && equipment.length > 0 && (
        <MyReservations
          reservations={myReservations}
          equipment={equipment}
          onChanged={state.reload}
        />
      )}

      {reserveTarget && currentUser && (
        <ReserveSheet
          key={reserveTarget.id}
          equipment={reserveTarget}
          members={members}
          currentUser={currentUser}
          canSelectMember={canManage}
          onClose={() => setReserveTarget(null)}
          onReserved={state.reload}
        />
      )}

      {form && (
        <EquipmentFormDialog
          key={form.mode === "edit" ? `edit-${form.equipment.id}` : "create"}
          value={form}
          onClose={() => setForm(null)}
          onSaved={state.reload}
        />
      )}

      <DeleteEquipmentDialog
        equipment={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={state.reload}
      />
    </div>
  );
}
