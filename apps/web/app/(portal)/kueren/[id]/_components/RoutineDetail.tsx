"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Member, Routine, RoutineMarker } from "@/lib/types";
import {
  data,
  errorMessage,
  isForbidden,
  isNotImplemented,
  memberById,
  permissions,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useT } from "@/lib/i18n";
import { formatDurationMs } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Icon } from "@/components/shell/icons";
import { useToast } from "@/components/ui/Toast";
import { kuerenDict, STATUS_TONE, STATUS_KEY, disciplineKey } from "../../i18n";
import { usePlayback } from "./usePlayback";
import { PlayerCard } from "./PlayerCard";
import { MarkerList } from "./MarkerList";
import { ScoreTrend } from "./ScoreTrend";
import { NotesCard } from "./NotesCard";
import { ShareRoutineDialog } from "./ShareRoutineDialog";
import { RoutineMediaCard, RoutineCoverImage } from "./RoutineMediaCard";

/**
 * Kür-Detail (Mockup Screen 2): Kopf mit Läufer:in + Status-Chips,
 * Trainings-Player, darunter Zeitmarken, RollArt-Verlauf und Notizen.
 * Kür + Mitglieder kommen aus der Daten-Facade (useData); Wiedergabe
 * bleibt simuliert und lebt im geladenen Teil, damit Waveform, Transport
 * und Marker-Liste denselben Player steuern.
 */

export function RoutineDetail({ routineId }: { routineId: string }) {
  const t = useT(kuerenDict);
  const state = useData(
    (repo) =>
      Promise.all([
        repo.getRoutineById(routineId),
        repo.getMembers(),
        repo.getCurrentUser(),
      ]),
    [routineId],
  );

  if (state.status === "loading") return <DetailSkeleton />;

  if (state.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-6">
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
      </div>
    );
  }

  const [routine, members, currentUser] = state.data;
  if (!routine) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <EmptyState
          icon="routines"
          title={t("notFoundTitle")}
          body={t("notFoundBody")}
          ctaHref="/kueren"
          ctaLabel={t("notFoundBack")}
        />
      </div>
    );
  }

  /* key: bei Kür-Wechsel Player-/Marker-Zustand sauber neu aufsetzen. */
  return (
    <LoadedDetail
      key={routine.id}
      routine={routine}
      members={members}
      currentUser={currentUser}
      reload={state.reload}
    />
  );
}

/** Lade-Gerüst — spiegelt Breadcrumb, Kopf, Player und die 2-Spalten-Karten. */
function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto grid w-full max-w-6xl gap-6">
      <Skeleton className="h-4 w-48" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-11 w-11 flex-none rounded-full" />
        <div className="grid min-w-0 flex-1 gap-2">
          <Skeleton className="h-7 w-2/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
      <Skeleton className="h-4 w-4/5" />
      <SkeletonCard lines={6} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <div className="grid gap-6">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    </div>
  );
}

