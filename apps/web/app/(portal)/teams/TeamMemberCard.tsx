"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { fullName } from "@/lib/data";
import type { Member, Team } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack, type AvatarStackPerson } from "@/components/ui/AvatarStack";
import { Icon } from "@/components/shell/icons";
import { teamsViewDict } from "./i18n";
import { rosterOf } from "./derive";

/**
 * Eine Team-Kachel der Mitgliederansicht (REIN LESEND): Name + Altersklasse,
 * Trainerstab (Avatar + Klartext), Sportler:innen als Avatar-Stapel mit Zahl
 * und ersten Namen. „Mein Team"-Badge, wenn `mine`.
 *
 * DIE GANZE KARTE ÖFFNET das Team (/teams/{id}) — der Team-Name trägt den Link,
 * ein ::before-Overlay macht die ganze Kachel klickbar, unten steht die klare
 * „Team öffnen"-Affordanz. Die Detailseite ist rein lesend (Kader ansehen),
 * die Verwaltung (Anlegen/Kader) läuft weiter über /verwaltung/teams.
 */

const MAX_NAMES = 4;

function toStackPeople(members: Member[]): AvatarStackPerson[] {
  return members.map((m) => ({ personId: m.id, firstName: m.firstName, lastName: m.lastName }));
}

export function TeamMemberCard({
  team,
  members,
  mine = false,
}: {
  team: Team;
  members: Member[];
  mine?: boolean;
}) {
  const t = useT(teamsViewDict);
  const { coaches, skaters } = rosterOf(team, members);

  const memberLabel =
    skaters.length === 1
      ? t("membersCountOne")
      : t("membersCountMany", { n: skaters.length });

  const shownNames = skaters.slice(0, MAX_NAMES).map(fullName);
  const restNames = skaters.length - shownNames.length;

  return (
    <Card className="group relative flex flex-col gap-4 transition-[border-color,box-shadow,transform] duration-150 hover:border-line-strong hover:shadow-pop focus-within:border-brand active:scale-[0.99]">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-md bg-brand-soft text-brand-ink transition-colors duration-150 group-hover:bg-brand group-hover:text-brand-contrast">
          <Icon name="teams" className="ic h-5 w-5" />
        </span>
        <div className="grid min-w-0 gap-1">
          <h3 className="truncate font-display text-h3 tracking-[-0.01em] text-ink">
            {/* ::before deckt die ganze Karte ab → überall klickbar; der Name
                trägt den Link (Fokusring liegt um ihn). */}
            <Link
              href={`/teams/${team.id}`}
              aria-label={t("openTeamAria", { team: team.name })}
              className="text-ink no-underline before:absolute before:inset-0 before:content-[''] hover:underline"
            >
              {team.name}
            </Link>
          </h3>
          <span className="flex flex-wrap items-center gap-2">
            {team.ageGroup ? (
              <Badge tone="neutral">{team.ageGroup}</Badge>
            ) : (
              <span className="text-caption text-ink-faint">{t("noAgeGroup")}</span>
            )}
            {mine && <Badge tone="brand">{t("badgeMine")}</Badge>}
          </span>
        </div>
      </div>

      {/* Trainerstab */}
      <div className="grid gap-2">
        <span className="eyebrow">{t("coachesLabel")}</span>
        {coaches.length > 0 ? (
          <ul className="grid gap-2">
            {coaches.map((coach) => (
              <li key={coach.id} className="flex items-center gap-2.5">
                <Avatar
                  personId={coach.id}
                  firstName={coach.firstName}
                  lastName={coach.lastName}
                  size="s"
                />
                <span className="min-w-0 truncate text-[13px] font-semibold text-ink">
                  {fullName(coach)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="flex items-center gap-2.5 text-[13px] text-ink-faint">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-sunken text-ink-faint">
              <Icon name="user" className="ic h-3.5 w-3.5" />
            </span>
            {t("noCoaches")}
          </span>
        )}
      </div>

      {/* Sportler:innen */}
      <div className="mt-auto grid gap-2 border-t border-line pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">{t("membersLabel")}</span>
          <span className="text-[13px] font-semibold text-ink-soft">
            {skaters.length > 0 ? memberLabel : t("emptyRoster")}
          </span>
        </div>
        {skaters.length > 0 && (
          <div className="grid gap-2">
            <AvatarStack
              people={toStackPeople(skaters)}
              size="s"
              max={6}
              label={t("teamRoster", { team: team.name })}
            />
            <p className="text-caption leading-snug text-ink-faint">
              {shownNames.join(" · ")}
              {restNames > 0 && <> · {t("moreNames", { n: restNames })}</>}
            </p>
          </div>
        )}
      </div>

      {/* „Team öffnen"-Affordanz — rein dekorativ (der Name-Link trägt die
          Aktion + aria-label); pointer-events-none, damit das ::before-Overlay
          die Klicks bekommt. Auf Hover wandert sie ins Beere. */}
      <span
        aria-hidden="true"
        className="pointer-events-none flex items-center gap-1 self-start text-[13px] font-bold text-ink-soft transition-colors duration-150 group-hover:text-brand"
      >
        {t("openTeam")}
        <Icon name="chevronRight" className="ic h-4 w-4" />
      </span>
    </Card>
  );
}
