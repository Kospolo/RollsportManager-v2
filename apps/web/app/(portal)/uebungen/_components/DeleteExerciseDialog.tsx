"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Exercise } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { uebungenDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen einer Übung. Es wird BEWUSST nie
 * automatisch bestätigt — der Löschlauf startet ausschließlich über den
 * expliziten „Übung löschen"-Klick. Erfolg: Toast + onDeleted() + schließen;
 * 403 bleibt als Klartext-Toast, der Dialog bleibt offen.
 */
export function DeleteExerciseDialog({
  exercise,
  onClose,
  onDeleted,
}: {
  exercise: Exercise | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(uebungenDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!exercise || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteExercise(exercise.id);
      showToast(t("deletedToast", { name: exercise.name }), { tone: "success" });
      onDeleted();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={exercise !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={exercise ? t("deleteTitle", { name: exercise.name }) : ""}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={submitting}>
            {t("deleteConfirm")}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-soft">{t("deleteBody")}</p>
    </Modal>
  );
}
