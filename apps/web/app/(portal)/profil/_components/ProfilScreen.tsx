"use client";

import { useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import { dataSource, errorMessage, isNotImplemented } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { MyProfile, MyProfileMembership } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { profilDict, roleKey, statusKey } from "../i18n";
import { ROLE_TONE, STATUS_TONE, splitDisplayName } from "../derive";
import { ProfileEditCard } from "./ProfileEditCard";
import { ProfilePhotoCard } from "./ProfilePhotoCard";
import { SelfProfileCard } from "./SelfProfileCard";
import { AccountCard } from "./AccountCard";
import { DeleteAccountCard } from "./DeleteAccountCard";

/**
 * Eigenes Profil (App-Shell-Selbstsicht): Kopf mit Avatar/Name/Rolle/Verein/
 * Beitritt, Bearbeiten-Formular (Vorname/Nachname/E-Mail/Geburtsdatum via
 * updateMyProfile) und ein Konto-Abschnitt. Jede Rolle darf ihr EIGENES Profil
 * bearbeiten — die Durchsetzung (member_id = self) bleibt serverseitig. Bei
 * Plattform-Personas (leere memberships) entfällt das Formular.
 */
export function ProfilScreen() {
  const t = useT(profilDict);

  const core = useData((repo) => repo.getMyProfile());

  const header = (
    <SectionHeader
      level={1}
      eyebrow={t("pageEyebrow")}
      title={t("pageTitle")}
      sub={t("pageSub")}
    />
  );

  if (core.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
        {header}
        {isNotImplemented(core.error) ? (
          <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
        ) : (
          <EmptyState
            icon="zap"
            title={t("loadErrorTitle")}
            body={errorMessage(core.error)}
            action={
              <Button variant="secondary" onClick={core.reload}>
                {t("loadErrorRetry")}
              </Button>
            }
          />
        )}
      </div>
    );
  }

  if (core.status === "loading") {
    return (
      <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
        {header}
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="grid gap-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl content-start gap-6">
      {header}
      <ProfileBody profile={core.data} onSaved={core.reload} />
    </div>
  );
}

function ProfileBody({ profile, onSaved }: { profile: MyProfile; onSaved: () => void }) {
  const t = useT(profilDict);
  const { locale } = useLocale();

  const primary = profile.memberships[0] as MyProfileMembership | undefined;
  const others = profile.memberships.slice(1);

  // Optimistischer Foto-Zustand nach Upload/Entfernen: { url } überschreibt den
  // Serverstand sofort in Kopf und Karte (url=null → Initialen), bis der
  // /me-Reload nachzieht. Der äußere null-Wert bedeutet „keine Überschreibung".
  const [photoOverride, setPhotoOverride] = useState<{ url: string | null } | null>(null);
  const shownAvatarUrl = photoOverride ? photoOverride.url : (primary?.avatarUrl ?? null);

  const name =
    profile.displayName ??
    (primary ? `${primary.firstName} ${primary.lastName}`.trim() : "—");
  const avatarName = primary
    ? { firstName: primary.firstName, lastName: primary.lastName }
    : splitDisplayName(name);
  const avatarId = primary?.id ?? profile.profileId;
  const accountEmail = primary?.email;

  return (
    <>
      {/* Kopf: Mensch zuerst */}
      <header className="flex flex-wrap items-center gap-4">
        <Avatar
          personId={avatarId}
          firstName={avatarName.firstName}
          lastName={avatarName.lastName}
          avatarUrl={shownAvatarUrl}
          size="l"
        />
        <div className="grid min-w-0 gap-1.5">
          <h2 className="font-display text-h1 tracking-tight text-ink">{name}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            {primary ? (
              <>
                <StatusPill tone={ROLE_TONE[primary.role]}>{t(roleKey(primary.role))}</StatusPill>
                <Badge tone={STATUS_TONE[primary.status]}>{t(statusKey(primary.status))}</Badge>
                {primary.role === "guest_coach" && primary.validUntil && (
                  <Badge tone="warn" icon="clock">
                    {t("guestUntil", { date: formatDateShort(primary.validUntil, locale) })}
                  </Badge>
                )}
                <span className="text-caption text-ink-faint">
                  {primary.clubName}
                  {primary.joinedOn
                    ? ` · ${t("joinedMeta", { date: formatDateShort(primary.joinedOn, locale) })}`
                    : ""}
                </span>
              </>
            ) : (
              <Badge tone="neutral" icon="globe">
                {t("platformBadge")}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Links: Profilfoto + Bearbeiten (oder Hinweis ohne Mitgliedschaft) */}
        <div className="grid gap-5">
          {primary && (
            <ProfilePhotoCard
              membership={primary}
              currentUrl={shownAvatarUrl}
              onUploaded={(url) => {
                setPhotoOverride({ url });
                onSaved();
              }}
              onRemoved={() => {
                setPhotoOverride({ url: null });
                onSaved();
              }}
            />
          )}
          {primary ? (
            <>
              <ProfileEditCard
                key={`${primary.id}:${primary.updatedAt}`}
                membership={primary}
                onSaved={onSaved}
              />
              {/* Selbst gepflegtes Profil (freiwillig) — lädt/schreibt eigenständig
                  über die Facade (app.set_self_profile). Nur mit Mitgliedschaft. */}
              <SelfProfileCard />
            </>
          ) : (
            <EmptyState
              icon="user"
              title={t("noMembershipTitle")}
              body={t("noMembershipBody")}
            />
          )}
          {others.length > 0 && <OtherMembershipsCard memberships={others} />}
        </div>

        {/* Rechts: Konto */}
        <div className="grid gap-5">
          <AccountCard email={accountEmail} />
          {/* Konto-Löschung nur im api-Modus (echter Login). In der öffentlichen
              Mock-Beta gibt es kein echtes Konto — die Karte entfällt dort. */}
          {dataSource === "api" && <DeleteAccountCard />}
        </div>
      </div>
    </>
  );
}

/** Weitere Vereins-Mitgliedschaften (nur bei Personen in mehreren Vereinen). */
function OtherMembershipsCard({ memberships }: { memberships: MyProfileMembership[] }) {
  const t = useT(profilDict);
  const { locale } = useLocale();

  return (
    <Card>
      <CardHeader eyebrow={t("otherEyebrow")} title={t("otherTitle")} />
      <ul className="grid list-none gap-2">
        {memberships.map((membership) => (
          <li
            key={membership.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line py-2 last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">
              {membership.clubName}
            </span>
            <StatusPill tone={ROLE_TONE[membership.role]}>{t(roleKey(membership.role))}</StatusPill>
            <Badge tone={STATUS_TONE[membership.status]}>{t(statusKey(membership.status))}</Badge>
            {membership.joinedOn && (
              <span className="text-caption text-ink-faint">
                {t("joinedMeta", { date: formatDateShort(membership.joinedOn, locale) })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
