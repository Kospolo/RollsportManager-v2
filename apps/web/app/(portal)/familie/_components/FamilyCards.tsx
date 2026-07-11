"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { fullName } from "@/lib/data";
import type { Team } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { Badge, DunningBadge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/shell/icons";
import { familieDict } from "../i18n";
import { teamNames, type DuesStatus, type FamilyLink } from "../derive";

/**
 * Karten des Familien-Screens. `PersonCard` ist die rein lesende Verknüpfung
 * (ganze Karte = Link ins Profil) für „Eltern & Bezugspersonen". `ChildCard`
 * zeigt zusätzlich eine Entfernen-Aktion — hier ist NUR der Namensbereich ein
 * Link, der Entfernen-Button liegt daneben (kein verschachteltes Interaktiv).
 * Avatare rendern das Profilfoto (avatarUrl), sonst die farbigen Initialen.
 */

/* ---------- Beitrags-Ampel ---------- */

export function DuesBadge({ status }: { status: DuesStatus }) {
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

/* ---------- Chips (Teams + Beitrag) ---------- */

function FamilyChips({
  link,
  dues,
  teams,
}: {
  link: FamilyLink;
  dues: DuesStatus | null;
  teams: Team[] | null;
}) {
  const names = teams ? teamNames(link.member, teams) : [];
  if (names.length === 0 && dues === null) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {names.map((name) => (
        <Badge key={name} tone="neutral" icon="teams">
          {name}
        </Badge>
      ))}
      {dues && <DuesBadge status={dues} />}
    </div>
  );
}

/* ---------- Sektion (Kinder / Erziehungsberechtigte) ---------- */

export function FamilySection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
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

/* ---------- Lesende Personen-Karte (ganze Karte = Link) ---------- */

export function PersonCard({
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

  return (
    <Link
      href={`/mitglieder/${person.id}`}
      aria-label={t("openMember", { name: fullName(person) })}
      className="group grid content-start gap-3 rounded-xl border border-line bg-surface p-5 no-underline shadow-card transition-colors duration-150 hover:border-line-strong hover:bg-sunken/40"
    >
      <div className="flex items-center gap-3">
        <Avatar
          personId={person.id}
          firstName={person.firstName}
          lastName={person.lastName}
          avatarUrl={person.avatarUrl}
          size="l"
        />
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
      <FamilyChips link={link} dues={dues} teams={teams} />
    </Link>
  );
}

/* ---------- Kind-Karte (Namensbereich = Link, Entfernen daneben) ---------- */

export function ChildCard({
  link,
  subtitle,
  dues,
  teams,
  onRemove,
}: {
  link: FamilyLink;
  subtitle: string;
  dues: DuesStatus | null;
  teams: Team[] | null;
  onRemove: (link: FamilyLink) => void;
}) {
  const t = useT(familieDict);
  const person = link.member;

  return (
    <div className="grid content-start gap-3 rounded-xl border border-line bg-surface p-5 shadow-card transition-colors duration-150 hover:border-line-strong">
      <div className="flex items-center gap-3">
        <Link
          href={`/mitglieder/${person.id}`}
          aria-label={t("openMember", { name: fullName(person) })}
          className="group flex min-w-0 flex-1 items-center gap-3 no-underline"
        >
          <Avatar
            personId={person.id}
            firstName={person.firstName}
            lastName={person.lastName}
            avatarUrl={person.avatarUrl}
            size="l"
          />
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="truncate font-display text-[16px] font-bold leading-tight text-ink group-hover:underline">
              {fullName(person)}
            </span>
            <span className="truncate text-caption text-ink-faint">{subtitle}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => onRemove(link)}
          aria-label={t("removeActionFor", { name: fullName(person) })}
          className="grid h-9 w-9 flex-none place-items-center rounded-full border border-line text-ink-faint transition-colors duration-150 hover:border-danger hover:text-danger"
        >
          <Icon name="trash" className="ic h-4 w-4" />
        </button>
      </div>
      <FamilyChips link={link} dues={dues} teams={teams} />
    </div>
  );
}
