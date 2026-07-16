"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { dataSource, errorMessage, type CapabilityLevel, type ClubRoleDef } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useCapabilities } from "@/lib/capabilities";
import type { Id } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Icon } from "@/components/shell/icons";
import { rollenDict } from "./i18n";
import { PermissionMatrix } from "./PermissionMatrix";
import { RolesList } from "./RolesList";
import { MemberRoles } from "./MemberRoles";
import { CoachTeams } from "./CoachTeams";

/**
 * „Rollen & Rechte" — die Steuerzentrale (RBAC-DESIGN §7).
 *
 * Vier Reiter, vier Anforderungen:
 *   Rechte        editierbare Matrix mit Stufen-Dropdowns  (§1.1)
 *   Rollen        eigene Rollen anlegen/umbenennen/löschen (§1.2)
 *   Personen      mehrere Rollen je Person                 (§1.3)
 *   Trainer:innen n:m Trainer:in ↔ Teams                   (§1.4)
 *
 * ### Das Gating ###
 * Über GET /me/capabilities (`roles:manage`), NICHT über die alte
 * permissions()-Attrappe. Wer nicht verwalten darf, sieht den Stand — die
 * Knöpfe fehlen. Das ist Kosmetik: der Server weist die Änderung ohnehin ab.
 *
 * ### Alles einmal laden, dann teilen ###
 * Rollen, Matrix, Personen und Teams hängen zusammen (die Chips brauchen die
 * Rollen-Namen, die Rollen-Liste die Personen-Zahl). Ein gemeinsames useData
 * statt vier — und ein `reload`, das nach jeder Änderung alles nachzieht.
 */

type TabValue = "matrix" | "roles" | "people" | "coaches";

