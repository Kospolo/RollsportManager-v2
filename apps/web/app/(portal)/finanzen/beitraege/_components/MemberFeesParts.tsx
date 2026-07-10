"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort, formatEUR } from "@/lib/format";
import { errorMessage, fullName, isForbidden, isNotImplemented } from "@/lib/data";
import type { Member, MemberFee } from "@/lib/types";
import { Icon } from "@/components/shell/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { memberFeesDict } from "../i18n";
import { PERIOD_LABEL_KEY, PERIOD_SUFFIX_KEY, PERIOD_TONE } from "../derive";

/**
 * Präsentations-Bausteine der Mitgliedsbeiträge-Tabelle (Zellen, Leer-/Fehler-
 * und Ladezustände, Layout-Rahmen). Ausgelagert, damit MemberFeesClient unter
 * der 400-Zeilen-Grenze bleibt. Reine Darstellung — keine Datenlogik.
 */

export function MemberCell({ member }: { member: Member }) {
  const t = useT(memberFeesDict);
  const year = member.joinedAt.slice(0, 4);
  return (
    <span className="flex items-center gap-2.5">
      <Avatar
        personId={member.id}
        firstName={member.firstName}
        lastName={member.lastName}
        size="s"
      />
      <span className="grid min-w-0">
        <span className="truncate font-semibold text-ink">{fullName(member)}</span>
        <span className="text-caption text-ink-faint">{t("memberSince", { year })}</span>
      </span>
    </span>
  );
}

export function CategoryCell({ fee }: { fee?: MemberFee }) {
  const t = useT(memberFeesDict);
  if (!fee) return <span className="text-ink-faint">{t("noCategory")}</span>;
  const period = fee.categoryPeriod ?? "monthly";
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-semibold text-ink">{fee.categoryName ?? t("dash")}</span>
      <Badge tone={PERIOD_TONE[period]}>{t(PERIOD_LABEL_KEY[period])}</Badge>
    </span>
  );
}

export function AmountCell({ fee }: { fee?: MemberFee }) {
  const t = useT(memberFeesDict);
  const { locale } = useLocale();
  if (!fee) return <span className="text-ink-faint">{t("dash")}</span>;
  const period = fee.categoryPeriod ?? "monthly";
  const isCustom = fee.customAmountCents != null;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      {isCustom && (
        <Badge tone="info" className="font-sans">
          {t("customBadge")}
        </Badge>
      )}
      <span>
        {formatEUR(fee.effectiveAmountCents, locale)}
        <span className="text-ink-faint"> {t(PERIOD_SUFFIX_KEY[period])}</span>
      </span>
    </span>
  );
}

export function ValidCell({ fee }: { fee?: MemberFee }) {
  const t = useT(memberFeesDict);
  const { locale } = useLocale();
  if (!fee) return <span className="text-ink-faint">{t("dash")}</span>;
  const from = formatDateShort(`${fee.validFrom}T00:00:00`, locale);
  const label = fee.validUntil
    ? t("validRange", { from, until: formatDateShort(`${fee.validUntil}T00:00:00`, locale) })
    : t("validOpen", { from });
  return <span className="whitespace-nowrap text-ink-soft">{label}</span>;
}

/** Fehler beim Nachladen der Tabelle (NotImplemented / Forbidden / generisch). */
export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useT(memberFeesDict);
  if (isNotImplemented(error)) {
    return <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />;
  }
  if (isForbidden(error)) {
    return <EmptyState icon="lock" title={t("forbidden")} body={t("forbiddenBody")} />;
  }
  return (
    <EmptyState
      icon="zap"
      title={t("loadErrorTitle")}
      body={errorMessage(error)}
      action={<Button onClick={onRetry}>{t("retry")}</Button>}
    />
  );
}

export function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/finanzen"
      className="inline-flex w-fit items-center gap-1.5 text-[13px] font-bold text-ink-soft no-underline transition-colors duration-150 hover:text-ink"
    >
      <Icon name="chevronRight" className="ic h-4 w-4 rotate-180" />
      {label}
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto grid w-full max-w-6xl gap-5">{children}</div>;
}

/** Lade-Zustand des Screens — spiegelt Kopf, KPIs, Werkzeugleiste und Tabelle. */
export function MemberFeesSkeleton() {
  return (
    <Shell>
      <Skeleton className="h-4 w-32" />
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-line bg-surface px-5 py-[18px] shadow-card"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-6 w-32" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <Card>
        <Skeleton className="mb-5 h-11 w-full max-w-xs" />
        <SkeletonCard lines={6} />
      </Card>
    </Shell>
  );
}
