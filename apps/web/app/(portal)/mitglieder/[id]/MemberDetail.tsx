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
  permissions,
  type AssignableRole,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import { useCapabilities } from "@/lib/capabilities";
import type { MemberRole, MemberStatus } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatusPill, type BadgeTone } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Field";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { AboutMeSheet } from "../AboutMeSheet";
import { mitgliederDict, roleKey, type MitgliederKey } from "../i18n";
import { ageYears, canSeeTrainerData, chatHref, ROLE_TONE, softNotImplemented, teamNames } from "../derive";
import { AttendanceCard, DuesCard, FamilyCard } from "./DetailCards";

/**
 * Der Steckbrief. Oben der Mensch (großes Porträt, Name, Rolle, Team), dann
 * das, was die Person SELBST über sich erzählt — und erst danach das, was der
 * Verein über sie verwaltet.
 *
 * ROLLENABHÄNGIG, OHNE LÖCHER: Was jemand nicht sehen darf, wird nicht als
 * gesperrte Zeile gezeigt, sondern gar nicht gebaut. Die API liefert die
 * redigierten Felder ohnehin als null (SENSITIVE_MEMBER_FIELDS) — die Gates
 * hier verhindern nur, dass daraus eine Karte voller „—" wird.
 *
 *   jedes Mitglied  → Porträt, Name, Rolle, Team(s), „Über mich", Nachricht
 *   Trainer & höher → zusätzlich Beitritt und Trainingsbeteiligung
 *   Verwaltung      → zusätzlich Stammdaten (E-Mail/Geburtstag) und Beiträge
 *
 * ⚠️ Kosmetik über der echten Durchsetzung, nicht statt ihr: ein 403 bleibt
 * jederzeit möglich (Rollenwechsel → Toast + Rollback).
 */

/** owner ist nie zuweisbar (Facade-Vertrag) — bleibt nur als Anzeige-Option. */
const ROLE_OPTIONS: AssignableRole[] = ["member", "coach", "guest_coach", "treasurer", "admin"];

const STATUS_KEY: Record<MemberStatus, MitgliederKey> = {
  active: "statusActive",
  pending: "statusPending",
  inactive: "statusInactive",
  rejected: "statusRejected",
};

