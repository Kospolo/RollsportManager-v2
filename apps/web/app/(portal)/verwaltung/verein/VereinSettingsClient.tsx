"use client";

import { errorMessage } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Club } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useT } from "@/lib/i18n";
import { vereinDict } from "./i18n";
import { VereinForm } from "./VereinForm";

/**
 * Vereins-Einstellungen (Verwaltung → Verein): lädt Verein + aktuelle Person
 * über die Facade und entscheidet die Sichtbarkeit. owner/admin bekommen das
 * editierbare Formular (VereinForm), alle anderen eine Nur-Ansicht.
 *
 * Client prüft nur zur Anzeige — die Wahrheit ist serverseitig
 * (updateClubSettings = owner/admin, RLS + API-DB-Check).
 */
export function VereinSettingsClient() {
  const t = useT(vereinDict);
  const state = useData((repo) =>
    Promise.all([repo.getClub(), repo.getCurrentUser()] as const),
  );

  if (state.status === "loading") {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-5">
        <Skeleton className="h-9 w-64" />
        <SkeletonCard lines={6} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-5">
        <EmptyState
          icon="zap"
          title={t("loadErrorTitle")}
          body={errorMessage(state.error)}
          action={<Button onClick={state.reload}>{t("retry")}</Button>}
        />
      </div>
    );
  }

  const [club, currentUser] = state.data;
  // updateClubSettings ist owner/admin (Facade); Moderatoren zählen hier NICHT.
  const canEdit = currentUser.role === "owner" || currentUser.role === "admin";

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <SectionHeader level={1} title={t("title")} sub={t("sub")} />
      {canEdit ? <VereinForm club={club} /> : <ReadOnlyClub club={club} />}
    </div>
  );
}

function ReadOnlyClub({ club }: { club: Club }) {
  const t = useT(vereinDict);
  const rows: { label: string; value: string }[] = [
    { label: t("roName"), value: club.name },
    { label: t("roShortName"), value: club.shortName || t("roEmpty") },
    { label: t("roCity"), value: club.city || t("roEmpty") },
    { label: t("roDiscipline"), value: club.discipline || t("roEmpty") },
  ];
  return (
    <div className="grid gap-5">
      <EmptyState icon="lock" title={t("readOnlyTitle")} body={t("readOnlyBody")} />
      <Card>
        <CardHeader eyebrow={t("roEyebrow")} title={t("roTitle")} />
        <dl className="grid">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2 last:border-b-0"
            >
              <dt className="text-[13px] font-semibold text-ink-faint">{row.label}</dt>
              <dd className="text-[14px] text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
