"use client";

import { useMemo, useState } from "react";
import { dataSource, errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT, type Locale } from "@/lib/i18n";
import { formatDateShort, formatDurationMs } from "@/lib/format";
import type { PlatformRoutineModeration, PlatformRoutineStatus } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiTile } from "@/components/ui/KpiTile";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { OperatorGate } from "../OperatorGate";
import { ViewClubButton } from "../ViewClubButton";
import {
  moderationDict,
  ROUTINE_STATUS_KEY,
  ROUTINE_STATUS_OPTIONS,
  ROUTINE_STATUS_TONE,
} from "./i18n";

/**
 * KÜREN-MODERATION — der ausdrückliche Grund des Betreibers für den
 * Vollzugriff: „alle Küren sehen können — nicht damit da illegale Sachen
 * gemacht werden“.
 *
 * Eine Liste über ALLE Vereine (GET /platform/routines), Filter nach Verein,
 * Status und Freitext über Titel/Musik/Interpret. Der Server filtert; hier wird
 * nichts nachgerechnet.
 *
 * ### Zwei Dinge, die diese Seite NICHT verspricht ###
 * 1. ANHÖREN. Kür-Audio ist an keiner Route abrufbar (GET /media/{key} löst nur
 *    Galerie/Dokumente/Avatare/Chat auf) — auch nicht für die eigene Trainerin.
 *    Ein Player mit einer toten URL wäre schlimmer als kein Player: er sähe nach
 *    einer erledigten Prüfung aus.
 * 2. MELDEN/SPERREN. Es gibt keinen Endpunkt dafür. Statt einen Knopf zu bauen,
 *    der nichts tut (oder — schlimmer — einen Toast zeigt, als hätte er etwas
 *    getan), führt der Weg über den Vereins-Umschalter in den Verein: dort ist
 *    der Betreiber owner-gleich und kann die Kür wirklich ändern oder löschen.
 * Beides steht als Karte AUF der Seite, nicht nur in diesem Kommentar — der
 * Nutzer soll es lesen, nicht der nächste Entwickler.
 */

const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

