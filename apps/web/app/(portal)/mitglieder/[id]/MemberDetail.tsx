"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import { fullName, memberById } from "@/lib/mock";
import type { MemberRole, MemberStatus } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatusPill, type BadgeTone } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/shell/icons";
import { mitgliederDict, roleKey, type MitgliederKey } from "../i18n";
import { ageYears, ROLE_TONE, teamNames } from "../derive";
import { AttendanceCard, DuesCard, FamilyCard } from "./DetailCards";

/**
 * Mitglieder-Profil: Brotkrumen + Kopf mit Avatar/Rolle, Stammdaten-Karte
 * (inkl. Rolle-ändern-Select, lokal + Toast), Familien-Karte,
 * Beitrags-Historie und Anwesenheits-Quote.
 */

const ROLE_OPTIONS: MemberRole[] = ["member", "coach", "guest_coach", "treasurer", "admin", "owner"];

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

export function MemberDetail({ id }: { id: string }) {
  const t = useT(mitgliederDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const member = memberById(id);
  const [role, setRole] = useState<MemberRole>(member?.role ?? "member");

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
  const teams = teamNames(member);

  const changeRole = (next: MemberRole) => {
    setRole(next);
    showToast(t("roleToast", { role: t(roleKey(next)) }), { tone: "success" });
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
              {teams.length > 0 ? teams.join(" · ") : t("noTeam")}
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
                {teams.length > 0 ? (
                  teams.map((team) => (
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
                hint={t("roleHint")}
                value={role}
                onChange={(event) => changeRole(event.target.value as MemberRole)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(roleKey(option))}
                  </option>
                ))}
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
