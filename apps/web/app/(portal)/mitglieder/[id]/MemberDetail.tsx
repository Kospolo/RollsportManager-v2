"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import {
  data,
  dataSource,
  errorMessage,
  fullName,
  isForbidden,
  isNotImplemented,
  type AssignableRole,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { MemberRole, MemberStatus } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatusPill, type BadgeTone } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { mitgliederDict, roleKey, type MitgliederKey } from "../i18n";
import { ageYears, ROLE_TONE, softNotImplemented, teamNames } from "../derive";
import { AttendanceCard, DuesCard, FamilyCard } from "./DetailCards";

/**
 * Mitglieder-Profil: Brotkrumen + Kopf mit Avatar/Rolle, Stammdaten-Karte
 * (inkl. Rolle-ändern-Select über die Facade: optimistisch + Rollback bei
 * Fehler, 403 als Klartext-Toast), Familien-Karte, Beitrags-Historie und
 * Anwesenheits-Quote. Alle Daten laden async über lib/data.
 */

/** owner ist nie zuweisbar (Facade-Vertrag) — bleibt nur als Anzeige-Option. */
const ROLE_OPTIONS: AssignableRole[] = ["member", "coach", "guest_coach", "treasurer", "admin"];

const STATUS_KEY: Record<MemberStatus, MitgliederKey> = {
  active: "statusActive",
  pending: "statusPending",
  inactive: "statusInactive",
};

const STATUS_TONE: Record<MemberStatus, BadgeTone> = {
  active: "success",
  pending: "info",
  inactive: "neutral",
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2 last:border-b-0">
      <dt className="text-[13px] font-semibold text-ink-faint">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-[14px] text-ink">
        {children}
      </dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5" aria-hidden="true">
      <Skeleton className="h-5 w-44" />
      <div className="flex flex-wrap items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="grid gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid gap-5">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={3} />
        </div>
        <div className="grid gap-5">
          <SkeletonCard lines={5} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    </div>
  );
}

