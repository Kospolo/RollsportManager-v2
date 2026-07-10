"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { fullName } from "@/lib/data";
import type { Achievement, Member } from "@/lib/types";
import { MEDAL_LABEL_KEY, medaillenDict } from "../i18n";
import { MedalIcon } from "./MedalIcon";

/**
 * Erfolgs-Karte: Medaillen-Symbol, Titel, Wettkampf, Platzierung, Datum. Bei
 * `showMember` zusätzlich Mitglied (Avatar + Name) für die Vereins-Vitrine.
 * Trainer+ (canWrite) bekommen die Aktionsleiste (Bearbeiten/Löschen) — die
 * Durchsetzung bleibt serverseitig (RLS), ein 403 wird oben als Toast gezeigt.
 */
export function AchievementCard({
  achievement,
  member,
  canWrite,
  showMember,
  onEdit,
  onDelete,
}: {
  achievement: Achievement;
  /** Aufgelöstes Mitglied zu memberId (kann fehlen, z. B. Ex-Mitglied) */
  member?: Member;
  canWrite: boolean;
  /** Mitgliedszeile einblenden (Vereins-Vitrine); false in „Meine Medaillen“ */
  showMember: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT(medaillenDict);
  const { locale } = useLocale();

  const medalLabel = achievement.medal
    ? t(MEDAL_LABEL_KEY[achievement.medal])
    : t("participation");

  return (
    <article className="grid gap-3 rounded-xl border border-line bg-surface p-5 shadow-card transition-colors duration-150 hover:border-line-strong">
      <div className="flex items-start gap-4">
        <MedalIcon medal={achievement.medal} size="lg" />

        <div className="grid min-w-0 flex-1 gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={achievement.medal ? "warn" : "neutral"}>{medalLabel}</Badge>
            {achievement.placement != null && (
              <Badge tone="neutral">{t("placementBadge", { n: achievement.placement })}</Badge>
            )}
          </div>

          <h3 className="text-[15.5px] font-bold leading-snug text-ink">{achievement.title}</h3>

          {achievement.competitionName && (
            <p className="inline-flex items-center gap-1.5 text-[13.5px] text-ink-soft">
              <Icon name="competition" className="ic h-[14px] w-[14px] text-ink-faint" />
              {achievement.competitionName}
            </p>
          )}

          <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-soft">
            {showMember && (
              <span className="inline-flex items-center gap-1.5">
                {member ? (
                  <Avatar
                    personId={member.id}
                    firstName={member.firstName}
                    lastName={member.lastName}
                    size="s"
                  />
                ) : (
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-sunken text-ink-faint">
                    <Icon name="user" className="ic h-3.5 w-3.5" />
                  </span>
                )}
                <span className="font-bold text-ink">
                  {member ? fullName(member) : t("participation")}
                </span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Icon name="clock" className="ic h-[14px] w-[14px] text-ink-faint" />
              {formatDate(achievement.achievedOn, locale)}
            </span>
          </div>

          {achievement.note && (
            <p className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-[20px] text-ink-soft">
              {achievement.note}
            </p>
          )}
        </div>
      </div>

      {canWrite && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <Button
            variant="ghost"
            size="sm"
            icon="edit"
            aria-label={t("editAria", { title: achievement.title })}
            onClick={onEdit}
          >
            {t("edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="!text-danger hover:!bg-danger-soft"
            aria-label={t("deleteAria", { title: achievement.title })}
            onClick={onDelete}
          >
            {t("delete")}
          </Button>
        </div>
      )}
    </article>
  );
}
