"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort, formatEUR } from "@/lib/format";
import { fullName, members } from "@/lib/mock";
import type { Member } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card, CardFooter, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { Badge, DunningBadge, StatusPill } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/shell/icons";
import { InviteSheet } from "./InviteSheet";
import { mitgliederDict, roleKey } from "./i18n";
import {
  duesStatus,
  matchesRoleFilter,
  openSumCentsOf,
  ROLE_TONE,
  teamNames,
  type RoleFilter,
} from "./derive";

/**
 * Mitgliederliste: Suche (Name) + Rollen-Filter-Chips über der Tabelle,
 * Summenzeile aktualisiert sich beim Filtern (DESIGN-SYSTEM §3.3).
 * Der Klick auf die Personen-Zelle öffnet das Profil /mitglieder/[id].
 */

const FILTERS: RoleFilter[] = ["all", "board", "treasurer", "coach", "member", "guest"];

const FILTER_LABEL_KEY = {
  all: "fAll",
  board: "fBoard",
  treasurer: "fTreasurer",
  coach: "fCoach",
  member: "fMember",
  guest: "fGuest",
} as const;

function sortedMembers(): Member[] {
  return [...members].sort(
    (a, b) => a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de"),
  );
}

export function MembersClient() {
  const t = useT(mitgliederDict);
  const { locale } = useLocale();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);

  const all = useMemo(() => sortedMembers(), []);

  const searched = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((member) => fullName(member).toLowerCase().includes(needle));
  }, [all, query]);

  const rows = useMemo(
    () => searched.filter((member) => matchesRoleFilter(member, filter)),
    [searched, filter],
  );

  /** Chip-Zähler folgen der Suche — so sieht man, wo Treffer liegen. */
  const filterOptions: FilterChipOption<RoleFilter>[] = FILTERS.map((value) => ({
    value,
    label: t(FILTER_LABEL_KEY[value]),
    count: searched.filter((member) => matchesRoleFilter(member, value)).length,
  }));

  /** Offene Posten der angezeigten Personen (eigene Rechnungen — zählt nie doppelt). */
  const shownOpenCents = rows.reduce((sum, member) => sum + openSumCentsOf(member.id), 0);

  const columns: Column<Member>[] = [
    {
      id: "member",
      header: t("colMember"),
      footer: t("shownOf", { shown: rows.length, total: all.length }),
      cell: (member) => (
        <Link
          href={`/mitglieder/${member.id}`}
          aria-label={t("openProfile", { name: fullName(member) })}
          className="group flex min-w-44 items-center gap-2.5 no-underline"
        >
          <Avatar personId={member.id} firstName={member.firstName} lastName={member.lastName} size="m" />
          <span className="grid min-w-0">
            <span className="truncate text-[14px] font-bold leading-tight text-ink group-hover:underline">
              {fullName(member)}
            </span>
            <span className="truncate text-[12px] text-ink-faint">
              {member.birthDate
                ? t("bornYear", { year: new Date(member.birthDate).getFullYear() })
                : member.email ?? "—"}
            </span>
          </span>
        </Link>
      ),
    },
    {
      id: "teams",
      header: t("colTeams"),
      cell: (member) => {
        const names = teamNames(member);
        if (names.length === 0) return <span className="text-[13px] text-ink-faint">{t("noTeam")}</span>;
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
          {member.status === "pending" && <Badge tone="info">{t("statusPending")}</Badge>}
          {member.status === "inactive" && <Badge tone="neutral">{t("statusInactive")}</Badge>}
        </span>
      ),
    },
    {
      id: "dues",
      header: t("colDues"),
      footer: (
        <span className="whitespace-nowrap font-mono text-mono-table tabular-nums">
          {t("duesOpenSum", { sum: formatEUR(shownOpenCents, locale) })}
        </span>
      ),
      cell: (member) => {
        const status = duesStatus(member);
        if (status.kind === "exempt") return <Badge tone="neutral">{t("duesExempt")}</Badge>;
        if (status.kind === "paid")
          return (
            <Badge tone="success" icon="check">
              {t("duesPaid")}
            </Badge>
          );
        return <DunningBadge level={status.level} />;
      },
    },
    {
      id: "joined",
      header: t("colJoined"),
      cell: (member) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {formatDateShort(member.joinedAt, locale)}
        </span>
      ),
    },
    {
      id: "open",
      header: <span className="sr-only">{t("colProfile")}</span>,
      align: "right",
      cell: (member) => (
        <Link
          href={`/mitglieder/${member.id}`}
          aria-label={t("openProfile", { name: fullName(member) })}
          className="inline-grid h-11 w-11 place-items-center rounded-full text-ink-faint transition-colors duration-150 hover:bg-sunken hover:text-ink"
        >
          <Icon name="chevronRight" className="ic h-4 w-4" />
        </Link>
      ),
    },
  ];

  const resetFilters = () => {
    setQuery("");
    setFilter("all");
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={t("sub")}
        action={
          <Button icon="plus" onClick={() => setInviteOpen(true)}>
            {t("invite")}
          </Button>
        }
      />

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
        <FilterChips options={filterOptions} value={filter} onChange={setFilter} label={t("filterLabel")} />
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
        {rows.length > 0 && (
          <CardFooter>
            <span>{t("rowHint")}</span>
          </CardFooter>
        )}
      </Card>

      <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