function LoadedDetail({
  routine,
  members,
  currentUser,
  reload,
}: {
  routine: Routine;
  members: Member[];
  currentUser: Member;
  reload: () => void;
}) {
  const t = useT(kuerenDict);
  const { showToast } = useToast();
  const playback = usePlayback(routine.music.durationMs);

  /* Kür-Teilen UND Medien-Upload sind Trainer:innen vorbehalten (serverseitig
     is_club_trainer + PRO); im UI ausgeblendet statt 403. */
  const canManage = permissions(currentUser).isTrainer;
  const canShare = canManage;
  const [shareOpen, setShareOpen] = useState(false);

  /* Marker optimistisch: sofort lokal, dann Facade-Write (api: POST). */
  const [markers, setMarkers] = useState<RoutineMarker[]>(routine.markers);
  const sortByTime = (list: RoutineMarker[]) =>
    [...list].sort((a, b) => a.timeMs - b.timeMs);

  const skaters = useMemo(
    () =>
      routine.memberIds
        .map((id) => memberById(members, id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m)),
    [routine.memberIds, members],
  );
  const skaterNames = skaters.map((m) => `${m.firstName} ${m.lastName}`).join(" & ");

  const addMarkerAtPlayhead = async () => {
    const timeMs = Math.round(playback.posMs);
    const tempId = `local-${Date.now()}`;
    const optimistic: RoutineMarker = { id: tempId, timeMs, label: t("newMarkerLabel") };
    setMarkers((current) => sortByTime([...current, optimistic]));
    showToast(t("markerAdded", { time: formatDurationMs(timeMs) }), { tone: "success" });
    try {
      const saved = await data.addRoutineMarker(routine.id, {
        timeMs,
        label: optimistic.label,
      });
      setMarkers((current) => sortByTime(current.map((m) => (m.id === tempId ? saved : m))));
    } catch (error) {
      // Rollback des optimistischen Markers + Fehlerhinweis.
      setMarkers((current) => current.filter((m) => m.id !== tempId));
      showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), {
        tone: "danger",
      });
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      {/* Breadcrumb */}
      <nav
        aria-label={t("breadcrumbLabel")}
        className="flex items-center gap-1.5 text-[13px] font-semibold"
      >
        <Link
          href="/kueren"
          className="rounded-sm text-ink-soft no-underline transition-colors duration-150 hover:text-brand-ink hover:underline"
        >
          {t("pageTitle")}
        </Link>
        <Icon name="chevronRight" className="ic h-3.5 w-3.5 text-ink-faint" />
        <span aria-current="page" className="min-w-0 truncate text-ink">
          {routine.title}
        </span>
      </nav>

      {/* Kopf: Mensch zuerst, dann Kür */}
      <header className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <AvatarStack
            people={skaters.map((m) => ({
              personId: m.id,
              firstName: m.firstName,
              lastName: m.lastName,
            }))}
            size="m"
            label={skaterNames}
            className="flex-none"
          />
          <div className="grid min-w-0 gap-1.5">
            <h1 className="font-display text-display tracking-tight text-ink">{routine.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{routine.category}</Badge>
              <Badge tone="neutral">{t(disciplineKey(routine.memberIds.length))}</Badge>
              <Badge
                tone={STATUS_TONE[routine.status]}
                icon={routine.status === "ready" ? "check" : undefined}
              >
                {t(STATUS_KEY[routine.status])}
              </Badge>
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-none flex-wrap items-center gap-2.5">
          {canShare && (
            <Button variant="secondary" icon="share" onClick={() => setShareOpen(true)}>
              {t("shareAction")}
            </Button>
          )}
          <Button
            variant="ghost"
            icon="download"
            onClick={() => showToast(t("demoUnavailable"), { tone: "info" })}
          >
            {t("exportAction")}
          </Button>
        </div>
      </header>

      {/* Meta-Zeile: Musik · Länge/BPM · Läufer:innen */}
      <p className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px] text-ink-soft">
        <span className="inline-flex min-w-0 items-center gap-2">
          <Icon name="routines" className="ic h-[15px] w-[15px] flex-none text-ink-faint" />
          <span className="truncate">
            {routine.music.title} · {routine.music.artist}
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Icon name="clock" className="ic h-[15px] w-[15px] flex-none text-ink-faint" />
          <span className="tabular-nums">
            {t("metaLength", { dur: formatDurationMs(routine.music.durationMs) })}
            {routine.music.bpm ? ` · ${t("metaBpm", { bpm: routine.music.bpm })}` : ""}
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <Icon name="members" className="ic h-[15px] w-[15px] flex-none text-ink-faint" />
          {skaterNames}
        </span>
      </p>

      {/* Kür-Bild — sichtbar für alle, die die Kür sehen (wenn hinterlegt). */}
      <RoutineCoverImage routine={routine} />

      <PlayerCard routine={routine} playback={playback} />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <MarkerList
          markers={markers}
          loopOn={playback.loopOn}
          loopA={playback.loopA}
          loopB={playback.loopB}
          onJump={playback.playFrom}
          onAdd={addMarkerAtPlayhead}
        />
        <div className="grid gap-6">
          <ScoreTrend routine={routine} />
          {/* Medien-Upload nur für Trainer:innen (ausgeblendet statt 403). */}
          {canManage && <RoutineMediaCard routine={routine} onChanged={reload} />}
          <NotesCard routineId={routine.id} />
        </div>
      </div>

      {canShare && (
        <ShareRoutineDialog
          routineId={routine.id}
          routineTitle={routine.title}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
