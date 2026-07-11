"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { errorMessage, isNotImplemented } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import type { Anniversary } from "@/lib/types";
import { jubilaeenDict } from "../i18n";
import { AnniversaryCard } from "./AnniversaryCard";
import { NextUpBanner } from "./NextUpBanner";
import { monthKey, monthLabel } from "./parts";

type Filter = "all" | "membership" | "birthday";

/**
 * Jubiläen-Screen: lädt die kommenden Vereins-Jubiläen (Geburtstage &
 * Mitgliedschaften der nächsten 365 Tage) über data.getAnniversaries() — reine
 * Lesesicht für alle Mitglieder (Scoping/Recht bleibt serverseitig). Ein
 * festlicher „Als Nächstes"-Hero, Filter-Chips nach Art und die chronologische,
 * nach Monaten gruppierte Liste.
 */
export function JubilaeenScreen() {
  const t = useT(jubilaeenDict);
  const { locale } = useLocale();
  const [filter, setFilter] = useState<Filter>("all");

  const anniversaries = useData((repo) => repo.getAnniversaries());

  const header = (
    <SectionHeader level={1} eyebrow={t("pageEyebrow")} title={t("pageTitle")} sub={t("pageSub")} />
  );
  const shell = (children: ReactNode) => (
    <div className="mx-auto grid w-full max-w-4xl content-start gap-6">
      {header}
      {children}
    </div>
  );

  // 1) Ladezustand → ruhiger Skeleton.
  if (anniversaries.status === "loading") {
    return shell(<LoadingBody />);
  }

  // 2) Fehler → NotImplemented freundlich, sonst Wiederholen.
  if (anniversaries.status === "error") {
    return shell(
      isNotImplemented(anniversaries.error) ? (
        <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
      ) : (
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(anniversaries.error)}
          action={
            <Button variant="secondary" onClick={anniversaries.reload}>
              {t("retry")}
            </Button>
          }
        />
      ),
    );
  }

  const all = anniversaries.data;

  // 3) Gar keine Jubiläen im Horizont → festlicher Leerzustand.
  if (all.length === 0) {
    return shell(<EmptyState icon="sparkle" title={t("emptyTitle")} body={t("emptyBody")} />);
  }

  const counts = {
    all: all.length,
    membership: all.filter((a) => a.kind === "membership").length,
    birthday: all.filter((a) => a.kind === "birthday").length,
  };
  const options: FilterChipOption<Filter>[] = [
    { value: "all", label: t("filterAll"), count: counts.all },
    { value: "membership", label: t("filterMembership"), count: counts.membership },
    { value: "birthday", label: t("filterBirthday"), count: counts.birthday },
  ];

  const filtered = filter === "all" ? all : all.filter((a) => a.kind === filter);

  return shell(
    <>
      {filtered.length > 0 && <NextUpBanner item={filtered[0]} />}

      <FilterChips options={options} value={filter} onChange={setFilter} label={t("filterLabel")} />

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface px-5 py-4 text-[13px] text-ink-faint">
          {t("filterEmpty")}
        </p>
      ) : (
        <MonthGroups items={filtered} locale={locale} />
      )}
    </>,
  );
}

/** Chronologisch nach Monaten gruppieren (Reihenfolge der bereits sortierten Liste bleibt). */
function MonthGroups({ items, locale }: { items: Anniversary[]; locale: Locale }) {
  const groups = useMemo(() => {
    const map = new Map<string, Anniversary[]>();
    for (const item of items) {
      const key = monthKey(item.date);
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="grid gap-6">
      {groups.map(([key, groupItems]) => (
        <section key={key} className="grid gap-2.5">
          <h2 className="eyebrow px-1 text-ink-soft">{monthLabel(groupItems[0].date, locale)}</h2>
          <ul className="grid gap-2.5">
            {groupItems.map((item) => (
              <AnniversaryCard key={`${item.memberId}-${item.kind}-${item.date}`} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Lade-Platzhalter: Hero + Chips-Zeile + einige Karten. */
function LoadingBody() {
  return (
    <div className="grid gap-6">
      <SkeletonCard lines={2} />
      <div className="flex gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>
      <div className="grid gap-2.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
