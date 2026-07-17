"use client";

import { useMemo, useState } from "react";
import type { Sparte, Team } from "@/lib/types";
import {
  data,
  dataSource,
  errorMessage,
  isForbidden,
  isNotImplemented,
  permissions,
  type ClubModuleState,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { spartenDict } from "../i18n";
import { SparteCard } from "./SparteCard";
import { SparteFormSheet, type SparteFormValue } from "./SparteFormSheet";
import { DeleteSparteDialog } from "./DeleteSparteDialog";

/**
 * Sparten: Karten-Grid der fachlichen Großbereiche des Vereins. Lesen ist für
 * jedes Mitglied; Anlegen/Bearbeiten/(De-)Aktivieren/Löschen nur für Berechtigte
 * (can_manage_sparten = owner/admin/treasurer + Plattform-Admin — NICHT
 * moderator/coach/member). Sichtbarkeit ist Komfort — die verbindliche
 * Durchsetzung bleibt serverseitig (RLS/API, 403 → Toast + Rollback).
 *
 * Im mock-Modus werden die Schreibpfade freigeschaltet, damit die Demo alle
 * Interaktionen zeigt; im api-Modus zählt allein die echte Rolle.
 */

const NO_SPARTEN: Sparte[] = [];
const NO_TEAMS: Team[] = [];
const NO_MODULES: ClubModuleState[] = [];

export function SpartenScreen() {
  const t = useT(spartenDict);
  const { showToast } = useToast();

  const state = useData((repo) =>
    Promise.all([
      repo.getSparten(),
      repo.getTeams(),
      repo.getCurrentUser(),
      repo.listClubModules(),
    ] as const),
  );

  const sparten = state.data?.[0] ?? NO_SPARTEN;
  const teams = state.data?.[1] ?? NO_TEAMS;
  const currentUser = state.data?.[2] ?? null;
  const modules = state.data?.[3] ?? NO_MODULES;

  const perms = currentUser ? permissions(currentUser) : null;
  const canManage = (perms?.canManageSparten ?? false) || dataSource === "mock";

  // Finanz-Modul an? (Kernmodul → i. d. R. immer verfügbar). Fehlt der Eintrag,
  // wird fail-open angenommen (kein Eintrag = kein Schalter = verfügbar).
  const financeAvailable = useMemo(() => {
    const finance = modules.find((m) => m.moduleKey === "finance");
    return finance ? finance.available : true;
  }, [modules]);

  const teamCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const team of teams) {
      if (team.sparteId) map.set(team.sparteId, (map.get(team.sparteId) ?? 0) + 1);
    }
    return map;
  }, [teams]);

  const [form, setForm] = useState<SparteFormValue | null>(null);
  const [toDelete, setToDelete] = useState<Sparte | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleActive = async (sparte: Sparte) => {
    if (busyId) return;
    setBusyId(sparte.id);
    try {
      await data.updateSparte(sparte.id, { active: !sparte.active });
      showToast(
        (!sparte.active ? t("activatedToast", { name: sparte.name }) : t("deactivatedToast", { name: sparte.name })),
        { tone: "success" },
      );
      state.reload();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setBusyId(null);
    }
  };

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
  } else if (sparten.length === 0) {
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
      <ul className="grid list-none gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {sparten.map((sparte) => (
          <SparteCard
            key={sparte.id}
            sparte={sparte}
            memberCount={sparte.memberIds.length}
            teamCount={teamCounts.get(sparte.id) ?? 0}
            canManage={canManage}
            busy={busyId === sparte.id}
            onEdit={() => setForm({ mode: "edit", sparte })}
            onToggleActive={() => void toggleActive(sparte)}
            onDelete={() => setToDelete(sparte)}
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
          canManage && state.status === "ready" && sparten.length > 0 ? (
            <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
              {t("newSparte")}
            </Button>
          ) : undefined
        }
      />

      {body}

      {form && (
        <SparteFormSheet
          key={form.mode === "edit" ? `edit-${form.sparte.id}` : "create"}
          value={form}
          financeAvailable={financeAvailable}
          onClose={() => setForm(null)}
          onSaved={state.reload}
        />
      )}

      <DeleteSparteDialog
        sparte={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={state.reload}
      />
    </div>
  );
}