export function MemberDetail({ id }: { id: string }) {
  const t = useT(mitgliederDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const state = useData(
    (repo) => Promise.all([repo.getMemberById(id), softNotImplemented(repo.getTeams())] as const),
    [id],
  );

  /**
   * Optimistische Rollen-Anzeige — an die Mitglieds-ID gebunden, damit beim
   * Profilwechsel (Familien-Links) kein alter Override mitwandert.
   * null = Server-Stand des geladenen Mitglieds.
   */
  const [override, setOverride] = useState<{ id: string; role: MemberRole } | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const roleOverride = override !== null && override.id === id ? override.role : null;

  if (state.status === "loading") return <DetailSkeleton />;

  if (state.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        {isNotImplemented(state.error) ? (
          <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
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

  const [member, teams] = state.data;

  if (!member) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        <EmptyState
          icon="members"
          title={t("notFoundTitle")}
          body={t("notFoundBody")}
          ctaHref="/mitglieder"
          ctaLabel={t("notFoundBack")}
        />
      </div>
    );
  }

  const name = fullName(member);
  /** null ⇒ Teams in der aktiven Datenquelle nicht angebunden (Anzeige „—"). */
  const memberTeams = teams === null ? null : teamNames(member, teams);
  const role = roleOverride ?? member.role;

  const changeRole = async (next: MemberRole) => {
    if (next === role || next === "owner" || savingRole) return;
    const previous = role;
    setOverride({ id, role: next }); // optimistisch — UI folgt sofort
    setSavingRole(true);
    try {
      await data.changeMemberRole(member.id, next);
      showToast(
        t(dataSource === "api" ? "roleToastSaved" : "roleToast", { role: t(roleKey(next)) }),
        { tone: "success" },
      );
    } catch (error) {
      // Rollback auf den vorherigen Stand + verständlicher Fehler-Toast (403 = keine Berechtigung).
      setOverride(previous === member.role ? null : { id, role: previous });
      showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void changeRole(next),
      });
    } finally {
      setSavingRole(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      {/* Brotkrumen */}
      <nav aria-label={t("breadcrumb")} className="flex items-center gap-1.5 text-[13px]">
        <Link
          href="/mitglieder"
          className="inline-flex min-h-11 items-center font-semibold text-ink-soft no-underline transition-colors duration-150 hover:text-ink hover:underline"
        >
          {t("backCrumb")}
        </Link>
        <Icon name="chevronRight" className="ic h-3.5 w-3.5 text-ink-faint" />
        <span aria-current="page" className="font-bold text-ink">
          {name}
        </span>
      </nav>

      {/* Kopf: Mensch zuerst */}
      <header className="flex flex-wrap items-center gap-4">
        <Avatar personId={member.id} firstName={member.firstName} lastName={member.lastName} size="l" />
        <div className="grid min-w-0 gap-1.5">
          <h1 className="font-display text-display tracking-tight text-ink">{name}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill tone={ROLE_TONE[role]}>{t(roleKey(role))}</StatusPill>
            <Badge tone={STATUS_TONE[member.status]}>{t(STATUS_KEY[member.status])}</Badge>
            {member.role === "guest_coach" && member.guestAccessUntil && (
              <Badge tone="warn" icon="clock">
                {t("guestUntil", { date: formatDateShort(member.guestAccessUntil, locale) })}
              </Badge>
            )}
            <span className="text-caption text-ink-faint">
              {t("metaJoined", { date: formatDateShort(member.joinedAt, locale) })}
              {" · "}
              {memberTeams === null ? "—" : memberTeams.length > 0 ? memberTeams.join(" · ") : t("noTeam")}
            </span>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Linke Spalte: Stammdaten + Familie */}
        <div className="grid gap-5">
          <Card>
            <CardHeader eyebrow={t("masterEyebrow")} title={t("masterTitle", { name: member.firstName })} />
            <dl className="grid">
              <DetailRow label={t("lblEmail")}>
                {member.email ? (
                  <span className="truncate">{member.email}</span>
                ) : (
                  <span className="text-ink-faint">{t("noEmail")}</span>
                )}
              </DetailRow>
              <DetailRow label={t("lblBirth")}>
                {member.birthDate ? (
                  <>
                    <span className="tabular-nums">{formatDateShort(member.birthDate, locale)}</span>
                    <span className="text-caption text-ink-faint">
                      {t("ageYears", { age: ageYears(member.birthDate) })}
                    </span>
                  </>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </DetailRow>
              <DetailRow label={t("lblJoined")}>
                <span className="tabular-nums">{formatDateShort(member.joinedAt, locale)}</span>
              </DetailRow>
              <DetailRow label={t("lblTeams")}>
                {memberTeams === null ? (
                  <span className="text-ink-faint">—</span>
                ) : memberTeams.length > 0 ? (
                  memberTeams.map((team) => (
                    <Badge key={team} tone="neutral">
                      {team}
                    </Badge>
                  ))
                ) : (
                  <span className="text-ink-faint">{t("noTeam")}</span>
                )}
              </DetailRow>
              <DetailRow label={t("lblStatus")}>
                <Badge tone={STATUS_TONE[member.status]}>{t(STATUS_KEY[member.status])}</Badge>
              </DetailRow>
              {member.role === "guest_coach" && member.guestAccessUntil && (
                <DetailRow label={t("lblAccess")}>
                  <Badge tone="warn" icon="clock">
                    {t("guestUntil", { date: formatDateShort(member.guestAccessUntil, locale) })}
                  </Badge>
                </DetailRow>
              )}
            </dl>

            <div className="mt-5">
              <Select
                label={t("roleSelect")}
                hint={dataSource === "api" ? t("roleHintApi") : t("roleHint")}
                value={role}
                disabled={savingRole}
                onChange={(event) => void changeRole(event.target.value as MemberRole)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(roleKey(option))}
                  </option>
                ))}
                {/* Anzeige-Option: owner kann Bestand sein, ist aber nie zuweisbar. */}
                <option value="owner" disabled>
                  {t(roleKey("owner"))}
                </option>
              </Select>
            </div>
          </Card>

          <FamilyCard memberId={member.id} />
        </div>

        {/* Rechte Spalte: Beiträge + Anwesenheit */}
        <div className="grid gap-5">
          <DuesCard member={member} />
          <AttendanceCard member={member} />
        </div>
      </div>
    </div>
  );
}