function formatCount(value: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

type StatusFilter = "all" | PlatformRoutineStatus;

export function ModerationClient() {
  return (
    <OperatorGate>
      <Moderation />
    </OperatorGate>
  );
}

function Moderation() {
  const t = useT(moderationDict);
  const { locale } = useLocale();

  const [search, setSearch] = useState("");
  const [clubId, setClubId] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  // Küren + Vereine (für das Verein-Auswahlfeld) gemeinsam.
  const state = useData((repo) =>
    Promise.all([repo.platformListRoutines(), repo.platformListClubs()] as const),
  );

  if (state.status === "loading") {
    return (
      <div className="grid gap-5" aria-busy="true">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={8} />
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

  const [routines, clubs] = state.data;
  const filterActive = search.trim() !== "" || clubId !== "all" || status !== "all";

  function clearFilter() {
    setSearch("");
    setClubId("all");
    setStatus("all");
  }

  return (
    <div className="grid gap-6">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={t("sub")}
        action={dataSource === "mock" ? <Badge tone="warn">{t("demoNote")}</Badge> : undefined}
      />

      <StatsGrid routines={routines} locale={locale} />
      <LimitsCard />

      <Card>
        <CardHeader eyebrow={t("tableEyebrow")} title={t("tableTitle")} />
        <FilterBar
          search={search}
          onSearch={setSearch}
          clubId={clubId}
          onClub={setClubId}
          status={status}
          onStatus={setStatus}
          clubs={clubs.map((c) => ({ id: c.id, name: c.name }))}
        />
        <RoutinesTable
          routines={routines}
          search={search}
          clubId={clubId}
          status={status}
          locale={locale}
          filterActive={filterActive}
          onClearFilter={clearFilter}
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Kennzahlen über die GELIEFERTE Menge — bewusst clientseitig gezählt und
 * bewusst harmlos: das sind Auszählungen der Liste, die gerade auf dem Schirm
 * ist, keine Hochrechnung auf einen Bestand, den der Server nie genannt hat.
 * (Bei mehr als 200 Küren kappt der Server; dann zählen sie die Seite.)
 */
function StatsGrid({
  routines,
  locale,
}: {
  routines: PlatformRoutineModeration[];
  locale: Locale;
}) {
  const t = useT(moderationDict);
  const n = (value: number) => formatCount(value, locale);
  const clubCount = new Set(routines.map((r) => r.clubId)).size;
  const withAudio = routines.filter((r) => r.audioAssetId !== undefined).length;
  const inCompetition = routines.filter((r) => r.status === "competition").length;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile label={t("kpiTotal")} value={n(routines.length)} tone="brand" />
      <KpiTile label={t("kpiClubs")} value={n(clubCount)} tone="info" />
      <KpiTile label={t("kpiWithAudio")} value={n(withAudio)} tone="neutral" />
      <KpiTile label={t("kpiCompetition")} value={n(inCompetition)} tone="success" />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Die beiden Grenzen, ungeschönt und dort, wo sie gelesen werden. */
function LimitsCard() {
  const t = useT(moderationDict);
  return (
    <Card>
      <CardHeader eyebrow={t("audioEyebrow")} title={t("audioTitle")} />
      <p className="-mt-1 max-w-prose text-body text-ink-soft">{t("audioBody")}</p>
      <h3 className="mt-5 font-display text-[15px] font-extrabold tracking-[-0.01em] text-ink">
        {t("actionTitle")}
      </h3>
      <p className="mt-1.5 max-w-prose text-body text-ink-soft">{t("actionBody")}</p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function FilterBar({
  search,
  onSearch,
  clubId,
  onClub,
  status,
  onStatus,
  clubs,
}: {
  search: string;
  onSearch: (v: string) => void;
  clubId: string;
  onClub: (v: string) => void;
  status: StatusFilter;
  onStatus: (v: StatusFilter) => void;
  clubs: { id: string; name: string }[];
}) {
  const t = useT(moderationDict);
  return (
    <div
      role="group"
      aria-label={t("filterLabel")}
      className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
    >
      <Input
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        type="search"
      />
      <Select label={t("clubLabel")} value={clubId} onChange={(e) => onClub(e.target.value)}>
        <option value="all">{t("clubAll")}</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select
        label={t("statusLabel")}
        value={status}
        onChange={(e) => onStatus(e.target.value as StatusFilter)}
      >
        <option value="all">{t("statusAll")}</option>
        {ROUTINE_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {t(ROUTINE_STATUS_KEY[s])}
          </option>
        ))}
      </Select>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function RoutinesTable({
  routines,
  search,
  clubId,
  status,
  locale,
  filterActive,
  onClearFilter,
}: {
  routines: PlatformRoutineModeration[];
  search: string;
  clubId: string;
  status: StatusFilter;
  locale: Locale;
  filterActive: boolean;
  onClearFilter: () => void;
}) {
  const t = useT(moderationDict);

  const needle = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      routines.filter((r) => {
        if (clubId !== "all" && r.clubId !== clubId) return false;
        if (status !== "all" && r.status !== status) return false;
        if (needle === "") return true;
        return [r.title, r.musicTitle, r.musicArtist].some((v) =>
          (v ?? "").toLowerCase().includes(needle),
        );
      }),
    [routines, clubId, status, needle],
  );

  const columns: Column<PlatformRoutineModeration>[] = [
    {
      id: "routine",
      header: t("colRoutine"),
      footer: t("routinesCount", { n: rows.length }),
      cell: (r) => (
        <span className="grid min-w-0">
          <span className="truncate text-[14px] font-bold text-ink">{r.title}</span>
          {r.category ? (
            <span className="truncate text-[12px] text-ink-faint">{r.category}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "club",
      header: t("colClub"),
      cell: (r) => <span className="text-[14px] text-ink-soft">{r.clubName}</span>,
    },
    {
      id: "music",
      header: t("colMusic"),
      cell: (r) =>
        r.musicTitle || r.musicArtist ? (
          <span className="grid min-w-0">
            {/* „honey“ ist im Design-System dem Musik-Kontext vorbehalten —
                hier ist er es wörtlich. */}
            <span className="truncate text-[14px] text-ink">{r.musicTitle ?? "—"}</span>
            <span className="truncate text-[12px] text-ink-faint">{r.musicArtist ?? "—"}</span>
          </span>
        ) : (
          <span className="text-[13px] text-ink-faint">{t("noMusic")}</span>
        ),
    },
    {
      id: "audio",
      header: "Audio",
      cell: (r) =>
        r.audioAssetId ? (
          <Badge tone="honey" icon="play">
            {t("hasAudio")}
          </Badge>
        ) : (
          <Badge tone="neutral">{t("noAudio")}</Badge>
        ),
    },
    {
      id: "status",
      header: t("colStatus"),
      cell: (r) => (
        <Badge tone={ROUTINE_STATUS_TONE[r.status]}>{t(ROUTINE_STATUS_KEY[r.status])}</Badge>
      ),
    },
    {
      id: "skaters",
      header: t("colSkaters"),
      mono: true,
      cell: (r) => String(r.skaterCount),
    },
    {
      id: "duration",
      header: t("colDuration"),
      mono: true,
      cell: (r) => (r.musicDurationMs === undefined ? "—" : formatDurationMs(r.musicDurationMs)),
    },
    {
      id: "updated",
      header: t("colUpdated"),
      cell: (r) => (
        <span className="whitespace-nowrap text-[13px] text-ink-soft tabular-nums">
          {formatDateShort(r.updatedAt, locale)}
        </span>
      ),
    },
    {
      id: "action",
      header: t("colAction"),
      align: "right",
      cell: (r) => (
        <span className="flex justify-end">
          {/* Ziel /kueren statt /mitglieder: von hier aus ist die Frage eine
              Kür-Frage. Der Klick schaltet die (protokollierte) Einsicht ein. */}
          <ViewClubButton club={{ id: r.clubId, name: r.clubName }} target="/kueren" />
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      caption={t("tableCaption")}
      empty={
        filterActive ? (
          <EmptyState
            icon="search"
            title={t("noMatch")}
            body={t("noMatchBody")}
            action={<Button onClick={onClearFilter}>{t("clearFilter")}</Button>}
          />
        ) : (
          <EmptyState icon="routines" title={t("tableTitle")} body={t("empty")} />
        )
      }
    />
  );
}
