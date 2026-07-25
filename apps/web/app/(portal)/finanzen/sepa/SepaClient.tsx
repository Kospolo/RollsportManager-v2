"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { errorMessage, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT, useLocale } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import type { Member, SepaMandate } from "@/lib/types";
import { Icon } from "@/components/shell/icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FilterChips } from "@/components/ui/FilterChips";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { sepaDict } from "./i18n";
import {
  buildMandateRows,
  countMandates,
  filterMandateRows,
  type MandateRow,
  type StatusFilter,
} from "./derive";
import { MandateSheet } from "./_components/MandateSheet";
import { RevokeModal } from "./_components/RevokeModal";

/**
 * SEPA-Mandate /finanzen/sepa (Seriositätszone) — Liste der Lastschriftmandate
 * über die Facade (lib/data, mock|api). Lädt gemeinsam: aktuelle Person (clubId
 * + Rechte), Mitglieder (Kontoinhaber-Auflösung) und die Mandate.
 *
 * Rechte SERVERSEITIG (RLS): SEPA-Mandate verwalten = can_manage_finance. Hier
 * gaten wir nur die Anzeige; im mock-Modus ist immer sichtbar. DATENSCHUTZ: es
 * werden nur ibanLast4 + Mandatsreferenz geführt — nie die volle IBAN.
 */
export function SepaClient() {
  const t = useT(sepaDict);

  const core = useData(async (repo) => {
    const currentUser = await repo.getCurrentUser();
    const clubId = currentUser.clubId;
    const [members, mandates] = await Promise.all([
      repo.getMembers(),
      repo.listSepaMandates(clubId),
    ]);
    return { currentUser, clubId, members, mandates };
  });

  if (core.status === "loading") return <SepaSkeleton />;

  if (core.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <Breadcrumb label={t("back")} current={t("pageTitle")} />
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(core.error)}
          action={<Button onClick={core.reload}>{t("retry")}</Button>}
        />
      </div>
    );
  }

  const canManageFinance =
    permissions(core.data.currentUser).canManageFinance;

  if (!canManageFinance) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <Breadcrumb label={t("back")} current={t("pageTitle")} />
        <EmptyState
          icon="lock"
          title={t("noAccessTitle")}
          body={t("noAccessBody")}
          ctaHref="/finanzen"
          ctaLabel={t("back")}
        />
      </div>
    );
  }

  return (
    <SepaContent
      clubId={core.data.clubId}
      members={core.data.members}
      mandates={core.data.mandates}
      onChanged={core.reload}
    />
  );
}

/* ------------------------------------------------------------------ */

