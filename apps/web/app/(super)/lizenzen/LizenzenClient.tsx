"use client";

import { useState, useSyncExternalStore } from "react";
import { dataSource, errorMessage, permissions } from "@/lib/data";
import { subscribeAuth } from "@/lib/auth/storage";
import { useData } from "@/lib/data/useData";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import type { PlatformEntitlement } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { lizenzenDict } from "./i18n";
import {
  SOURCE_LABEL_KEY,
  SOURCE_TONE,
  STATUS_LABEL_KEY,
  STATUS_TONE,
  TIER_LABEL_KEY,
  TIER_TONE,
  licenseTotals,
} from "./derive";
import { EditEntitlementModal } from "./EditEntitlementModal";

/**
 * Betreiber-Lizenzverwaltung ((super)/lizenzen): Kennzahlen + Tabelle aller
 * Vereine mit ihrer Lizenz und das Setzen von Stufe/Status/Testphase über die
 * Facade (data.platformListEntitlements / -platformSetEntitlement → GET/PATCH
 * /platform/entitlements, serverseitig hinter requirePlatformAdmin).
 *
 * Sichtbarkeit im Client anhand permissions().isPlatformAdmin (Token-Claim);
 * im mock-Modus als Demo freigeschaltet. Der echte Schutz bleibt der Server.
 */

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

type Access = "checking" | "granted" | "denied";

/** Zugriff aus dem Token-Claim ableiten — externer Store, kein setState-Effect. */
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

export function LizenzenClient() {
  const t = useT(lizenzenDict);
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

  return <Lizenzen />;
}

/* ------------------------------------------------------------------ */

function Lizenzen() {
  const t = useT(lizenzenDict);
  const { locale } = useLocale();
  const [editing, setEditing] = useState<PlatformEntitlement | null>(null);

  const state = useData((repo) => repo.platformListEntitlements());

  if (state.status === "loading") {
    return (
      <div className="grid gap-5" aria-busy="true">
        <SkeletonCard lines={2} />
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

  const rows = state.data;
  const totals = licenseTotals(rows);
  const n = (value: number) => formatCount(value, locale);

  return (
    <div className="grid gap-6">
      <SectionHeader
        level={1}
        eyebrow={t("eyebrow")}
        title={t("title")}
        sub={t("sub")}
        action={dataSource === "mock" ? <Badge tone="warn">{t("demoNote")}</Badge> : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label={t("kpiClubs")}
          value={n(totals.clubs)}
          tone="brand"
          sub={t("kpiLicensedSub", { n: n(totals.licensed) })}
        />
        <KpiTile
          label={t("kpiActive")}
          value={n(totals.active)}
          tone="success"
          sub={t("kpiActiveSub")}
        />
        <KpiTile label={t("kpiTrial")} value={n(totals.trial)} tone="info" />
        <KpiTile
          label={t("kpiPastDue")}
          value={n(totals.pastDue)}
          tone={totals.pastDue > 0 ? "warn" : "neutral"}
        />
      </div>

      <LicensesCard rows={rows} locale={locale} onManage={setEditing} />

      <EditEntitlementModal
        entitlement={editing}
        onClose={() => setEditing(null)}
        onSaved={state.reload}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LicensesCard({
  rows,
  locale,
  onManage,
}: {
  rows: PlatformEntitlement[];
  locale: Locale;
  onManage: (row: PlatformEntitlement) => void;
}) {
  const t = useT(lizenzenDict);
  const totalMembers = rows.reduce((sum, r) => sum + r.memberCount, 0);

  const columns: Column<PlatformEntitlement>[] = [
    {
      id: "club",
      header: t("colClub"),
      footer: t("clubsCount", { n: rows.length }),
      cell: (row) => (
        <span className="grid min-w-0">
          <span className="truncate text-[14px] font-bold text-ink">{row.clubName}</span>
          {row.shortName && (
            <span className="truncate text-[12px] text-ink-faint">{row.shortName}</span>
          )}
        </span>
      ),
    },
    {
      id: "tier",
      header: t("colTier"),
      cell: (row) =>
        row.tier ? (
          <Badge tone={TIER_TONE[row.tier]}>{t(TIER_LABEL_KEY[row.tier])}</Badge>
        ) : (
          <span className="text-[13px] text-ink-faint">{t("noLicense")}</span>
        ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (row) =>
        row.status ? (
          <Badge tone={STATUS_TONE[row.status]}>{t(STATUS_LABEL_KEY[row.status])}</Badge>
        ) : (
          <span className="text-[13px] text-ink-faint">{t("dash")}</span>
        ),
    },
    {
      id: "validUntil",
      header: t("colValidUntil"),
      cell: (row) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {row.validUntil
            ? formatDateShort(row.validUntil, locale)
            : row.entitlementId
              ? t("unlimited")
              : t("dash")}
        </span>
      ),
    },
    {
      id: "members",
      header: t("colMembers"),
      mono: true,
      footer: t("membersTotal", { n: formatCount(totalMembers, locale) }),
      cell: (row) => formatCount(row.memberCount, locale),
    },
    {
      id: "source",
      header: t("colSource"),
      cell: (row) =>
        row.source ? (
          <Badge tone={SOURCE_TONE[row.source]}>{t(SOURCE_LABEL_KEY[row.source])}</Badge>
        ) : (
          <span className="text-[13px] text-ink-faint">{t("dash")}</span>
        ),
    },
    {
      id: "action",
      header: t("colAction"),
      align: "right",
      cell: (row) => (
        <Button
          size="sm"
          variant={row.entitlementId ? "secondary" : "ghost"}
          icon={row.entitlementId ? "edit" : "plus"}
          onClick={() => onManage(row)}
        >
          {row.entitlementId ? t("actManage") : t("actCreate")}
        </Button>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader eyebrow={t("dirEyebrow")} title={t("tableTitle")} />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.clubId}
        caption={t("tableCaption")}
        empty={<EmptyState icon="members" title={t("emptyTitle")} body={t("emptyBody")} />}
      />
    </Card>
  );
}
