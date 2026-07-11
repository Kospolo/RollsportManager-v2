"use client";

import { useMemo } from "react";
import type { PublicRoutine, PublicRoutineMarker, PublicRoutineScore } from "@/lib/types";
import { errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort, formatDurationMs } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { publicKuerDict } from "../i18n";

/**
 * Login-freie Kür-Ansicht per Token. Lädt getPublicRoutine(token) über die
 * Facade (öffentlicher Client OHNE Auth) und zeigt NUR unkritische Daten:
 * Titel, Disziplin, Vereinsname, Musik-Meta, Marker und Wertungs-Verlauf —
 * KEINE Namen/Kontakt/Finanzen. Unbekannter/abgelaufener/widerrufener Token =
 * null → sauberer „Link ungültig"-Zustand (kein technischer Fehler).
 */
export function PublicRoutineView({ token }: { token: string }) {
  const t = useT(publicKuerDict);
  const state = useData((repo) => repo.getPublicRoutine(token), [token]);

  if (state.status === "loading") return <ViewSkeleton label={t("loadingLabel")} />;

  if (state.status === "error") {
    return (
      <EmptyState
        icon="zap"
        title={t("errorTitle")}
        body={errorMessage(state.error)}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  }

  /* null = Token unbekannt/abgelaufen/widerrufen — bewusst kein Fehler. */
  if (state.data === null) {
    return <EmptyState icon="link" title={t("notFoundTitle")} body={t("notFoundBody")} />;
  }

  return <LoadedPublicRoutine routine={state.data} />;
}

function ViewSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="grid gap-6">
      <div className="grid gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
      </div>
      <SkeletonCard lines={4} />
      <SkeletonCard lines={5} />
    </div>
  );
}

function LoadedPublicRoutine({ routine }: { routine: PublicRoutine }) {
  const t = useT(publicKuerDict);
  const { locale } = useLocale();

  const hasMusicMeta =
    routine.musicTitle || routine.musicArtist || routine.musicDurationMs || routine.musicBpm;

  return (
    <div className="grid gap-6">
      {/* Kopf */}
      <header className="grid gap-3">
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1 className="font-display text-display tracking-tight text-ink">{routine.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {routine.discipline && <Badge tone="brand">{routine.discipline}</Badge>}
          <Badge tone="neutral" icon="shield">
            {routine.clubName}
          </Badge>
        </div>
      </header>

      {/* Musik */}
      <Card>
        <CardHeader eyebrow={t("musicEyebrow")} title={t("musicTitle")} />
        {hasMusicMeta ? (
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13.5px] text-ink-soft">
            {(routine.musicTitle || routine.musicArtist) && (
              <span className="inline-flex min-w-0 items-center gap-2">
                <Icon name="routines" className="ic h-[15px] w-[15px] flex-none text-ink-faint" />
                <span className="truncate">
                  {[routine.musicTitle, routine.musicArtist].filter(Boolean).join(" · ")}
                </span>
              </span>
            )}
            {routine.musicDurationMs != null && (
              <span className="inline-flex items-center gap-2">
                <Icon name="clock" className="ic h-[15px] w-[15px] flex-none text-ink-faint" />
                <span className="tabular-nums">
                  {t("metaLength", { dur: formatDurationMs(routine.musicDurationMs) })}
                  {routine.musicBpm ? ` · ${t("metaBpm", { bpm: routine.musicBpm })}` : ""}
                </span>
              </span>
            )}
          </p>
        ) : (
          <p className="text-body text-ink-soft">{t("noMusic")}</p>
        )}

        {routine.musicDurationMs != null && routine.musicDurationMs > 0 && (
          <PublicTimeline
            durationMs={routine.musicDurationMs}
            markers={routine.markers}
            ariaLabel={t("timelineAria")}
          />
        )}
      </Card>

      {/* Elemente / Marker */}
      <Card>
        <CardHeader eyebrow={t("timelineEyebrow")} title={t("timelineTitle")} />
        {routine.markers.length === 0 ? (
          <p className="text-body text-ink-soft">{t("markersEmpty")}</p>
        ) : (
          <ul className="grid gap-1.5">
            {routine.markers.map((marker, i) => (
              <MarkerRow key={i} marker={marker} />
            ))}
          </ul>
        )}
      </Card>

      {/* Wertungs-Verlauf */}
      <Card>
        <CardHeader eyebrow={t("scoresEyebrow")} title={t("scoresTitle")} />
        {routine.scores.length === 0 ? (
          <p className="text-body text-ink-soft">{t("scoresEmpty")}</p>
        ) : (
          <ScoresTable scores={routine.scores} locale={locale} />
        )}
      </Card>
    </div>
  );
}

