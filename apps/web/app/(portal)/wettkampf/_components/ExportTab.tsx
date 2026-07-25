"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import { data, errorMessage, fullName, isForbidden, permissions } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useLocale, useT } from "@/lib/i18n";
import { dayDiff, formatDate, relativeDays } from "@/lib/format";
import type { Competition } from "@/lib/types";
import type { StarterEntry } from "../derive";
import { wettkampfDict, type WettkampfKey } from "../i18n";

/**
 * Tab „Meldung & Export“ — nur Trainerstab (is_club_trainer).
 *
 * Meldeliste der Starter (Kür verlinkt, Kategorie, Startgeld-Status) mit
 * Meldeschluss-Countdown und echtem Verbandsmeldung-Export
 * (data.federationExportUrl → CSV-Datei-Download via Bearer-fetch, wie die
 * Finanz-Exporte). Dazu die Platzhalter-Karte „Urkunden-Druck“ mit „Bald“.
 *
 * Rechte SERVERSEITIG (RLS + Rollencheck): STRIKT is_club_trainer (Member →
 * 403 auf dem Export). Hier gaten wir nur die Anzeige; im mock-Modus ist alles
 * sichtbar. Ein 403 auf den Export wird als sauberer Toast behandelt.
 */

/** Meldestatus der Verbandsmeldung — aus dem Startgeld-Status abgeleitet. */
type FedStatus = "reported" | "confirmed" | "withdrawn";

const FED_STATUS_KEY: Record<FedStatus, WettkampfKey> = {
  reported: "fedStatusReported",
  confirmed: "fedStatusConfirmed",
  withdrawn: "fedStatusWithdrawn",
};

const FED_STATUS_TONE: Record<FedStatus, BadgeTone> = {
  reported: "info",
  confirmed: "success",
  withdrawn: "neutral",
};

/** Startgeld bezahlt = Meldung bestätigt; sonst gemeldet (Rückzug kommt vom Server). */
function fedStatus(entry: StarterEntry): FedStatus {
  return entry.feeStatus === "paid" ? "confirmed" : "reported";
}

/** Countdown-Ton: überfällig rot, ≤ 3 Tage gelb, sonst neutral. */
function deadlineTone(diff: number): BadgeTone {
  if (diff < 0) return "danger";
  if (diff <= 3) return "warn";
  return "neutral";
}

