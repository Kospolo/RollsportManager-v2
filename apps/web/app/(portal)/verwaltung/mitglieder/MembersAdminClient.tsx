"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import { errorMessage, fullName, isNotImplemented, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Id, Member } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { InviteSheet } from "../../mitglieder/InviteSheet";
import { EditMemberSheet } from "./EditMemberSheet";
import { JoinRequestsCard } from "./JoinRequestsCard";
import { mitgliederVerwaltungDict, roleKey, statusKey, type MitgliederVerwaltungKey } from "./i18n";
import {
  matchesRoleFilter,
  matchesStatusFilter,
  ROLE_FILTERS,
  ROLE_TONE,
  sortMembers,
  STATUS_FILTERS,
  STATUS_TONE,
  teamNames,
  type RoleFilter,
  type StatusFilter,
} from "./derive";

/**
 * Mitglieder-Verwaltung: durchsuch- und filterbare Tabelle (Rolle + Status).
 * Zeilenklick öffnet das Bearbeiten-Sheet mit echten Speicherpfaden
 * (data.updateMember + data.changeMemberRole). Bearbeiten und Einladen sind
 * an can_manage_members gebunden (Anzeige-Mirror aus permissions); die
 * verbindliche Prüfung passiert serverseitig — 403 ⇒ Toast + Rollback.
 */

const ROLE_FILTER_LABEL: Record<RoleFilter, MitgliederVerwaltungKey> = {
  all: "fAll",
  board: "fBoard",
  moderator: "fModerator",
  treasurer: "fTreasurer",
  coach: "fCoach",
  member: "fMember",
  guest: "fGuest",
};

const STATUS_FILTER_LABEL: Record<StatusFilter, MitgliederVerwaltungKey> = {
  all: "stAll",
  active: "stActive",
  inactive: "stInactive",
  pending: "stPending",
};

const NO_MEMBERS: Member[] = [];

