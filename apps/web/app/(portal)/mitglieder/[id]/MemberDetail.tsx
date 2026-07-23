"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n";
import { formatDateShort } from "@/lib/format";
import {
  ApiError,
  data,
  dataSource,
  errorMessage,
  fullName,
  isForbidden,
  permissions,
  type AssignableRole,
} from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { MemberCoachNote, MemberProfile } from "@/lib/api/generated";
import type { Member, MemberRole, MemberStatus, Sparte, Team } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatusPill, type BadgeTone } from "@/components/ui/Badge";
import { PortraitTile } from "@/components/ui/PortraitTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Select } from "@/components/ui/Field";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { AboutMeSheet } from "../AboutMeSheet";
import { AssessmentSheet } from "./AssessmentSheet";
import { CoachNoteSheet } from "./CoachNoteSheet";
import { MemberSpartenCard } from "./MemberSpartenCard";
import { MemberSpartenSheet } from "./MemberSpartenSheet";
import { FamilyCard } from "./DetailCards";
import { mitgliederDict, roleKey, type MitgliederKey } from "../i18n";
import { profileDict } from "./profile-i18n";
import { ageYears, chatHref, ROLE_TONE, softNotImplemented, teamNames } from "../derive";
import {
  AssessmentCard,
  AttendanceCard,
  CheckinCard,
  CoachNotesCard,
  ConsentCard,
  DepartmentsCard,
  DutyCard,
  EquipmentCard,
  FinanceCard,
  GalleryCard,
  MedalCard,
  RolesCard,
  RoutinesCard,
  RsvpCard,
  ScoreCard,
} from "./ProfileSections";

/**
 * Die 360-Grad-Detailseite EINER Person — gespeist AUSSCHLIESSLICH aus dem
 * Aggregat-Endpunkt (getMemberProfile → GET .../members/{id}/profile).
 *
 * DIE HARTE REGEL: Der Server staffelt jede Sektion selbst. Kommt sie als null,
 * darf der/die Betrachter:in sie nicht sehen — dann wird sie GAR NICHT gebaut
 * (kein „—", kein „gesperrt", kein leerer Kasten). Eine erlaubte, aber leere
 * Sektion ([]) rendert ihre Karte gar nicht erst (die Karten self-guarden).
 * Die Gruppen-Überschriften erscheinen nur, wenn die Gruppe Inhalt trägt.
 */

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
  rejected: "warn",
};

function aboutMeOf(member: MemberProfile["member"]): string | null {
  return (member as { about_me?: string | null }).about_me ?? null;
}

function isNotFound(error: unknown): boolean {
  if (error instanceof ApiError) return error.status === 404;
  return error instanceof Error && /nicht gefunden|not found/i.test(error.message);
}

/** Dekorativer Ausweis-Code (kein echter QR — nur die „Vereinsausweis"-Andeutung). */
function PassCode() {
  const cells = Array.from({ length: 49 }, (_, i) => (i * 7 + ((i * i) % 5)) % 3 === 0);
  return (
    <span aria-hidden="true" className="grid grid-cols-7 gap-[3px] rounded-md bg-surface p-2 shadow-card">
      {cells.map((on, i) => (
        <span key={i} className={`h-[7px] w-[7px] rounded-[1px] ${on ? "bg-ink" : "bg-line"}`} />
      ))}
    </span>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5" aria-hidden="true">
      <Skeleton className="h-5 w-44" />
      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <Skeleton className="h-32 w-28 rounded-xl" />
          <div className="grid gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
      </Card>
      <div className="grid items-start gap-5 md:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={5} />
      </div>
    </div>
  );
}

/**
 * Darf die Betrachterin die INTERNEN Trainer-Notizen (0069) dieser Person
 * ueberhaupt sehen/schreiben?
 *
 * ⚠️ Das ist KOSMETIK. Die Wahrheit steht in app.can_read_coach_note /
 * app.can_write_coach_note (RLS) — hier wird bewusst KEIN zweites Regelwerk
 * nachgebaut, das spaeter von der echten Regel auseinanderlaeuft. Abgebildet
 * ist nur der grobe Schnitt "Leitung oder Trainer:in DIESER Person, und nicht
 * ueber mich selbst", damit nicht jedem Mitglied ein leerer Kasten erscheint.
 *
 * Der ELTERN-Fall (auch: die Trainerin ist die Mutter des Kindes) wird hier
 * NICHT geprueft — die Guardianships liegen auf dieser Seite nicht vor. Der
 * Server liefert dann eine leere Liste bzw. ein 403. Das ist die richtige
 * Reihenfolge: lieber ein Knopf zu viel als eine Regel zu viel.
 *
 * Nimmt den noch nicht ausgepackten useData-Zustand, weil der Aufruf oberhalb
 * der early returns stehen muss (Rules of Hooks).
 */
