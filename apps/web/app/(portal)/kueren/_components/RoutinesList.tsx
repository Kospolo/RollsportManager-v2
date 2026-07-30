"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ClubEntitlement, Member, Routine, RoutineStatus } from "@/lib/types";
import { errorMessage, isNotImplemented, memberById, permissions } from "@/lib/data";
import { routineLimit, tierName } from "@/lib/entitlement";
import { useData } from "@/lib/data/useData";
import { useLocale, useT } from "@/lib/i18n";
import { formatDurationMs } from "@/lib/format";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { FilterChips, type FilterChipOption } from "@/components/ui/FilterChips";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Icon } from "@/components/shell/icons";
import { useToast } from "@/components/ui/Toast";
import {
  kuerenDict,
  STATUS_TONE,
  STATUS_KEY,
  disciplineKey,
  formatPoints,
  formatPointsDelta,
} from "../i18n";

type StatusFilter = "all" | RoutineStatus;

/** Anzeige-Reihenfolge: aktive Küren zuerst, Archiv ans Ende. */
const STATUS_ORDER: Record<RoutineStatus, number> = {
  competition: 0,
  ready: 1,
  draft: 2,
  archived: 3,
};

/**
 * Kür-Kontingent im Blick: verbraucht / erlaubt je Vereins-Stufe. `max` null =
 * unbegrenzt. `reached` = Kontingent ausgeschöpft (nur bei endlichem max).
 */
type LimitInfo = {
  used: number;
  max: number | null;
  tierLabel: string;
  reached: boolean;
};

/**
 * Kopf (Titel + „Neue Kür") — identisch über Lade-, Fehler- und Datenzustand.
 * Die Liste ist RLS-gescoped: Mitglieder sehen nur ihre EIGENEN Küren, Coaches
 * die ihrer Teams. Anlegen ist is_club_trainer vorbehalten — der „Neue Kür"-
 * Button erscheint deshalb nur für Trainer:innen (canCreate).
 *
 * `limit` (nur wenn vorhanden) zeigt neben dem Button das Kür-Kontingent der
 * Vereins-Stufe und sperrt „Neue Kür", sobald es ausgeschöpft ist — ein
 * Upgrade-Hinweis statt des generischen Demo-Hinweises. Nur Anzeige: die
 * verbindliche Grenze zieht der Server (wie v1 get_user_limits).
 */
