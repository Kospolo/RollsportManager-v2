"use client";

import { useT } from "@/lib/i18n";
import { fullName } from "@/lib/data";
import type { Member, Team } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AvatarStack, type AvatarStackPerson } from "@/components/ui/AvatarStack";
import { Icon } from "@/components/shell/icons";
import { teamsDict } from "./i18n";
import { rosterOf } from "./derive";

/**
 * Eine Team-Kachel: Name + Altersklasse, Trainerstab als Avatar-Stapel mit
 * Klartext, Sportler:innen-Zahl — plus die Aktionen (Umbenennen, Kader,
 * Löschen). Aktionen erscheinen nur, wenn der aktuelle Nutzer verwalten darf;
 * die verbindliche Prüfung bleibt serverseitig.
 */

function toStackPeople(members: Member[]): AvatarStackPerson[] {
  return members.map((m) => ({ personId: m.id, firstName: m.firstName, lastName: m.lastName }));
}

export function TeamCard({
  team,
  members,
  canManage,
  onEdit,
  onRoster,
  onDelete,
}: {
  team: Team;
  members: Member[];
  canManage: boolean;
  onEdit: () => void;
  onRoster: () => void;
  onDelete: () => void;
}) {
  const t = useT(teamsDict);
  const { coaches, skaters } = rosterOf(team, members);

  const coachLabel = t(coaches.length === 1 ? "coachesOne" : "coachesMany", {
    n: coaches.length,
  });
  const skaterLabel = t(skaters.length === 1 ? "skatersOne" : "skatersMany", {
    n: skaters.length,
  });

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-md bg-brand-soft text-brand-ink">
          <Icon name="members" className="ic h-5 w-5" />
        </span>
        <div className="grid min-w-0 gap-1">
          <h3 className="truncate font-display text-h3 tracking-[-0.01em] text-ink">{team.name}</h3>
          {team.ageGroup ? (
            <Badge tone="neutral">{team.ageGroup}</Badge>
          ) : (
            <span className="text-caption text-ink-faint">{t("noAgeGroup")}</span>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-2.5">
          {coaches.length > 0 ? (
            <AvatarStack people={toStackPeople(coaches)} size="s" max={5} label={coachLabel} />
          ) : (
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-sunken text-ink-faint">
              <Icon name="user" className="ic h-3.5 w-3.5" />
            </span>
          )}
          <span className="min-w-0 truncate text-[13px] font-semibold text-ink-soft">
            {coaches.length > 0 ? coaches.map(fullName).join(" · ") : t("noCoaches")}
          </span>
        </div>
        <p className="text-caption text-ink-faint">
          {coachLabel} · {skaters.length > 0 ? skaterLabel : t("emptyRoster")}
        </p>
      </div>

      {canManage && (
        <div
          className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3"
          role="group"
          aria-label={t("cardActions", { team: team.name })}
        >
          <Button variant="ghost" size="sm" icon="members" onClick={onRoster}>
            {t("actRoster")}
          </Button>
          <Button variant="ghost" size="sm" icon="edit" onClick={onEdit}>
            {t("actEdit")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <span className="text-danger">{t("actDelete")}</span>
          </Button>
        </div>
      )}
    </Card>
  );
}
