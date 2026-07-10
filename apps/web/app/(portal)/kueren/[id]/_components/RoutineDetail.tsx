"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RoutineMarker } from "@/lib/types";
import { routineById, memberById } from "@/lib/mock";
import { useT } from "@/lib/i18n";
import { formatDurationMs } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Icon } from "@/components/shell/icons";
import { useToast } from "@/components/ui/Toast";
import { kuerenDict, STATUS_TONE, STATUS_KEY, disciplineKey } from "../../i18n";
import { usePlayback } from "./usePlayback";
import { PlayerCard } from "./PlayerCard";
import { MarkerList } from "./MarkerList";
import { ScoreTrend } from "./ScoreTrend";
import { NotesCard } from "./NotesCard";

/**
 * Kür-Detail (Mockup Screen 2): Kopf mit Läufer:in + Status-Chips,
 * Trainings-Player, darunter Zeitmarken, RollArt-Verlauf und Notizen.
 * Wiedergabe-Zustand lebt hier, damit Waveform, Transport und
 * Marker-Liste denselben Player steuern.
 */

export function RoutineDetail({ routineId }: { routineId: string }) {
  const t = useT(kuerenDict);
  const { showToast } = useToast();

  /* Die Seite (Server) garantiert die Existenz — Mock ist statisch. */
  const routine = routineById(routineId)!;
  const playback = usePlayback(routine.music.durationMs);

  /* Marker lokal editierbar (optimistisch, ohne Backend). */
  const [markers, setMarkers] = useState<RoutineMarker[]>(routine.markers);

  const skaters = useMemo(
    () =>
      routine.memberIds
        .map((id) => memberById(id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m)),
    [routine.memberIds],
  );
  const skaterNames = skaters.map((m) => `${m.firstName} ${m.lastName}`).join(" & ");

  const addMarkerAtPlayhead = () => {
    const timeMs = Math.round(playback.posMs);
    const marker: RoutineMarker = {
      id: `local-${Date.now()}`,
      timeMs,
      label: t("newMarkerLabel"),
    };
    setMarkers((current) => [...current, marker].sort((a, b) => a.timeMs - b.timeMs));
    showToast(t("markerAdded", { time: formatDurationMs(timeMs) }), { tone: "success" });
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
          <Button
            variant="secondary"
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
          <NotesCard routineId={routine.id} />
        </div>
      </div>
    </div>
  );
}
