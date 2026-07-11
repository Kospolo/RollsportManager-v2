"use client";

import { useMemo, useState } from "react";
import type { Department, Member } from "@/lib/types";
import { dataSource, errorMessage, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { abteilungenDict } from "../i18n";
import { DepartmentCard } from "./DepartmentCard";
import { DepartmentFormDialog, type DepartmentFormValue } from "./DepartmentFormDialog";
import { DeleteDepartmentDialog } from "./DeleteDepartmentDialog";
import { DepartmentMembersSheet } from "./DepartmentMembersSheet";

/**
 * Abteilungen: Karten-Grid mit Leitung und Mitgliederzahl; Klick auf eine Karte
 * öffnet die Mitglieder-Sicht. Vereins-Admins legen Abteilungen an, bearbeiten
 * und löschen sie; Trainer:innen/Admins pflegen zusätzlich die Mitglieder-
 * Zuordnung. Lesen ist für jedes Mitglied. Sichtbarkeit ist Komfort — die
 * verbindliche Durchsetzung bleibt serverseitig (RLS/API, 403 → Toast + Rollback).
 *
 * Im mock-Modus werden die Schreibpfade freigeschaltet, damit die Demo alle
 * Interaktionen zeigt; im api-Modus zählt allein die echte Rolle.
 */

const NO_DEPARTMENTS: Department[] = [];
const NO_MEMBERS: Member[] = [];

export function DepartmentsScreen() {
  const t = useT(abteilungenDict);

  const state = useData((repo) =>
    Promise.all([repo.listDepartments(), repo.getMembers(), repo.getCurrentUser()] as const),
  );

  const departments = state.data?.[0] ?? NO_DEPARTMENTS;
  const members = state.data?.[1] ?? NO_MEMBERS;
  const currentUser = state.data?.[2] ?? null;

  const perms = currentUser ? permissions(currentUser) : null;
  const canManage = (perms?.isClubAdmin ?? false) || dataSource === "mock";
  const canAssign = (perms?.isTrainer ?? false) || dataSource === "mock";

  const [form, setForm] = useState<DepartmentFormValue | null>(null);
  const [toDelete, setToDelete] = useState<Department | null>(null);
  const [membersOf, setMembersOf] = useState<Department | null>(null);

  const membersById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const member of members) map.set(member.id, member);
    return map;
  }, [members]);

  const rosterOf = (department: Department) =>
    department.memberIds
      .map((id) => membersById.get(id))
      .filter((m): m is Member => m !== undefined)
      .map((m) => ({ personId: m.id, firstName: m.firstName, lastName: m.lastName }));

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <ul className="grid list-none gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <SkeletonCard lines={3} />
          </li>
        ))}
      </ul>
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
  } else if (departments.length === 0) {
    body = (
      <EmptyState
        icon="teams"
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
      <ul className="grid list-none gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {departments.map((department) => (
          <DepartmentCard
            key={department.id}
            department={department}
            lead={department.leadMemberId ? membersById.get(department.leadMemberId) : undefined}
            roster={rosterOf(department)}
            canManage={canManage}
            onOpenMembers={() => setMembersOf(department)}
            onEdit={() => setForm({ mode: "edit", department })}
            onDelete={() => setToDelete(department)}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8">
      <SectionHeader
        level={1}
        title={t("pageTitle")}
        sub={t("pageSub")}
        action={
          canManage && state.status === "ready" && departments.length > 0 ? (
            <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
              {t("newDepartment")}
            </Button>
          ) : undefined
        }
      />

      {body}

      {form && (
        <DepartmentFormDialog
          key={form.mode === "edit" ? `edit-${form.department.id}` : "create"}
          value={form}
          members={members}
          onClose={() => setForm(null)}
          onSaved={state.reload}
        />
      )}

      <DeleteDepartmentDialog
        department={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={state.reload}
      />

      {membersOf && (
        <DepartmentMembersSheet
          key={membersOf.id}
          department={membersOf}
          members={members}
          canAssign={canAssign}
          onClose={() => setMembersOf(null)}
          onSaved={state.reload}
        />
      )}
    </div>
  );
}
