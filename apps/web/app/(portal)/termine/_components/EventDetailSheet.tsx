"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { ResponseBar } from "@/components/ui/ResponseBar";
import { Sheet } from "@/components/ui/Modal";
import { Tabs, TabPanel, type TabItem } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/shell/icons";
import { useLocale, useT } from "@/lib/i18n";
import { dayDiff, formatDate, formatTime } from "@/lib/format";
import type {
  Attendance,
  AttendanceStatus,
  Event,
  Member,
  Rsvp,
  RsvpStatus,
  Team,
} from "@/lib/types";
import { termineDict } from "../i18n";
import {
  attendanceCounts,
  participantsOf,
  rsvpCounts,
  teamsOf,
  RSVP_LABEL_KEY,
  TYPE_LABEL_KEY,
  TYPE_TONE,
} from "../helpers";
import { AttendancePanel, ResponsesPanel } from "./ParticipantPanels";
import { QrCheckinModal } from "./QrCheckinModal";

type SectionTab = "responses" | "attendance";

/** Aktiver Zustand der Antwort-Pills — Ton je Status, Wort immer sichtbar. */
const RSVP_ACTIVE_CLASS: Record<RsvpStatus, string> = {
  going: "border-transparent bg-success-soft text-success",
  maybe: "border-transparent bg-info-soft text-info",
  declined: "border-transparent bg-danger-soft text-danger",
  sick: "border-transparent bg-warn-soft text-warn",
};

const RSVP_OPTIONS: RsvpStatus[] = ["going", "maybe", "declined", "sick"];

/**
 * Termin-Detail als rechtes Sheet: Meta-Block, eigene Antwort (optimistisch,
 * Facade-Write inkl. Toast macht der Screen), Tabs Antworten/Anwesenheit,
 * QR-Check-in-Modal für Trainer:innen. Daten kommen als Props aus der Facade.
 */
