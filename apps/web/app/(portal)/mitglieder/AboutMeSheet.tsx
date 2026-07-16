"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { data, dataSource, errorMessage, isForbidden, ABOUT_ME_MAX } from "@/lib/data";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { mitgliederDict } from "./i18n";

/**
 * „Über mich" bearbeiten — der Weg, auf dem ein Mitglied überhaupt etwas über
 * sich einträgt. Ohne ihn bleibt das Verzeichnis leer, egal wie schön es ist.
 *
 * Schreibt über die Facade (updateMyProfile → PATCH /me, member_id = self,
 * serverseitig erzwungen) und bedient damit mock UND api: der Mock schreibt in
 * denselben Mitglieder-Store, aus dem das Verzeichnis liest (mock/member-store)
 * — die Änderung ist also SOFORT auf der eigenen Karte sichtbar. Kein Formular,
 * das grün blinkt und nichts speichert.
 *
 * Der Aufrufer lädt nach onSaved neu; der lokale Entwurf lebt nur, solange das
 * Sheet offen ist (Remount über `key` beim Öffnen).
 */
export function AboutMeSheet({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Aktueller Serverstand des eigenen Textes ("" = nichts eingetragen). */
  initial: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(mitgliederDict);
  const { showToast } = useToast();

  const [text, setText] = useState(initial);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = text.trim();
  const tooLong = trimmed.length > ABOUT_ME_MAX;
  const dirty = trimmed !== initial.trim();
  const remaining = ABOUT_ME_MAX - trimmed.length;

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const save = async () => {
    if (submitting || tooLong) return;
    if (!dirty) {
      showToast(t("aboutNoChanges"), { tone: "neutral" });
      return;
    }
    setSubmitting(true);
    try {
      // Leerer Text ⇒ null: der Eintrag wird entfernt, nicht als "" gespeichert
      // (sonst gälte „eingetragen, aber leer" als Eintrag und die Karte
      // reservierte Platz für nichts).
      await data.updateMyProfile({ aboutMe: trimmed === "" ? null : trimmed });
      if (trimmed === "") {
        showToast(t("aboutClearedToast"), { tone: "neutral" });
      } else {
        showToast(t(dataSource === "api" ? "aboutSavedToast" : "aboutSavedToastMock"), {
          tone: "success",
        });
      }
      onSaved();
      onClose();
    } catch (error) {
      showToast(isForbidden(error) ? t("aboutForbidden") : errorMessage(error), {
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
      eyebrow={t("aboutSheetEyebrow")}
      title={t("aboutSheetTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>
            {t("aboutCancel")}
          </Button>
          <Button icon="check" onClick={() => void save()} disabled={submitting || tooLong}>
            {t("aboutSave")}
          </Button>
        </>
      }
    >
      <Textarea
        label={t("aboutField")}
        placeholder={t("aboutFieldPh")}
        hint={t("aboutFieldHint")}
        error={tooLong ? t("aboutTooLong", { max: ABOUT_ME_MAX }) : undefined}
        value={text}
        rows={5}
        maxLength={ABOUT_ME_MAX + 40}
        onChange={(event) => setText(event.target.value)}
      />
      {/* Restzeichen: aria-live, damit Screenreader das Limit mitbekommen,
          ohne dass es bei jedem Tastendruck vorgelesen wird (polite). */}
      <p
        aria-live="polite"
        className={`mt-2 text-right text-caption tabular-nums ${
          tooLong ? "text-danger" : "text-ink-faint"
        }`}
      >
        {t("aboutRemaining", { n: remaining })}
      </p>
    </Sheet>
  );
}
