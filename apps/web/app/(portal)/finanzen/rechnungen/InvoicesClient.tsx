"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort, formatEUR } from "@/lib/format";
import {
  dataSource,
  errorMessage,
  fullName,
  isForbidden,
  isNotImplemented,
  memberById,
  permissions,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Id, InvoiceDetail, LedgerCategory, Member } from "@/lib/types";
import { Icon } from "@/components/shell/icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { StatusPill, DunningBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { invoicesDict } from "./i18n";
import {
  FILTER_KEY,
  STATUS_FILTERS,
  STATUS_KEY,
  STATUS_TONE,
  sumInvoiceCents,
  type InvoiceStatusFilter,
} from "./derive";
import { CreateInvoiceSheet } from "./_components/CreateInvoiceSheet";
import { InvoiceDetailSheet } from "./_components/InvoiceDetailSheet";

/**
 * Rechnungs-Verwaltung: lädt die eingeloggte Person + Mitglieder über die
 * Facade, gatet die Sichtbarkeit auf can_manage_finance (verbindlich
 * serverseitig via RLS) und übergibt an die eigentliche Liste. NotImplemented
 * / Forbidden / Ladefehler werden als ehrlicher Leerzustand behandelt, nie
 * als Absturz.
 */
export function InvoicesClient() {
  const t = useT(invoicesDict);

  const core = useData(async (repo) => {
    const [currentUser, members] = await Promise.all([
      repo.getCurrentUser(),
      repo.getMembers(),
    ]);
    return { currentUser, members, clubId: currentUser.clubId };
  });

  if (core.status === "loading") return <InvoicesSkeleton />;

  if (core.status === "error") {
    return (
      <Shell>
        {isNotImplemented(core.error) ? (
          <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
        ) : (
          <EmptyState
            icon="zap"
            title={t("loadErrorTitle")}
            body={errorMessage(core.error)}
            action={<Button onClick={core.reload}>{t("retry")}</Button>}
          />
        )}
      </Shell>
    );
  }

  const canManage =
    permissions(core.data.currentUser).canManageFinance || dataSource === "mock";

  if (!canManage) {
    return (
      <Shell>
        <BackLink label={t("backToFinance")} />
        <EmptyState icon="lock" title={t("forbidden")} body={t("forbiddenBody")} />
      </Shell>
    );
  }

  return <InvoicesContent clubId={core.data.clubId} members={core.data.members} />;
}

/* ------------------------------------------------------------------ */

/**
 * Rechnungsliste mit Filter (Status + Mitglied-Suche), Summenzeile aus
 * DENSELBEN Zeilen wie die Anzeige, Detail-Sheet und „Rechnung erstellen".
 * Änderungen (anlegen/bezahlen/stornieren) werden optimistisch als Overlay
 * geführt (created + patched) — kein Neu-Laden, keine Prop-Ableitungsfalle.
 */
