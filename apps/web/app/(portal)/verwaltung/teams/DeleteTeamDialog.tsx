"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Team } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { teamsDict } from "./i18n";

/**
 * Bestätigungs-Dialog für das (Soft-)Löschen eines Teams. Es wird BEWUSST nie
 * automatisch bestätigt — der Löschlauf startet ausschließlich über den
 * expliziten „Team löschen“-Klick. Erfolg: Toast + onDeleted() + schließen;
 * 403 bleibt als Klartext-Toast, der Dialog bleibt offen.
 */
export function DeleteTeamDialog({
  team,
  onClose,
  onDeleted,
}: {
  team: Team | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(teamsDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!team || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteTeam(team.id);
      showToast(t("deletedToast", { name: team.name }), { tone: "success" });
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
      open={team !== null}
      onClose={onClose}
      eyebrow={t("deleteEyebrow")}
      title={team ? t("deleteTitle", { team: team.name }) : ""}
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