export function RollenClient() {
  const t = useT(rollenDict);
  const caps = useCapabilities();
  const [tab, setTab] = useState<TabValue>("matrix");

  const state = useData(
    (repo) =>
      Promise.all([
        repo.listClubRoles(),
        repo.getMembers(),
        repo.getTeams(),
        repo.listMemberRoles(),
        repo.getCurrentUser(),
      ] as const),
    [],
  );

  /**
   * Die Matrix je Rolle. Es gibt keinen Endpoint, der alle Matrizen auf einmal
   * liefert (GET .../roles/{roleId}/permissions ist je Rolle) — also eine
   * Anfrage je Rolle. Bei sieben Systemrollen plus ein paar eigenen ist das
   * vertretbar; hätte ein Verein einmal sehr viele Rollen, wäre ein
   * Sammel-Endpoint die bessere Lösung. Ehrlich benannt statt versteckt.
   */
  const permissionsState = useData(async (repo) => {
    const list = await repo.listClubRoles();
    const entries = await Promise.all(
      list.map(async (role) => {
        const perms = await repo.getRolePermissions(role.id);
        return [role.id, new Map(perms.map((p) => [p.capabilityKey, p.level]))] as const;
      }),
    );
    return new Map<string, ReadonlyMap<string, CapabilityLevel>>(entries);
  }, []);

  const roles: ClubRoleDef[] = useMemo(() => state.data?.[0] ?? [], [state.data]);
  const members = useMemo(() => state.data?.[1] ?? [], [state.data]);
  const teams = useMemo(() => state.data?.[2] ?? [], [state.data]);
  const memberRoles = useMemo(() => state.data?.[3] ?? [], [state.data]);
  const currentUser = state.data?.[4] ?? null;

  const rolesByMember = useMemo(
    () => new Map<Id, Id[]>(memberRoles.map((r) => [r.memberId, r.roleIds])),
    [memberRoles],
  );

  const memberCountByRole = useMemo(() => {
    const counts = new Map<Id, number>();
    for (const assignment of memberRoles) {
      for (const roleId of assignment.roleIds) {
        counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
      }
    }
    return counts;
  }, [memberRoles]);

  const reloadAll = () => {
    state.reload();
    permissionsState.reload();
  };

  const canManage = caps.hasCap("roles", "manage");
  const canManageCoaches = caps.hasCap("team_coaches", "manage");

  const tabs: TabItem<TabValue>[] = [
    { value: "matrix", label: t("tabMatrix") },
    { value: "roles", label: t("tabRoles"), count: roles.length },
    { value: "people", label: t("tabPeople"), count: members.length },
    { value: "coaches", label: t("tabCoaches"), count: teams.length },
  ];

  // Keine Auflösung = keine Mitgliedschaft (der Server antwortet dann mit 403).
  // Fail-closed: lieber gar nichts als eine Attrappe.
  if (caps.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-5">
        <SectionHeader level={1} title={t("title")} sub={t("sub")} />
        <EmptyState icon="lock" title={t("forbiddenTitle")} body={t("forbiddenBody")} />
      </div>
    );
  }

  const loading =
    caps.status === "loading" || state.status === "loading" || permissionsState.status === "loading";

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-5">
      <SectionHeader level={1} title={t("title")} sub={t("sub")} />

      {dataSource !== "api" && (
        <Card className="flex items-start gap-3">
          <Badge tone="warn">{t("demoTag")}</Badge>
          <p className="text-[13px] text-ink-soft">{t("demoNote")}</p>
        </Card>
      )}

      {/* Sofortwirksamkeit ist ein Feature — also steht sie da, nicht im Changelog. */}
      <Card className="flex items-start gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-success-soft text-success">
          <Icon name="zap" className="ic h-4 w-4" />
        </span>
        <span className="grid gap-1">
          <span className="eyebrow">{t("liveEyebrow")}</span>
          <span className="font-display text-h3 tracking-[-0.01em] text-ink">{t("liveTitle")}</span>
          <p className="text-[14px] text-ink-soft">{t("liveBody")}</p>
        </span>
      </Card>

      {!canManage && caps.status === "ready" && (
        <Card className="flex items-start gap-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-info-soft text-info">
            <Icon name="lock" className="ic h-4 w-4" />
          </span>
          <span className="grid gap-1">
            <span className="eyebrow">{t("lockedTitle")}</span>
            <p className="text-[14px] text-ink-soft">{t("lockedBody")}</p>
          </span>
        </Card>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} label={t("title")} idBase="rollen" />

      {loading ? (
        <SkeletonCard lines={10} />
      ) : state.status === "error" ? (
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(state.error)}
          action={<Button onClick={reloadAll}>{t("retry")}</Button>}
        />
      ) : (
        <>
          {tab === "matrix" && (
            <PermissionMatrix
              roles={roles}
              permissionsByRole={permissionsState.data ?? new Map()}
              canManage={canManage}
              onSaved={reloadAll}
            />
          )}
          {tab === "roles" && (
            <RolesList
              roles={roles}
              permissionsByRole={permissionsState.data ?? new Map()}
              memberCountByRole={memberCountByRole}
              canManage={canManage}
              onChanged={reloadAll}
            />
          )}
          {tab === "people" && (
            <MemberRoles
              members={members}
              roles={roles}
              rolesByMember={rolesByMember}
              currentUserId={currentUser?.id ?? null}
              canManage={canManage}
              onChanged={reloadAll}
            />
          )}
          {tab === "coaches" && (
            <CoachTeams
              members={members}
              teams={teams}
              canManage={canManageCoaches}
              onChanged={reloadAll}
            />
          )}
        </>
      )}

      {/* Der Schutz ist der Server — das gehört auf die Seite, nicht ins README. */}
      <Card className="flex items-start gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-brand-soft text-brand-ink">
          <Icon name="lock" className="ic h-4 w-4" />
        </span>
        <span className="grid gap-1">
          <span className="eyebrow">{t("serverEyebrow")}</span>
          <span className="font-display text-h3 tracking-[-0.01em] text-ink">
            {t("serverTitle")}
          </span>
          <p className="text-[14px] text-ink-soft">{t("serverBody")}</p>
        </span>
      </Card>
    </div>
  );
}