function InvoicesContent({ clubId, members }: { clubId: Id; members: Member[] }) {
  const t = useT(invoicesDict);
  const { locale } = useLocale();

  const loaded = useData(
    async (repo) => {
      const [invoices, categories] = await Promise.all([
        repo.listInvoices(clubId),
        repo.listLedgerCategories(clubId),
      ]);
      return { invoices, categories };
    },
    [clubId],
  );

  const [created, setCreated] = useState<InvoiceDetail[]>([]);
  const [patched, setPatched] = useState<Record<Id, InvoiceDetail>>({});
  const [filter, setFilter] = useState<InvoiceStatusFilter>("all");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<Id | null>(null);

  /** Geladene + neu angelegte Rechnungen, überlagert von Status-Änderungen. */
  const allInvoices = useMemo<InvoiceDetail[]>(() => {
    const base = loaded.status === "ready" ? loaded.data.invoices : [];
    return [...created, ...base].map((inv) => patched[inv.id] ?? inv);
  }, [loaded, created, patched]);

  const categories: LedgerCategory[] =
    loaded.status === "ready" ? loaded.data.categories : [];

  /** Anzahl je Status — als Zähler in den Filter-Chips. */
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inv of allInvoices) map[inv.status] = (map[inv.status] ?? 0) + 1;
    return map;
  }, [allInvoices]);

  const normalizedQuery = query.trim().toLowerCase();

  /** Gefilterte + gesuchte Zeilen, neueste zuerst. */
  const rows = useMemo(() => {
    return allInvoices
      .filter((inv) => filter === "all" || inv.status === filter)
      .filter((inv) => {
        if (!normalizedQuery) return true;
        const member = memberById(members, inv.memberId);
        const name = member ? fullName(member).toLowerCase() : "";
        return (
          name.includes(normalizedQuery) ||
          inv.number.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort(
        (a, b) =>
          b.issuedAt.localeCompare(a.issuedAt) || b.number.localeCompare(a.number),
      );
  }, [allInvoices, filter, normalizedQuery, members]);

  const shownSumCents = sumInvoiceCents(rows);
  const selected = selectedId
    ? allInvoices.find((inv) => inv.id === selectedId)
    : undefined;

  const filterOptions: FilterChipOption<InvoiceStatusFilter>[] = STATUS_FILTERS.map(
    (value) => ({
      value,
      label: t(FILTER_KEY[value]),
      count: value === "all" ? allInvoices.length : counts[value] ?? 0,
    }),
  );

  const columns: Column<InvoiceDetail>[] = [
    {
      id: "number",
      header: t("colNumber"),
      mono: true,
      cell: (row) => row.number,
      footer: t("footShown", { shown: rows.length, total: allInvoices.length }),
    },
    {
      id: "member",
      header: t("colMember"),
      cell: (row) => <MemberCell member={memberById(members, row.memberId)} />,
      footer: <span className="font-bold text-ink-soft">{t("footSumLabel")}</span>,
    },
    {
      id: "amount",
      header: t("colAmount"),
      mono: true,
      cell: (row) => formatEUR(row.amountCents, locale),
      footer: formatEUR(shownSumCents, locale),
    },
    {
      id: "due",
      header: t("colDue"),
      cell: (row) => (
        <span className="whitespace-nowrap text-ink-soft">
          {formatDateShort(row.dueAt, locale)}
        </span>
      ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (row) => (
        <StatusPill tone={STATUS_TONE[row.status]}>{t(STATUS_KEY[row.status])}</StatusPill>
      ),
    },
    {
      id: "dunning",
      header: t("colDunning"),
      cell: (row) =>
        row.status === "open" && row.dunningLevel > 0 ? (
          <DunningBadge level={row.dunningLevel} />
        ) : (
          <span className="text-ink-faint">{t("noDunning")}</span>
        ),
    },
    {
      id: "open",
      header: <span className="sr-only">{t("colOpen")}</span>,
      align: "right",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("openInvoice", { number: row.number })}
          onClick={() => setSelectedId(row.id)}
        >
          <Icon name="chevronRight" className="ic h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <Shell>
      <BackLink label={t("backToFinance")} />
      <SectionHeader
        level={1}
        title={t("pageTitle")}
        sub={t("pageSub")}
        action={
          <Button icon="plus" onClick={() => setCreateOpen(true)}>
            {t("createInvoice")}
          </Button>
        }
      />

      <Card>
        <div className="mb-5 grid gap-4">
          <Input
            label={t("searchLabel")}
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full max-w-xs"
          />
          <FilterChips
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            label={t("filterLabel")}
          />
        </div>

        {loaded.status === "loading" ? (
          <SkeletonCard lines={6} />
        ) : loaded.status === "error" ? (
          <LoadError error={loaded.error} onRetry={loaded.reload} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            caption={t("tableCaption")}
            empty={
              <EmptyState
                icon="finance"
                title={t("emptyTitle")}
                body={t("emptyBody")}
                action={
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setFilter("all");
                      setQuery("");
                    }}
                  >
                    {t("emptyReset")}
                  </Button>
                }
              />
            }
          />
        )}
      </Card>

      <CreateInvoiceSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        clubId={clubId}
        members={members}
        onCreated={(invoice) => setCreated((current) => [invoice, ...current])}
      />

      {selected && (
        <InvoiceDetailSheet
          invoice={selected}
          member={memberById(members, selected.memberId)}
          categories={categories}
          clubId={clubId}
          onClose={() => setSelectedId(null)}
          onChanged={(invoice) =>
            setPatched((current) => ({ ...current, [invoice.id]: invoice }))
          }
        />
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */

function MemberCell({ member }: { member: Member | undefined }) {
  const t = useT(invoicesDict);
  if (!member) {
    return <span className="text-ink-soft">{t("unknownMember")}</span>;
  }
  return (
    <span className="flex items-center gap-2.5">
      <Avatar
        personId={member.id}
        firstName={member.firstName}
        lastName={member.lastName}
        size="s"
      />
      <span className="truncate font-semibold text-ink">{fullName(member)}</span>
    </span>
  );
}

/** Fehler beim Nachladen der Tabelle (NotImplemented / Forbidden / generisch). */
function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useT(invoicesDict);
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

function BackLink({ label }: { label: string }) {
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

function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto grid w-full max-w-6xl gap-5">{children}</div>;
}

/** Lade-Zustand des Screens — spiegelt Kopf, Werkzeugleiste und Tabelle. */
function InvoicesSkeleton() {
  return (
    <Shell>
      <Skeleton className="h-4 w-32" />
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Card>
        <Skeleton className="mb-5 h-11 w-full max-w-xs" />
        <SkeletonCard lines={6} />
      </Card>
    </Shell>
  );
}