export function EventDetailSheet({
  event,
  rsvps,
  attendanceMap,
  attendanceRecords,
  attendanceReadUnavailable = false,
  members,
  teams,
  currentUser,
  past,
  onClose,
  onSetOwnRsvp,
  onChangeOwnComment,
  onCommitOwnComment,
  onToggleAttendance,
}: {
  event: Event;
  rsvps: Rsvp[];
  attendanceMap: Record<string, AttendanceStatus>;
  /** Roh-Datensätze (für Check-in-Zeiten); api-Modus: leer */
  attendanceRecords: Attendance[];
  /** api-Modus: kein Lese-Endpoint für Anwesenheit — Hinweis im Tab */
  attendanceReadUnavailable?: boolean;
  members: Member[];
  teams: Team[];
  /** Eingeloggte Person aus der Facade (getCurrentUser) */
  currentUser: Member;
  past: boolean;
  onClose: () => void;
  /** Antwort-Pille: optimistischer Write + Toast (im Screen) */
  onSetOwnRsvp: (eventId: string, memberId: string, status: RsvpStatus, comment?: string) => void;
  /** Kommentar-Tippen: nur lokaler Zustand */
  onChangeOwnComment: (eventId: string, memberId: string, status: RsvpStatus, comment: string) => void;
  /** Kommentar-Blur: Facade-Write */
  onCommitOwnComment: (eventId: string, memberId: string, status: RsvpStatus, comment: string) => void;
  onToggleAttendance: (eventId: string, memberId: string, present: boolean) => void;
}) {
  const t = useT(termineDict);
  const { locale } = useLocale();

  const [tab, setTab] = useState<SectionTab>(past ? "attendance" : "responses");
  const [qrOpen, setQrOpen] = useState(false);

  const participants = participantsOf(event, rsvps, members);
  const counts = rsvpCounts(participants.length, rsvps);
  const att = attendanceCounts(participants, attendanceMap);
  const attendanceEditable = dayDiff(event.startsAt) <= 0;
  const own = rsvps.find((rsvp) => rsvp.memberId === currentUser.id);

  function selectOwnStatus(status: RsvpStatus) {
    if (own?.status === status) return;
    onSetOwnRsvp(event.id, currentUser.id, status, own?.comment);
  }

  const tabs: TabItem<SectionTab>[] = [
    { value: "responses", label: t("tabResponses"), count: rsvps.length },
    { value: "attendance", label: t("tabAttendance"), count: att.recorded },
  ];

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t(TYPE_LABEL_KEY[event.type])}
      title={event.title}
    >
      <div className="grid gap-5">
        {/* Meta-Block */}
        <div className="grid gap-2 text-[14px] text-ink-soft">
          <span className="inline-flex items-center gap-2">
            <Icon name="clock" className="ic h-4 w-4 flex-none text-ink-faint" />
            {formatDate(event.startsAt, locale)},{" "}
            {t("timeRange", {
              start: formatTime(event.startsAt, locale),
              end: formatTime(event.endsAt, locale),
            })}
          </span>
          <span className="inline-flex items-center gap-2">
            <Icon name="pin" className="ic h-4 w-4 flex-none text-ink-faint" />
            {event.location}
          </span>
          <span className="inline-flex items-center gap-2">
            <Icon name="members" className="ic h-4 w-4 flex-none text-ink-faint" />
            {t("invited", { n: participants.length })}
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={TYPE_TONE[event.type]}>{t(TYPE_LABEL_KEY[event.type])}</Badge>
            {teamsOf(event, teams).map((team) => (
              <Badge key={team.id} tone="neutral">
                {team.name}
              </Badge>
            ))}
          </div>
        </div>

        {event.note && (
          <div className="grid gap-1 rounded-md bg-sunken px-3.5 py-3">
            <span className="eyebrow">{t("noteTitle")}</span>
            <p className="text-[13.5px] leading-[20px] text-ink-soft">{event.note}</p>
          </div>
        )}

        {!past && <ResponseBar yes={counts.yes} no={counts.no} open={counts.open} />}

        {/* Eigene Antwort — optimistisch, nur für kommende Termine */}
        {!past && (
          <section className="grid gap-2.5 rounded-lg border border-line bg-canvas p-4">
            <div className="grid gap-0.5">
              <h3 className="text-[14px] font-bold text-ink">{t("yourResponse")}</h3>
              <p className="text-caption text-ink-faint">{t("yourResponseHint")}</p>
            </div>
            <div role="group" aria-label={t("yourResponse")} className="flex flex-wrap gap-2">
              {RSVP_OPTIONS.map((status) => {
                const active = own?.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectOwnStatus(status)}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[13px] font-bold transition-colors duration-150 ${
                      active
                        ? RSVP_ACTIVE_CLASS[status]
                        : "border-line-strong bg-surface text-ink-soft hover:bg-sunken"
                    }`}
                  >
                    {active && <Icon name="check" className="ic h-[14px] w-[14px]" />}
                    {t(RSVP_LABEL_KEY[status])}
                  </button>
                );
              })}
            </div>
            {own && (own.status === "declined" || own.status === "sick") && (
              <Textarea
                label={t("commentLabel")}
                placeholder={t("commentPh")}
                rows={2}
                value={own.comment ?? ""}
                onChange={(changeEvent) =>
                  onChangeOwnComment(event.id, currentUser.id, own.status, changeEvent.target.value)
                }
                onBlur={(blurEvent) =>
                  onCommitOwnComment(event.id, currentUser.id, own.status, blurEvent.target.value)
                }
              />
            )}
          </section>
        )}

        {/* Teilnehmer: Antworten / Anwesenheit */}
        <section className="grid gap-3">
          <Tabs
            tabs={tabs}
            value={tab}
            onChange={setTab}
            label={t("tabsLabel")}
            idBase="event-detail"
          />
          <TabPanel value="responses" active={tab} idBase="event-detail">
            <ResponsesPanel participants={participants} rsvps={rsvps} teams={teams} />
          </TabPanel>
          <TabPanel value="attendance" active={tab} idBase="event-detail">
            <AttendancePanel
              event={event}
              participants={participants}
              attendanceMap={attendanceMap}
              attendanceRecords={attendanceRecords}
              readUnavailable={attendanceReadUnavailable}
              teams={teams}
              editable={attendanceEditable}
              showQr={!past}
              onShowQr={() => setQrOpen(true)}
              onToggle={(memberId, present) => onToggleAttendance(event.id, memberId, present)}
            />
          </TabPanel>
        </section>
      </div>

      <QrCheckinModal open={qrOpen} onClose={() => setQrOpen(false)} event={event} />
    </Sheet>
  );
}
