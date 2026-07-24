"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { MemberCoachNote } from "@/lib/api/generated";
import { data, dataSource, errorMessage, isForbidden } from "@/lib/data";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { mitgliederDict } from "../i18n";
import { profileDict } from "./profile-i18n";

/**
 * INTERNE Trainer-Notiz schreiben ODER ändern (Migration 0069).
 *
 * ⚠️ NICHT die Beurteilung (AssessmentSheet). Der Unterschied ist der ganze
 * Zweck: die Beurteilung liest die Familie, diese Notiz NICHT.
 *
 * ### DER HINWEIS IST PFLICHT, NICHT DEKORATION ###
 * Der Kasten oben im Sheet ist ausdrueckliche Vorgabe des Chefs und steht
 * BEWUSST ueber dem Eingabefeld, nicht als Fussnote darunter: er soll gelesen
 * werden, BEVOR getippt wird. Er sagt beides — dass Mitglied und Eltern die
 * Notiz nicht sehen, UND dass sie bei einem foermlichen Auskunftsersuchen nach
 * Art. 15 DSGVO dennoch herausgegeben werden muss.
 *
 * Wer hier kuerzt ("das mit der DSGVO verunsichert nur"), nimmt der Trainerin
 * genau die Information, auf der ihre Formulierungsentscheidung beruht. Der
 * zweite Satz ist der Grund, warum der erste kein Freibrief ist. Der Text lebt
 * in profile-i18n.ts (cnNoticeTitle/cnNoticeBody), DE und EN.
 *
 * Er steht im BEARBEITEN-Modus genauso da wie beim Schreiben — gerade dort
 * wird umformuliert, also faellt dort dieselbe Entscheidung noch einmal.
 *
 * ### ABGRENZUNG ZU DEN ANDEREN TEXTSORTEN ###
 * Unter dem Feld steht in einem Satz, wie sich diese Notiz zur BEURTEILUNG
 * (Familie liest mit) und zu den persoenlichen "Notizen" verhaelt. Drei Sorten
 * Text ueber dieselbe Person mit drei verschiedenen Leserkreisen sind eine
 * Verwechslungsfalle; der Satz kostet zwei Zeilen und verhindert genau die
 * Notiz, die im falschen Kasten landet.
 *
 * Kein totes Formular: schreibt ueber die Facade (createMemberCoachNote ->
 * POST /coach-notes bzw. updateMemberCoachNote -> PATCH /coach-notes/{id}) und
 * bedient mock UND api. Der Server erzwingt die Berechtigung endgueltig; dieses
 * Sheet wird nur fuer Berechtigte gerendert.
 */
export type CoachNoteSheetValue =
  | { mode: "create" }
  | { mode: "edit"; note: MemberCoachNote };

export function CoachNoteSheet({
  value,
  memberId,
  onClose,
  onSaved,
}: {
  value: CoachNoteSheetValue;
  memberId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(mitgliederDict);
  const tp = useT(profileDict);
  const { showToast } = useToast();

  const isEdit = value.mode === "edit";
  const [body, setBody] = useState(isEdit ? value.note.body : "");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = body.trim();
  const canSave = trimmed.length > 0 && !submitting;

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const save = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      if (value.mode === "edit") {
        await data.updateMemberCoachNote(value.note.id, { body: trimmed });
        showToast(tp(dataSource === "api" ? "cnUpdated" : "cnUpdatedMock"), { tone: "success" });
      } else {
        await data.createMemberCoachNote({ memberId, body: trimmed });
        showToast(tp(dataSource === "api" ? "cnSaved" : "cnSavedMock"), { tone: "success" });
        setBody("");
      }
      onSaved();
      onClose();
    } catch (error) {
      showToast(isForbidden(error) ? tp("cnForbidden") : errorMessage(error), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void save(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={close}
      eyebrow={tp(isEdit ? "cnEditEyebrow" : "cnSheetEyebrow")}
      title={tp(isEdit ? "cnEditTitle" : "cnSheetTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>
            {tp("cnCancel")}
          </Button>
          <Button icon="check" onClick={() => void save()} disabled={!canSave}>
            {tp("cnSave")}
          </Button>
        </>
      }
    >
      {/* Der Pflicht-Hinweis. role="note" statt "alert": er ist dauerhafte
          Rahmeninformation, keine Reaktion auf eine Eingabe — ein alert wuerde
          Screenreader bei jedem Oeffnen unterbrechen. */}
      <div
        role="note"
        className="mb-4 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <p className="font-semibold">{tp("cnNoticeTitle")}</p>
        <p className="mt-1">{tp("cnNoticeBody")}</p>
      </div>

      <Textarea
        label={tp("cnBodyLabel")}
        placeholder={tp("cnBodyPh")}
        error={trimmed.length === 0 && body.length > 0 ? tp("cnBodyRequired") : undefined}
        value={body}
        rows={5}
        maxLength={4000}
        onChange={(event) => setBody(event.target.value)}
      />

      {/* Ruhiger als der Pflicht-Kasten und bewusst UNTER dem Feld: das hier
          ist Orientierung ("welcher der drei Kaesten ist der richtige?"),
          keine Warnung. Zwei Warnfarben uebereinander entwerten die erste. */}
      <p className="mt-3 text-caption leading-[18px] text-ink-soft">{tp("cnVsAssessment")}</p>
    </Sheet>
  );
}
