"use client";

import { useMemo } from "react";
import type { Facility, FacilityBooking, Member, Team } from "@/lib/types";
import { memberById } from "@/lib/data";
import { useLocale, useT } from "@/lib/i18n";
import { formatDate, formatTime, relativeDays } from "@/lib/format";
import { Sheet } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { belegungsplanDict } from "../i18n";
import {
  KIND_LABEL_KEY,
  STATUS_LABEL_KEY,
  STATUS_TONE,
  groupBookingsByDay,
  hasConflict,
  upcomingBookings,
} from "../helpers";

/**
 * Detail-Sheet einer Halle: Stammdaten (Art, Ort, Kapazität, Hinweise) und die
 * kommenden Buchungen nach Datum gruppiert. „Hier buchen" öffnet das
 * Buchen-Sheet (Halle vorbelegt). Trainer:innen (canManageFacility) bekommen
 * Bearbeiten/Löschen der Halle; einzelne Buchungen darf löschen, wer sie
 * angelegt hat oder Trainer:in ist (canDeleteBooking). Überschneidungen werden
 * je Buchung als Warn-Chip markiert.
 */
export function FacilityDetailSheet({
  facility,
  bookings,
  members,
  teams,
  canManageFacility,
  canDeleteBooking,
  onBook,
  onEditFacility,
  onDeleteFacility,
  onDeleteBooking,
  onClose,
}: {
  facility: Facility;
  /** Buchungen genau dieser Halle (für Liste + Überschneidungs-Markierung). */
  bookings: FacilityBooking[];
  members: Member[];
  teams: Team[];
  canManageFacility: boolean;
  canDeleteBooking: (booking: FacilityBooking) => boolean;
  onBook: () => void;
  onEditFacility: () => void;
  onDeleteFacility: () => void;
  onDeleteBooking: (booking: FacilityBooking) => void;
  onClose: () => void;
}) {
  const t = useT(belegungsplanDict);
  const { locale } = useLocale();

  const days = useMemo(
    () => groupBookingsByDay(upcomingBookings(bookings)),
    [bookings],
  );

  const teamName = (teamId?: string) =>
    teamId ? teams.find((team) => team.id === teamId)?.name : undefined;
  const bookerName = (booking: FacilityBooking) => {
    const member = memberById(members, booking.bookedByMemberId);
    return member ? `${member.firstName} ${member.lastName}` : t("unknownMember");
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("detailEyebrow")}
      title={facility.name}
      footer={
        canManageFacility ? (
          <>
            <Button variant="danger" onClick={onDeleteFacility}>
              {t("deleteAction")}
            </Button>
            <Button variant="ghost" icon="edit" onClick={onEditFacility}>
              {t("editAction")}
            </Button>
            <Button icon="events" onClick={onBook}>
              {t("bookHere")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              {t("close")}
            </Button>
            <Button icon="events" onClick={onBook}>
              {t("bookHere")}
            </Button>
          </>
        )
      }
    >
      <div className="grid gap-5">
        {/* Stammdaten */}
        <div className="grid gap-3">
          <div>
            <Badge tone="brand">{t(KIND_LABEL_KEY[facility.kind])}</Badge>
          </div>
          {facility.address && (
            <MetaRow icon="globe" label={t("metaAddress")}>
              {facility.address}
            </MetaRow>
          )}
          {facility.capacity !== undefined && (
            <MetaRow icon="members" label={t("metaCapacity")}>
              {t("metaCapacityValue", { n: facility.capacity })}
            </MetaRow>
          )}
          {facility.notes && (
            <MetaRow icon="pin" label={t("metaNotes")}>
              {facility.notes}
            </MetaRow>
          )}
        </div>

        {/* Kommende Buchungen */}
        <section className="grid gap-3">
          <h3 className="eyebrow">{t("upcomingHeading")}</h3>

          {days.length === 0 ? (
            <p className="rounded-md bg-sunken px-3 py-3 text-caption leading-[18px] text-ink-soft">
              {t("detailNoUpcoming")}
            </p>
          ) : (
            <div className="grid gap-4">
              {days.map((day) => (
                <div key={day.key} className="grid gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-bold text-ink">
                      {formatDate(day.iso, locale)}
                    </span>
                    <span className="text-caption text-ink-faint">
                      {relativeDays(day.iso, locale)}
                    </span>
                  </div>
                  <ul className="grid list-none gap-2">
                    {day.bookings.map((booking) => (
                      <li
                        key={booking.id}
                        className="grid gap-2 rounded-md border border-line bg-canvas p-3"
                      >
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="font-mono text-mono-table tabular-nums text-ink">
                            {formatTime(booking.startsAt, locale)}–
                            {formatTime(booking.endsAt, locale)}
                          </span>
                          <Badge tone={STATUS_TONE[booking.status]}>
                            {t(STATUS_LABEL_KEY[booking.status])}
                          </Badge>
                          {hasConflict(booking, bookings) && (
                            <Badge tone="warn" icon="zap">
                              {t("conflictBadge")}
                            </Badge>
                          )}
                        </div>

                        <span className="text-body font-semibold text-ink">{booking.title}</span>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-soft">
                          <span className="inline-flex items-center gap-1.5">
                            <Icon name="user" className="ic h-[14px] w-[14px] text-ink-faint" />
                            {t("bookedBy", { name: bookerName(booking) })}
                          </span>
                          {teamName(booking.teamId) && (
                            <span className="inline-flex items-center gap-1.5">
                              <Icon name="teams" className="ic h-[14px] w-[14px] text-ink-faint" />
                              {teamName(booking.teamId)}
                            </span>
                          )}
                          {canDeleteBooking(booking) && (
                            <button
                              type="button"
                              onClick={() => onDeleteBooking(booking)}
                              className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-caption font-semibold text-danger transition-colors duration-150 hover:bg-danger-soft"
                            >
                              <Icon name="close" className="ic h-[13px] w-[13px]" />
                              {t("bookingDeleteAction")}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Sheet>
  );
}

/** Meta-Zeile im Detail: Icon + Label + Wert. */
function MetaRow({
  icon,
  label,
  children,
}: {
  icon: "globe" | "members" | "pin";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-caption text-ink-faint">
        <Icon name={icon} className="ic h-[14px] w-[14px]" />
        {label}
      </span>
      <span className="whitespace-pre-line text-body text-ink">{children}</span>
    </div>
  );
}