function SepaContent({
  clubId,
  members,
  mandates,
  onChanged,
}: {
  clubId: string;
  members: Member[];
  mandates: SepaMandate[];
  onChanged: () => void;
}) {
  const t = useT(sepaDict);
  const { locale } = useLocale();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<MandateRow | null>(null);

  const allRows = useMemo(() => buildMandateRows(mandates, members), [mandates, members]);
  const rows = useMemo(() => filterMandateRows(allRows, status), [allRows, status]);
  const counts = useMemo(() => countMandates(mandates), [mandates]);

  const totallyEmpty = mandates.length === 0;

  const columns: Column<MandateRow>[] = [
    {
      id: "member",
      header: t("colMember"),
      cell: (row) =>
        row.memberName ? (
          <span className="font-semibold text-ink">{row.memberName}</span>
        ) : (
          <span className="text-ink-faint">{t("unknownMember")}</span>
        ),
    },
    {
      id: "reference",
      header: t("colReference"),
      cell: (row) => (
        <span className="font-mono text-mono-table tabular-nums text-ink-soft">
          {row.mandate.mandateReference}
        </span>
      ),
    },
    {
      id: "iban",
      header: t("colIban"),
      cell: (row) =>
        row.mandate.ibanLast4 ? (
          <span
            className="font-mono text-mono-table tabular-nums text-ink"
            aria-label={t("ibanMask", { last4: row.mandate.ibanLast4 })}
          >
            <span aria-hidden="true">•••• {row.mandate.ibanLast4}</span>
          </span>
        ) : (
          <span className="text-ink-faint">{t("valueUnknown")}</span>
        ),
    },
    {
      id: "holder",
      header: t("colHolder"),
      cell: (row) => <span className="text-ink">{row.mandate.accountHolder}</span>,
    },
    {
      id: "signed",
      header: t("colSigned"),
      cell: (row) => (
        <span className="whitespace-nowrap text-ink-soft">
          {row.mandate.signedOn ? formatDateShort(row.mandate.signedOn, locale) : t("valueUnknown")}
        </span>
      ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (row) =>
        row.mandate.status === "active" ? (
          <Badge tone="success">{t("badgeActive")}</Badge>
        ) : (
          <Badge tone="neutral">{t("badgeRevoked")}</Badge>
        ),
    },
    {
      id: "action",
      header: <span className="sr-only">{t("colAction")}</span>,
      align: "right",
      cell: (row) =>
        row.mandate.status === "active" ? (
          <Button
            variant="ghost"
            size="sm"
            icon="close"
            onClick={() => setRevokeTarget(row)}
          >
            {t("revokeAction")}
          </Button>
        ) : (
          <span className="text-ink-faint" aria-hidden="true">
            {t("valueUnknown")}
          </span>
        ),
    },
  ];

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Breadcrumb label={t("back")} current={t("pageTitle")} />

      <SectionHeader
        level={1}
        eyebrow={t("pageEyebrow")}
        title={t("pageTitle")}
        sub={t("pageSub", { active: counts.active, revoked: counts.revoked })}
        action={
          <>
            <Button
              variant="ghost"
              icon="download"
              disabled
              title={t("collectorSoon")}
              aria-disabled="true"
            >
              {t("collectorButton")}
            </Button>
            <Button icon="plus" onClick={() => setSheetOpen(true)}>
              {t("addMandate")}
            </Button>
          </>
        }
      />

      {/* Datenschutz-Hinweis: nie die volle IBAN. */}
      <aside className="flex items-start gap-3 rounded-xl border border-line bg-info-soft/40 p-4">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-info-soft text-info">
          <Icon name="shield" className="ic h-4 w-4" />
        </span>
        <div className="grid gap-0.5">
          <span className="eyebrow">{t("privacyEyebrow")}</span>
          <b className="font-display text-[15px] font-bold tracking-[-0.01em] text-ink">
            {t("privacyTitle")}
          </b>
          <span className="text-[13px] leading-snug text-ink-soft">{t("privacyBody")}</span>
        </div>
      </aside>

      {totallyEmpty ? (
        <EmptyState
          icon="bank"
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <Button icon="plus" onClick={() => setSheetOpen(true)}>
              {t("emptyCta")}
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-1.5">
            <span className="text-[13px] font-bold text-ink">{t("filterStatus")}</span>
            <FilterChips<StatusFilter>
              label={t("filterStatus")}
              value={status}
              onChange={setStatus}
              options={[
                { value: "all", label: t("statusAll") },
                { value: "active", label: t("statusActive") },
                { value: "revoked", label: t("statusRevoked") },
              ]}
            />
          </div>

          <Card>
            <DataTable<MandateRow>
              columns={columns}
              rows={rows}
              rowKey={(row) => row.mandate.id}
              caption={t("tableCaption")}
              empty={
                <EmptyState
                  icon="search"
                  title={t("emptyFilterTitle")}
                  body={t("emptyFilterBody")}
                  action={
                    <Button variant="secondary" onClick={() => setStatus("all")}>
                      {t("emptyFilterCta")}
                    </Button>
                  }
                />
              }
            />
            <CardFooter>
              <span>{t("footCount", { n: rows.length })}</span>
              <span>{t("footCollector")}</span>
            </CardFooter>
          </Card>
        </>
      )}

      {sheetOpen && (
        <MandateSheet
          clubId={clubId}
          members={members}
          onClose={() => setSheetOpen(false)}
          onSaved={onChanged}
        />
      )}
      {revokeTarget && (
        <RevokeModal
          mandate={revokeTarget.mandate}
          memberName={revokeTarget.memberName ?? t("unknownMember")}
          onClose={() => setRevokeTarget(null)}
          onRevoked={onChanged}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Brotkrumen zurück zum Finanz-Hub — konsistent mit dem Kassenbuch. */
function Breadcrumb({ label, current }: { label: string; current: string }) {
  return (
    <nav aria-label={label} className="flex items-center gap-1.5 text-[13px]">
      <Link
        href="/finanzen"
        className="inline-flex min-h-11 items-center font-semibold text-ink-soft no-underline transition-colors duration-150 hover:text-ink hover:underline"
      >
        {label}
      </Link>
      <Icon name="chevronRight" className="ic h-3.5 w-3.5 text-ink-faint" />
      <span aria-current="page" className="font-bold text-ink">
        {current}
      </span>
    </nav>
  );
}

/** Lade-Zustand — spiegelt das fertige Layout (Kopf, Hinweis, Filter, Tabelle). */
function SepaSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5" aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-40" />
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-9 w-72" />
      <SkeletonCard lines={7} />
    </div>
  );
}
