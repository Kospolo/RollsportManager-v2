"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage } from "@/lib/data";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { supportDict } from "./i18n";

/**
 * Ein Anliegen aufmachen: Betreff + Beschreibung, beides Pflicht (der Vertrag
 * verlangt es ebenfalls — ein Ticket ohne Text ist für den Betreiber wertlos).
 *
 * Der Dialog wird vom Elternteil nur im geöffneten Zustand gemountet, daher
 * frischer useState je Öffnung und kein State-Sync per Effect (wie bei
 * NoteFormDialog).
 *
 * Erfolg: Toast + onCreated(ticketId) — der Aufrufer springt direkt in den
 * neuen Verlauf. Fehler: Toast, Dialog bleibt offen (Eingabe geht nie verloren).
 */
export function NewTicketDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (ticketId: string) => void;
}) {
  const t = useT(supportDict);
  const { showToast } = useToast();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [subjectError, setSubjectError] = useState<string | undefined>(undefined);
  const [bodyError, setBodyError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();

    setSubjectError(trimmedSubject === "" ? t("fRequired") : undefined);
    setBodyError(trimmedBody === "" ? t("fRequired") : undefined);
    if (trimmedSubject === "" || trimmedBody === "") return;

    setSubmitting(true);
    try {
      const created = await data.createSupportTicket({
        subject: trimmedSubject,
        body: trimmedBody,
      });
      showToast(t("createdToast"), { tone: "success" });
      onCreated(created.id);
    } catch (error) {
      // 403 (kein Vorstand) landet genauso hier wie ein Netzfehler — die
      // Meldung des Servers ist bilingual und wird direkt gezeigt.
      showToast(errorMessage(error) || t("genericError"), { tone: "danger" });
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={t("createEyebrow")}
      title={t("createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Input
          label={t("fSubject")}
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value);
            if (subjectError) setSubjectError(undefined);
          }}
          placeholder={t("fSubjectPlaceholder")}
          maxLength={200}
          error={subjectError}
        />
        <Textarea
          label={t("fBody")}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            if (bodyError) setBodyError(undefined);
          }}
          placeholder={t("fBodyPlaceholder")}
          rows={6}
          maxLength={10000}
          error={bodyError}
        />
        {/* Ehrlichkeit statt Versprechen: es gibt keinen Mailversand (0052). */}
        <p className="text-[13px] text-ink-soft">{t("noMailHint")}</p>
      </div>
    </Modal>
  );
}
