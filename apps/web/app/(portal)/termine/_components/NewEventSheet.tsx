"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, isForbidden } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { Event, EventAudience, EventType, Team } from "@/lib/types";
import { termineDict } from "../i18n";

const FORM_ID = "new-event-form";

type FieldErrors = Partial<Record<"title" | "location" | "date" | "end" | "teams", string>>;

/**
 * „Neuer Termin“-Formular als Sheet — legt den Termin über die Facade an
 * (api-Modus: echter POST /events, mock-Modus: In-Memory). Der erzeugte
 * Termin (mit echter ID) fließt via onCreate zurück in die Liste.
 * Verein/Teams kommen als Props aus der Facade; sind Teams im api-Modus
 * nicht lesbar (NotImplemented), entfällt die Team-Pflicht mit Hinweis.
 *
 * `canPublishToClub` blendet NUR das Häkchen „Vereinsveranstaltung“ ein bzw.
 * aus (Anzeige). Die verbindliche Prüfung sitzt serverseitig — im API-Gate
 * (events.ts) UND im RLS-Trigger app.protect_event_audience (Migration 0050).
 * v1 hatte die Rechte NUR hier im Client; genau das war der Fehler dieses
 * Projekts. Wer das Häkchen per DevTools erzwingt, bekommt ein 403.
 */
export function NewEventSheet({
  open,
  onClose,
  teams,
  teamsUnavailable = false,
  canPublishToClub = false,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  teams: Team[];
  /** api-Modus: kein Teams-Endpoint — Hinweis statt Chips, keine Team-Pflicht */
  teamsUnavailable?: boolean;
  /** Vorstand (owner/admin/moderator)? Nur dann ist das Häkchen sichtbar. */
  canPublishToClub?: boolean;
  onCreate: (event: Event) => void;
}) {
  const t = useT(termineDict);
  const { showToast } = useToast();
  const teamsLabelId = useId();
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("training");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("18:30");
  const [location, setLocation] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [audience, setAudience] = useState<EventAudience>("teams");
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
    setAudience("teams");
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

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (submitting) return;
    const nextErrors: FieldErrors = {};
    if (!title.trim()) nextErrors.title = t("errTitle");
    if (!location.trim()) nextErrors.location = t("errLocation");
    if (!date) nextErrors.date = t("errDate");
    if (start && end && end <= start) nextErrors.end = t("errEnd");
    // Team-Pflicht nur, wenn Teams überhaupt wählbar sind (api: NotImplemented)
    // — und NICHT bei einer Vereinsveranstaltung: die kennt per Definition
    // keine Teams (Server: 400 bzw. 23514, Migration 0050).
    if (audience === "teams" && teams.length > 0 && teamIds.length === 0) {
      nextErrors.teams = t("errTeams");
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const created = await data.createEvent({
        type,
        title: title.trim(),
        location: location.trim(),
        startsAt: new Date(`${date}T${start}`).toISOString(),
        endsAt: new Date(`${date}T${end}`).toISOString(),
        audience,
        // Eine Vereinsveranstaltung trägt KEINE Teams — sonst stünden zwei
        // Wahrheiten nebeneinander, und der Server lehnt ab.
        teamIds: audience === "club" ? [] : teamIds,
        note: note.trim() || undefined,
      });
      onCreate(created);
      showToast(t("createdToast", { title: created.title }), { tone: "success" });
      reset();
      onClose();
    } catch (error) {
      showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), {
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
      eyebrow={t("formEyebrow")}
      title={t("formTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="plus" disabled={submitting}>
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

        {/*
          „Vereinsveranstaltung“ — nur für den Vorstand sichtbar. Ein Mitglied
          oder eine Trainerin sieht das Häkchen gar nicht erst; erzwingt es
          jemand trotzdem, antwortet der Server mit 403 (siehe Kopfkommentar).
        */}
        {canPublishToClub && (
          <label className="flex items-start gap-3 rounded-md border border-line-strong bg-surface px-3 py-3">
            <input
              type="checkbox"
              checked={audience === "club"}
              onChange={(changeEvent) => {
                setAudience(changeEvent.target.checked ? "club" : "teams");
                setErrors((previous) => ({ ...previous, teams: undefined }));
              }}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]"
            />
            <span className="grid gap-0.5">
              <span className="text-[13px] font-bold text-ink">{t("fAudience")}</span>
              <span className="text-caption leading-[18px] text-ink-faint">
                {t("fAudienceHint")}
              </span>
            </span>
          </label>
        )}

        {/* Team-Mehrfachauswahl als Chips (aria-pressed).
            Bei einer Vereinsveranstaltung entfällt sie: alle sehen den Termin. */}
        {audience === "teams" && (
        <div className="grid gap-1.5">
          <span id={teamsLabelId} className="text-[13px] font-bold text-ink">
            {t("fTeams")}
          </span>
          {teams.length > 0 ? (
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
          ) : (
            teamsUnavailable && (
              <p className="rounded-md bg-sunken px-3 py-2 text-caption leading-[18px] text-ink-soft">
                {t("teamsUnavailableHint")}
              </p>
            )
          )}
          {errors.teams ? (
            <p className="text-caption font-semibold text-danger">{errors.teams}</p>
          ) : (
            teams.length > 0 && <p className="text-caption text-ink-faint">{t("fTeamsHint")}</p>
          )}
        </div>
        )}

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