function ListShell({
  canCreate,
  limit,
  children,
}: {
  canCreate: boolean;
  limit?: LimitInfo;
  children: ReactNode;
}) {
  const t = useT(kuerenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const counterText =
    limit == null
      ? null
      : limit.max == null
        ? locale === "de"
          ? `${limit.used} Küren · unbegrenzt`
          : `${limit.used} routines · unlimited`
        : `${limit.used} / ${limit.max}`;

  const handleCreate = () => {
    if (limit?.reached && limit.max != null) {
      const kuer =
        locale === "de"
          ? `${limit.max} ${limit.max === 1 ? "Kür" : "Küren"}`
          : `${limit.max} ${limit.max === 1 ? "routine" : "routines"}`;
      showToast(
        locale === "de"
          ? `Kür-Limit erreicht — Stufe ${limit.tierLabel} erlaubt höchstens ${kuer}. Höhere Stufe für mehr.`
          : `Routine limit reached — the ${limit.tierLabel} plan allows at most ${kuer}. Upgrade for more.`,
        { tone: "info" },
      );
      return;
    }
    showToast(t("demoUnavailable"), { tone: "info" });
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <SectionHeader
        level={1}
        title={t("pageTitle")}
        sub={t("pageSub")}
        action={
          canCreate ? (
            <div className="flex items-center gap-2.5">
              {counterText ? (
                <Badge tone={limit?.reached ? "danger" : "neutral"}>{counterText}</Badge>
              ) : null}
              <Button icon="plus" onClick={handleCreate}>
                {t("newRoutine")}
              </Button>
            </div>
          ) : undefined
        }
      />
      {children}
    </div>
  );
}

export function RoutinesList() {
  const t = useT(kuerenDict);
  /* Küren + Mitglieder (Läufer:innen-Avatare) + aktuelle Person gemeinsam laden. */
  const state = useData((repo) =>
    Promise.all([repo.getRoutines(), repo.getMembers(), repo.getCurrentUser()]),
  );
  // Entitlement SEPARAT laden: das Kür-Kontingent ist Beiwerk. Scheitert der
  // Abruf (z. B. api-Modus ohne Endpoint), bleibt die Liste trotzdem stehen —
  // dann nur ohne Zähler. Kein Grund, die ganze Seite zu blockieren.
  const entState = useData((repo) => repo.getClubEntitlement(), []);
  const entitlement = entState.data ?? null;

  // Anlegen = is_club_trainer; im mock-Modus (Demo-Persona Trainerin) sichtbar.
  const isTrainer =
    permissions(state.data?.[2] ?? null).isTrainer;

  if (state.status === "loading") {
    return (
      <ListShell canCreate={isTrainer}>
        <div aria-hidden="true" className="grid gap-5">
          <Skeleton className="h-9 w-full max-w-xl rounded-full" />
          <ul className="grid list-none gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i}>
                <SkeletonCard lines={4} />
              </li>
            ))}
          </ul>
        </div>
      </ListShell>
    );
  }

  if (state.status === "error") {
    return (
      <ListShell canCreate={isTrainer}>
        {isNotImplemented(state.error) ? (
          <EmptyState
            icon="sparkle"
            title={t("notConnectedTitle")}
            body={t("notConnectedBody")}
          />
        ) : (
          <EmptyState
            icon="zap"
            title={t("loadErrorTitle")}
            body={errorMessage(state.error)}
            action={<Button onClick={state.reload}>{t("retry")}</Button>}
          />
        )}
      </ListShell>
    );
  }

  const [routines, members] = state.data;
  return (
    <LoadedList
      routines={routines}
      members={members}
      isTrainer={isTrainer}
      entitlement={entitlement}
    />
  );
}

function LoadedList({
  routines,
  members,
  isTrainer,
  entitlement,
}: {
  routines: Routine[];
  members: Member[];
  isTrainer: boolean;
  entitlement: ClubEntitlement | null;
}) {
  const t = useT(kuerenDict);
  const { locale } = useLocale();
  const [filter, setFilter] = useState<StatusFilter>("all");

  // Kür-Kontingent der Vereins-Stufe (Anzeige; Durchsetzung ist serverseitig).
  // Nur wenn das Entitlement geladen ist — sonst kein Zähler, keine Sperre.
  const max = entitlement ? routineLimit(entitlement.tier) : null;
  const limit: LimitInfo | undefined = entitlement
    ? {
        used: routines.length,
        max,
        tierLabel: tierName(entitlement.tier, locale),
        reached: max != null && routines.length >= max,
      }
    : undefined;

  const sorted = useMemo(
    () => [...routines].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [routines],
  );
  const visible = filter === "all" ? sorted : sorted.filter((r) => r.status === filter);

  const countOf = (status: RoutineStatus) => routines.filter((r) => r.status === status).length;
  const filterOptions: FilterChipOption<StatusFilter>[] = [
    { value: "all", label: t("filterAll"), count: routines.length },
    { value: "competition", label: t("statusCompetition"), count: countOf("competition") },
    { value: "ready", label: t("statusReady"), count: countOf("ready") },
    { value: "draft", label: t("statusDraft"), count: countOf("draft") },
    { value: "archived", label: t("statusArchived"), count: countOf("archived") },
  ];

  // Keine Küren im gescopeten Read: Mitglied hat (noch) keine eigene Kür,
  // Trainer:in hat noch keine angelegt — kein „Filter zurücksetzen" anbieten.
  if (routines.length === 0) {
    return (
      <ListShell canCreate={isTrainer} limit={limit}>
        <EmptyState
          icon="routines"
          title={t("noRoutinesTitle")}
          body={isTrainer ? t("noRoutinesBodyTrainer") : t("noRoutinesBodyMember")}
        />
      </ListShell>
    );
  }

  return (
    <ListShell canCreate={isTrainer} limit={limit}>
      <FilterChips
        options={filterOptions}
        value={filter}
        onChange={setFilter}
        label={t("filterLabel")}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon="routines"
          title={t("listEmptyTitle")}
          body={t("listEmptyBody")}
          action={
            <Button variant="secondary" onClick={() => setFilter("all")}>
              {t("listEmptyCta")}
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((routine) => (
            <RoutineCard key={routine.id} routine={routine} members={members} />
          ))}
        </ul>
      )}
    </ListShell>
  );
}

