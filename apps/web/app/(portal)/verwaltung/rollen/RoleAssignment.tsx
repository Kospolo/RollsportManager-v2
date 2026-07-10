"use client";

import { useMemo, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import {
  data,
  dataSource,
  errorMessage,
  fullName,
  isForbidden,
  isNotImplemented,
  permissions,
  type AssignableRole,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Id, Member, MemberRole } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { rollenDict, roleLabelKey } from "./i18n";
import { ROLE_TONE, assignableRolesFor, sortByRole } from "./derive";

/**
 * Rollen-Zuweisung: Mitgliederliste mit aktueller Rolle und Schnell-Zuweisung
 * über data.changeMemberRole. Sichtbarkeit/Interaktivität richten sich nach der
 * Rolle des aktuellen Users (Anzeige-Gate) — der Server bleibt die Wahrheit:
 * ein 403 wird als Toast gezeigt und die optimistische Änderung zurückgenommen.
 */

const NO_MEMBERS: Member[] = [];

/** Kompaktes Rollen-Select in Tokens (Field-Chrome ist für Formularzeilen zu groß). */
function InlineRoleSelect({
  value,
  options,
  disabled,
  ariaLabel,
  onChange,
  labelFor,
}: {
  value: MemberRole;
  options: AssignableRole[];
  disabled: boolean;
  ariaLabel: string;
  onChange: (next: AssignableRole) => void;
  labelFor: (role: MemberRole) => string;
}) {
  return (
    <span className="relative inline-block">
      <select
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as AssignableRole)}
        className="min-h-9 appearance-none rounded-md border border-transparent bg-sunken py-1 pl-3 pr-9 text-[13px] font-semibold text-ink transition-colors duration-150 hover:bg-sunken/70 disabled:opacity-45"
      >
        {options.map((role) => (
          <option key={role} value={role}>
            {labelFor(role)}
          </option>
        ))}
        {/* Bestandswert owner: nie zuweisbar, aber als aktuelle Anzeige nötig. */}
        {value === "owner" && (
          <option value="owner" disabled>
            {labelFor("owner")}
          </option>
        )}
      </select>
      <Icon
        name="chevronDown"
        className="ic pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
      />
    </span>
  );
}

export function RoleAssignment() {
  const t = useT(rollenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const state = useData(
    (repo) => Promise.all([repo.getMembers(), repo.getCurrentUser()] as const),
    [],
  );

  /** Optimistische Rollen je Mitglied (memberId → Rolle); null = Server-Stand. */
  const [overrides, setOverrides] = useState<Record<Id, MemberRole>>({});
  const [saving, setSaving] = useState<ReadonlySet<Id>>(new Set());

  const members = state.data?.[0] ?? NO_MEMBERS;
  const currentUser = state.data?.[1] ?? null;
  const perms = permissions(currentUser, { isPlatformAdmin: false });
  const canAssign = perms.isClubAdmin;
  const options = assignableRolesFor(perms.role);

  const rows = useMemo(() => sortByRole(members), [members]);
  const roleOf = (member: Member): MemberRole => overrides[member.id] ?? member.role;
  const labelFor = (role: MemberRole) => t(roleLabelKey(role));

  const changeRole = async (member: Member, next: AssignableRole) => {
    const previous = roleOf(member);
    if (next === previous || saving.has(member.id)) return;

    setOverrides((current) => ({ ...current, [member.id]: next })); // optimistisch
    setSaving((current) => new Set(current).add(member.id));
    try {
      await data.changeMemberRole(member.id, next);
      showToast(
        t(dataSource === "api" ? "toastSaved" : "toastDemo", {
          name: fullName(member),
          role: labelFor(next),
        }),
        { tone: "success" },
      );
    } catch (error) {
      // Rollback auf den vorherigen Stand + Klartext-Toast (403 = keine Berechtigung).
      setOverrides((current) => {
        const nextState = { ...current };
        if (previous === member.role) delete nextState[member.id];
        else nextState[member.id] = previous;
        return nextState;
      });
      showToast(isForbidden(error) ? t("toastForbidden") : errorMessage(error), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void changeRole(member, next),
      });
    } finally {
      setSaving((current) => {
        const nextState = new Set(current);
        nextState.delete(member.id);
        return nextState;
      });
    }
  };

  const memberCell: Column<Member> = {
    id: "member",
    header: t("colMember"),
    cell: (member) => (
      <span className="flex min-w-44 items-center gap-2.5">
        <Avatar personId={member.id} firstName={member.firstName} lastName={member.lastName} size="m" />
        <span className="grid min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-bold leading-tight text-ink">
              {fullName(member)}
            </span>
            {currentUser?.id === member.id && <Badge tone="brand">{t("youTag")}</Badge>}
          </span>
          <span className="truncate text-[12px] text-ink-faint">{member.email ?? "—"}</span>
        </span>
      </span>
    ),
  };

  const currentRoleCell: Column<Member> = {
    id: "role",
    header: t("colCurrentRole"),
    cell: (member) => {
      const role = roleOf(member);
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusPill tone={ROLE_TONE[role]}>{labelFor(role)}</StatusPill>
          {member.role === "guest_coach" && member.guestAccessUntil && (
            <Badge tone="warn" icon="clock">
              {t("guestUntil", { date: formatDateShort(member.guestAccessUntil, locale) })}
            </Badge>
          )}
        </span>
      );
    },
  };

  const assignCell: Column<Member> = {
    id: "assign",
    header: t("colAssign"),
    align: "right",
    cell: (member) => {
      const isSelf = currentUser?.id === member.id;
      const role = roleOf(member);
      // Gate nach Referenz 1.3 (Anzeige): eigene Rolle nie, sonst nach Hierarchie.
      if (isSelf || !perms.canChangeRole(member.role)) {
        return (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint">
            <Icon name="lock" className="ic h-3.5 w-3.5" />
            {isSelf ? t("reasonSelf") : t("reasonProtected")}
          </span>
        );
      }
      return (
        <InlineRoleSelect
          value={role}
          options={options}
          disabled={saving.has(member.id)}
          ariaLabel={t("selectAria", { name: fullName(member) })}
          onChange={(next) => void changeRole(member, next)}
          labelFor={labelFor}
        />
      );
    },
  };

  const columns: Column<Member>[] = canAssign
    ? [memberCell, currentRoleCell, assignCell]
    : [memberCell, currentRoleCell];

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = <SkeletonCard lines={8} />;
  } else if (state.status === "error") {
    body = isNotImplemented(state.error) ? (
      <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
    ) : (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error)}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else {
    body = (
      <Card>
        <CardHeader eyebrow={t("assignEyebrow")} title={t("assignTitle")} />
        {!canAssign && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-info-soft px-4 py-3 text-info">
            <Icon name="lock" className="ic mt-0.5 h-4 w-4 flex-none" />
            <span className="grid gap-0.5">
              <span className="text-[13.5px] font-bold">{t("lockedTitle")}</span>
              <span className="text-[13px]">
                {t("lockedBody", { role: perms.role ? labelFor(perms.role) : "—" })}
              </span>
            </span>
          </div>
        )}
        <p className="mb-4 text-[13px] text-ink-soft">{t("assignSub")}</p>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(member) => member.id}
          caption={t("tableCaption")}
          empty={<EmptyState icon="members" title={t("emptyTitle")} body={t("emptyBody")} />}
        />
      </Card>
    );
  }

  return body;
}
