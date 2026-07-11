"use client";

import { useMemo, useState } from "react";
import {
  dataSource,
  errorMessage,
  isNotImplemented,
  permissions,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import type { Member, WaitlistEntry } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { KIND_KEY, STATUS_KEY, wartelistenDict } from "./i18n";
import {
  KIND_ICON,
  STATUS_TONE,
  resolveTargetLabel,
  softNotImplemented,
  sortEntries,
  type TargetSources,
} from "./derive";
import { JoinWaitlistDialog } from "./JoinWaitlistDialog";
import { LeaveWaitlistDialog, type LeaveTarget } from "./LeaveWaitlistDialog";
import { WaitlistQueue } from "./WaitlistQueue";

/**
 * Wartelisten-Screen. Zwei Sichten aus EINER (RLS-gescopten) Response:
 *  - „Meine Einträge": jede:r sieht die eigenen Plätze und trägt sich selbst
 *    ein/aus (join/leave).
 *  - „Vereins-Warteschlange": Trainer+ verwalten die ganze Queue und setzen den
 *    Status (Angebot/erfüllt). Die Sicht wird aus der Response abgeleitet —
 *    einem Mitglied liefert die RLS nur die eigenen Einträge, also erscheint die
 *    Warteschlange dort nicht. Alle Rechte gelten serverseitig; ein 403 wird als
 *    Klartext-Toast behandelt.
 *
 * Im mock-Modus ist die Demo-Persona eine Trainerin — damit die Warteschlange
 * erlebbar ist, wird die Trainer-Sicht dort zusätzlich aktiviert.
 */

const NO_MEMBERS: Member[] = [];

export function WartelistenClient() {
  const t = useT(wartelistenDict);
  const { locale } = useLocale();

  const state = useData((repo) =>
    Promise.all([
      repo.listWaitlists(),
      repo.getCurrentUser(),
      repo.getMembers(),
      softNotImplemented(repo.getTeams()),
      softNotImplemented(repo.listFacilities()),
      softNotImplemented(repo.listEquipment()),
      softNotImplemented(repo.getEvents()),
    ] as const),
  );

  const [joinOpen, setJoinOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<LeaveTarget | null>(null);

  const me = state.data?.[1] ?? null;
  const members = state.data?.[2] ?? NO_MEMBERS;
  const sources: TargetSources = useMemo(
    () => ({
      teams: state.data?.[3] ?? null,
      facilities: state.data?.[4] ?? null,
      equipment: state.data?.[5] ?? null,
      events: state.data?.[6] ?? null,
    }),
    [state.data],
  );

  const entries = state.data?.[0] ?? [];
  const perms = permissions(me);
  const isMock = dataSource === "mock";
  const canManage = perms.isTrainer || isMock;
  const myEntries = useMemo(
    () => (me ? sortEntries(entries.filter((e) => e.memberId === me.id)) : []),
    [entries, me],
  );

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
        <Skeleton className="h-9 w-48 rounded-full" />
        <span className="hidden sm:block" />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  } else if (state.status === "error") {
    body = isNotImplemented(state.error) ? (
      <EmptyState icon="sparkle" title={t("notConnectedTitle")} body={t("notConnectedBody")} />
    ) : (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error) || t("loadErrorBody")}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else {
    body = (
      <div className="grid gap-8">
        <section className="grid gap-3">
          <div className="flex items-baseline gap-2.5">
            <h2 className="font-display text-h3 tracking-[-0.01em] text-ink">{t("mineTitle")}</h2>
            {myEntries.length > 0 && (
              <span className="text-caption text-ink-faint">
                {t("mineCount", { n: myEntries.length })}
              </span>
            )}
          </div>
          {myEntries.length === 0 ? (
            <EmptyState
              icon="clock"
              title={t("mineEmptyTitle")}
              body={t("mineEmptyBody")}
              action={
                <Button icon="plus" onClick={() => setJoinOpen(true)}>
                  {t("joinCta")}
                </Button>
              }
            />
          ) : (
            <ul className="grid list-none gap-3 sm:grid-cols-2">
              {myEntries.map((entry) => (
                <MyEntryCard
                  key={entry.id}
                  entry={entry}
                  sources={sources}
                  onLeave={() => setLeaveTarget({ entry, mode: "self" })}
                />
              ))}
            </ul>
          )}
        </section>

        {canManage && (
          <section className="grid gap-3">
            <SectionHeader level={2} title={t("queueTitle")} sub={t("queueSub")} />
            {entries.length === 0 ? (
              <EmptyState
                icon="clock"
                title={t("queueEmptyTitle")}
                body={t("queueEmptyBody")}
              />
            ) : (
              <WaitlistQueue
                entries={entries}
                members={members}
                sources={sources}
                onChanged={state.reload}
                onRemove={setLeaveTarget}
              />
            )}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={t("sub")}
        action={
          state.status === "ready" ? (
            <Button icon="plus" onClick={() => setJoinOpen(true)}>
              {t("joinCta")}
            </Button>
          ) : undefined
        }
      />

      {body}

      {joinOpen && me && (
        <JoinWaitlistDialog
          me={me}
          sources={sources}
          onClose={() => setJoinOpen(false)}
          onJoined={state.reload}
        />
      )}

      <LeaveWaitlistDialog
        target={leaveTarget}
        onClose={() => setLeaveTarget(null)}
        onLeft={state.reload}
      />
    </div>
  );
}

/* ---------- Meine-Einträge-Karte (Selbst-Austrag) ---------- */

function MyEntryCard({
  entry,
  sources,
  onLeave,
}: {
  entry: WaitlistEntry;
  sources: TargetSources;
  onLeave: () => void;
}) {
  const t = useT(wartelistenDict);
  const { locale } = useLocale();
  const label = resolveTargetLabel(entry, sources, locale);
  const targetText = label === null ? t("targetGeneral") : (label ?? t("targetUnknown"));

  return (
    <li className="grid content-start gap-3 rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start gap-2.5">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Badge tone="neutral" icon={KIND_ICON[entry.kind]} className="w-fit">
            {t(KIND_KEY[entry.kind])}
          </Badge>
          <span className="truncate font-display text-[15px] font-bold leading-tight text-ink">
            {targetText}
          </span>
        </div>
        <Badge tone={STATUS_TONE[entry.status]} className="flex-none">
          {t(STATUS_KEY[entry.status])}
        </Badge>
      </div>

      {entry.note && (
        <p className="rounded-lg bg-sunken px-3 py-2 text-caption text-ink-soft">„{entry.note}"</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-ink-faint">
          {t("joinedOn", { date: formatDateShort(entry.createdAt, locale) })}
        </span>
        <Button size="sm" variant="ghost" icon="trash" onClick={onLeave}>
          {t("leaveCta")}
        </Button>
      </div>
    </li>
  );
}
