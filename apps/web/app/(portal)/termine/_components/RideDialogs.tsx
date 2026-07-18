"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Field";
import { useT } from "@/lib/i18n";
import { termineDict } from "../i18n";

/**
 * Die beiden Dialoge der Fahrgemeinschaften.
 *
 * ### FÜR WEN WIRD ZUGESAGT ###
 * Ein Kind sagt nicht selbst zu — das tut ein:e Erziehungsberechtigte:r
 * (app.can_act_for_member, dieselbe Regel wie beim Selbst-Profil). Deshalb ist
 * die erste Frage nicht „mitfahren ja/nein", sondern WER mitfährt. Steht nur
 * eine Person zur Wahl, wird nicht gefragt — dann ist die Auswahl keine Frage,
 * sondern eine Hürde, und der Aufruf geht direkt raus (siehe RidesPanel).
 *
 * ### ABSAGEN WERDEN BESTÄTIGT ###
 * Zusage zurückziehen und Fahrt absagen laufen NIE ohne ausdrücklichen Klick
 * im Dialog. Beides nimmt jemandem etwas weg: den Platz oder die ganze Fahrt.
 */

export interface RideCandidate {
  memberId: string;
  label: string;
}

export function JoinRideModal({
  candidates,
  busy,
  onClose,
  onConfirm,
}: {
  /** Mindestens zwei — bei genau einer Person fragt das Panel gar nicht erst. */
  candidates: RideCandidate[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (memberId: string) => void;
}) {
  const t = useT(termineDict);
  const [choice, setChoice] = useState(candidates[0]?.memberId ?? "");

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={t("rideJoinEyebrow")}
      title={t("rideJoinTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => onConfirm(choice)} disabled={busy || choice === ""}>
            {t("rideJoinSubmit")}
          </Button>
        </>
      }
    >
      <Select
        label={t("rideJoinForLabel")}
        hint={t("rideJoinForHint")}
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
      >
        {candidates.map((candidate) => (
          <option key={candidate.memberId} value={candidate.memberId}>
            {candidate.label}
          </option>
        ))}
      </Select>
    </Modal>
  );
}

/**
 * Bestätigung für „Zusage zurückziehen" und „Fahrt absagen". Wird NIE
 * automatisch bestätigt — der Schreibpfad startet ausschließlich hier.
 */
export function ConfirmRideDialog({
  title,
  body,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useT(termineDict);
  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={t("ridesTitle")}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-soft">{body}</p>
    </Modal>
  );
}
