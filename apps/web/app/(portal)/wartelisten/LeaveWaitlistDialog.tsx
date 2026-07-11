"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { WaitlistEntry } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { wartelistenDict } from "./i18n";

/** Ziel des Austragens: eigener Eintrag (self) oder Trainer entfernt fremd. */
export type LeaveTarget = {
  entry: WaitlistEntry;
  mode: "self" | "trainer";
  /** Anzeigename des Mitglieds — nur für die Trainer-Variante. */
  memberName?: string;
};

/**
 * Bestätigungs-Dialog fürs Austragen/Entfernen (leaveWaitlist). Wird BEWUSST nie
 * automatisch bestätigt — der Löschlauf startet nur über den expliziten Klick.
 * Erfolg: Toast + onLeft() + schließen; 403 → Klartext-Toast, Dialog bleibt
 * offen. Die verbindliche Autorisierung bleibt serverseitig.
 */
export function LeaveWaitlistDialog({
  target,
  onClose,
  onLeft,
}: {
  target: LeaveTarget | null;
  onClose: () => void;
  onLeft: () => void;
}) {
  const t = useT(wartelistenDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const isTrainer = target?.mode === "trainer";

  const confirm = async () => {
    if (!target || submitting) return;
    setSubmitting(true);
    try {
      await data.leaveWaitlist(target.entry.id);
      showToast(t("leftToast"), { tone: "success" });
      onLeft();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbiddenManage") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      eyebrow={t("leaveEyebrow")}
      title={isTrainer ? t("leaveTitleTrainer") : t("leaveTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={submitting}>
            {isTrainer ? t("removeConfirm") : t("leaveConfirm")}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-soft">
        {isTrainer ? t("leaveBodyTrainer", { name: target?.memberName ?? "" }) : t("leaveBody")}
      </p>
    </Modal>
  );
}
