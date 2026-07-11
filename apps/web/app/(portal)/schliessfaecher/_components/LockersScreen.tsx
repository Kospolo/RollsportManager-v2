"use client";

import { useMemo, useState } from "react";
import type { Locker, LockerStatus, Member, MemberRole } from "@/lib/types";
import { dataSource, errorMessage, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { schliessfaecherDict, STATUS_KEY, STATUS_ORDER } from "../i18n";
import { LockerCard } from "./LockerCard";
import { AssignLockerSheet } from "./AssignLockerSheet";
import { LockerFormDialog, type LockerFormValue } from "./LockerFormDialog";
import { DeleteLockerDialog } from "./DeleteLockerDialog";

/**
 * Schließfächer: Grid aller Fächer mit Status-Badge (frei/belegt/defekt),
 * Standort und — bei Belegung — dem zugeordneten Mitglied. Trainer:innen ordnen
 * zu und geben frei (assign/release), Vereins-Admins pflegen die Stammdaten
 * (anlegen/bearbeiten/löschen) und melden defekt/repariert. Sichtbarkeit ist
 * Komfort — die verbindliche Durchsetzung bleibt serverseitig (RLS/API/Trigger,
 * 403 → Toast + Rollback).
 *
 * RLS-Verschärfung: Fächer LESEN dürfen nur owner/admin/treasurer (+ Plattform-
 * Admin) oder das eigene, zugeordnete Fach eines Mitglieds. Moderator/Coach
 * sehen KEINE Fächer. VERWALTEN/ZUORDNEN ist owner/admin/treasurer vorbehalten.
 * Die Zeilen-Sichtbarkeit erzwingt die RLS serverseitig; hier gaten wir nur die
 * Aktionen und die Ansicht (Verwaltungs- vs. Mitglieds-Sicht).
 *
 * Im mock-Modus gibt es keine echte Session; damit ALLE Schreibpfade erlebbar
 * sind, werden die Verwaltungsrechte dort auf true gehoben. Im api-Modus zählt
 * allein die echte Rolle.
 */

const NO_LOCKERS: Locker[] = [];
const NO_MEMBERS: Member[] = [];

/** Fächer verwalten/zuordnen: owner/admin/treasurer (+ Plattform-Admin). */
const LOCKER_ADMIN_ROLES: readonly MemberRole[] = ["owner", "admin", "treasurer"];

export function LockersScreen() {
  const t = useT(schliessfaecherDict);

  const state = useData((repo) =>
    Promise.all([repo.listLockers(), repo.getMembers(), repo.getCurrentUser()] as const),
  );

  const lockers = state.data?.[0] ?? NO_LOCKERS;
  const members = state.data?.[1] ?? NO_MEMBERS;
  const currentUser = state.data?.[2] ?? null;

  const perms = permissions(currentUser);
  const isMock = dataSource === "mock";
  // Verwalten UND Zuordnen: owner/admin/treasurer (+ Plattform-Admin). Moderator
  // und Coach dürfen weder verwalten noch überhaupt Fächer sehen.
  const canManage =
    (perms.role != null && LOCKER_ADMIN_ROLES.includes(perms.role)) || perms.isPlatformAdmin || isMock;
  const canAssign = canManage;
  /** Mitglieds-/Nicht-Verwalter-Sicht: nur das eigene Fach (oder keins). */
  const memberView = !canManage;

  const [filter, setFilter] = useState<LockerStatus | "all">("all");
  const [form, setForm] = useState<LockerFormValue | null>(null);
  const [toDelete, setToDelete] = useState<Locker | null>(null);
  const [assignTarget, setAssignTarget] = useState<Locker | null>(null);

  const counts = useMemo(() => {
    const base: Record<LockerStatus, number> = { free: 0, assigned: 0, broken: 0 };
    for (const locker of lockers) base[locker.status] += 1;
    return base;
  }, [lockers]);

  const visible = useMemo(
    () => (filter === "all" ? lockers : lockers.filter((l) => l.status === filter)),
    [lockers, filter],
  );

  const filterOptions: FilterChipOption<LockerStatus | "all">[] = [
    { value: "all", label: t("filterAll"), count: lockers.length },
    ...STATUS_ORDER.map((status) => ({
      value: status,
      label: t(STATUS_KEY[status]),
      count: counts[status],
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
              <SkeletonCard lines={2} />
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
  } else if (lockers.length === 0) {
    body = memberView ? (
      <EmptyState icon="lock" title={t("emptyMemberTitle")} body={t("emptyMemberBody")} />
    ) : (
      <EmptyState
        icon="lock"
        title={t("listEmptyTitle")}
        body={t("listEmptyBody")}
        action={
          <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
            {t("listEmptyCta")}
          </Button>
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
            {visible.map((locker) => (
              <LockerCard
                key={locker.id}
                locker={locker}
                members={members}
                canManage={canManage}
                canAssign={canAssign}
                onAssign={() => setAssignTarget(locker)}
                onReassign={() => setAssignTarget(locker)}
                onEdit={() => setForm({ mode: "edit", locker })}
                onDelete={() => setToDelete(locker)}
                onChanged={state.reload}
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
        title={memberView ? t("pageTitleMember") : t("pageTitle")}
        sub={memberView ? t("pageSubMember") : t("pageSub")}
        action={
          canManage && state.status === "ready" && lockers.length > 0 ? (
            <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
              {t("newLocker")}
            </Button>
          ) : undefined
        }
      />

      {body}

      {assignTarget && (
        <AssignLockerSheet
          key={assignTarget.id}
          locker={assignTarget}
          members={members}
          onClose={() => setAssignTarget(null)}
          onAssigned={state.reload}
        />
      )}

      {form && (
        <LockerFormDialog
          key={form.mode === "edit" ? `edit-${form.locker.id}` : "create"}
          value={form}
          onClose={() => setForm(null)}
          onSaved={state.reload}
        />
      )}

      <DeleteLockerDialog
        locker={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={state.reload}
      />
    </div>
  );
}
