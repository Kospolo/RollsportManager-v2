"use client";

import { useRef, useState } from "react";
import { data, errorMessage } from "@/lib/data";
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
      {canEdit && <LogoCard club={club} onChanged={state.reload} />}
      {canEdit ? <VereinForm club={club} /> : <ReadOnlyClub club={club} />}
    </div>
  );
}

/**
 * Vereinslogo hochladen / ersetzen / entfernen (0060). Direkt-Upload ueber die
 * Facade (repo.uploadClubLogo). Nur owner/admin sehen diese Karte; der Server
 * setzt dieselbe Grenze durch (403 sonst). Nach Erfolg wird die Ansicht neu
 * geladen, damit das neue Logo (bzw. der Normalfall Initialen) erscheint.
 */
function LogoCard({ club, onChanged }: { club: Club; onChanged: () => void }) {
  const t = useT(vereinDict);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erlaubt dieselbe Datei erneut zu waehlen
    if (!file) return;
    if (!file.type.toLowerCase().startsWith("image/")) {
      setError(t("logoTypeError"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await data.uploadClubLogo(file);
      onChanged();
    } catch (err) {
      setError(errorMessage(err) || t("logoError"));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    setError(null);
    try {
      await data.removeClubLogo();
      onChanged();
    } catch (err) {
      setError(errorMessage(err) || t("logoError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader eyebrow={t("logoEyebrow")} title={t("logoTitle")} />
      <div className="flex flex-wrap items-center gap-4">
        {club.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={club.logoUrl}
            alt={t("logoAlt")}
            className="h-16 w-16 flex-none rounded-2xl border border-line object-cover"
          />
        ) : (
          <span
            className="grid h-16 w-16 flex-none place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong font-display text-[18px] font-extrabold text-brand-contrast"
            aria-hidden="true"
          >
            {club.shortName?.slice(0, 3) || club.name.slice(0, 2)}
          </span>
        )}
        <div className="grid min-w-0 gap-2">
          <p className="max-w-md text-[13px] leading-snug text-ink-soft">{t("logoHint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPick}
            />
            <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? t("logoBusy") : club.logoUrl ? t("logoReplace") : t("logoUpload")}
            </Button>
            {club.logoUrl && (
              <Button variant="ghost" disabled={busy} onClick={onRemove}>
                {t("logoRemove")}
              </Button>
            )}
          </div>
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>
      </div>
    </Card>
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
