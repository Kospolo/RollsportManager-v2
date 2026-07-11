"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { dataSource, errorMessage, permissions } from "@/lib/data";
import { subscribeAuth } from "@/lib/auth/storage";
import { useData } from "@/lib/data/useData";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import type { PlatformSystemInfo } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { systemDict } from "./i18n";

/**
 * System-Ansicht (Betreiber-Ebene): App-Version, Auth-Modus, Health, DB-
 * Kennzahlen, angewandte Migrationen und Feature-Flags. REIN INFORMATIV/LESEND
 * über die Facade (data.platformSystemInfo → GET /platform/system,
 * data.platformGetSettings → GET /platform/settings), serverseitig hinter
 * requirePlatformAdmin bzw. RLS.
 *
 * Sichtbarkeit im Client anhand permissions().isPlatformAdmin (Token-Claim
 * app_metadata.is_platform_admin) — reine UX, der Server bleibt die alleinige
 * Autorität. Im mock-Modus gibt es keine Dev-Session, dort ist die Ansicht als
 * Demo freigeschaltet. Gleiches Zugriffsmuster wie die Plattform-Übersicht.
 */

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

type Access = "checking" | "granted" | "denied";

/**
 * Zugriff auf die Betreiber-Ebene aus dem Token-Claim ableiten. Externer Store
 * (useSyncExternalStore) statt setState-im-Effect: SSR + Hydration liefern
 * "checking" (Server-Snapshot), der Client entscheidet danach ohne Mismatch —
 * gleiches Muster wie die Plattform-Übersicht, lib/i18n und lib/theme.
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

export function SystemConsoleClient() {
  const t = useT(systemDict);
  const access = useSyncExternalStore(subscribeAuth, readAccess, serverAccess);

  if (access === "checking") {
    return (
      <div className="grid gap-5" aria-busy="true">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={5} />
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

  return <SystemConsole />;
}

/* ------------------------------------------------------------------ */

function SystemConsole() {
  const t = useT(systemDict);
  const { locale } = useLocale();

  const state = useData((repo) =>
    Promise.all([repo.platformSystemInfo(), repo.platformGetSettings()] as const),
  );

  if (state.status === "loading") {
    return (
      <div className="grid gap-5" aria-busy="true">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={5} />
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

  const [info, settings] = state.data;

  return (
    <div className="grid gap-6">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={t("sub")}
        action={dataSource === "mock" ? <Badge tone="warn">{t("demoNote")}</Badge> : undefined}
      />

      <InstanceCard info={info} locale={locale} />
      <DbStatsGrid db={info.db} locale={locale} />
      <MigrationsCard migrations={info.migrations} locale={locale} />
      <FeatureFlagsCard flags={settings.featureFlags} locale={locale} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <dt className="eyebrow">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function InstanceCard({ info, locale }: { info: PlatformSystemInfo; locale: Locale }) {
  const t = useT(systemDict);
  return (
    <Card>
      <CardHeader eyebrow={t("instanceEyebrow")} title={t("instanceTitle")} />
      <dl className="grid gap-5 sm:grid-cols-3">
        <InfoItem label={t("appVersion")}>
          <span className="font-mono text-mono-table tabular-nums text-ink">
            {info.appVersion}
          </span>
        </InfoItem>
        <InfoItem label={t("authMode")}>
          <Badge tone={info.authMode === "prod" ? "success" : "warn"}>
            {info.authMode === "prod" ? t("authProd") : t("authDev")}
          </Badge>
        </InfoItem>
        <InfoItem label={t("health")}>
          <div className="grid gap-1.5">
            <Badge tone="success" icon="check">
              {t("healthOk")}
            </Badge>
            <span className="text-caption text-ink-faint">
              {t("dbTime", { time: formatDateTime(info.health.dbTime, locale) })}
            </span>
          </div>
        </InfoItem>
      </dl>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function DbStatsGrid({ db, locale }: { db: PlatformSystemInfo["db"]; locale: Locale }) {
  const t = useT(systemDict);
  const n = (value: number) => formatCount(value, locale);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiTile label={t("kpiClubs")} value={n(db.clubs)} tone="brand" />
      <KpiTile label={t("kpiUsers")} value={n(db.users)} tone="info" />
      <KpiTile label={t("kpiMembers")} value={n(db.members)} tone="neutral" />
      <KpiTile
        label={t("kpiActiveEnt")}
        value={n(db.activeEntitlements)}
        tone={db.activeEntitlements > 0 ? "success" : "neutral"}
      />
      <KpiTile label={t("kpiWebhooks")} value={n(db.webhookEvents)} tone="info" />
      <KpiTile
        label={t("kpiDbSize")}
        value={db.sizePretty}
        tone="neutral"
        sub={t("dbSizeSub", { bytes: n(db.sizeBytes) })}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

type MigrationRow = { name: string; latest: boolean };

function MigrationsCard({
  migrations,
  locale,
}: {
  migrations: PlatformSystemInfo["migrations"];
  locale: Locale;
}) {
  const t = useT(systemDict);
  const rows: MigrationRow[] = migrations.list.map((name) => ({
    name,
    latest: name === migrations.latest,
  }));

  const columns: Column<MigrationRow>[] = [
    {
      id: "migration",
      header: t("colMigration"),
      footer: t("migCount", { n: formatCount(migrations.count, locale) }),
      cell: (row) => (
        <span className="font-mono text-mono-table tabular-nums text-ink">{row.name}</span>
      ),
    },
    {
      id: "latest",
      header: "",
      align: "right",
      cell: (row) =>
        row.latest ? (
          <Badge tone="success" icon="check">
            {t("badgeLatest")}
          </Badge>
        ) : null,
    },
  ];

  return (
    <Card>
      <CardHeader
        eyebrow={t("migEyebrow")}
        title={t("migTitle")}
        action={
          migrations.latest ? (
            <Badge tone="neutral" icon="clock">
              {t("migLatest")}: {migrations.latest}
            </Badge>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.name}
        caption={t("migCaption")}
        empty={
          <EmptyState
            icon="download"
            title={t("migEmptyTitle")}
            body={t("migEmptyBody")}
          />
        }
      />
    </Card>
  );
}

/* ------------------------------------------------------------------ */

type FlagRow = { key: string; enabled: boolean };

function FeatureFlagsCard({
  flags,
  locale,
}: {
  flags: Record<string, boolean>;
  locale: Locale;
}) {
  const t = useT(systemDict);
  const rows: FlagRow[] = Object.entries(flags)
    .map(([key, enabled]) => ({ key, enabled }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const columns: Column<FlagRow>[] = [
    {
      id: "flag",
      header: t("colFlag"),
      footer: t("flagsCount", { n: formatCount(rows.length, locale) }),
      cell: (row) => (
        <span className="font-mono text-mono-table tabular-nums text-ink">{row.key}</span>
      ),
    },
    {
      id: "state",
      header: t("colState"),
      align: "right",
      cell: (row) => (
        <Badge tone={row.enabled ? "success" : "neutral"}>
          {row.enabled ? t("flagOn") : t("flagOff")}
        </Badge>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader eyebrow={t("flagsEyebrow")} title={t("flagsTitle")} />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        caption={t("flagsCaption")}
        empty={
          <EmptyState
            icon="settings"
            title={t("flagsEmptyTitle")}
            body={t("flagsEmptyBody")}
          />
        }
      />
    </Card>
  );
}
