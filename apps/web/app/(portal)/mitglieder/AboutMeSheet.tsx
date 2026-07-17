"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { data, dataSource, errorMessage, isForbidden, MOTTO_MAX } from "@/lib/data";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { mitgliederDict } from "./i18n";

/**
 * „Über mich" bearbeiten — der Weg, auf dem ein Mitglied überhaupt etwas über
 * sich einträgt. Ohne ihn bleibt das Verzeichnis leer, egal wie schön es ist.
 *
 * „Über mich" IST das Selbst-Profil-Motto (club_members.profile_motto, 0045/
 * 0053). Geschrieben wird deshalb über die Facade updateMySelfProfile → PATCH
 * /clubs/{clubId}/members/{memberId}/profile → app.set_self_profile — ein echter
 * TEIL-PATCH: nur `motto` senden lässt Lieblingsdisziplin, „läuft seit" und
 * Sichtbarkeit UNVERÄNDERT. (NICHT PATCH /me: dessen MeUpdate-Schema kennt kein
 * Motto und würde den leeren Body mit 422 abweisen.) Rechte serverseitig: nur
 * die Person selbst / ihre Erziehungsberechtigten, nur status=active.
 *
 * Bedient mock UND api: der Mock spiegelt das Motto in denselben Mitglieder-
 * Store, aus dem das Verzeichnis liest (mock/member-store) — die Änderung ist
 * also SOFORT auf der eigenen Karte sichtbar. Kein Formular, das grün blinkt
 * und nichts speichert.
 *
 * Der Aufrufer lädt nach onSaved neu; der lokale Entwurf lebt nur, solange das
 * Sheet offen ist (Remount über `key` beim Öffnen). Der ANFANGSWERT `initial`
 * kommt vom Aufrufer aus Member.aboutMe — und das ist im api-Modus profile_motto
 * (mappers.mapMember), im Mock der gespiegelte Motto-Store: derselbe Wert, den
 * wir hier zurückschreiben.
 */
export function AboutMeSheet({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Aktueller Serverstand des eigenen Mottos ("" = nichts eingetragen). */
  initial: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(mitgliederDict);
  const { showToast } = useToast();

  const [text, setText] = useState(initial);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = text.trim();
  const tooLong = trimmed.length > MOTTO_MAX;
  const dirty = trimmed !== initial.trim();
  const remaining = MOTTO_MAX - trimmed.length;

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
      // Nur `motto` senden — Teil-Patch: Disziplin/„läuft seit"/Sichtbarkeit
      // bleiben unberührt. Leerer Text ⇒ null: der Eintrag wird entfernt, nicht
      // als "" gespeichert (sonst gälte „eingetragen, aber leer" als Eintrag und
      // die Karte reservierte Platz für nichts).
      await data.updateMySelfProfile({ motto: trimmed === "" ? null : trimmed });
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
        error={tooLong ? t("aboutTooLong", { max: MOTTO_MAX }) : undefined}
        value={text}
        rows={5}
        maxLength={MOTTO_MAX + 40}
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
