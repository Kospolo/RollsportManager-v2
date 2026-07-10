"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useLocale, useT } from "@/lib/i18n";
import { formatTime } from "@/lib/format";
import { fullName } from "@/lib/mock";
import type { AttendanceStatus, Event, Member, Rsvp, RsvpStatus } from "@/lib/types";
import { termineDict } from "../i18n";
import { checkinIso, teamNameOf, RSVP_LABEL_KEY, RSVP_ORDER, RSVP_TONE } from "../helpers";

/** Gemeinsame Zeile: Avatar + Name + Team — rechts der jeweilige Status. */
function PersonRow({ member, children }: { member: Member; children: React.ReactNode }) {
  const team = teamNameOf(member);
  return (
    <li className="flex min-h-14 items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      <Avatar personId={member.id} firstName={member.firstName} lastName={member.lastName} size="s" />
      <div className="grid min-w-0 gap-px">
        <span className="truncate text-[14px] font-bold text-ink">{fullName(member)}</span>
        {team && <span className="truncate text-caption text-ink-faint">{team}</span>}
      </div>
      <div className="ml-auto flex flex-none items-center gap-2.5">{children}</div>
    </li>
  );
}

/** Tab „Antworten“: sortierte Teilnehmerliste mit Status-Pille + Zitat-Blase. */
export function ResponsesPanel({
  participants,
  rsvps,
}: {
  participants: Member[];
  rsvps: Rsvp[];
}) {
  const t = useT(termineDict);
  const { locale } = useLocale();

  const statusOf = (member: Member): RsvpStatus | "none" =>
    rsvps.find((rsvp) => rsvp.memberId === member.id)?.status ?? "none";
  const commentOf = (member: Member) =>
    rsvps.find((rsvp) => rsvp.memberId === member.id)?.comment;

  const sorted = [...participants].sort(
    (a, b) =>
      RSVP_ORDER[statusOf(a)] - RSVP_ORDER[statusOf(b)] ||
      fullName(a).localeCompare(fullName(b), locale),
  );
  const quoted = (text: string) => (locale === "de" ? `„${text}“` : `“${text}”`);

  if (participants.length === 0) {
    return <p className="py-4 text-[14px] text-ink-faint">{t("noResponses")}</p>;
  }

  return (
    <ul className="grid list-none">
      {sorted.map((member) => {
        const status = statusOf(member);
        const comment = commentOf(member);
        return (
          <li key={member.id} className="border-b border-line last:border-b-0">
            <div className="flex min-h-14 items-center gap-3 py-2.5">
              <Avatar
                personId={member.id}
                firstName={member.firstName}
                lastName={member.lastName}
                size="s"
              />
              <div className="grid min-w-0 gap-px">
                <span className="truncate text-[14px] font-bold text-ink">{fullName(member)}</span>
                {teamNameOf(member) && (
                  <span className="truncate text-caption text-ink-faint">{teamNameOf(member)}</span>
                )}
              </div>
              <Badge tone={RSVP_TONE[status]} className="ml-auto flex-none">
                {t(RSVP_LABEL_KEY[status])}
              </Badge>
            </div>
            {comment && (status === "declined" || status === "sick" || status === "maybe") && (
              <p className="mb-2.5 ml-11 rounded-md bg-sunken px-3 py-2 text-[13px] leading-[19px] text-ink-soft">
                {quoted(comment)}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Tab „Anwesenheit“ (Trainer-Aktion): Schalter pro Mitglied (optimistisch),
 * Verspätet/Entschuldigt-Badges, Check-in-Zeit und QR-Check-in-Einstieg.
 */
export function AttendancePanel({
  event,
  participants,
  attendanceMap,
  editable,
  showQr,
  onShowQr,
  onToggle,
}: {
  event: Event;
  participants: Member[];
  attendanceMap: Record<string, AttendanceStatus>;
  editable: boolean;
  showQr: boolean;
  onShowQr: () => void;
  onToggle: (memberId: string, present: boolean) => void;
}) {
  const t = useT(termineDict);
  const { locale } = useLocale();

  const present = participants.filter((member) => {
    const status = attendanceMap[member.id];
    return status === "present" || status === "late";
  }).length;

  const sorted = [...participants].sort((a, b) =>
    fullName(a).localeCompare(fullName(b), locale),
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-caption text-ink-faint">
          {editable ? t("attendanceHint") : t("attendanceFuture")}
        </p>
        {showQr && (
          <Button variant="secondary" size="sm" icon="check" className="ml-auto" onClick={onShowQr}>
            {t("qrButton")}
          </Button>
        )}
      </div>

      {editable && (
        <p className="text-[13px] font-bold text-ink-soft">
          {t("attendanceOf", { present, total: participants.length })}
        </p>
      )}

      {editable && (
        <ul className="grid list-none">
          {sorted.map((member) => {
            const status = attendanceMap[member.id];
            const isPresent = status === "present" || status === "late";
            const checkin = checkinIso(event.id, member.id);
            return (
              <PersonRow key={member.id} member={member}>
                {status === "late" && <Badge tone="warn">{t("lateBadge")}</Badge>}
                {status === "excused" && <Badge tone="info">{t("excusedBadge")}</Badge>}
                {checkin && isPresent && (
                  <span className="hidden text-caption tabular-nums text-ink-faint sm:inline">
                    {t("checkedInAt", { time: formatTime(checkin, locale) })}
                  </span>
                )}
                <Switch
                  checked={isPresent}
                  onChange={(next) => onToggle(member.id, next)}
                  label={t("attSwitchLabel", { name: fullName(member) })}
                  words={{ on: t("attOn"), off: t("attOff") }}
                />
              </PersonRow>
            );
          })}
        </ul>
      )}
    </div>
  );
}
