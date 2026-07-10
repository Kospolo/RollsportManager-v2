"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { club, teams } from "@/lib/mock";
import type { Event, EventType } from "@/lib/types";
import { termineDict } from "../i18n";

const FORM_ID = "new-event-form";

type FieldErrors = Partial<Record<"title" | "location" | "date" | "end" | "teams", string>>;

/**
 * „Neuer Termin“-Formular als Sheet — rein lokaler State + Toast,
 * kein Backend. Validierung in Klartext unter den Feldern (Field-Set).
 */
export function NewEventSheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (event: Event) => void;
}) {
  const t = useT(termineDict);
  const { showToast } = useToast();
  const teamsLabelId = useId();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("training");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("18:30");
  const [location, setLocation] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  function reset() {
    setTitle("");
    setType("training");
    setDate("");
    setStart("17:00");
    setEnd("18:30");
    setLocation("");
    setTeamIds([]);
    setNote("");
    setErrors({});
  }

  function toggleTeam(teamId: string) {
    setTeamIds((previous) =>
      previous.includes(teamId)
        ? previous.filter((id) => id !== teamId)
        : [...previous, teamId],
    );
    setErrors((previous) => ({ ...previous, teams: undefined }));
  }

  function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!title.trim()) nextErrors.title = t("errTitle");
    if (!location.trim()) nextErrors.location = t("errLocation");
    if (!date) nextErrors.date = t("errDate");
    if (start && end && end <= start) nextErrors.end = t("errEnd");
    if (teamIds.length === 0) nextErrors.teams = t("errTeams");
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    const created: Event = {
      id: `e-local-${Date.now()}`,
      clubId: club.id,
      type,
      title: title.trim(),
      location: location.trim(),
      startsAt: new Date(`${date}T${start}`).toISOString(),
      endsAt: new Date(`${date}T${end}`).toISOString(),
      teamIds,
      rsvps: [],
      note: note.trim() || undefined,
    };
    onCreate(created);
    showToast(t("createdToast", { title: created.title }), { tone: "success" });
    reset();
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={t("formEyebrow")}
      title={t("formTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="plus">
            {t("submit")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid gap-4">
        <Input
          label={t("fTitle")}
          placeholder={t("fTitlePh")}
          value={title}
          error={errors.title}
          onChange={(changeEvent) => {
            setTitle(changeEvent.target.value);
            setErrors((previous) => ({ ...previous, title: undefined }));
          }}
        />

        <Select
          label={t("fType")}
          value={type}
          onChange={(changeEvent) => setType(changeEvent.target.value as EventType)}
        >
          <option value="training">{t("typeTraining")}</option>
          <option value="competition">{t("typeCompetition")}</option>
          <option value="other">{t("typeOther")}</option>
        </Select>

        <Input
          label={t("fDate")}
          type="date"
          value={date}
          error={errors.date}
          onChange={(changeEvent) => {
            setDate(changeEvent.target.value);
            setErrors((previous) => ({ ...previous, date: undefined }));
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("fStart")}
            type="time"
            value={start}
            onChange={(changeEvent) => setStart(changeEvent.target.value)}
          />
          <Input
            label={t("fEnd")}
            type="time"
            value={end}
            error={errors.end}
            onChange={(changeEvent) => {
              setEnd(changeEvent.target.value);
              setErrors((previous) => ({ ...previous, end: undefined }));
            }}
          />
        </div>

        <Input
          label={t("fLocation")}
          placeholder={t("fLocationPh")}
          value={location}
          error={errors.location}
          onChange={(changeEvent) => {
            setLocation(changeEvent.target.value);
            setErrors((previous) => ({ ...previous, location: undefined }));
          }}
        />

        {/* Team-Mehrfachauswahl als Chips (aria-pressed) */}
        <div className="grid gap-1.5">
          <span id={teamsLabelId} className="text-[13px] font-bold text-ink">
            {t("fTeams")}
          </span>
          <div role="group" aria-labelledby={teamsLabelId} className="flex flex-wrap gap-2">
            {teams.map((team) => {
              const active = teamIds.includes(team.id);
              return (
                <button
                  key={team.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleTeam(team.id)}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[13px] font-bold transition-colors duration-150 ${
                    active
                      ? "border-transparent bg-brand-soft text-brand-ink"
                      : "border-line-strong bg-surface text-ink-soft hover:bg-sunken"
                  }`}
                >
                  {team.name}
                </button>
              );
            })}
          </div>
          {errors.teams ? (
            <p className="text-caption font-semibold text-danger">{errors.teams}</p>
          ) : (
            <p className="text-caption text-ink-faint">{t("fTeamsHint")}</p>
          )}
        </div>

        <Textarea
          label={t("fNote")}
          placeholder={t("fNotePh")}
          rows={3}
          value={note}
          onChange={(changeEvent) => setNote(changeEvent.target.value)}
        />
      </form>
    </Sheet>
  );
}
