"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { data, dataSource, errorMessage, isForbidden } from "@/lib/data";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Textarea, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { mitgliederDict } from "../i18n";
import { profileDict } from "./profile-i18n";

/**
 * Trainer-Beurteilung schreiben — NUR für berechtigte Betrachter:innen
 * gerendert (Team-Trainer:in der Person oder Vorstand; die Detailseite gated
 * den Knopf, der Server erzwingt es endgültig). Kein totes Formular: schreibt
 * über die Facade (createMemberAssessment → POST /assessments) und bedient
 * mock UND api — der Mock legt die Beurteilung in seinem Laufzeit-Store ab,
 * sodass sie nach onSaved sofort in der Liste erscheint.
 */
export function AssessmentSheet({
  open,
  memberId,
  onClose,
  onSaved,
}: {
  open: boolean;
  memberId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(mitgliederDict);
  const tp = useT(profileDict);
  const { showToast } = useToast();

  const [body, setBody] = useState("");
  const [tech, setTech] = useState("");
  const [expr, setExpr] = useState("");
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
      await data.createMemberAssessment({
        memberId,
        body: trimmed,
        ...(tech ? { ratingTechnik: Number(tech) } : {}),
        ...(expr ? { ratingAusdruck: Number(expr) } : {}),
      });
      showToast(tp(dataSource === "api" ? "asSaved" : "asSavedMock"), { tone: "success" });
      onSaved();
      onClose();
    } catch (error) {
      showToast(isForbidden(error) ? tp("asForbidden") : errorMessage(error), {
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
      open={open}
      onClose={close}
      eyebrow={tp("asSheetEyebrow")}
      title={tp("asSheetTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>
            {tp("asCancel")}
          </Button>
          <Button icon="check" onClick={() => void save()} disabled={!canSave}>
            {tp("asSave")}
          </Button>
        </>
      }
    >
      <Textarea
        label={tp("asBodyLabel")}
        placeholder={tp("asBodyPh")}
        error={trimmed.length === 0 && body.length > 0 ? tp("asBodyRequired") : undefined}
        value={body}
        rows={5}
        maxLength={2000}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Select label={tp("asTechLabel")} value={tech} onChange={(e) => setTech(e.target.value)}>
          <option value="">{tp("asRatingNone")}</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {tp("ratingOf", { n })}
            </option>
          ))}
        </Select>
        <Select label={tp("asExprLabel")} value={expr} onChange={(e) => setExpr(e.target.value)}>
          <option value="">{tp("asRatingNone")}</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {tp("ratingOf", { n })}
            </option>
          ))}
        </Select>
      </div>
    </Sheet>
  );
}
