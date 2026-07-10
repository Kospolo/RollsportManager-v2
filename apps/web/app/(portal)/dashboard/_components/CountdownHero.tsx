"use client";

import { AvatarStack } from "@/components/ui/AvatarStack";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { dayDiff, formatDate, formatTime, relativeDays } from "@/lib/format";
import { dashboardDict } from "../i18n";
import type { CompetitionInfo } from "../derive";

/**
 * Countdown-Hero (DESIGN-SYSTEM §3.9, Jury-Übernahme aus B):
 * dosierte Motivationskarte in Heimspiel-Tonalität — brand-soft-Tint,
 * Display-Zahl, Klartext-Meta. Kein Gradient, keine Animation.
 */

function MetaLine({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  return (
    <span className="flex items-start gap-2">
      <Icon name={icon} className="ic mt-[3px] h-[15px] w-[15px] flex-none text-brand-ink" />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

export function CountdownHero({ info }: { info: CompetitionInfo | null }) {
  const t = useT(dashboardDict);
  const { locale } = useLocale();

  if (!info) {
    return (
      <EmptyState
        icon="competition"
        title={t("heroEmptyTitle")}
        body={t("heroEmptyBody")}
        ctaHref="/wettkampf"
        ctaLabel={t("heroEmptyCta")}
      />
    );
  }

  const { competition, days, participants, note } = info;
  const deadline = competition.registrationDeadline;
  const deadlineDiff = deadline ? dayDiff(deadline) : null;
  const deadlineTone = deadlineDiff !== null && deadlineDiff < 0 ? "danger" : deadlineDiff !== null && deadlineDiff <= 3 ? "warn" : "neutral";

  return (
    <section className="rounded-xl bg-brand-soft p-5 shadow-card sm:p-6">
      <h2 className="eyebrow text-brand-ink">{t("heroEyebrow")}</h2>

      <p className="mt-2 font-display text-[38px] font-extrabold leading-[1.05] tracking-tight text-brand-ink tabular-nums">
        {days === 0 ? (
          t("heroTodayBig")
        ) : (
          <>
            {days}{" "}
            <span className="text-[19px] tracking-normal">
              {days === 1 ? t("heroDayWord") : t("heroDaysWord")}
            </span>
          </>
        )}
      </p>

      <div className="mb-4 mt-3 grid gap-1.5 text-[13.5px] leading-snug text-ink">
        <MetaLine icon="competition">
          <b className="font-bold">{competition.name}</b>
        </MetaLine>
        <MetaLine icon="events">
          {t("heroDate", {
            date: formatDate(competition.startsAt, locale),
            time: formatTime(competition.startsAt, locale),
          })}
        </MetaLine>
        <MetaLine icon="pin">{competition.location}</MetaLine>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <AvatarStack
          people={participants.map((m) => ({
            personId: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
          }))}
          max={4}
          size="s"
        />
        <span className="text-caption font-semibold text-ink-soft">
          {t("heroRegistered", { n: participants.length })}
        </span>
      </div>

      {deadline && (
        <p className="mb-4">
          <Badge tone={deadlineTone} icon="clock">
            {t("heroDeadline", { rel: relativeDays(deadline, locale) })}
          </Badge>
        </p>
      )}

      {note && <p className="mb-4 text-caption leading-relaxed text-ink-soft">{note}</p>}

      <ButtonLink variant="ghost" href="/wettkampf" icon="competition" className="w-full">
        {t("heroCta")}
      </ButtonLink>
    </section>
  );
}
