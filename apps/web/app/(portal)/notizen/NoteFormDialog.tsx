"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage } from "@/lib/data";
import type { Note } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { notesDict } from "./i18n";

/**
 * Anlegen ODER Bearbeiten einer privaten Notiz (Titel + Text) über die
 * Facade. Der Dialog wird vom Elternteil nur im geöffneten Zustand gemountet
 * (frischer useState-Startwert je Öffnung) — daher kein State-Sync per Effect.
 *
 * Titel ist Pflicht, der Text ist optional. Erfolg: Toast + onSaved()
 * (Liste neu laden) + schließen. Fehler: Toast, Dialog bleibt offen.
 */

export type NoteFormValue = { mode: "create" } | { mode: "edit"; note: Note };

export function NoteFormDialog({
  value,
  onClose,
  onSaved,
}: {
  value: NoteFormValue;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(notesDict);
  const { showToast } = useToast();

  const isEdit = value.mode === "edit";

  const [title, setTitle] = useState(isEdit ? value.note.title : "");
  const [body, setBody] = useState(isEdit ? value.note.body : "");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t("fTitleError"));
      return;
    }
    setSubmitting(true);
    try {
      if (value.mode === "create") {
        const created = await data.createNote({ title: trimmedTitle, body: body.trim() });
        showToast(t("createdToast", { title: created.title }), { tone: "success" });
      } else {
        const updated = await data.updateNote(value.note.id, {
          title: trimmedTitle,
          body: body.trim(),
        });
        showToast(t("updatedToast", { title: updated.title }), { tone: "success" });
      }
      onSaved();
      onClose();
    } catch (caught) {
      showToast(errorMessage(caught) || t("genericError"), { tone: "danger" });
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
          label={t("fTitle")}
          placeholder={t("fTitlePlaceholder")}
          autoComplete="off"
          autoFocus
          error={error}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError(undefined);
          }}
        />
        <Textarea
          label={t("fBody")}
          placeholder={t("fBodyPlaceholder")}
          hint={t("fBodyHint")}
          rows={6}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
        {/* Enter (mit Cmd/Ctrl) bzw. der Fuß-Button lösen die Primäraktion aus */}
        <button type="submit" className="sr-only">
          {isEdit ? t("save") : t("create")}
        </button>
      </form>
    </Modal>
  );
}