function coachNotesAllowed(
  profile: MemberProfile | null,
  teams: Team[] | null,
  currentUser: Member | null | undefined,
): boolean {
  if (!profile || !currentUser) return false;
  if (profile.member.id === currentUser.id) return false;
  if (permissions(currentUser).isClubAdmin) return true;
  return (teams ?? []).some(
    (tm) => tm.coachIds.includes(currentUser.id) && profile.member.team_ids.includes(tm.id),
  );
}

/**
 * Laedt die internen Notizen ueber EINEN eigenen Endpunkt — bewusst nicht ueber
 * das Profil-Aggregat, das die Familie fuer ihr Kind oeffnet.
 * null = nicht geladen bzw. nicht erlaubt (Sektion wird dann gar nicht gebaut).
 */
function useCoachNotes(memberId: string, enabled: boolean) {
  const [fetched, setFetched] = useState<MemberCoachNote[] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // Abbruchmarke: beim Wechsel auf ein anderes Mitglied darf die Antwort der
    // ALTEN Anfrage nicht mehr in den Zustand der neuen Seite laufen — sonst
    // stuenden die internen Notizen des vorigen Kindes am neuen Profil.
    let cancelled = false;
    void (async () => {
      try {
        const rows = await data.listMemberCoachNotes(memberId);
        if (!cancelled) setFetched(rows);
      } catch {
        if (!cancelled) setFetched([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, memberId]);

  // Abgeleitet statt im Effekt zurueckgesetzt: wer nicht darf, sieht null,
  // ohne dass ein Effekt dafuer synchron Zustand schreiben muss.
  const notes = enabled ? fetched : null;

  // Nachladen nach dem Speichern. Ohne Abbruchmarke: dieser Aufruf haengt an
  // einer Nutzeraktion, nicht am Lebenszyklus der Seite.
  const reload = useCallback(async () => {
    try {
      setFetched(await data.listMemberCoachNotes(memberId));
    } catch {
      setFetched([]);
    }
  }, [memberId]);

  return { notes, reload };
}

export function MemberDetail({ id }: { id: string }) {
  const t = useT(mitgliederDict);
  const tp = useT(profileDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const state = useData(
    (repo) =>
      Promise.all([
        repo.getMemberProfile(id),
        softNotImplemented(repo.getTeams()),
        repo.getCurrentUser(),
        softNotImplemented(repo.getMembers()),
        softNotImplemented(repo.getSparten()),
      ] as const),
    [id],
  );

  const [override, setOverride] = useState<{ id: string; role: MemberRole } | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [assessOpen, setAssessOpen] = useState(false);
  const [spartenOpen, setSpartenOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  // INTERNE Trainer-Notizen (0069). Der Hook steht hier OBEN und
  // UNBEDINGT — unterhalb der early returns (loading/error) waere er ein
  // Verstoss gegen die Rules of Hooks: die Aufrufreihenfolge muss in jedem
  // Render dieselbe sein. Deshalb wird das Recht aus dem noch nicht
  // ausgepackten state abgeleitet (coachNotesAllowed), nicht aus den weiter
  // unten berechneten Variablen.
  const ready = state.status === "ready" ? state.data : null;
  const mayHandleCoachNotes = coachNotesAllowed(
    ready ? ready[0] : null,
    ready ? ready[1] : null,
    ready ? ready[2] : null,
  );
  const { notes: coachNotes, reload: reloadCoachNotes } = useCoachNotes(id, mayHandleCoachNotes);

  const roleOverride = override !== null && override.id === id ? override.role : null;

  if (state.status === "loading") return <DetailSkeleton />;

  if (state.status === "error") {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-5">
        {isNotFound(state.error) ? (
          <EmptyState
            icon="members"
            title={t("notFoundTitle")}
            body={t("notFoundBody")}
            ctaHref="/mitglieder"
            ctaLabel={t("notFoundBack")}
          />
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

  const [profile, teams, currentUser, roster, sparten] = state.data;
  const member = profile.member;
  const viewMember: Member = {
    id: member.id,
    clubId: member.club_id,
    firstName: member.first_name,
    lastName: member.last_name,
    role: member.role as MemberRole,
    status: member.status as MemberStatus,
    teamIds: member.team_ids,
    joinedAt: member.joined_on ?? "",
    email: member.email ?? undefined,
    birthDate: member.birth_date ?? undefined,
    avatarUrl: member.avatar_url ?? undefined,
  };
  const name = fullName(viewMember);
  const role = roleOverride ?? (member.role as MemberRole);
  const memberTeams = teams === null ? [] : teamNames(viewMember, teams);
  const isSelf = member.id === currentUser?.id;
  const perms = permissions(currentUser);
  const canEditRole = perms.canChangeRole(member.role as MemberRole) && !isSelf;
  const about = aboutMeOf(member)?.trim();

  // Name eines/r Beurteilungs-Autor:in aus dem Roster (Fallback: Rolle „Trainer").
  const authorName = (mid: string): string => {
    const hit = roster?.find((m) => m.id === mid);
    return hit ? fullName(hit) : t("roleCoach");
  };

  // Beurteilung schreiben darf, wer Team-Trainer:in der Person ODER Vorstand ist
  // (Kosmetik — der Server erzwingt es endgültig).
  const coachesMember =
    currentUser != null &&
    (teams ?? []).some((tm) => tm.coachIds.includes(currentUser.id) && member.team_ids.includes(tm.id));
  const canWriteAssessment =
    profile.assessments !== null && (perms.isClubAdmin || coachesMember);

  const changeRole = async (next: MemberRole) => {
    if (next === role || next === "owner" || savingRole) return;
    const previous = role;
    setOverride({ id, role: next });
    setSavingRole(true);
    try {
      await data.changeMemberRole(member.id, next);
      showToast(
        t(dataSource === "api" ? "roleToastSaved" : "roleToast", { role: t(roleKey(next)) }),
        { tone: "success" },
      );
    } catch (error) {
      setOverride(previous === (member.role as MemberRole) ? null : { id, role: previous });
      showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void changeRole(next),
      });
    } finally {
      setSavingRole(false);
    }
  };

  /* --------------- Was trägt Inhalt? (Gruppen-Überschriften nur mit Inhalt) --------------- */
  const P = profile;
  const hasRoutines = (P.routines?.length ?? 0) > 0;
  const comp = P.competition;
  const hasScores = !!comp && (comp.scores.some((s) => s.total_score != null) || comp.entries.length > 0);
  const hasMedals = (P.achievements?.length ?? 0) > 0;
  const perfAny = hasRoutines || hasScores || hasMedals;

  const hasAssess = P.assessments !== null;
  const hasAttendance = (P.attendance?.length ?? 0) > 0;
  const duty = P.duty;
  const hasDuty =
    !!duty && (duty.requirements.reduce((s, r) => s + (r.required_hours ?? 0), 0) > 0 || duty.entries.length > 0);
  const hasCheckins = (P.checkins?.length ?? 0) > 0;
  // coachNotes !== null heisst "die Betrachterin darf sie sehen" — dann traegt
  // die Gruppe Inhalt, auch wenn sonst nichts in ihr steht (sonst haette eine
  // Trainerin bei einem ansonsten leeren Profil keinen Weg zur Notiz).
  const devAny = hasAssess || hasAttendance || hasDuty || hasCheckins || coachNotes !== null;

  const hasRsvp = (P.rsvps?.length ?? 0) > 0;
  const hasEquip = (P.equipment?.length ?? 0) > 0;
  const eventsAny = hasRsvp || hasEquip;

  const contactFields: Array<{ label: string; value: React.ReactNode }> = [];
  if (member.email) contactFields.push({ label: tp("lblEmail"), value: member.email });
  if (member.phone) contactFields.push({ label: tp("lblPhone"), value: member.phone });
  if (member.postal_address) contactFields.push({ label: tp("lblAddress"), value: member.postal_address });
  if (member.birth_date)
    contactFields.push({
      label: tp("lblBirth"),
      value: (
        <span className="tabular-nums">
          {formatDateShort(member.birth_date, locale)}{" "}
          <span className="text-ink-faint">· {tp("ageYears", { age: ageYears(member.birth_date) })}</span>
        </span>
      ),
    });
  if (member.valid_until)
    contactFields.push({
      label: tp("lblValidUntil"),
      value: <span className="tabular-nums">{formatDateShort(member.valid_until, locale)}</span>,
    });

  const fin = P.finance;
  const hasFinance =
    !!fin &&
    (fin.invoices.length > 0 || fin.member_fees.length > 0 || fin.sepa_mandates.length > 0 || fin.donations.length > 0);
  const hasRoles = P.roles.length > 0;
  const hasDepts = P.departments.length > 0;
  const hasConsents = P.consents !== null && P.consents.length > 0;

  // Sparten-Zugehörigkeit (n:m) — aus der Vereins-Spartenliste abgeleitet (welche
  // Sparte führt dieses Mitglied im Roster?). getSparten ist eine Contract-Lücke-
  // weiche Nebenquelle (softNotImplemented → null); dann fällt der Bereich still weg.
  const canManageSparten = perms.canManageSparten;
  const memberSparten: Sparte[] = (sparten ?? [])
    .filter((s) => s.memberIds.includes(member.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));
  // Karte nur, wenn Daten angebunden sind UND es etwas zu zeigen/verwalten gibt.
  const showSparten = sparten !== null && (memberSparten.length > 0 || canManageSparten);

  const orgAny =
    contactFields.length > 0 ||
    hasRoles ||
    hasDepts ||
    showSparten ||
    hasFinance ||
    hasConsents ||
    canEditRole ||
    !!FamilyCardVisible(perms);

  const hasPhotos = (P.photos?.length ?? 0) > 0;

  // Selbst-Profil (Motto/Disziplin/seit) — nur wenn serverseitig geliefert.
  const motto = member.profile_motto?.trim();
  const discipline = member.profile_favorite_discipline?.trim();
  const skatingSince = member.profile_skating_since;
  const hasSelfProfile = !!(motto || discipline || skatingSince);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
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

      {/* DER VEREINSAUSWEIS — großes Porträt, Einordnung, „dabei seit", Ausweis-Code. */}
      <Card>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="h-32 w-28 flex-none overflow-hidden rounded-xl border border-line shadow-card">
            <PortraitTile
              personId={member.id}
              firstName={member.first_name}
              lastName={member.last_name}
              avatarUrl={member.avatar_url}
            />
          </div>

          <div className="grid min-w-0 flex-1 gap-2.5">
            <div className="flex items-start justify-between gap-3">
              <span className="eyebrow flex items-center gap-1.5 text-brand">
                <Icon name="shield" className="ic h-3.5 w-3.5" />
                {tp("passEyebrow")}
              </span>
              <div className="hidden flex-none sm:block">
                <PassCode />
              </div>
            </div>
            <h1 className="font-display text-display tracking-tight text-ink">{name}</h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill tone={ROLE_TONE[role]}>{t(roleKey(role))}</StatusPill>
              {isSelf && <Badge tone="brand">{t("youBadge")}</Badge>}
              <Badge tone={STATUS_TONE[member.status as MemberStatus]}>
                {t(STATUS_KEY[member.status as MemberStatus])}
              </Badge>
              {member.role === "guest_coach" && member.valid_until && (
                <Badge tone="warn" icon="clock">
                  {t("guestUntil", { date: formatDateShort(member.valid_until, locale) })}
                </Badge>
              )}
            </div>
            {(memberTeams.length > 0 || (profile.joined_on_visible && member.joined_on)) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {memberTeams.map((team) => (
                  <Badge key={team} tone="neutral">
                    {team}
                  </Badge>
                ))}
                {profile.joined_on_visible && member.joined_on && (
                  <span className="text-caption text-ink-faint">
                    {tp("since", { date: formatDateShort(member.joined_on, locale) })}
                  </span>
                )}
              </div>
            )}
          </div>

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

        {/* „Über mich" — der freiwillige Text. Fehlt er bei Fremden: nichts. */}
        {about ? (
          <div className="mt-5 border-t border-line pt-5">
            <h2 className="eyebrow mb-1.5">
              {isSelf ? t("aboutTitleSelf") : t("aboutTitle", { name: member.first_name })}
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

        {/* Selbst-Profil (Motto/Disziplin/seit) — nur wenn serverseitig sichtbar. */}
        {hasSelfProfile && (
          <div className="mt-5 border-t border-line pt-5">
            <h2 className="eyebrow mb-2">{tp("selfProfileEyebrow")}</h2>
            {motto && <p className="mb-2 text-body italic text-ink">„{motto}“</p>}
            <div className="flex flex-wrap gap-2">
              {discipline && (
                <Badge tone="neutral" icon="routines">
                  {tp("lblDiscipline")}: {discipline}
                </Badge>
              )}
              {skatingSince && (
                <Badge tone="neutral" icon="clock">
                  {tp("lblSkatingSince")} {skatingSince}
                </Badge>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ---------------- LEISTUNG ---------------- */}
      {perfAny && (
        <section className="grid gap-4">
          <SectionHeader title={tp("perfSection")} />
          <div className="grid items-start gap-5 md:grid-cols-2">
            {hasScores && (
              <div className="md:col-span-2">
                <ScoreCard competition={comp!} />
              </div>
            )}
            {hasRoutines && <RoutinesCard routines={P.routines!} />}
            {hasMedals && <MedalCard achievements={P.achievements!} />}
          </div>
        </section>
      )}

      {/* ---------------- ENTWICKLUNG ---------------- */}
      {devAny && (
        <section className="grid gap-4">
          <SectionHeader title={tp("devSection")} />
          <div className="grid items-start gap-5 md:grid-cols-2">
            {hasAssess && (
              <div className="md:col-span-2">
                <AssessmentCard
                  assessments={P.assessments!}
                  authorName={authorName}
                  canWrite={canWriteAssessment}
                  onWrite={() => setAssessOpen(true)}
                />
              </div>
            )}
            {coachNotes !== null && (
              <div className="md:col-span-2">
                <CoachNotesCard
                  notes={coachNotes}
                  authorName={authorName}
                  canWrite={mayHandleCoachNotes}
                  onWrite={() => setNoteOpen(true)}
                />
              </div>
            )}
            {hasAttendance && <AttendanceCard attendance={P.attendance!} />}
            {hasDuty && <DutyCard duty={duty!} />}
            {hasCheckins && <CheckinCard checkins={P.checkins!} />}
          </div>
        </section>
      )}

      {/* ---------------- TERMINE ---------------- */}
      {eventsAny && (
        <section className="grid gap-4">
          <SectionHeader title={tp("eventsSection")} />
          <div className="grid items-start gap-5 md:grid-cols-2">
            {hasRsvp && <RsvpCard rsvps={P.rsvps!} />}
            {hasEquip && <EquipmentCard equipment={P.equipment!} />}
          </div>
        </section>
      )}

      {/* ---------------- VEREIN & ORGA ---------------- */}
      {orgAny && (
        <section className="grid gap-4">
          <SectionHeader title={tp("orgSection")} />
          <div className="grid items-start gap-5 md:grid-cols-2">
            {contactFields.length > 0 && (
              <Card>
                <CardHeader eyebrow={tp("contactEyebrow")} title={tp("contactTitle")} />
                <dl className="grid">
                  {contactFields.map((f) => (
                    <div
                      key={f.label}
                      className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2 last:border-0"
                    >
                      <dt className="text-[13px] font-semibold text-ink-faint">{f.label}</dt>
                      <dd className="min-w-0 text-[14px] text-ink">{f.value}</dd>
                    </div>
                  ))}
                </dl>
                {!profile.contact_visible ? null : (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-caption text-ink-faint">
                    <Icon name="lock" className="ic h-3.5 w-3.5" />
                    {tp("contactStaffNote")}
                  </p>
                )}
              </Card>
            )}

            {hasFinance && (
              <div className="md:col-span-2">
                <FinanceCard finance={fin!} />
              </div>
            )}

            {FamilyCardVisible(perms) && <FamilyCard memberId={member.id} />}

            {hasRoles && <RolesCard roles={P.roles} />}
            {hasDepts && <DepartmentsCard departments={P.departments} />}
            {showSparten && (
              <MemberSpartenCard
                sparten={memberSparten}
                canManage={canManageSparten}
                onManage={() => setSpartenOpen(true)}
              />
            )}
            {hasConsents && <ConsentCard consents={P.consents!} />}

            {canEditRole && (
              <Card>
                <CardHeader eyebrow={tp("rolesEyebrow")} title={t("roleSelect")} />
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
              </Card>
            )}
          </div>
        </section>
      )}

      {/* ---------------- GALERIE ---------------- */}
      {hasPhotos && <GalleryCard photos={P.photos} />}

      {isSelf && aboutOpen && (
        <AboutMeSheet
          key={about ?? ""}
          open={aboutOpen}
          initial={about ?? ""}
          onClose={() => setAboutOpen(false)}
          onSaved={state.reload}
        />
      )}
      {assessOpen && (
        <AssessmentSheet
          open={assessOpen}
          memberId={member.id}
          onClose={() => setAssessOpen(false)}
          onSaved={state.reload}
        />
      )}
      {noteOpen && mayHandleCoachNotes && (
        <CoachNoteSheet
          open={noteOpen}
          memberId={member.id}
          onClose={() => setNoteOpen(false)}
          onSaved={() => void reloadCoachNotes()}
        />
      )}
      {spartenOpen && canManageSparten && sparten !== null && (
        <MemberSpartenSheet
          key={member.id}
          memberId={member.id}
          memberName={name}
          sparten={sparten}
          onClose={() => setSpartenOpen(false)}
          onSaved={state.reload}
        />
      )}
    </div>
  );
}

/** Familien-Verknüpfungen sind Verwaltungssicht (wie zuvor). */
function FamilyCardVisible(perms: ReturnType<typeof permissions>): boolean {
  return perms.canManageMembers || perms.isPlatformAdmin;
}
