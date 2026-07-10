"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { CreateDutyEntryInput, UpdateDutyEntryInput } from "@/lib/data";
import type { DutyEntry, DutyKind, Id } from "@/lib/types";
import { dutyKindLabels } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { pflichtstundenDict, DUTY_KIND_ORDER } from "../i18n";
import { todayISODate } from "../logic";

const FORM_ID = "duty-entry-form";

/** create = neuer Eintrag für das eigene Mitglied; edit = bestehenden ändern. */
export type LogHoursValue =
  | { mode: "create" }
  | { mode: "edit"; entry: DutyEntry };

/**
 * „Stunden erfassen"-Sheet (Datum + Stunden + Art + Notiz) über die Facade
 * (data.createDutyEntry / data.updateDutyEntry). Selbst-Service: der Eintrag
 * läuft FEST auf das eigene Mitglied (memberId). `approved` wird hier NIE
 * gesetzt — das dürfen serverseitig nur Trainer:innen (DB-Trigger + 403).
 * Erfolg: Toast + onSaved() + schließen; 403 → Klartext-Toast, Sheet bleibt.
 */
export function LogHoursSheet({
  value,
  memberId,
  onClose,
  onSaved,
}: {
  value: LogHoursValue;
  /** Eigenes Mitglied — nur beim Anlegen relevant. */
  memberId: Id;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(pflichtstundenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const isEdit = value.mode === "edit";
  const initial = value.mode === "edit" ? value.entry : null;

  const today = useMemo(() => todayISODate(), []);
  const [date, setDate] = useState(initial?.activityDate ?? today);
  const [hours, setHours] = useState(initial ? String(initial.hours) : "");
  const [kind, setKind] = useState<DutyKind>(initial?.kind ?? "training");
  const [note, setNote] = useState(initial?.note ?? "");

  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const [hoursError, setHoursError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;

    let ok = true;
    const parsedHours = Number(hours.trim().replace(",", "."));
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      setHoursError(t("fHoursError"));
      ok = false;
    }
    if (!date || date > today) {
      setDateError(t("fDateError"));
      ok = false;
    }
    if (!ok) return;

    setSubmitting(true);
    try {
      if (value.mode === "edit") {
        const patch: UpdateDutyEntryInput = {
          hours: parsedHours,
          activityDate: date,
          kind,
          note: note.trim() ? note.trim() : null,
        };
        await data.updateDutyEntry(value.entry.id, patch);
        showToast(t("updatedToast"), { tone: "success" });
      } else {
        const input: CreateDutyEntryInput = {
          memberId,
          hours: parsedHours,
          activityDate: date,
          kind,
          note: note.trim() || undefined,
        };
        await data.createDutyEntry(input);
        showToast(t("createdToast"), { tone: "success" });
      }
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={isEdit ? t("editEyebrow") : t("createEyebrow")}
      title={isEdit ? t("editTitle") : t("createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="check" disabled={submitting}>
            {isEdit ? t("save") : t("create")}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          label={t("fDate")}
          type="date"
          max={today}
          error={dateError}
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            if (dateError) setDateError(undefined);
          }}
        />

        <Input
          label={t("fHours")}
          type="number"
          min={0.5}
          step={0.5}
          inputMode="decimal"
          autoComplete="off"
          hint={t("fHoursHint")}
          error={hoursError}
          value={hours}
          onChange={(event) => {
            setHours(event.target.value);
            if (hoursError) setHoursError(undefined);
          }}
        />

        <Select
          label={t("fKind")}
          value={kind}
          onChange={(event) => setKind(event.target.value as DutyKind)}
        >
          {DUTY_KIND_ORDER.map((kindValue) => (
            <option key={kindValue} value={kindValue}>
              {dutyKindLabels[kindValue][locale]}
            </option>
          ))}
        </Select>

        <Textarea
          label={t("fNote")}
          placeholder={t("fNotePlaceholder")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </form>
    </Sheet>
  );
}
