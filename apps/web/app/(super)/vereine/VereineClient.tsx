"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { dataSource, errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import type {
  PlatformClubSummary,
  PlatformEntitlement,
  PlatformUserSummary,
} from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { OperatorGate } from "../OperatorGate";
import { ViewClubButton } from "../ViewClubButton";
import { STATUS_LABEL_KEY, STATUS_TONE, TIER_LABEL_KEY, TIER_TONE } from "../lizenzen/derive";
import { lizenzenDict } from "../lizenzen/i18n";
import { vereineDict } from "./i18n";

/**
 * „Vereine & Nutzer" — das Verzeichnis der Betreiber-Ebene und der Ort, an dem
 * der Vereins-Umschalter sitzt.
 *
 * Drei Quellen, ein Bild: /platform/clubs (Stammdaten), /platform/entitlements
 * (Lizenz je Verein) und /platform/users. Die Lizenz kommt bewusst mit in die
 * Vereinszeile: die erste Frage bei einem Verein ist fast immer „zahlt der?" —
 * und die Antwort steht sonst zwei Klicks weiter unter „Lizenzen".
 *
 * Die Verknüpfung ist kein heimliches Zusammenrechnen: beide Endpunkte liefern
 * dieselbe club_id, hier wird nur nachgeschlagen, nichts erfunden.
 */

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

export function VereineClient() {
  return (
    <OperatorGate>
      <Vereine />
    </OperatorGate>
  );
}

function Vereine() {
  const t = useT(vereineDict);

  const state = useData((repo) =>
    Promise.all([
      repo.platformListClubs(),
      repo.platformListUsers(),
      repo.platformListEntitlements(),
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

  const [clubs, users, entitlements] = state.data;

  return (
    <div className="grid gap-6">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={t("sub")}
        action={dataSource === "mock" ? <Badge tone="warn">{t("demoNote")}</Badge> : undefined}
      />
      <HowItWorksCard />
      <ClubsCard clubs={clubs} entitlements={entitlements} />
      <RightsCard />
      <UsersCard users={users} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Der Hinweis steht ÜBER der Tabelle, nicht in einer Fußnote. Wer gleich auf
 * „Ansehen" klickt, soll vorher gelesen haben, was das bedeutet — und dass es
 * protokolliert wird.
 */
function HowItWorksCard() {
  const t = useT(vereineDict);
  return (
    <Card>
      <CardHeader eyebrow={t("howEyebrow")} title={t("howTitle")} />
      <p className="-mt-1 max-w-prose text-body text-ink-soft">{t("howBody")}</p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function ClubsCard({
  clubs,
  entitlements,
}: {
  clubs: PlatformClubSummary[];
  entitlements: PlatformEntitlement[];
}) {
  const t = useT(vereineDict);
  const tLic = useT(lizenzenDict);
  const { locale } = useLocale();
  const [filter, setFilter] = useState("");

  // Lizenz je club_id nachschlagen — beide Endpunkte sprechen dieselbe Id.
  const licenseOf = useMemo(() => {
    const map = new Map<string, PlatformEntitlement>();
    for (const row of entitlements) map.set(row.clubId, row);
    return map;
  }, [entitlements]);

  const needle = filter.trim().toLowerCase();
  const rows = useMemo(
    () =>
      needle === ""
        ? clubs
        : clubs.filter((c) =>
            [c.name, c.shortName, c.city].some((v) => (v ?? "").toLowerCase().includes(needle)),
          ),
    [clubs, needle],
  );

  const totalMembers = rows.reduce((sum, c) => sum + c.memberCount, 0);

  const columns: Column<PlatformClubSummary>[] = [
    {
      id: "club",
      header: t("colClub"),
      footer: t("clubsCount", { n: rows.length }),
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
      id: "license",
      header: t("colLicense"),
      cell: (club) => {
        const lic = licenseOf.get(club.id);
        // Kein Eintrag ODER kein tier/status = kein Abo. Nicht „basic" raten:
        // ein geratener Tarif ist eine Falschaussage über Geld.
        if (!lic?.tier || !lic.status) {
          return <Badge tone="neutral">{t("noLicense")}</Badge>;
        }
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={TIER_TONE[lic.tier]}>{tLic(TIER_LABEL_KEY[lic.tier])}</Badge>
            <Badge tone={STATUS_TONE[lic.status]}>{tLic(STATUS_LABEL_KEY[lic.status])}</Badge>
          </span>
        );
      },
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
      cell: (club) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {formatDateShort(club.createdAt, locale)}
        </span>
      ),
    },
    {
      id: "action",
      header: t("colAction"),
      align: "right",
      cell: (club) => (
        <span className="flex justify-end">
          <ViewClubButton
            club={{
              id: club.id,
              name: club.name,
              ...(club.shortName ? { shortName: club.shortName } : {}),
            }}
          />
        </span>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader eyebrow={t("clubsEyebrow")} title={t("clubsTitle")} />
      <div className="mb-4 max-w-sm">
        <Input
          label={t("filterLabel")}
          placeholder={t("filterPlaceholder")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          type="search"
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(club) => club.id}
        caption={t("clubsCaption")}
        empty={
          needle === "" ? (
            <EmptyState icon="teams" title={t("clubsTitle")} body={t("clubsEmpty")} />
          ) : (
            <EmptyState
              icon="search"
              title={t("noMatch")}
              body={t("noMatchBody")}
              action={<Button onClick={() => setFilter("")}>{t("clearFilter")}</Button>}
            />
          )
        }
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Rechte & Module: ein VERWEIS, kein zweites Bedienfeld.
 *
 * Der Verein hat seit dem RBAC-Umbau eine eigene Rollen-Oberfläche
 * ((portal)/verwaltung/rollen). Sie hier nachzubauen hieße: zwei Oberflächen für
 * dieselbe Tabelle, die auseinanderlaufen, sobald eine von beiden gepflegt wird.
 * Über den Umschalter benutzt der Betreiber einfach die vorhandene.
 *
 * Der zweite Absatz sagt die unbequeme Wahrheit über die 18 wirkungslosen
 * Fähigkeiten. Nachgezählt in 0033_capability_enforcement.sql:180-221
 * (3 enforced + 2 partial + 9 write_only + 18 unenforced = 32) — nicht geraten.
 */
function RightsCard() {
  const t = useT(vereineDict);
  return (
    <Card>
      <CardHeader eyebrow={t("rightsEyebrow")} title={t("rightsTitle")} />
      <p className="-mt-1 max-w-prose text-body text-ink-soft">{t("rightsBody")}</p>
      <p className="mt-3 max-w-prose rounded-lg bg-sunken px-4 py-3 text-caption text-ink-soft">
        {t("rightsHonest")}
      </p>
      <p className="mt-4">
        <Link
          href="/plattform-einstellungen"
          className="inline-flex min-h-9 items-center gap-1.5 text-[13.5px] font-bold text-brand-ink"
        >
          <Icon name="settings" className="ic h-4 w-4" />
          {t("toFlags")}
        </Link>
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function UsersCard({ users }: { users: PlatformUserSummary[] }) {
  const t = useT(vereineDict);
  const { locale } = useLocale();

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
      <p className="-mt-2 mb-4 max-w-prose text-caption text-ink-faint">{t("usersNote")}</p>
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
