"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { budgetDict } from "../i18n";
import type { BudgetRow } from "../derive";

/**
 * Bestätigungs-Dialog fürs Entfernen einer Planzeile (deleteBudget). Löschen
 * wird NIE still ausgeführt — es braucht immer diesen expliziten Klick auf die
 * Danger-Aktion. Das Ist (Kassenbuch) bleibt unberührt; nur der Planwert fällt
 * weg (die Kategorie-Zeile zeigt danach wieder „kein Plan").
 */
export function ConfirmClearModal({
  row,
  onClose,
  onCleared,
}: {
  row: BudgetRow;
  onClose: () => void;
  onCleared: () => void;
}) {
  const t = useT(budgetDict);
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (busy || !row.budgetId) return;
    setBusy(true);
    try {
      await data.deleteBudget(row.budgetId);
      showToast(t("removedToast", { name: row.categoryName }), { tone: "success" });
      onCleared();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      eyebrow={t("planEyebrow")}
      title={t("removeTitle")}
      maxWidthClass="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={() => void confirm()} disabled={busy}>
            {t("remove")}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-soft">{t("removeBody", { name: row.categoryName })}</p>
    </Modal>
  );
}