const STATUS_TONE: Record<MemberStatus, BadgeTone> = {
  active: "success",
  pending: "info",
  inactive: "neutral",
  // "danger" waere zu laut: abgelehnt ist kein Alarm, sondern ein
  // abgeschlossener Vorgang. "warn" trennt ihn sichtbar von "inaktiv" —
  // ein abgelehnter Antrag ist keine ruhende Mitgliedschaft.
  rejected: "warn",
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
      <div className="flex flex-wrap items-center gap-5">
        <Skeleton className="h-24 w-24 rounded-full" />
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
  const { hasCap } = useCapabilities();

  const state = useData(
    (repo) =>
      Promise.all([
        repo.getMemberById(id),
        softNotImplemented(repo.getTeams()),
        repo.getCurrentUser(),
      ] as const),
    [id],
  );

  /**
   * Optimistische Rollen-Anzeige — an die Mitglieds-ID gebunden, damit beim
   * Profilwechsel (Familien-Links) kein alter Override mitwandert.
   */
  const [override, setOverride] = useState<{ id: string; role: MemberRole } | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
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

  const [member, teams, currentUser] = state.data;

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
  const memberTeams = teams === null ? [] : teamNames(member, teams);
  const role = roleOverride ?? member.role;

  const perms = permissions(currentUser);
  const isSelf = member.id === currentUser?.id;

  /**
   * Trainingsbeteiligung ANDERER: zwei Gates, beide müssen halten.
   *
   *  1. canSeeTrainerData — die ausdrückliche Ansage des Nutzers
   *     („das kann Trainer und höher sehen, aber Rest nicht").
   *  2. hasCap("attendance", "read_all") — die Fähigkeit aus
   *     GET /me/capabilities, fail-closed (Ladefehler ⇒ Rang 0 ⇒ nichts).
   *
   * ⚠️ Warum BEIDE: app.role_permissions gibt `member` bis heute
   * attendance = read_all (live nachgemessen, im Mock-Seed identisch). Gate 2
   * allein würde die Beteiligung also weiterhin JEDEM Mitglied zeigen. Gate 1
   * allein würde brechen, sobald jemand die Fähigkeit korrekt herabstuft.
   * Zusammen: heute richtig, später automatisch strenger.
   *
   * Und beides bleibt Kosmetik — die Daten liefert die API einem `member`
   * weiterhin aus, wenn er den Endpoint direkt ruft. Der echte Fix gehört in
   * app.role_permissions (siehe Bericht).
   */
  const seeTrainerData = canSeeTrainerData(perms) && hasCap("attendance", "read_all");
  const canManage = perms.canManageMembers || perms.isPlatformAdmin;
  const canEditRole = perms.canChangeRole(member.role) && !isSelf;
  const about = member.aboutMe?.trim();

  /**
   * PII (E-Mail/Geburtsdatum) spiegelt serverseitig maySeeFullRoster
   * (SENSITIVE_MEMBER_FIELDS): nur Verwaltungs-/Finanz-Rollen — ein coach
   * bekommt die Felder im api-Modus als null.
   *
   * ⚠️ Das Gate ist hier NICHT nur Kosmetik, sondern Mock-Treue: der Mock
   * redigiert NICHT (lib/mock hat alle Geburtsdaten im Klartext). Ohne dieses
   * Gate zeigt die Demo — die der Nutzer anklickt — die Geburtsdaten von
   * Kindern an Rollen, denen die echte API sie verweigert. Der Screen sähe im
   * Mock also freizügiger aus als in Produktion. Das eigene Profil ist
   * ausgenommen: die eigenen Daten darf man immer sehen.
   */
  const showPii = canManage || isSelf;

  /**
   * Stammdaten-Karte NUR bauen, wenn wirklich etwas drin steht. Für ein plain
   * member bliebe sonst eine Karte aus lauter „—", die wie ein Fehler aussieht.
   */
  const hasMaster = showPii && Boolean(member.email || member.birthDate);
  const showMasterCard = hasMaster || canEditRole || (seeTrainerData && member.joinedAt);

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

      {/* DER STECKBRIEF — Mensch, Einordnung und Selbst-Gesagtes in EINER Karte.
          Bewusst nicht als nackter Seitenkopf: Für ein plain member ist das oft
          ALLES, was es zu sehen gibt (kein Beitritt, keine Stammdaten, keine
          Beteiligung). Als Karte ist diese Ansicht dann eine vollständige,
          ruhige Visitenkarte — als Kopfzeile wäre sie eine Überschrift über
          einer leeren Seite. Gleiche Daten, völlig anderer Eindruck. */}
      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <Avatar
            personId={member.id}
            firstName={member.firstName}
            lastName={member.lastName}
            avatarUrl={member.avatarUrl}
            size="2xl"
          />
          <div className="grid min-w-0 flex-1 gap-2">
            <h1 className="font-display text-display tracking-tight text-ink">{name}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill tone={ROLE_TONE[role]}>{t(roleKey(role))}</StatusPill>
              {isSelf && <Badge tone="brand">{t("youBadge")}</Badge>}
              <Badge tone={STATUS_TONE[member.status]}>{t(STATUS_KEY[member.status])}</Badge>
              {member.role === "guest_coach" && member.guestAccessUntil && (
                <Badge tone="warn" icon="clock">
                  {t("guestUntil", { date: formatDateShort(member.guestAccessUntil, locale) })}
                </Badge>
              )}
            </div>
            {/* Teams als Badges; Beitritt NUR Trainer & höher. Sonst steht hier
                schlicht nichts — nie „—", das wäre eine vorgetäuschte Lücke. */}
            {(memberTeams.length > 0 || (seeTrainerData && member.joinedAt)) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {memberTeams.map((team) => (
                  <Badge key={team} tone="neutral">
                    {team}
                  </Badge>
                ))}
                {seeTrainerData && member.joinedAt && (
                  <span className="text-caption text-ink-faint">
                    {t("metaJoined", { date: formatDateShort(member.joinedAt, locale) })}
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Genau EINE Beere-Aktion pro Sichtbereich (DESIGN-SYSTEM §3.1). */}
          <div className="flex flex-none flex-wrap items-center gap-2.5">
            {isSelf ? (
              <Button icon="edit" onClick={() => setAboutOpen(true)}>
                {about ? t("aboutEditCta") : t("aboutAddCta")}
              </Button>
            ) : (
              <ButtonLink href={chatHref(member.id)} aria-label={t("messageAria", { name })}>
                {t("messageCtaLong")}
              </ButtonLink>
            )}
          </div>
        </div>

        {/* „Über mich" — der einzige Text, den die Person selbst schreibt, und
            für ein Mitglied der einzige Inhalt über den Namen hinaus. Fehlt er
            bei Fremden: nichts (kein leeres Versprechen). Bei einem selbst:
            eine Einladung, etwas zu schreiben. */}
        {about ? (
          <div className="mt-5 border-t border-line pt-5">
            <h2 className="eyebrow mb-1.5">
              {isSelf ? t("aboutTitleSelf") : t("aboutTitle", { name: member.firstName })}
            </h2>
            <p className="whitespace-pre-line text-body text-ink">{about}</p>
          </div>
        ) : (
          isSelf && (
            <div className="mt-5 border-t border-line pt-5">
              <h2 className="eyebrow mb-1.5">{t("aboutTitleSelf")}</h2>
              <p className="text-body text-ink-soft">{t("aboutEmptySelf")}</p>
            </div>
          )
        )}
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="grid gap-5">
          {showMasterCard && (
            <Card>
              <CardHeader eyebrow={t("masterEyebrow")} title={t("masterTitle", { name: member.firstName })} />
              <dl className="grid">
                {/* Jede Zeile erscheint NUR mit echtem Wert. Fehlt das Feld,
                    weil die API es redigiert hat, gibt es keine Zeile — und
                    damit auch keinen falschen Eindruck von „nicht gepflegt". */}
                {showPii && member.email && (
                  <DetailRow label={t("lblEmail")}>
                    <span className="truncate">{member.email}</span>
                  </DetailRow>
                )}
                {showPii && member.birthDate && (
                  <DetailRow label={t("lblBirth")}>
                    <span className="tabular-nums">{formatDateShort(member.birthDate, locale)}</span>
                    <span className="text-caption text-ink-faint">
                      {t("ageYears", { age: ageYears(member.birthDate) })}
                    </span>
                  </DetailRow>
                )}
                {seeTrainerData && member.joinedAt && (
                  <DetailRow label={t("lblJoined")}>
                    <span className="tabular-nums">{formatDateShort(member.joinedAt, locale)}</span>
                  </DetailRow>
                )}
                {memberTeams.length > 0 && (
                  <DetailRow label={t("lblTeams")}>
                    {memberTeams.map((team) => (
                      <Badge key={team} tone="neutral">
                        {team}
                      </Badge>
                    ))}
                  </DetailRow>
                )}
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

              {/* Rolle ändern nur, wer es darf — sonst kein toter Select. */}
              {canEditRole && (
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
                    <option value="owner" disabled>
                      {t(roleKey("owner"))}
                    </option>
                  </Select>
                </div>
              )}
            </Card>
          )}

          {/* Familie: Verknüpfungen sind Verwaltungssicht. */}
          {canManage && <FamilyCard memberId={member.id} />}
        </div>

        <div className="grid gap-5">
          {/* Beiträge = Seriositätszone, strikt Finanz-Rollen. */}
          {perms.canManageFinance || perms.isPlatformAdmin ? <DuesCard member={member} /> : null}

          {/* Trainingsbeteiligung: Trainer & höher — bisher sah sie JEDES
              Mitglied (role_permissions attendance=read_all für member).
              Der Nutzer hat das ausdrücklich korrigiert. */}
          {seeTrainerData && <AttendanceCard member={member} />}
        </div>
      </div>

      {isSelf && aboutOpen && (
        <AboutMeSheet
          key={about ?? ""}
          open={aboutOpen}
          initial={about ?? ""}
          onClose={() => setAboutOpen(false)}
          onSaved={state.reload}
        />
      )}
    </div>
  );
}
