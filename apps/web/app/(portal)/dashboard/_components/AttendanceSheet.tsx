"use client";

import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Modal";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { formatTime, relativeDays } from "@/lib/format";
import { fullName, teams } from "@/lib/mock";
import type { Member, RsvpStatus } from "@/lib/types";
import { dashboardDict, type DashboardKey } from "../i18n";
import type { SessionInfo } from "../derive";

/**
 * Anwesenheit erfassen: rechtes Sheet mit abhakbarer Teilnehmerliste.
 * Zusagen sind vorbelegt (Optimistic UI), Status immer Farbe + Wort.
 * Rein lokaler React-State — kein Backend.
 */

const RSVP_TONE: Record<RsvpStatus | "none", BadgeTone> = {
  going: "success",
  declined: "danger",
  sick: "warn",
  maybe: "info",
  none: "neutral",
};

const RSVP_KEY: Record<RsvpStatus | "none", DashboardKey> = {
  going: "rsvpGoing",
  declined: "rsvpDeclined",
  sick: "rsvpSick",
  maybe: "rsvpMaybe",
  none: "rsvpNone",
};

/** Sortierung: Zusagen oben, dann Vielleicht/Offen, Absagen unten. */
const RSVP_ORDER: Record<RsvpStatus | "none", number> = {
  going: 0,
  maybe: 1,
  none: 2,
  sick: 3,
  declined: 4,
};

const teamNameById = new Map(teams.map((team) => [team.id, team.name]));

function memberTeams(member: Member): string {
  return member.teamIds
    .map((id) => teamNameById.get(id))
    .filter(Boolean)
    .join(" · ");
}

export function AttendanceSheet({
  session,
  initialPresent,
  onClose,
  onSave,
}: {
  session: SessionInfo;
  initialPresent: string[];
  onClose: () => void;
  onSave: (presentIds: string[]) => void;
}) {
  const t = useT(dashboardDict);
  const { locale } = useLocale();
  const [present, setPresent] = useState<Set<string>>(() => new Set(initialPresent));

  const sorted = useMemo(
    () =>
      [...session.roster].sort((a, b) => {
        const statusA = session.rsvpByMember[a.id] ?? "none";
        const statusB = session.rsvpByMember[b.id] ?? "none";
        if (RSVP_ORDER[statusA] !== RSVP_ORDER[statusB]) {
          return RSVP_ORDER[statusA] - RSVP_ORDER[statusB];
        }
        return fullName(a).localeCompare(fullName(b), locale === "de" ? "de-DE" : "en-GB");
      }),
    [session, locale],
  );

  const toggle = (id: string) => {
    setPresent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allChecked = present.size === sorted.length && sorted.length > 0;
  const { event } = session;

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("sheetEyebrow")}
      title={event.title}
      footer={
        <>
          <span aria-live="polite" className="mr-auto self-center text-caption text-ink-soft">
            {t("presentCount", { x: present.size, y: sorted.length })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setPresent(allChecked ? new Set() : new Set(sorted.map((m) => m.id)))
            }
          >
            {allChecked ? t("clearAll") : t("markAll")}
          </Button>
          <Button icon="check" onClick={() => onSave(Array.from(present))}>
            {t("sheetSave")}
          </Button>
        </>
      }
    >
      <p className="text-caption text-ink-soft">
        {relativeDays(event.startsAt, locale)} · {formatTime(event.startsAt, locale)}–
        {formatTime(event.endsAt, locale)} · {event.location}
      </p>
      <p className="mt-1 text-caption text-ink-faint">{t("sheetHint")}</p>

      <ul className="mt-4 grid">
        {sorted.map((member) => {
          const status = session.rsvpByMember[member.id] ?? "none";
          const checked = present.has(member.id);
          return (
            <li key={member.id} className="border-t border-line first:border-t-0">
              <button
                type="button"
                onClick={() => toggle(member.id)}
                aria-pressed={checked}
                aria-label={t("presentAria", { name: fullName(member) })}
                className="flex min-h-14 w-full items-center gap-3 rounded-md px-1.5 py-2 text-left transition-colors duration-150 hover:bg-sunken"
              >
                <span
                  aria-hidden="true"
                  className={`grid h-[23px] w-[23px] flex-none place-items-center rounded-sm border-2 transition-colors duration-150 ${
                    checked
                      ? "border-success bg-success text-canvas"
                      : "border-line-strong text-transparent"
                  }`}
                >
                  <Icon name="check" className="ic h-3.5 w-3.5" />
                </span>
                <Avatar
                  personId={member.id}
                  firstName={member.firstName}
                  lastName={member.lastName}
                  size="s"
                />
                <span className="grid min-w-0 flex-1 gap-px">
                  <b className="truncate text-[14px] font-bold text-ink">{fullName(member)}</b>
                  <span className="truncate text-caption text-ink-faint">
                    {memberTeams(member)}
                  </span>
                </span>
                <Badge tone={RSVP_TONE[status]} className="flex-none">
                  {t(RSVP_KEY[status])}
                </Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
