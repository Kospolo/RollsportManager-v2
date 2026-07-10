"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { DutyEntry } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { pflichtstundenDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen eines eigenen Eintrags. Wird
 * BEWUSST nie automatisch bestätigt — der Löschlauf startet nur über den
 * expliziten Klick. Erfolg: Toast + onDeleted() + schließen; 403 bleibt als
 * Klartext-Toast, der Dialog bleibt offen (Rollback).
 */
export function DeleteEntryDialog({
  entry,
  onClose,
  onDeleted,
}: {
  entry: DutyEntry | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(pflichtstundenDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!entry || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteDutyEntry(entry.id);
      showToast(t("deletedToast"), { tone: "success" });
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
      open={entry !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={t("deleteTitle")}
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
