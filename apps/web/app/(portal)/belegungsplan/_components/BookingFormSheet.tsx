"use client";

import { useEffect, useMemo, useState } from "react";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { CreateBookingInput } from "@/lib/data";
import type { BookingStatus, Facility, FacilityBooking, Member, Team } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { belegungsplanDict } from "../i18n";
import { conflictingBookings } from "../helpers";

const FORM_ID = "booking-form";

type FieldErrors = Partial<Record<"title" | "date" | "end", string>>;

/**
 * „Halle buchen"-Sheet: legt eine Buchung über die Facade (data.createBooking)
 * an. Self-Service — Nicht-Trainer:innen buchen FEST für das eigene Mitglied
 * (bookedByMemberId = currentUser), nur Trainer:innen dürfen ein Mitglied
 * wählen und den Status setzen. Die Durchsetzung bleibt serverseitig (RLS +
 * Rollencheck); ein 403 kommt als Klartext-Toast zurück.
 *
 * Überschneidungen sind NICHT DB-erzwungen — das Sheet zeigt sie clientseitig
 * aus den geladenen Buchungen als (nicht-blockierenden) Hinweis an.
 */
export function BookingFormSheet({
  open,
  initialFacilityId,
  facilities,
  bookings,
  members,
  teams,
  currentUser,
  canChooseMember,
  onClose,
  onSaved,
}: {
  open: boolean;
  initialFacilityId: string | null;
  facilities: Facility[];
  bookings: FacilityBooking[];
  members: Member[];
  teams: Team[];
  currentUser: Member | null;
  canChooseMember: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(belegungsplanDict);
  const { showToast } = useToast();

  const [facilityId, setFacilityId] = useState("");
  const [title, setTitle] = useState("");
  const [memberId, setMemberId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("18:30");
  const [status, setStatus] = useState<BookingStatus>("confirmed");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Beim Öffnen frisch vorbelegen (Halle aus dem Detail, Mitglied = ich selbst).
  useEffect(() => {
    if (!open) return;
    setFacilityId(initialFacilityId ?? facilities[0]?.id ?? "");
    setTitle("");
    setMemberId(currentUser?.id ?? "");
    setTeamId("");
    setDate("");
    setStart("17:00");
    setEnd("18:30");
    setStatus(canChooseMember ? "confirmed" : "pending");
    setErrors({});
  }, [open, initialFacilityId, facilities, currentUser, canChooseMember]);

  const memberOptions = useMemo(
    () => [...members].sort((a, b) => fullName(a).localeCompare(fullName(b), "de")),
    [members],
  );

  // Trainer:innen: alle Teams; Mitglieder: nur die eigenen Teams (Self-Service).
  const teamOptions = useMemo(() => {
    if (canChooseMember) return teams;
    const own = new Set(currentUser?.teamIds ?? []);
    return teams.filter((team) => own.has(team.id));
  }, [teams, canChooseMember, currentUser]);

  const startsAtIso = date && start ? new Date(`${date}T${start}`).toISOString() : "";
  const endsAtIso = date && end ? new Date(`${date}T${end}`).toISOString() : "";

  const conflicts = useMemo(() => {
    if (!facilityId || !startsAtIso || !endsAtIso || endsAtIso <= startsAtIso) return [];
    return conflictingBookings(bookings, facilityId, startsAtIso, endsAtIso);
  }, [bookings, facilityId, startsAtIso, endsAtIso]);

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (submitting) return;

    const nextErrors: FieldErrors = {};
    if (!title.trim()) nextErrors.title = t("bTitleError");
    if (!date) nextErrors.date = t("bDateError");
    if (start && end && end <= start) nextErrors.end = t("bEndError");
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const bookedByMemberId = canChooseMember ? memberId : currentUser?.id;
    if (!facilityId || !bookedByMemberId) return;

    setSubmitting(true);
    try {
      const input: CreateBookingInput = {
        facilityId,
        bookedByMemberId,
        teamId: teamId || undefined,
        title: title.trim(),
        startsAt: new Date(`${date}T${start}`).toISOString(),
        endsAt: new Date(`${date}T${end}`).toISOString(),
        status: canChooseMember ? status : "pending",
      };
      const created = await data.createBooking(input);
      showToast(t("bookingCreatedToast", { title: created.title }), { tone: "success" });
      onSaved();
      onClose();
    } catch (error) {
      showToast(isForbidden(error) ? t("forbiddenBooking") : errorMessage(error), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={t("bookEyebrow")}
      title={t("bookTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="check" disabled={submitting}>
            {t("bSubmit")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid gap-4">
        <Select
          label={t("bFacility")}
          value={facilityId}
          onChange={(event) => setFacilityId(event.target.value)}
        >
          {facilities.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.name}
            </option>
          ))}
        </Select>

        <Input
          label={t("bTitle")}
          placeholder={t("bTitlePlaceholder")}
          autoComplete="off"
          value={title}
          error={errors.title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (errors.title) setErrors((previous) => ({ ...previous, title: undefined }));
          }}
        />

        {canChooseMember ? (
          <Select
            label={t("bMember")}
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
          >
            {memberOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {fullName(member)}
              </option>
            ))}
          </Select>
        ) : (
          <div className="grid gap-1.5">
            <span className="text-[13px] font-bold text-ink">{t("bMember")}</span>
            <span className="inline-flex min-h-11 items-center gap-2 rounded-md bg-sunken px-4 text-body text-ink">
              <Icon name="user" className="ic h-[16px] w-[16px] text-ink-faint" />
              {currentUser ? fullName(currentUser) : t("bMemberSelf")}
            </span>
            <p className="text-caption text-ink-faint">{t("bMemberSelfHint")}</p>
          </div>
        )}

        {teamOptions.length > 0 && (
          <Select
            label={t("bTeam")}
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
          >
            <option value="">{t("bTeamNone")}</option>
            {teamOptions.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        )}

        <Input
          label={t("bDate")}
          type="date"
          value={date}
          error={errors.date}
          onChange={(event) => {
            setDate(event.target.value);
            if (errors.date) setErrors((previous) => ({ ...previous, date: undefined }));
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("bStart")}
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
          <Input
            label={t("bEnd")}
            type="time"
            value={end}
            error={errors.end}
            onChange={(event) => {
              setEnd(event.target.value);
              if (errors.end) setErrors((previous) => ({ ...previous, end: undefined }));
            }}
          />
        </div>

        {canChooseMember ? (
          <Select
            label={t("bStatus")}
            value={status}
            onChange={(event) => setStatus(event.target.value as BookingStatus)}
          >
            <option value="confirmed">{t("statusConfirmed")}</option>
            <option value="pending">{t("statusPending")}</option>
          </Select>
        ) : (
          <p className="rounded-md bg-sunken px-3 py-2 text-caption leading-[18px] text-ink-soft">
            {t("bStatusMemberHint")}
          </p>
        )}

        {conflicts.length > 0 && (
          <div className="grid gap-1 rounded-md bg-warn-soft px-3 py-2.5 text-caption text-warn">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Icon name="zap" className="ic h-[15px] w-[15px]" />
              {conflicts.length === 1
                ? t("bConflictOne")
                : t("bConflictMany", { n: conflicts.length })}
            </span>
            <span className="text-ink-soft">{t("bConflictHint")}</span>
          </div>
        )}
      </form>
    </Sheet>
  );
}
