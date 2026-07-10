"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { CreateTrainingSlotInput, UpdateTrainingSlotInput } from "@/lib/data";
import type { Facility, Member, MemberRole, Team, TrainingSlot, Weekday } from "@/lib/types";
import { weekdayLabels } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { trainingsplanDict } from "../i18n";
import { hhmm, WEEKDAY_ORDER } from "../helpers";

/**
 * Anlegen ODER Bearbeiten einer Trainingszeit über die Facade
 * (data.createTrainingSlot / data.updateTrainingSlot). Nur für Trainer:innen
 * (is_club_trainer) — die Sichtbarkeit ist Komfort, die Wahrheit bleibt
 * serverseitig (RLS/API). Erfolg: Toast + onSaved() (Reload) + schließen.
 * Fehler: Toast (403 → Klartext), Dialog bleibt für einen erneuten Versuch offen.
 * Es findet KEIN optimistisches Update statt — bei Fehler bleibt der Plan wie er war.
 */
export type SlotFormValue = { mode: "create" } | { mode: "edit"; slot: TrainingSlot };

/** Rollen, die als Trainer:in an einem Slot in Frage kommen (COACH_ROLES). */
const COACH_ROLES: readonly MemberRole[] = [
  "owner",
  "admin",
  "moderator",
  "coach",
  "guest_coach",
];

export function SlotFormDialog({
  value,
  teams,
  facilities,
  members,
  onClose,
  onSaved,
}: {
  value: SlotFormValue;
  teams: Team[];
  facilities: Facility[];
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(trainingsplanDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const isEdit = value.mode === "edit";
  const initial = isEdit ? value.slot : undefined;

  const [weekday, setWeekday] = useState<Weekday>(initial?.weekday ?? 0);
  const [start, setStart] = useState(initial ? hhmm(initial.startsTime) : "17:00");
  const [end, setEnd] = useState(initial ? hhmm(initial.endsTime) : "18:30");
  const [teamId, setTeamId] = useState(initial?.teamId ?? "");
  const [facilityId, setFacilityId] = useState(initial?.facilityId ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [coachMemberId, setCoachMemberId] = useState(initial?.coachMemberId ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  const [endError, setEndError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const coachOptions = useMemo(
    () =>
      members
        .filter((m) => COACH_ROLES.includes(m.role))
        .sort((a, b) => fullName(a).localeCompare(fullName(b), "de")),
    [members],
  );

  const submit = async () => {
    if (submitting) return;
    if (!start || !end || end <= start) {
      setEndError(t("fEndError"));
      return;
    }

    const trimmedLocation = location.trim();
    const trimmedNote = note.trim();
    const slotLabel = `${weekdayLabels[weekday][locale]} ${start}`;

    setSubmitting(true);
    try {
      if (value.mode === "create") {
        const input: CreateTrainingSlotInput = {
          weekday,
          startsTime: start,
          endsTime: end,
          teamId: teamId || undefined,
          facilityId: facilityId || undefined,
          location: trimmedLocation || undefined,
          coachMemberId: coachMemberId || undefined,
          note: trimmedNote || undefined,
        };
        await data.createTrainingSlot(input);
        showToast(t("createdToast", { slot: slotLabel }), { tone: "success" });
      } else {
        const patch: UpdateTrainingSlotInput = {
          weekday,
          startsTime: start,
          endsTime: end,
          teamId: teamId || null,
          facilityId: facilityId || null,
          location: trimmedLocation || null,
          coachMemberId: coachMemberId || null,
          note: trimmedNote || null,
        };
        await data.updateTrainingSlot(value.slot.id, patch);
        showToast(t("updatedToast", { slot: slotLabel }), { tone: "success" });
      }
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={isEdit ? t("editEyebrow") : t("createEyebrow")}
      title={isEdit ? t("editTitle") : t("createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button icon="check" onClick={submit} disabled={submitting}>
            {isEdit ? t("save") : t("create")}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Select
          label={t("fWeekday")}
          value={String(weekday)}
          onChange={(event) => setWeekday(Number(event.target.value) as Weekday)}
        >
          {WEEKDAY_ORDER.map((w) => (
            <option key={w} value={w}>
              {weekdayLabels[w][locale]}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("fStart")}
            type="time"
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              if (endError) setEndError(undefined);
            }}
          />
          <Input
            label={t("fEnd")}
            type="time"
            value={end}
            error={endError}
            onChange={(event) => {
              setEnd(event.target.value);
              if (endError) setEndError(undefined);
            }}
          />
        </div>

        {teams.length > 0 && (
          <Select
            label={t("fTeam")}
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
          >
            <option value="">{t("fTeamNone")}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        )}

        {facilities.length > 0 && (
          <Select
            label={t("fFacility")}
            value={facilityId}
            onChange={(event) => setFacilityId(event.target.value)}
          >
            <option value="">{t("fFacilityNone")}</option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </Select>
        )}

        <Input
          label={t("fLocation")}
          hint={t("fLocationHint")}
          placeholder={t("fLocationPlaceholder")}
          autoComplete="off"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />

        {coachOptions.length > 0 && (
          <Select
            label={t("fCoach")}
            value={coachMemberId}
            onChange={(event) => setCoachMemberId(event.target.value)}
          >
            <option value="">{t("fCoachNone")}</option>
            {coachOptions.map((member) => (
              <option key={member.id} value={member.id}>
                {fullName(member)}
              </option>
            ))}
          </Select>
        )}

        <Textarea
          label={t("fNote")}
          placeholder={t("fNotePlaceholder")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        <button type="submit" className="sr-only">
          {isEdit ? t("save") : t("create")}
        </button>
      </form>
    </Modal>
  );
}