export function MembersAdminClient() {
  const t = useT(mitgliederVerwaltungDict);
  const { locale } = useLocale();

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id | null>(null);
  /** Optimistische Overrides (Stammdaten/Rolle) bis zum nächsten Reload. */
  const [patched, setPatched] = useState<Record<Id, Member>>({});

  const state = useData((repo) =>
    Promise.all([
      repo.getMembers(),
      repo.getCurrentUser(),
      repo.getTeams().catch((error: unknown) => {
        if (isNotImplemented(error)) return null;
        throw error;
      }),
    ] as const),
  );

  const allMembers = state.data?.[0] ?? NO_MEMBERS;
  const currentUser = state.data?.[1] ?? null;
  const teams = state.data?.[2] ?? null;

  const perms = permissions(currentUser);
  const canManageMembers = perms.canManageMembers;

  const applyPatched = useCallback(
    (member: Member) => setPatched((prev) => ({ ...prev, [member.id]: member })),
    [],
  );

  const mergedAll = useMemo(
    () => sortMembers(allMembers.map((member) => patched[member.id] ?? member)),
    [allMembers, patched],
  );

  const searched = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return mergedAll;
    return mergedAll.filter(
      (member) =>
        fullName(member).toLowerCase().includes(needle) ||
        (member.email ?? "").toLowerCase().includes(needle),
    );
  }, [mergedAll, query]);

  const rows = useMemo(
    () =>
      searched.filter(
        (member) => matchesRoleFilter(member, roleFilter) && matchesStatusFilter(member, statusFilter),
      ),
    [searched, roleFilter, statusFilter],
  );

  /** Chip-Zähler folgen der jeweils ANDEREN aktiven Auswahl (kombiniert). */
  const afterStatus = searched.filter((member) => matchesStatusFilter(member, statusFilter));
  const afterRole = searched.filter((member) => matchesRoleFilter(member, roleFilter));

  const roleOptions: FilterChipOption<RoleFilter>[] = ROLE_FILTERS.map((value) => ({
    value,
    label: t(ROLE_FILTER_LABEL[value]),
    count: afterStatus.filter((member) => matchesRoleFilter(member, value)).length,
  }));

  const statusOptions: FilterChipOption<StatusFilter>[] = STATUS_FILTERS.map((value) => ({
    value,
    label: t(STATUS_FILTER_LABEL[value]),
    count: afterRole.filter((member) => matchesStatusFilter(member, value)).length,
  }));

  const editing = editingId ? mergedAll.find((member) => member.id === editingId) ?? null : null;

  const resetFilters = () => {
    setQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  const sublineFor = (member: Member) =>
    member.birthDate
      ? t("bornYear", { year: new Date(member.birthDate).getFullYear() })
      : member.email ?? t("noEmailShort");

  const identity = (member: Member) => (
    <>
      <Avatar personId={member.id} firstName={member.firstName} lastName={member.lastName} size="m" />
      <span className="grid min-w-0">
        <span className="truncate text-[14px] font-bold leading-tight text-ink group-hover:underline">
          {fullName(member)}
        </span>
        <span className="truncate text-[12px] text-ink-faint">{sublineFor(member)}</span>
      </span>
    </>
  );

  const columns: Column<Member>[] = [
    {
      id: "member",
      header: t("colMember"),
      footer: t("shownOf", { shown: rows.length, total: mergedAll.length }),
      cell: (member) =>
        canManageMembers ? (
          <button
            type="button"
            onClick={() => setEditingId(member.id)}
            aria-label={t("editAria", { name: fullName(member) })}
            className="group flex min-w-44 items-center gap-2.5 text-left"
          >
            {identity(member)}
          </button>
        ) : (
          <Link
            href={`/mitglieder/${member.id}`}
            className="group flex min-w-44 items-center gap-2.5 no-underline"
          >
            {identity(member)}
          </Link>
        ),
    },
    {
      id: "teams",
      header: t("colTeams"),
      cell: (member) => {
        if (teams === null) return <span className="text-[13px] text-ink-faint">—</span>;
        const names = teamNames(member, teams);
        if (names.length === 0)
          return <span className="text-[13px] text-ink-faint">{t("noTeam")}</span>;
        return (
          <span className="flex flex-wrap gap-1.5">
            {names.map((name) => (
              <Badge key={name} tone="neutral">
                {name}
              </Badge>
            ))}
          </span>
        );
      },
    },
    {
      id: "role",
      header: t("colRole"),
      cell: (member) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusPill tone={ROLE_TONE[member.role]}>{t(roleKey(member.role))}</StatusPill>
          {member.role === "guest_coach" && member.guestAccessUntil && (
            <Badge tone="warn" icon="clock">
              {t("guestUntil", { date: formatDateShort(member.guestAccessUntil, locale) })}
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (member) => <Badge tone={STATUS_TONE[member.status]}>{t(statusKey(member.status))}</Badge>,
    },
    {
      id: "joined",
      header: t("colJoined"),
      cell: (member) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {member.joinedAt ? formatDateShort(member.joinedAt, locale) : "—"}
        </span>
      ),
    },
  ];

  if (canManageMembers) {
    columns.push({
      id: "edit",
      header: <span className="sr-only">{t("colEdit")}</span>,
      align: "right",
      cell: (member) => (
        <Button
          size="sm"
          variant="ghost"
          icon="edit"
          onClick={() => setEditingId(member.id)}
          aria-label={t("editAria", { name: fullName(member) })}
        >
          {t("edit")}
        </Button>
      ),
    });
  }

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <>
        <div className="flex flex-wrap items-center gap-3" aria-hidden="true">
          <Skeleton className="h-11 w-full rounded-full sm:w-72" />
          <Skeleton className="h-9 w-80 max-w-full rounded-full" />
        </div>
        <SkeletonCard lines={8} />
      </>
    );
  } else if (state.status === "error") {
    body = (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error)}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else {
    body = (
      <>
        {!canManageMembers && (
          <Card className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full bg-sunken text-ink-soft">
              <Icon name="lock" className="ic h-4 w-4" />
            </span>
            <p className="text-[13.5px] text-ink-soft">{t("readOnlyNote")}</p>
          </Card>
        )}

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative flex min-h-11 w-full items-center sm:w-72">
              <span className="sr-only">{t("searchLabel")}</span>
              <Icon
                name="search"
                className="ic pointer-events-none absolute left-4 h-4 w-4 text-ink-faint"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="min-h-11 w-full rounded-full border border-transparent bg-sunken pl-10 pr-4 text-body text-ink placeholder:text-ink-faint"
              />
            </label>
            <FilterChips
              options={roleOptions}
              value={roleFilter}
              onChange={setRoleFilter}
              label={t("filterRoleLabel")}
            />
          </div>
          <FilterChips
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            label={t("filterStatusLabel")}
          />
        </div>

        <Card>
          <CardHeader eyebrow={t("listEyebrow")} title={t("listTitle")} />
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(member) => member.id}
            caption={t("tableCaption")}
            empty={
              <EmptyState
                icon="members"
                title={t("emptyTitle")}
                body={t("emptyBody")}
                action={
                  <Button variant="secondary" onClick={resetFilters}>
                    {t("emptyReset")}
                  </Button>
                }
              />
            }
          />
          {teams === null && (
            <CardFooter>
              <span>{t("teamsNiHint")}</span>
            </CardFooter>
          )}
        </Card>
      </>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <nav aria-label={t("breadcrumb")} className="flex items-center gap-1.5 text-[13px]">
        <Link
          href="/verwaltung"
          className="inline-flex min-h-11 items-center font-semibold text-ink-soft no-underline transition-colors duration-150 hover:text-ink hover:underline"
        >
          {t("hubCrumb")}
        </Link>
        <Icon name="chevronRight" className="ic h-3.5 w-3.5 text-ink-faint" />
        <span aria-current="page" className="font-bold text-ink">
          {t("title")}
        </span>
      </nav>

      <SectionHeader
        level={1}
        eyebrow={t("eyebrow")}
        title={t("title")}
        sub={t("sub")}
        action={
          canManageMembers ? (
            <Button icon="plus" onClick={() => setInviteOpen(true)}>
              {t("invite")}
            </Button>
          ) : undefined
        }
      />

      {/* Die Freigabe-Liste steht GANZ OBEN und nicht unter einem Status-Filter:
          ein Antrag, den niemand sieht, ist ein Mensch, der wartet. */}
      <JoinRequestsCard canManage={canManageMembers} onChanged={state.reload} />

      {body}

      {canManageMembers && <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} />}

      {canManageMembers && currentUser && editing && (
        <EditMemberSheet
          key={editing.id}
          member={editing}
          perms={perms}
          currentUserId={currentUser.id}
          onClose={() => setEditingId(null)}
          onPatched={applyPatched}
        />
      )}
    </div>
  );
}
