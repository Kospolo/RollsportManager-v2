"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Sparte } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { spartenDict } from "../i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen einer Sparte. Wird BEWUSST nie
 * automatisch bestätigt — der Löschlauf startet nur über den expliziten Klick.
 * Erfolg: Toast + onDeleted() + schließen; 403 bleibt als Klartext-Toast, der
 * Dialog bleibt offen.
 */
export function DeleteSparteDialog({
  sparte,
  onClose,
  onDeleted,
}: {
  sparte: Sparte | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(spartenDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!sparte || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteSparte(sparte.id);
      showToast(t("deletedToast", { name: sparte.name }), { tone: "success" });
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
      open={sparte !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={sparte ? t("deleteTitle", { name: sparte.name }) : ""}
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
