"use client";

import { useState } from "react";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { familieDict } from "../i18n";
import type { FamilyLink } from "../derive";

/**
 * Bestätigungs-Dialog zum Entfernen einer Familien-Verknüpfung
 * (removeGuardianship). Wird BEWUSST nie automatisch bestätigt — der Löschlauf
 * startet nur über den expliziten Klick. Entfernt nur die Zuordnung, nicht das
 * Mitglied. Erfolg: Toast + onRemoved(guardianshipId) + schließen; 403 bleibt
 * ein Klartext-Toast, der Dialog bleibt offen.
 */
export function RemoveGuardianshipDialog({
  link,
  onRemoved,
  onClose,
}: {
  link: FamilyLink | null;
  onRemoved: (guardianshipId: string) => void;
  onClose: () => void;
}) {
  const t = useT(familieDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!link || submitting) return;
    const name = fullName(link.member);
    setSubmitting(true);
    try {
      await data.removeGuardianship(link.guardianshipId);
      showToast(t("removedToast", { name }), { tone: "success" });
      onRemoved(link.guardianshipId);
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={link !== null}
      onClose={onClose}
      eyebrow={t("removeEyebrow")}
      title={link ? t("removeTitle", { name: fullName(link.member) }) : ""}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={submitting}>
            {t("removeConfirm")}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-soft">{t("removeBody")}</p>
    </Modal>
  );
}
