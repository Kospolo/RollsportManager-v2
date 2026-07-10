"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { errorMessage, fullName, isNotImplemented } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Team } from "@/lib/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge, DunningBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import { familieDict, RELATION_KEY } from "./i18n";
import {
  childrenOf,
  duesStatus,
  guardiansOf,
  softNotImplemented,
  teamNames,
  type DuesStatus,
  type FamilyLink,
} from "./derive";

/**
 * Familien-Übersicht der eingeloggten Person: „Meine Kinder" (falls
 * Erziehungsberechtigte:r) bzw. „Eltern & Bezugspersonen" (falls Kind) —
 * je mit Avatar, Name, Team und Beitragsstatus, verlinkt ins Mitgliedsprofil.
 *
 * REIN LESEND: Anlegen/Verknüpfen ist als „Bald"-Hinweis angedeutet (kein
 * Endpoint). Daten kommen ausschließlich über die Facade (lib/data):
 * getCurrentUser + getGuardianships + getMembers sind Pflicht; Teams und
 * Rechnungen sind im api-Modus optional (NotImplemented ⇒ Zusatzangaben
 * entfallen still, ein Hinweis erscheint darunter).
 */

/* ---------- Beitrags-Ampel ---------- */

function DuesBadge({ status }: { status: DuesStatus }) {
  const t = useT(familieDict);
  if (status.kind === "exempt") return <Badge tone="neutral">{t("duesExempt")}</Badge>;
  if (status.kind === "paid")
    return (
      <Badge tone="success" icon="check">
        {t("duesPaid")}
      </Badge>
    );
  return <DunningBadge level={status.level} />;
}

/* ---------- Personen-Karte (verlinkt ins Profil) ---------- */

function PersonCard({
  link,
  subtitle,
  dues,
  teams,
}: {
  link: FamilyLink;
  subtitle: string;
  /** null = Beitragsdaten nicht angebunden → keine Ampel */
  dues: DuesStatus | null;
  /** null = Teams nicht angebunden → keine Team-Chips */
  teams: Team[] | null;
}) {
  const t = useT(familieDict);
  const person = link.member;
  const names = teams ? teamNames(person, teams) : [];
  const hasChips = names.length > 0 || dues !== null;

  return (
    <Link
      href={`/mitglieder/${person.id}`}
      aria-label={t("openMember", { name: fullName(person) })}
      className="group grid content-start gap-3 rounded-xl border border-line bg-surface p-5 no-underline shadow-card transition-colors duration-150 hover:border-line-strong hover:bg-sunken/40"
    >
      <div className="flex items-center gap-3">
        <Avatar personId={person.id} firstName={person.firstName} lastName={person.lastName} size="l" />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate font-display text-[16px] font-bold leading-tight text-ink group-hover:underline">
            {fullName(person)}
          </span>
          <span className="truncate text-caption text-ink-faint">{subtitle}</span>
        </span>
        <Icon
          name="chevronRight"
          className="ic h-4 w-4 flex-none text-ink-faint transition-colors duration-150 group-hover:text-ink"
        />
      </div>
      {hasChips && (
        <div className="flex flex-wrap items-center gap-1.5">
          {names.map((name) => (
            <Badge key={name} tone="neutral" icon="teams">
              {name}
            </Badge>
          ))}
          {dues && <DuesBadge status={dues} />}
        </div>
      )}
    </Link>
  );
}

/* ---------- Sektion (Kinder / Erziehungsberechtigte) ---------- */

function FamilySection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const t = useT(familieDict);
  return (
    <section className="grid gap-3">
      <div className="flex items-baseline gap-2.5">
        <h2 className="font-display text-h3 tracking-[-0.01em] text-ink">{title}</h2>
        <span className="text-caption text-ink-faint">{t("countLinked", { n: count })}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/* ---------- Screen ---------- */

export function FamilyClient() {
  const t = useT(familieDict);
  const { showToast } = useToast();

  const state = useData((repo) =>
    Promise.all([
      repo.getCurrentUser(),
      repo.getGuardianships(),
      repo.getMembers(),
      softNotImplemented(repo.getTeams()),
      softNotImplemented(repo.getInvoices()),
    ] as const),
  );

  const notifySoon = () => showToast(t("soonToast"), { tone: "info" });

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  } else if (state.status === "error") {
    body = isNotImplemented(state.error) ? (
      <EmptyState icon="sparkle" title={t("niTitle")} body={t("niBody")} />
    ) : (
      <EmptyState
        icon="zap"
        title={t("loadErrorTitle")}
        body={errorMessage(state.error)}
        action={<Button onClick={state.reload}>{t("retry")}</Button>}
      />
    );
  } else {
    const [me, guardianships, members, teams, invoices] = state.data;
    const children = childrenOf(me.id, guardianships, members);
    const guardians = guardiansOf(me.id, guardianships, members);
    const hasFamily = children.length > 0 || guardians.length > 0;
    const partial = teams === null || invoices === null;

    const duesFor = (link: FamilyLink): DuesStatus | null =>
      invoices ? duesStatus(link.member, invoices, guardianships) : null;

    if (!hasFamily) {
      body = <EmptyState icon="members" title={t("emptyTitle")} body={t("emptyBody")} />;
    } else {
      body = (
        <div className="grid gap-6">
          {children.length > 0 && (
            <FamilySection title={t("childrenTitle")} count={children.length}>
              {children.map((link) => (
                <PersonCard
                  key={link.member.id}
                  link={link}
                  subtitle={
                    link.member.birthDate
                      ? t("bornYear", { year: new Date(link.member.birthDate).getFullYear() })
                      : t(RELATION_KEY[link.relation])
                  }
                  dues={duesFor(link)}
                  teams={teams}
                />
              ))}
            </FamilySection>
          )}

          {guardians.length > 0 && (
            <FamilySection title={t("guardiansTitle")} count={guardians.length}>
              {guardians.map((link) => (
                <PersonCard
                  key={link.member.id}
                  link={link}
                  subtitle={t(RELATION_KEY[link.relation])}
                  dues={duesFor(link)}
                  teams={teams}
                />
              ))}
            </FamilySection>
          )}

          <div className="grid gap-1">
            {partial && <p className="text-caption text-ink-faint">{t("partialHint")}</p>}
            <p className="text-caption text-ink-faint">{t("soonHint")}</p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <SectionHeader
        level={1}
        title={t("title")}
        sub={t("sub")}
        action={
          <Button variant="ghost" icon="plus" onClick={notifySoon}>
            {t("linkCta")}
          </Button>
        }
      />
      {body}
    </div>
  );
}
