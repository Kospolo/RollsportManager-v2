"use client";

import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Badge } from "@/components/ui/Badge";
import { ResponseBar } from "@/components/ui/ResponseBar";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { formatTime } from "@/lib/format";
import { fullName, memberById } from "@/lib/mock";
import type { AttendanceStatus, Event, Member, Rsvp } from "@/lib/types";
import { termineDict } from "../i18n";
import {
  attendanceCounts,
  participantsOf,
  rsvpCounts,
  teamsOf,
  TYPE_LABEL_KEY,
  TYPE_TONE,
} from "../helpers";

/**
 * Termin-Karte in der Tagesliste (Mockup .session): Zeitspalte,
 * Titel + Team-Badges, Ort, AvatarStack + ResponseBar, Absagegrund-Blase.
 * Die ganze Karte öffnet das Detail (Overlay-Button, 44-px-Ziel).
 */
export function EventCard({
  event,
  rsvps,
  past = false,
  attendanceMap,
  onOpen,
}: {
  event: Event;
  rsvps: Rsvp[];
  /** Vergangene Termine: ausgegraut, Anwesenheits-Bilanz statt RSVP-Balken */
  past?: boolean;
  attendanceMap?: Record<string, AttendanceStatus>;
  onOpen: () => void;
}) {
  const t = useT(termineDict);
  const { locale } = useLocale();

  const participants = participantsOf(event, rsvps);
  const counts = rsvpCounts(participants.length, rsvps);
  const going = rsvps
    .filter((rsvp) => rsvp.status === "going")
    .map((rsvp) => memberById(rsvp.memberId))
    .filter((member): member is Member => member !== undefined);
  const quote = past
    ? undefined
    : rsvps.find((rsvp) => (rsvp.status === "declined" || rsvp.status === "sick") && rsvp.comment);
  const quoteMember = quote ? memberById(quote.memberId) : undefined;
  const att = attendanceMap ? attendanceCounts(participants, attendanceMap) : undefined;
  const quoted = (text: string) => (locale === "de" ? `„${text}“` : `“${text}”`);

  return (
    <article
      className={`group relative grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-card transition-colors duration-150 hover:border-line-strong sm:grid-cols-[92px_minmax(0,1fr)_auto] ${
        past ? "opacity-65" : ""
      }`.trim()}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("detailsAria", { title: event.title })}
        className="absolute inset-0 z-10 rounded-xl"
      />

      {/* Zeitspalte */}
      <div className="flex flex-row items-baseline gap-2 sm:flex-col sm:gap-1">
        <span className="font-display text-[19px] font-extrabold leading-6 tabular-nums text-ink">
          {formatTime(event.startsAt, locale)}
        </span>
        <span className="text-caption tabular-nums text-ink-faint">
          – {formatTime(event.endsAt, locale)}
        </span>
      </div>

      {/* Inhalt */}
      <div className="grid min-w-0 gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15.5px] font-bold text-ink">{event.title}</h3>
          <Badge tone={TYPE_TONE[event.type]}>{t(TYPE_LABEL_KEY[event.type])}</Badge>
          {teamsOf(event).map((team) => (
            <Badge key={team.id} tone="neutral">
              {team.name}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="pin" className="ic h-[14px] w-[14px] text-ink-faint" />
            {event.location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="members" className="ic h-[14px] w-[14px] text-ink-faint" />
            {t("invited", { n: participants.length })}
          </span>
        </div>

        {past ? (
          <span
            className={`text-caption font-semibold ${
              att && att.recorded > 0 ? "text-ink-soft" : "text-ink-faint"
            }`}
          >
            {att && att.recorded > 0
              ? t("attendanceOf", { present: att.present, total: participants.length })
              : t("noAttendance")}
          </span>
        ) : (
          participants.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {going.length > 0 && (
                <AvatarStack
                  people={going.map((member) => ({
                    personId: member.id,
                    firstName: member.firstName,
                    lastName: member.lastName,
                  }))}
                  size="s"
                />
              )}
              <ResponseBar
                yes={counts.yes}
                no={counts.no}
                open={counts.open}
                className="min-w-[220px] flex-1"
              />
            </div>
          )
        )}

        {quote && quoteMember && (
          <div className="flex items-start gap-2.5 rounded-md bg-sunken px-3 py-2 text-[13px] leading-[19px] text-ink-soft">
            <Avatar
              personId={quoteMember.id}
              firstName={quoteMember.firstName}
              lastName={quoteMember.lastName}
              size="s"
            />
            <p className="min-w-0">
              <b className="font-bold text-ink">{fullName(quoteMember)}</b>{" "}
              {quote.status === "sick" ? t("quoteSick") : t("quoteDeclined")}{" "}
              {quoted(quote.comment ?? "")}
            </p>
          </div>
        )}
      </div>

      {/* Detail-Affordanz */}
      <Icon
        name="chevronRight"
        className="ic hidden h-5 w-5 self-center text-ink-faint transition-colors duration-150 group-hover:text-ink sm:block"
      />
    </article>
  );
}