function RoutineCard({ routine, members }: { routine: Routine; members: Member[] }) {
  const t = useT(kuerenDict);
  const { locale } = useLocale();
  const skaters = routine.memberIds
    .map((id) => memberById(members, id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  const skaterNames = skaters.map((m) => `${m.firstName} ${m.lastName}`).join(" & ");

  const scores = routine.scores;
  const last = scores[scores.length - 1];
  const previous = scores[scores.length - 2];
  const delta = last && previous ? last.total - previous.total : undefined;
  const deltaTone = delta === undefined ? "neutral" : delta > 0 ? "success" : delta < 0 ? "danger" : "neutral";

  return (
    <li className="min-w-0">
      <Link
        href={`/kueren/${routine.id}`}
        aria-label={`${routine.title} — ${skaterNames}`}
        className="group flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5 no-underline shadow-card transition-all duration-150 hover:border-line-strong hover:shadow-pop"
      >
        {/* Läufer:in zuerst (Signatur „Menschen zuerst") + Status */}
        <div className="flex items-center gap-2.5">
          <AvatarStack
            people={skaters.map((m) => ({
              personId: m.id,
              firstName: m.firstName,
              lastName: m.lastName,
            }))}
            size="m"
          />
          <span className="min-w-0 truncate text-[14.5px] font-bold text-ink">{skaterNames}</span>
          <Badge tone={STATUS_TONE[routine.status]} className="ml-auto">
            {t(STATUS_KEY[routine.status])}
          </Badge>
        </div>

        <div className="grid gap-1">
          <h3 className="font-display text-h3 tracking-[-0.01em] text-ink transition-colors duration-150 group-hover:text-brand-ink">
            {routine.title}
          </h3>
          <p className="text-caption text-ink-soft">
            {routine.category} · {t(disciplineKey(routine.memberIds.length))}
          </p>
        </div>

        <p className="flex min-w-0 items-center gap-2 text-caption text-ink-soft">
          <Icon name="routines" className="ic h-[15px] w-[15px] flex-none text-honey-deep" />
          <span className="truncate">
            {routine.music.title} · {routine.music.artist}
          </span>
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
          <span className="inline-flex items-center gap-1.5 text-ink-soft">
            <Icon name="clock" className="ic h-[15px] w-[15px] text-ink-faint" />
            <span className="font-mono text-mono-table tabular-nums">
              {formatDurationMs(routine.music.durationMs)}
            </span>
          </span>
          {last ? (
            <span className="ml-auto inline-flex items-center gap-2">
              <span className="text-caption text-ink-faint">{t("lastScoreLabel")}</span>
              <span className="font-mono text-mono-table tabular-nums text-ink">
                {formatPoints(last.total, locale)}
              </span>
              {delta !== undefined && (
                <Badge tone={deltaTone}>
                  <span className="font-mono tabular-nums">{formatPointsDelta(delta, locale)}</span>
                </Badge>
              )}
            </span>
          ) : (
            <span className="ml-auto text-caption text-ink-faint">{t("noScoreYet")}</span>
          )}
        </div>
      </Link>
    </li>
  );
}
