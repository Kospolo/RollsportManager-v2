"use client";

import { useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { data, errorMessage, fullName, isForbidden, type ClubRoleDef } from "@/lib/data";
import type { Id, Member } from "@/lib/types";
import { useCapabilities } from "@/lib/capabilities";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Modal";
import { Icon } from "@/components/shell/icons";
import { rollenDict } from "./i18n";
import { roleTone, sortMembers, sortRoles } from "./derive";

/**
 * MEHRFACHROLLEN (RBAC-DESIGN §1.3): einer Person mehrere Rollen geben.
 *
 * ### Was das ersetzt ###
 * Die Vorgängerin (RoleAssignment) schrieb über data.changeMemberRole →
 * PATCH .../members/{id}/role. Das setzt die PRIMÄRROLLE club_members.role, die
 * ein Trigger nach member_roles spiegelt (0024:78-127, Kommentar dort:
 * „Zweitrollen bleiben unberührt"). Über diesen Weg waren Mehrfachrollen
 * strukturell unerreichbar — egal, wie die Oberfläche aussah.
 * Hier läuft es über PUT .../members/{id}/roles: Zielzustand, mehrere Rollen.
 *
 * ### Die Chips sind der Punkt ###
 * Die Rechte einer Person sind die VEREINIGUNG über alle ihre Rollen (höchste
 * Stufe je Fähigkeit gewinnt). Eine Liste, die nur eine Rolle zeigt, verschweigt
 * die halbe Wahrheit — deshalb steht jede Rolle als eigener Chip.
 */

const NO_ROLES: Id[] = [];

function RolesSheet({
  member,
  roles,
  current,
  onClose,
  onSaved,
}: {
  member: Member;
  roles: ClubRoleDef[];
  current: Id[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(rollenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const caps = useCapabilities();
  const [selected, setSelected] = useState<Set<Id>>(new Set(current));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = (role: ClubRoleDef) => (locale === "en" ? role.nameEn : role.nameDe);

  const toggle = (roleId: Id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await data.setMemberRoles(member.id, [...selected]);
      showToast(t("rolesSaved", { name: fullName(member) }), { tone: "success" });
      onSaved();
      // Die eigenen Rechte können sich gerade geändert haben — sofort nachziehen.
      caps.reload();
      onClose();
    } catch (err) {
      // Der Server hat eigene Sperren (owner nur durch owner, keine
      // Selbstvergabe, Moderator-Schranke — Trigger protect_member_roles).
      // Sie kommen hier als Klartext an, nicht als Stacktrace.
      setError(isForbidden(err) ? t("toastForbidden") : errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("peopleEyebrow")}
      title={t("editRolesTitle", { name: fullName(member) })}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("roleCancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {t("roleSave")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <p className="text-[13px] text-ink-soft">{t("editRolesSub")}</p>
        <ul className="grid gap-1.5">
          {sortRoles(roles).map((role) => (
            <li key={role.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3.5 py-2.5 hover:bg-sunken">
                <input
                  type="checkbox"
                  checked={selected.has(role.id)}
                  onChange={() => toggle(role.id)}
                  disabled={submitting}
                  className="h-4 w-4 flex-none accent-[var(--brand)]"
                />
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  <StatusPill tone={roleTone(role)}>{name(role)}</StatusPill>
                  {role.protected && (
                    <Badge tone="brand" icon="lock">
                      {t("roleProtectedBadge")}
                    </Badge>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

export function MemberRoles({
  members,
  roles,
  rolesByMember,
  currentUserId,
  canManage,
  onChanged,
}: {
  members: Member[];
  roles: ClubRoleDef[];
  rolesByMember: ReadonlyMap<Id, Id[]>;
  currentUserId: Id | null;
  canManage: boolean;
  onChanged: () => void;
}) {
  const t = useT(rollenDict);
  const { locale } = useLocale();
  const [sheetFor, setSheetFor] = useState<Member | null>(null);

  const rows = sortMembers(members);
  const byId = new Map(roles.map((r) => [r.id, r]));
  const roleName = (role: ClubRoleDef) => (locale === "en" ? role.nameEn : role.nameDe);

  const memberCell: Column<Member> = {
    id: "member",
    header: t("colMember"),
    cell: (member) => (
      <span className="flex min-w-44 items-center gap-2.5">
        <Avatar
          personId={member.id}
          firstName={member.firstName}
          lastName={member.lastName}
          size="m"
        />
        <span className="grid min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-bold leading-tight text-ink">
              {fullName(member)}
            </span>
            {currentUserId === member.id && <Badge tone="brand">{t("youTag")}</Badge>}
          </span>
          <span className="truncate text-[12px] text-ink-faint">{member.email ?? "—"}</span>
        </span>
      </span>
    ),
  };

  const rolesCell: Column<Member> = {
    id: "roles",
    header: t("colRoles"),
    cell: (member) => {
      const ids = rolesByMember.get(member.id) ?? NO_ROLES;
      const assigned = ids.map((id) => byId.get(id)).filter((r): r is ClubRoleDef => !!r);
      if (assigned.length === 0) {
        return <span className="text-[13px] text-ink-faint">{t("noRoles")}</span>;
      }
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          {sortRoles(assigned).map((role) => (
            <StatusPill key={role.id} tone={roleTone(role)}>
              {roleName(role)}
            </StatusPill>
          ))}
        </span>
      );
    },
  };

  const editCell: Column<Member> = {
    id: "edit",
    header: t("colEdit"),
    align: "right",
    cell: (member) => (
      <Button variant="ghost" size="sm" icon="edit" onClick={() => setSheetFor(member)}>
        {t("editRoles")}
      </Button>
    ),
  };

  const columns: Column<Member>[] = canManage
    ? [memberCell, rolesCell, editCell]
    : [memberCell, rolesCell];

  return (
    <Card>
      <CardHeader eyebrow={t("peopleEyebrow")} title={t("peopleTitle")} />
      <p className="mb-4 text-[13px] text-ink-soft">{t("peopleSub")}</p>
      {!canManage && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-info-soft px-4 py-3 text-info">
          <Icon name="lock" className="ic mt-0.5 h-4 w-4 flex-none" />
          <span className="grid gap-0.5">
            <span className="text-[13.5px] font-bold">{t("lockedTitle")}</span>
            <span className="text-[13px]">{t("lockedBody")}</span>
          </span>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(member) => member.id}
        caption={t("tableCaption")}
        empty={<EmptyState icon="members" title={t("emptyTitle")} body={t("emptyBody")} />}
      />
      {sheetFor && (
        <RolesSheet
          member={sheetFor}
          roles={roles}
          current={rolesByMember.get(sheetFor.id) ?? NO_ROLES}
          onClose={() => setSheetFor(null)}
          onSaved={onChanged}
        />
      )}
    </Card>
  );
}
