"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { JoinWaitlistInput } from "@/lib/data";
import type { Member, WaitlistKind } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { KIND_KEY, KIND_ORDER, wartelistenDict } from "./i18n";
import { targetOptions, type TargetSources } from "./derive";

const FORM_ID = "waitlist-join-form";

/**
 * Selbst-Eintrag in eine Warteliste (memberId = eigene Person). Art wählen,
 * optional ein konkretes Ziel (Halle/Ausrüstung/Team/Termin) und eine Notiz.
 * Sind für die Art keine Ziele hinterlegt, bleibt der allgemeine Eintrag
 * möglich. Erfolg: Toast + onJoined() + schließen; 403 → Klartext-Toast, Dialog
 * bleibt offen. Die verbindliche Autorisierung bleibt serverseitig.
 */
export function JoinWaitlistDialog({
  me,
  sources,
  onClose,
  onJoined,
}: {
  me: Member;
  sources: TargetSources;
  onClose: () => void;
  onJoined: () => void;
}) {
  const t = useT(wartelistenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [kind, setKind] = useState<WaitlistKind>("facility");
  const [targetId, setTargetId] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const options = useMemo(() => targetOptions(kind, sources, locale), [kind, sources, locale]);
  const hasTargets = options.length > 0;

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const input: JoinWaitlistInput = {
        memberId: me.id,
        kind,
        targetId: targetId || undefined,
        note: note.trim() || undefined,
      };
      await data.joinWaitlist(input);
      showToast(t("joinedToast"), { tone: "success" });
      onJoined();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbiddenJoin") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={t("joinEyebrow")}
      title={t("joinTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="check" disabled={submitting}>
            {t("submitJoin")}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Select
          label={t("fKind")}
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as WaitlistKind);
            setTargetId("");
          }}
        >
          {KIND_ORDER.map((k) => (
            <option key={k} value={k}>
              {t(KIND_KEY[k])}
            </option>
          ))}
        </Select>

        <Select
          label={t("fTarget")}
          value={targetId}
          hint={hasTargets ? undefined : t("fTargetUnavailable")}
          disabled={!hasTargets}
          onChange={(event) => setTargetId(event.target.value)}
        >
          <option value="">{t("fTargetGeneral")}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>

        <Textarea
          label={t("fNote")}
          placeholder={t("fNotePlaceholder")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </form>
    </Modal>
  );
}
