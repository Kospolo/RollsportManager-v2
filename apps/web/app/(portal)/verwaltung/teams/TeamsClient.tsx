"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { errorMessage, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Member, Team } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { teamsDict } from "./i18n";
import { sortTeams } from "./derive";
import { TeamCard } from "./TeamCard";
import { TeamFormDialog, type TeamFormValue } from "./TeamFormDialog";
import { DeleteTeamDialog } from "./DeleteTeamDialog";
import { RosterDialog } from "./RosterDialog";

/**
 * Team-Verwaltung: Liste aller Teams mit Anlegen, Umbenennen, Löschen und
 * Kader-Zuordnung — alle Schreibpfade über die Facade (lib/data).
 *
 * Sichtbarkeit der Aktionen richtet sich nach der Rolle des aktuellen Nutzers
 * (is_club_admin = owner/admin/moderator). Der mock-Modus hat keine echte
 * Session (aktueller Nutzer = Coach); damit die Verwaltung dort trotzdem
 * erlebbar ist, wird sie im mock freigeschaltet — analog zum dokumentierten
 * Muster der Plattform-Screens. Im api-Modus zählt allein die echte Rolle,
 * und die Wahrheit bleibt serverseitig (403 → Toast, kein lokaler Schein).
 */

const NO_TEAMS: Team[] = [];
const NO_MEMBERS: Member[] = [];

export function TeamsClient() {
  const t = useT(teamsDict);

  const state = useData((repo) =>
    Promise.all([repo.getTeams(), repo.getMembers(), repo.getCurrentUser()] as const),
  );

  const teams = state.data?.[0] ?? NO_TEAMS;
  const members = state.data?.[1] ?? NO_MEMBERS;
  const currentUser = state.data?.[2] ?? null;

  const perms = permissions(currentUser);
  const canManage = perms.isClubAdmin;

  const sorted = useMemo(() => sortTeams(teams), [teams]);

  const [form, setForm] = useState<TeamFormValue | null>(null);
  const [toDelete, setToDelete] = useState<Team | null>(null);
  const [rosterTeam, setRosterTeam] = useState<Team | null>(null);

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-5" aria-hidden="true">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  } else if (state.status === "error") {
    body = (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error) || t("loadErrorBody")}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else if (sorted.length === 0) {
    body = canManage ? (
      <EmptyState
        icon="members"
        title={t("emptyTitle")}
        body={t("emptyBody")}
        action={
          <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
            {t("emptyCta")}
          </Button>
        }
      />
    ) : (
      <EmptyState icon="lock" title={t("emptyReadonlyTitle")} body={t("emptyReadonlyBody")} />
    );
  } else {
    body = (
      <div className="grid gap-5">
        {!canManage && (
          <p className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-3 text-[13px] text-ink-soft shadow-card">
            <Icon name="lock" className="ic h-4 w-4 flex-none text-ink-faint" />
            {t("readonlyBanner")}
          </p>
        )}
        <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              members={members}
              canManage={canManage}
              onEdit={() => setForm({ mode: "edit", team })}
              onRoster={() => setRosterTeam(team)}
              onDelete={() => setToDelete(team)}
            />
          ))}
        </div>
      </div>
    );
  }

  const teamCountLabel =
    sorted.length === 1 ? t("oneTeam") : t("teamsCount", { n: sorted.length });

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={state.status === "ready" && sorted.length > 0 ? teamCountLabel : t("sub")}
        action={
          canManage && (
            <Button icon="plus" onClick={() => setForm({ mode: "create" })}>
              {t("newTeam")}
            </Button>
          )
        }
      />

      {body}

      {form && (
        <TeamFormDialog
          key={form.mode === "edit" ? `edit-${form.team.id}` : "create"}
          value={form}
          onClose={() => setForm(null)}
          onSaved={state.reload}
        />
      )}
      <DeleteTeamDialog
        team={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={state.reload}
      />
      {rosterTeam && (
        <RosterDialog
          key={rosterTeam.id}
          team={rosterTeam}
          members={members}
          onClose={() => setRosterTeam(null)}
          onSaved={state.reload}
        />
      )}
    </div>
  );
}
