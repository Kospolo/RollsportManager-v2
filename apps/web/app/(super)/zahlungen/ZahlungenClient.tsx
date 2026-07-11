"use client";

import { useState, useSyncExternalStore } from "react";
import { dataSource, errorMessage, permissions, type PlatformPaymentsQuery } from "@/lib/data";
import { subscribeAuth } from "@/lib/auth/storage";
import { useData } from "@/lib/data/useData";
import { useLocale, useT } from "@/lib/i18n";
import type { PlatformPayment } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { zahlungenDict } from "./i18n";
import {
  EventDetail,
  EventsTable,
  Pagination,
  SummaryGrid,
  type ProviderFilter,
  type StatusFilter,
} from "./ZahlungenParts";

/**
 * Betreiber-Ansicht „Zahlungen" ((super)-Ebene): reine Lesesicht auf die
 * Webhook-/Zahlungs-Ereignisse (Stripe/RevenueCat) plus die aggregierten
 * Abo-Zustände. Alles über die Facade (data.platformListPayments →
 * GET /platform/payments, serverseitig hinter requirePlatformAdmin).
 *
 * Sichtbarkeit im Client anhand permissions().isPlatformAdmin (Token-Claim
 * app_metadata.is_platform_admin) — reine UX. Der echte Schutz bleibt
 * serverseitig. Im mock-Modus ist die Ansicht als Demo freigeschaltet.
 */

const PAGE_SIZE = 50;

/* ------------------------------------------------------------------ */
/* Zugriffs-Gate (identisch zur Plattform-Konsole)                     */

type Access = "checking" | "granted" | "denied";

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

export function ZahlungenClient() {
  const t = useT(zahlungenDict);
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

  return <Zahlungen />;
}

/* ------------------------------------------------------------------ */

function Zahlungen() {
  const t = useT(zahlungenDict);
  const { locale } = useLocale();

  const [provider, setProvider] = useState<ProviderFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<PlatformPayment | null>(null);

  const state = useData(
    (repo) =>
      repo.platformListPayments({
        provider: provider === "all" ? undefined : provider,
        status: status === "all" ? undefined : status,
        limit: PAGE_SIZE,
        offset,
      } satisfies PlatformPaymentsQuery),
    [provider, status, offset],
  );

  const onProvider = (value: ProviderFilter) => {
    setProvider(value);
    setOffset(0);
  };
  const onStatus = (value: StatusFilter) => {
    setStatus(value);
    setOffset(0);
  };

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

  const result = state.data;

  const providerOptions: FilterChipOption<ProviderFilter>[] = [
    { value: "all", label: t("filterAll") },
    { value: "stripe", label: t("pStripe") },
    { value: "revenuecat", label: t("pRevenuecat") },
  ];
  const statusOptions: FilterChipOption<StatusFilter>[] = [
    { value: "all", label: t("filterAll") },
    { value: "processed", label: t("stProcessed") },
    { value: "failed", label: t("stFailed") },
    { value: "received", label: t("stReceived") },
    { value: "skipped", label: t("stSkipped") },
  ];

  return (
    <div className="grid gap-6">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={t("sub")}
        action={dataSource === "mock" ? <Badge tone="warn">{t("demoNote")}</Badge> : undefined}
      />

      <SummaryGrid summary={result.subscriptionSummary} locale={locale} />

      <Card>
        <CardHeader eyebrow={t("eventsEyebrow")} title={t("eventsTitle")} />
        <div className="mb-5 grid gap-3">
          <FilterChips
            label={t("providerFilterLabel")}
            options={providerOptions}
            value={provider}
            onChange={onProvider}
          />
          <FilterChips
            label={t("statusFilterLabel")}
            options={statusOptions}
            value={status}
            onChange={onStatus}
          />
        </div>

        <EventsTable rows={result.events} locale={locale} onDetail={setDetail} />
        <Pagination page={result.page} count={result.events.length} onOffset={setOffset} />
      </Card>

      <EventDetail payment={detail} locale={locale} onClose={() => setDetail(null)} />
    </div>
  );
}
