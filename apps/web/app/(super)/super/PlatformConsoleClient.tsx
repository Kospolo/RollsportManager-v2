"use client";

import { useSyncExternalStore } from "react";
import { dataSource, errorMessage, permissions } from "@/lib/data";
import { subscribeAuth } from "@/lib/auth/storage";
import { useData } from "@/lib/data/useData";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import type { PlatformClubSummary, PlatformStats, PlatformUserSummary } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { plattformDict } from "./i18n";

/**
 * Plattform-Konsole (Betreiber-Ebene): Kennzahlen + Verzeichnis aller Vereine
 * und Nutzer. Reine Lesesicht über die Facade (data.platformStats / -ListClubs
 * / -ListUsers → GET /platform/*, serverseitig hinter requirePlatformAdmin).
 *
 * Sichtbarkeit im Client anhand permissions().isPlatformAdmin (Token-Claim
 * app_metadata.is_platform_admin). Im mock-Modus gibt es keine Dev-Session —
 * dort wird die Konsole als Demo freigeschaltet ({ isPlatformAdmin: true }).
 * Der echte Schutz bleibt serverseitig.
 */

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

type Access = "checking" | "granted" | "denied";

/**
 * Zugriff auf die Betreiber-Ebene aus dem Token-Claim ableiten. Externer Store
 * (useSyncExternalStore) statt setState-im-Effect: SSR + Hydration liefern
 * "checking" (Server-Snapshot), der Client übernimmt danach die Entscheidung
 * ohne Hydration-Mismatch — gleiches Muster wie lib/i18n und lib/theme.
 */
function readAccess(): Access {
  const isAdmin = permissions(
    null,
    dataSource === "mock" ? { isPlatformAdmin: true } : undefined,
  ).isPlatformAdmin;
  return isAdmin ? "granted" : "denied";
}

function serverAccess(): Access {
  return "checking";
}

export function PlatformConsoleClient() {
  const t = useT(plattformDict);
  const access = useSyncExternalStore(subscribeAuth, readAccess, serverAccess);

  if (access === "checking") {
    return (
      <div className="grid gap-5" aria-busy="true">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (access === "denied") {
    return (
      <EmptyState
        icon="lock"
        title={t("noAccessTitle")}
        body={t("noAccessBody")}
        ctaHref="/dashboard"
        ctaLabel={t("backToPortal")}
      />
    );
  }

  return <PlatformConsole />;
}

/* ------------------------------------------------------------------ */

function PlatformConsole() {
  const t = useT(plattformDict);
  const { locale } = useLocale();

  const state = useData((repo) =>
    Promise.all([
      repo.platformStats(),
      repo.platformListClubs(),
      repo.platformListUsers(),
    ] as const),
  );

  if (state.status === "loading") {
    return (
      <div className="grid gap-5" aria-busy="true">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error)}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  }

  const [stats, clubs, users] = state.data;

  return (
    <div className="grid gap-6">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={t("sub")}
        action={dataSource === "mock" ? <Badge tone="warn">{t("demoNote")}</Badge> : undefined}
      />

      <StatsGrid stats={stats} locale={locale} />
      <ClubsCard clubs={clubs} locale={locale} />
      <UsersCard users={users} locale={locale} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatsGrid({ stats, locale }: { stats: PlatformStats; locale: Locale }) {
  const t = useT(plattformDict);
  const n = (value: number) => formatCount(value, locale);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiTile label={t("kpiClubs")} value={n(stats.clubs)} tone="brand" />
      <KpiTile label={t("kpiUsers")} value={n(stats.users)} tone="info" />
      <KpiTile
        label={t("kpiMembers")}
        value={n(stats.members)}
        tone="neutral"
        sub={t("activeSub")}
        delta={{ text: n(stats.activeMembers), tone: "success" }}
      />
      <KpiTile label={t("kpiTeams")} value={n(stats.teams)} tone="info" />
      <KpiTile label={t("kpiEvents")} value={n(stats.events)} tone="neutral" />
      <KpiTile
        label={t("kpiOpenInvoices")}
        value={n(stats.openInvoices)}
        tone={stats.openInvoices > 0 ? "warn" : "success"}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ClubsCard({ clubs, locale }: { clubs: PlatformClubSummary[]; locale: Locale }) {
  const t = useT(plattformDict);
  const totalMembers = clubs.reduce((sum, c) => sum + c.memberCount, 0);

  const columns: Column<PlatformClubSummary>[] = [
    {
      id: "club",
      header: t("colClub"),
      footer: t("clubsCount", { n: clubs.length }),
      cell: (club) => (
        <span className="grid min-w-0">
          <span className="truncate text-[14px] font-bold text-ink">{club.name}</span>
          <span className="truncate text-[12px] text-ink-faint">{club.shortName}</span>
        </span>
      ),
    },
    {
      id: "city",
      header: t("colCity"),
      cell: (club) => <span className="text-[14px] text-ink-soft">{club.city}</span>,
    },
    {
      id: "discipline",
      header: t("colDiscipline"),
      cell: (club) => <Badge tone="neutral">{club.discipline}</Badge>,
    },
    {
      id: "members",
      header: t("colMembers"),
      mono: true,
      footer: t("membersTotal", { n: formatCount(totalMembers, locale) }),
      cell: (club) => formatCount(club.memberCount, locale),
    },
    {
      id: "created",
      header: t("colCreated"),
      align: "right",
      cell: (club) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {formatDateShort(club.createdAt, locale)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader eyebrow={t("clubsEyebrow")} title={t("clubsTitle")} />
      <DataTable
        columns={columns}
        rows={clubs}
        rowKey={(club) => club.id}
        caption={t("clubsCaption")}
        empty={<EmptyState icon="members" title={t("clubsTitle")} body={t("clubsEmpty")} />}
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function UsersCard({ users, locale }: { users: PlatformUserSummary[]; locale: Locale }) {
  const t = useT(plattformDict);

  const columns: Column<PlatformUserSummary>[] = [
    {
      id: "user",
      header: t("colUser"),
      footer: t("usersCount", { n: users.length }),
      cell: (user) => (
        <span className="truncate text-[14px] font-bold text-ink">{user.displayName}</span>
      ),
    },
    {
      id: "locale",
      header: t("colLocale"),
      cell: (user) => (
        <Badge tone="neutral" className="uppercase">
          {user.locale}
        </Badge>
      ),
    },
    {
      id: "clubs",
      header: t("colClubs"),
      mono: true,
      cell: (user) => formatCount(user.clubCount, locale),
    },
    {
      id: "created",
      header: t("colCreated"),
      align: "right",
      cell: (user) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {formatDateShort(user.createdAt, locale)}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader eyebrow={t("usersEyebrow")} title={t("usersTitle")} />
      <DataTable
        columns={columns}
        rows={users}
        rowKey={(user) => user.id}
        caption={t("usersCaption")}
        empty={<EmptyState icon="members" title={t("usersTitle")} body={t("usersEmpty")} />}
      />
    </Card>
  );
}