/** Dezente Zeitleiste (dekorativ) mit echten Marker-Pins nach Zeitanteil. */
function PublicTimeline({
  durationMs,
  markers,
  ariaLabel,
}: {
  durationMs: number;
  markers: PublicRoutineMarker[];
  ariaLabel: string;
}) {
  const pins = markers
    .filter((m): m is PublicRoutineMarker & { timeMs: number } => m.timeMs != null)
    .map((m) => ({ left: Math.min(100, Math.max(0, (m.timeMs / durationMs) * 100)), label: m.label }));

  /* Rein dekorative, deterministische Balken — kein echtes Audiosignal. */
  const bars = useMemo(() => {
    const count = 56;
    return Array.from({ length: count }, (_, i) => {
      const v = Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.31 + 1));
      return 0.22 + 0.78 * v;
    });
  }, []);

  return (
    <div role="img" aria-label={ariaLabel} className="relative mt-4 h-16 select-none">
      <div aria-hidden="true" className="flex h-full items-center gap-[3px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-full bg-wave-off"
            style={{ height: `${Math.round(h * 100)}%` }}
          />
        ))}
      </div>
      {pins.map((pin, i) => (
        <span
          key={i}
          title={pin.label}
          className="pointer-events-none absolute -top-1 bottom-0 w-[2.5px] -translate-x-1/2 rounded-full bg-honey-deep"
          style={{ left: `${pin.left}%` }}
        >
          <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full border-2 border-surface bg-honey-deep" />
        </span>
      ))}
    </div>
  );
}

/** Eine Marker-Zeile: Zeit (Mono) + optionales Element-Kürzel + Label. */
function MarkerRow({ marker }: { marker: PublicRoutineMarker }) {
  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-1.5 odd:bg-sunken/60">
      <span className="w-14 flex-none font-mono text-[13px] tabular-nums text-ink-soft">
        {marker.timeMs != null ? formatDurationMs(marker.timeMs) : "—"}
      </span>
      {marker.elementCode && (
        <span className="flex-none rounded-md bg-brand-soft px-2 py-0.5 font-mono text-[12px] font-bold text-brand-ink">
          {marker.elementCode}
        </span>
      )}
      <span className="min-w-0 truncate text-body text-ink">{marker.label}</span>
    </li>
  );
}

/** Wertungs-Tabelle (Datum, Technik, Komponenten, Gesamt, Platz). */
function ScoresTable({
  scores,
  locale,
}: {
  scores: PublicRoutineScore[];
  locale: "de" | "en";
}) {
  const t = useT(publicKuerDict);
  const cell = (value: number | null) =>
    value == null ? "—" : value.toFixed(2).replace(".", locale === "de" ? "," : ".");

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-[13.5px]">
        <thead>
          <tr className="text-left text-caption font-semibold uppercase tracking-wide text-ink-faint">
            <th className="py-2 pr-3 font-semibold">{t("colDate")}</th>
            <th className="py-2 pr-3 text-right font-semibold">{t("colTechnical")}</th>
            <th className="py-2 pr-3 text-right font-semibold">{t("colComponents")}</th>
            <th className="py-2 pr-3 text-right font-semibold">{t("colTotal")}</th>
            <th className="py-2 text-right font-semibold">{t("colPlacement")}</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((score, i) => (
            <tr key={i} className="border-t border-line">
              <td className="py-2 pr-3 text-ink">{formatDateShort(score.scoredOn, locale)}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-ink-soft">
                {cell(score.technicalScore)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-ink-soft">
                {cell(score.componentsScore)}
              </td>
              <td className="py-2 pr-3 text-right font-bold tabular-nums text-ink">
                {cell(score.totalScore)}
              </td>
              <td className="py-2 text-right tabular-nums text-ink">
                {score.placement != null ? `${score.placement}.` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
