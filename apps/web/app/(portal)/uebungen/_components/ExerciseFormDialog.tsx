"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { CreateExerciseInput, UpdateExerciseInput } from "@/lib/data";
import type { Exercise, ExerciseCategory } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  CATEGORY_KEY,
  CATEGORY_ORDER,
  DIFFICULTY_VALUES,
  uebungenDict,
} from "../i18n";

/**
 * Anlegen ODER Bearbeiten einer Übung über die Facade (data.*Exercise). Der
 * Dialog wird vom Elternteil nur bei geöffnetem Zustand gemountet — daher
 * frische useState-Startwerte je Öffnung, kein State-Sync per Effect.
 *
 * Erfolg: Toast + onSaved() (Liste neu laden) + schließen. Fehler: Toast
 * (403 → Klartext „nur Trainer:innen"), Dialog bleibt für einen erneuten
 * Versuch offen. Die Rechte-Wahrheit bleibt serverseitig (RLS/API).
 */

export type ExerciseFormValue = { mode: "create" } | { mode: "edit"; exercise: Exercise };

const HTTP_RE = /^https?:\/\/\S+$/i;

export function ExerciseFormDialog({
  value,
  onClose,
  onSaved,
}: {
  value: ExerciseFormValue;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(uebungenDict);
  const { showToast } = useToast();
  const isEdit = value.mode === "edit";
  const initial = isEdit ? value.exercise : undefined;

  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<ExerciseCategory>(initial?.category ?? "warmup");
  const [difficulty, setDifficulty] = useState<number>(initial?.difficulty ?? 3);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [duration, setDuration] = useState(
    initial?.durationSeconds !== undefined ? String(initial.durationSeconds) : "",
  );

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [videoError, setVideoError] = useState<string | undefined>(undefined);
  const [durationError, setDurationError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;

    const trimmedName = name.trim();
    const trimmedVideo = videoUrl.trim();
    const trimmedDuration = duration.trim();
    let ok = true;

    if (!trimmedName) {
      setNameError(t("fNameError"));
      ok = false;
    }
    if (trimmedVideo && !HTTP_RE.test(trimmedVideo)) {
      setVideoError(t("fVideoError"));
      ok = false;
    }
    let durationSeconds: number | undefined;
    if (trimmedDuration) {
      const parsed = Number(trimmedDuration);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setDurationError(t("fDurationError"));
        ok = false;
      } else {
        durationSeconds = Math.round(parsed);
      }
    }
    if (!ok) return;

    const trimmedDesc = description.trim();
    const trimmedInstr = instructions.trim();

    setSubmitting(true);
    try {
      if (value.mode === "create") {
        const input: CreateExerciseInput = {
          name: trimmedName,
          category,
          difficulty,
          description: trimmedDesc || undefined,
          videoUrl: trimmedVideo || undefined,
          instructions: trimmedInstr || undefined,
          durationSeconds,
        };
        const created = await data.createExercise(input);
        showToast(t("createdToast", { name: created.name }), { tone: "success" });
      } else {
        const patch: UpdateExerciseInput = {
          name: trimmedName,
          category,
          difficulty,
          description: trimmedDesc || null,
          videoUrl: trimmedVideo || null,
          instructions: trimmedInstr || null,
          durationSeconds: durationSeconds ?? null,
        };
        const updated = await data.updateExercise(value.exercise.id, patch);
        showToast(t("updatedToast", { name: updated.name }), { tone: "success" });
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
        <Input
          label={t("fName")}
          placeholder={t("fNamePlaceholder")}
          autoComplete="off"
          error={nameError}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setNameError(undefined);
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t("fCategory")}
            value={category}
            onChange={(event) => setCategory(event.target.value as ExerciseCategory)}
          >
            {CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {t(CATEGORY_KEY[cat])}
              </option>
            ))}
          </Select>

          <Select
            label={t("fDifficulty")}
            hint={t("fDifficultyHint")}
            value={String(difficulty)}
            onChange={(event) => setDifficulty(Number(event.target.value))}
          >
            {DIFFICULTY_VALUES.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </Select>
        </div>

        <Textarea
          label={t("fDescription")}
          placeholder={t("fDescriptionPlaceholder")}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <Input
          label={t("fVideoUrl")}
          placeholder={t("fVideoPlaceholder")}
          inputMode="url"
          autoComplete="off"
          error={videoError}
          value={videoUrl}
          onChange={(event) => {
            setVideoUrl(event.target.value);
            if (videoError) setVideoError(undefined);
          }}
        />

        <Textarea
          label={t("fInstructions")}
          placeholder={t("fInstructionsPlaceholder")}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
        />

        <Input
          label={t("fDuration")}
          hint={t("fDurationHint")}
          type="number"
          min={1}
          inputMode="numeric"
          autoComplete="off"
          error={durationError}
          value={duration}
          onChange={(event) => {
            setDuration(event.target.value);
            if (durationError) setDurationError(undefined);
          }}
        />

        <button type="submit" className="sr-only">
          {isEdit ? t("save") : t("create")}
        </button>
      </form>
    </Modal>
  );
}
