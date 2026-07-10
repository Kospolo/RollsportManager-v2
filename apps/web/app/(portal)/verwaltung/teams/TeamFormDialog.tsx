"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Team } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { teamsDict } from "./i18n";

/**
 * Anlegen ODER Umbenennen eines Teams (Name + optionale Altersklasse) über
 * die Facade. Der Dialog wird vom Elternteil nur bei geöffnetem Zustand
 * gemountet (frischer useState-Startwert je Öffnung) — daher kein
 * State-Sync per Effect.
 *
 * Erfolg: Toast + onSaved() (Liste neu laden) + schließen. Fehler: Toast
 * (403 → Klartext), Dialog bleibt für einen erneuten Versuch offen.
 */

export type TeamFormValue = { mode: "create" } | { mode: "edit"; team: Team };

export function TeamFormDialog({
  value,
  onClose,
  onSaved,
}: {
  value: TeamFormValue;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(teamsDict);
  const { showToast } = useToast();

  const isEdit = value.mode === "edit";

  const [name, setName] = useState(isEdit ? value.team.name : "");
  const [ageGroup, setAgeGroup] = useState(isEdit ? value.team.ageGroup : "");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("fNameError"));
      return;
    }
    const trimmedAge = ageGroup.trim();
    setSubmitting(true);
    try {
      if (value.mode === "create") {
        const created = await data.createTeam({
          name: trimmedName,
          ageGroup: trimmedAge || undefined,
        });
        showToast(t("createdToast", { name: created.name }), { tone: "success" });
      } else {
        const updated = await data.updateTeam(value.team.id, {
          name: trimmedName,
          ageGroup: trimmedAge || null,
        });
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
          error={error}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(undefined);
          }}
        />
        <Input
          label={t("fAgeGroup")}
          placeholder={t("fAgeGroupPlaceholder")}
          hint={t("fAgeGroupHint")}
          autoComplete="off"
          value={ageGroup}
          onChange={(event) => setAgeGroup(event.target.value)}
        />
        {/* Enter im Formular löst die Primäraktion aus */}
        <button type="submit" className="sr-only">
          {isEdit ? t("save") : t("create")}
        </button>
      </form>
    </Modal>
  );
}