export function ExportTab({
  competition,
  entries,
  notified,
  onNotified,
}: {
  competition?: Competition;
  entries: StarterEntry[];
  notified: Record<string, boolean>;
  onNotified: (next: Record<string, boolean>) => void;
}) {
  const t = useT(wettkampfDict);
  const core = useData((repo) => repo.getCurrentUser());

  if (core.status === "loading") {
    return (
      <div aria-hidden="true" className="grid gap-6">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  if (core.status === "error") {
    return (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(core.error)}
        action={<Button onClick={core.reload}>{t("retry")}</Button>}
      />
    );
  }

  const isTrainer = permissions(core.data).isTrainer;

  if (!isTrainer) {
    return <EmptyState icon="lock" title={t("fedLockTitle")} body={t("fedLockBody")} />;
  }

  return (
    <ExportTabReady
      competition={competition}
      entries={entries}
      notified={notified}
      onNotified={onNotified}
    />
  );
}

/* ---------- Trainer-Zustand: Meldeliste, Countdown, Export, Urkunden ---------- */

function ExportTabReady({
  competition,
  entries,
  notified,
  onNotified,
}: {
  competition?: Competition;
  entries: StarterEntry[];
  notified: Record<string, boolean>;
  onNotified: (next: Record<string, boolean>) => void;
}) {
  const t = useT(wettkampfDict);
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  /** Verbandsmeldung als CSV holen und als echten Datei-Download auslösen. */
  async function runExport() {
    if (!competition) return;
    setBusy(true);
    try {
      const file = await data.federationExportUrl(competition.id);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast(t("fedExportDone", { file: file.filename }), { tone: "success" });
    } catch (error) {
      showToast(
        isForbidden(error)
          ? t("fedExportForbidden")
          : t("fedExportError", { reason: errorMessage(error) }),
        { tone: "danger" },
      );
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<StarterEntry>[] = [
    {
      id: "skater",
      header: t("colSkater"),
      footer:
        entries.length === 1
          ? t("footerStartersOne")
          : t("footerStartersMany", { n: entries.length }),
      cell: (entry) => (
        <span className="flex items-center gap-2.5">
          <Avatar
            personId={entry.member.id}
            firstName={entry.member.firstName}
            lastName={entry.member.lastName}
            size="m"
          />
          <span className="grid min-w-0 gap-px">
            <b className="font-bold text-ink">{fullName(entry.member)}</b>
            {entry.team && (
              <span className="text-caption text-ink-faint">{entry.team.name}</span>
            )}
          </span>
        </span>
      ),
    },
    {
      id: "category",
      header: t("colCategory"),
      cell: (entry) =>
        entry.routine ? (
          <span className="text-ink-soft">{entry.routine.category}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      id: "routine",
      header: t("colRoutine"),
      cell: (entry) =>
        entry.routine ? (
          <Link href={`/kueren/${entry.routine.id}`} className="text-[14px]">
            {entry.routine.title}
          </Link>
        ) : (
          <span className="text-caption text-ink-faint">{t("noRoutine")}</span>
        ),
    },
    {
      id: "status",
      header: t("fedColStatus"),
      align: "right",
      cell: (entry) => {
        const status = fedStatus(entry);
        return (
          <Badge
            tone={FED_STATUS_TONE[status]}
            icon={status === "confirmed" ? "check" : undefined}
          >
            {t(FED_STATUS_KEY[status])}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="grid gap-6">
      {/* ---------- Verbandsmeldung (Meldeliste + CSV-Export) ---------- */}
      <div className="grid gap-4">
        <SectionHeader
          title={t("fedListTitle")}
          sub={t("fedListSub")}
          action={
            <Button
              icon="download"
              onClick={runExport}
              disabled={busy || !competition || entries.length === 0}
            >
              {busy ? t("fedExporting") : t("fedExport")}
            </Button>
          }
        />

        {competition ? (
          <>
            <DeadlineCountdown deadline={competition.registrationDeadline} />
            <Card padded={false} className="px-2 py-2 sm:px-3">
              <DataTable
                columns={columns}
                rows={entries}
                rowKey={(entry) => entry.member.id}
                caption={t("fedTableCaption", { name: competition.name })}
                empty={
                  <EmptyState
                    icon="competition"
                    title={t("fedEmptyTitle")}
                    body={t("fedEmptyBody")}
                  />
                }
              />
            </Card>
          </>
        ) : (
          <EmptyState
            icon="competition"
            title={t("fedNoCompTitle")}
            body={t("fedNoCompBody")}
          />
        )}
      </div>

      {/* ---------- Urkunden-Druck (Platzhalter „Bald“) ---------- */}
      <div className="grid gap-4">
        <SectionHeader title={t("printTitle")} sub={t("printSub")} />
        <EmptyState
          icon="download"
          title={t("certTitle")}
          body={t("certBody")}
          action={
            <span className="flex flex-col items-center gap-3">
              <Badge tone="info" icon="clock">
                {t("soon")}
              </Badge>
              {notified.certificates ? (
                <Button variant="ghost" icon="check" disabled>
                  {t("notified")}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  icon="bell"
                  onClick={() => {
                    onNotified({ ...notified, certificates: true });
                    showToast(t("notifyToast", { feature: t("certTitle") }), {
                      tone: "success",
                    });
                  }}
                >
                  {t("notify")}
                </Button>
              )}
            </span>
          }
        />
      </div>
    </div>
  );
}

/* ---------- Meldeschluss-Countdown ---------- */

function DeadlineCountdown({ deadline }: { deadline?: string }) {
  const t = useT(wettkampfDict);
  const { locale } = useLocale();

  if (!deadline) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-sunken px-3.5 py-2.5">
        <Icon name="clock" className="ic h-4 w-4 flex-none text-ink-faint" />
        <span className="text-caption text-ink-faint">{t("deadlineNone")}</span>
      </div>
    );
  }

  const diff = dayDiff(deadline);
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-line bg-sunken px-3.5 py-2.5">
      <Icon name="clock" className="ic h-4 w-4 flex-none text-ink-faint" />
      <span className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
        {t("deadlineLabel")}
      </span>
      <span className="text-[14px] font-bold text-ink">{formatDate(deadline, locale)}</span>
      <Badge tone={deadlineTone(diff)}>
        {diff < 0 ? t("deadlinePassed") : relativeDays(deadline, locale)}
      </Badge>
    </div>
  );
}
