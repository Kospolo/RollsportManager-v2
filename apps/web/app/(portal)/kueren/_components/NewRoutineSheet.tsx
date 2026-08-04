"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, isForbidden } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { Routine } from "@/lib/types";
import { kuerenDict } from "../i18n";

const FORM_ID = "new-routine-form";

/**
 * „Neue Kür"-Formular als Sheet — legt eine Kür über die Facade an
 * (POST /routines, mock: In-Memory). Bewusst minimal: nur Titel (Pflicht) und
 * optionale Kategorie. Musik, Marker und Läufer:innen kommen danach in der
 * Detailansicht dazu — genau der Ablauf, den die iOS-App auch fährt.
 *
 * Rechte prüft der Server (can_manage_routines); ein 403 wird als
 * „Keine Berechtigung" gezeigt, nicht als roher Fehler.
 */
export function NewRoutineSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (routine: Routine) => void;
}) {
  const t = useT(kuerenDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [titleError, setTitleError] = useState<string | undefined>(undefined);

  function reset() {
    setTitle("");
    setCategory("");
    setTitleError(undefined);
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (submitting) return;
    if (!title.trim()) {
      setTitleError(t("createErrTitle"));
      return;
    }
    setSubmitting(true);
    try {
      const created = await data.createRoutine({
        title: title.trim(),
        category: category.trim() || undefined,
      });
      onCreated(created);
      showToast(t("createdToast", { title: created.title }), { tone: "success" });
      reset();
      onClose();
    } catch (error) {
      showToast(isForbidden(error) ? t("createNoPermission") : errorMessage(error), {
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
      eyebrow={t("createSheetEyebrow")}
      title={t("createSheetTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("createCancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="plus" disabled={submitting}>
            {t("createSubmit")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid gap-4">
        <p className="rounded-lg bg-sunken px-4 py-3 text-caption leading-[19px] text-ink-soft">
          {t("createHint")}
        </p>
        <Input
          label={t("fRoutineTitle")}
          placeholder={t("fRoutineTitlePh")}
          value={title}
          error={titleError}
          onChange={(changeEvent) => {
            setTitle(changeEvent.target.value);
            setTitleError(undefined);
          }}
        />
        <Input
          label={t("fRoutineCategory")}
          placeholder={t("fRoutineCategoryPh")}
          value={category}
          onChange={(changeEvent) => setCategory(changeEvent.target.value)}
        />
      </form>
    </Sheet>
  );
}
