"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { MemberCoachNote } from "@/lib/api/generated";
import { data, errorMessage, isForbidden } from "@/lib/data";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { profileDict } from "./profile-i18n";

/**
 * Bestaetigungs-Dialog fuer das (serverseitig soft-)Loeschen einer INTERNEN
 * Trainer-Notiz (0069) — Verfasserin oder Vereinsleitung.
 *
 * Wird NIE automatisch bestaetigt: der Loeschlauf startet ausschliesslich ueber
 * den ausdruecklichen Klick auf den Danger-Knopf. Das ist hier keine Formalie —
 * es geht um Text ueber ein Kind, und ein versehentliches Loeschen faellt
 * niemandem auf, weil ausser der Verfasserin ohnehin kaum jemand mitliest.
 *
 * Der Text im Kasten sagt bewusst NICHT nur "kann nicht rueckgaengig gemacht
 * werden", sondern auch, dass genau das hier in Ordnung ist: eine interne
 * Notiz, die ihren Zweck erfuellt hat, SOLL verschwinden (Art. 5 Abs. 1 lit. e
 * DSGVO — Speicherbegrenzung). Eine Loeschfrist-Automatik gibt es nicht; das
 * hier ist der manuelle Weg, und er darf sich nicht wie ein Fehler anfuehlen.
 *
 * 403 bleibt ein ruhiger Klartext-Toast, der Dialog bleibt offen.
 */
export function CoachNoteDeleteDialog({
  note,
  onClose,
  onDeleted,
}: {
  note: MemberCoachNote | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const tp = useT(profileDict);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!note || submitting) return;
    setSubmitting(true);
    try {
      await data.deleteMemberCoachNote(note.id);
      showToast(tp("cnDeleted"), { tone: "success" });
      onDeleted();
      onClose();
    } catch (error) {
      showToast(isForbidden(error) ? tp("cnDeleteForbidden") : errorMessage(error), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={note !== null}
      onClose={onClose}
      eyebrow={tp("cnDeleteEyebrow")}
      title={tp("cnDeleteTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {tp("cnCancel")}
          </Button>
          <Button variant="danger" onClick={() => void confirm()} disabled={submitting}>
            {tp("cnDeleteConfirm")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <p className="text-body text-ink-soft">{tp("cnDeleteBody")}</p>
        {note && (
          // Der Wortlaut steht mit im Dialog: wer loescht, soll sehen, WAS er
          // loescht — nicht nur, DASS er loescht.
          <p className="rounded-xl bg-sunken p-4 text-[14px] leading-[21px] text-ink">
            {note.body}
          </p>
        )}
      </div>
    </Modal>
  );
}
