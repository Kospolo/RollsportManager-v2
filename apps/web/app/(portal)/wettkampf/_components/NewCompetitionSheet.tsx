"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, isForbidden } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { Competition, CompetitionStatus } from "@/lib/types";
import { wettkampfDict } from "../i18n";

const FORM_ID = "new-competition-form";

type FieldErrors = Partial<Record<"name" | "location" | "date" | "end", string>>;

/** ISO-Zeitstempel → lokales Datum (YYYY-MM-DD) fürs date-Feld. */
function toDateInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** ISO-Zeitstempel → lokale Uhrzeit (HH:mm) fürs time-Feld. */
function toTimeInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Wettkampf-Formular als Sheet — legt einen Wettkampf über die Facade an ODER
 * bearbeitet einen bestehenden (Prop `competition` gesetzt). Anlegen: POST
 * /competitions (mock: mutiert mock.competitions). Bearbeiten: PATCH
 * /competitions/{id} über data.updateCompetition, mit den Feldern aus dem
 * Wettkampf vorbefüllt. Nach Erfolg meldet onSaved zurück — der Screen lädt die
 * Liste neu (reload).
 *
 * Das Sheet trägt die STAMMDATEN (Name, Ort, Zeiten, Meldeschluss, Status). Die
 * Startliste (Meldungen) wird im Meldungen-Tab gepflegt, nicht hier.
 *
 * Nur Anzeige-Gating: sichtbar ist das Sheet ausschließlich für den Trainerstab
 * (WettkampfClient). Die verbindliche Prüfung sitzt serverseitig (RLS +
 * API-Gate competitions.ts); ein 403 kommt als sauberer Toast zurück.
 */
export function NewCompetitionSheet({
  open,
  onClose,
  competition,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Gesetzt = Bearbeiten-Modus: Felder vorbefüllen, data.updateCompetition statt createCompetition. */
  competition?: Competition;
  /** Nach erfolgreichem Anlegen/Bearbeiten — der Screen lädt die Liste neu. */
  onSaved: (competition: Competition) => void;
}) {
  const t = useT(wettkampfDict);
  const { showToast } = useToast();
  const isEdit = competition !== undefined;
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState(competition?.name ?? "");
  const [location, setLocation] = useState(competition?.location ?? "");
  const [date, setDate] = useState(competition ? toDateInput(competition.startsAt) : "");
  const [start, setStart] = useState(competition ? toTimeInput(competition.startsAt) : "09:00");
  const [end, setEnd] = useState(
    competition?.endsAt ? toTimeInput(competition.endsAt) : "17:00",
  );
  const [deadline, setDeadline] = useState(competition?.registrationDeadline ?? "");
  const [status, setStatus] = useState<CompetitionStatus>(competition?.status ?? "upcoming");
  const [errors, setErrors] = useState<FieldErrors>({});

  function reset() {
    setName("");
    setLocation("");
    setDate("");
    setStart("09:00");
    setEnd("17:00");
    setDeadline("");
    setStatus("upcoming");
    setErrors({});
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (submitting) return;
    const nextErrors: FieldErrors = {};
    if (!name.trim()) nextErrors.name = t("errName");
    if (!location.trim()) nextErrors.location = t("errLocation");
    if (!date) nextErrors.date = t("errDate");
    if (start && end && end <= start) nextErrors.end = t("errEnd");
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const startsAt = new Date(`${date}T${start}`).toISOString();
      const endsAt = new Date(`${date}T${end}`).toISOString();
      const registrationDeadline = deadline ? deadline : undefined;

      if (isEdit && competition) {
        const saved = await data.updateCompetition(competition.id, {
          name: name.trim(),
          location: location.trim(),
          startsAt,
          endsAt,
          // Leerer Meldeschluss LÖSCHT die Angabe (null), nicht undefined.
          registrationDeadline: deadline ? deadline : null,
          status,
        });
        onSaved(saved);
        showToast(t("updatedToast", { name: saved.name }), { tone: "success" });
        onClose();
      } else {
        const created = await data.createCompetition({
          name: name.trim(),
          location: location.trim(),
          startsAt,
          endsAt,
          registrationDeadline,
          status,
        });
        onSaved(created);
        showToast(t("createdToast", { name: created.name }), { tone: "success" });
        reset();
        onClose();
      }
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
      title={isEdit ? t("editTitle") : t("formTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            icon={isEdit ? "check" : "plus"}
            disabled={submitting}
          >
            {isEdit ? t("saveSubmit") : t("submit")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid gap-4">
        <Input
          label={t("fName")}
          placeholder={t("fNamePh")}
          value={name}
          error={errors.name}
          onChange={(changeEvent) => {
            setName(changeEvent.target.value);
            setErrors((previous) => ({ ...previous, name: undefined }));
          }}
        />

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

        <div className="grid gap-1.5">
          <Input
            label={t("fDeadline")}
            type="date"
            value={deadline}
            onChange={(changeEvent) => setDeadline(changeEvent.target.value)}
          />
          <p className="text-caption text-ink-faint">{t("fDeadlineHint")}</p>
        </div>

        <Select
          label={t("fStatus")}
          value={status}
          onChange={(changeEvent) => setStatus(changeEvent.target.value as CompetitionStatus)}
        >
          <option value="upcoming">{t("statusUpcoming")}</option>
          <option value="running">{t("statusRunning")}</option>
          <option value="done">{t("statusDone")}</option>
        </Select>
      </form>
    </Sheet>
  );
}
