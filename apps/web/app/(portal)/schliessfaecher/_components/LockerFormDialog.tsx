"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { CreateLockerInput, UpdateLockerInput } from "@/lib/data";
import type { Locker, LockerSize } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { schliessfaecherDict } from "../i18n";
import { SIZE_KEY, SIZE_ORDER, parsePriceInput, priceToInput } from "../derive";

const FORM_ID = "locker-form";

/**
 * Anlegen ODER Bearbeiten der Schließfach-Stammdaten (Nummer/Kennung, Standort,
 * GRÖSSE, LISTENPREIS, Notiz) über die Facade (data.createLocker /
 * data.updateLocker) — nur is_club_admin. Belegung (status/Mitglied) läuft
 * NICHT hierüber, sondern über Zuordnen/Freigeben bzw. die Defekt-Meldung; die
 * VERMIETUNG erst recht nicht (eigenes Sheet, eigener Vertrag).
 *
 * ### DER PREIS HAT DREI ZUSTÄNDE ###
 * Das Feld ist bewusst KEIN Zahlenfeld mit Default 0. Leer = „noch nicht
 * festgelegt", 0 = „ausdrücklich kostenlos", alles andere ein Betrag. Der
 * Hinweis unter dem Feld sagt das in Worten, weil die Unterscheidung sonst nur
 * für die sichtbar wäre, die den Datentyp kennt. Ein Verein, der versehentlich
 * „kostenlos" hinterlegt, verschenkt Geld und merkt es beim Jahresabschluss.
 *
 * Was hier steht, ist der LISTENPREIS — der Vorschlag, nicht der Vertrag.
 * Ändert er sich, bleiben laufende Mieten bei ihrem vereinbarten Betrag.
 *
 * Nur bei geöffnetem Zustand gemountet → frische Startwerte je Öffnung. Erfolg:
 * Toast + onSaved() + schließen; 403 → Klartext-Toast, Dialog bleibt offen.
 */
export type LockerFormValue = { mode: "create" } | { mode: "edit"; locker: Locker };

export function LockerFormDialog({
  value,
  onClose,
  onSaved,
}: {
  value: LockerFormValue;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(schliessfaecherDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const isEdit = value.mode === "edit";
  const initial = isEdit ? value.locker : undefined;

  const [label, setLabel] = useState(initial?.label ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [size, setSize] = useState<LockerSize>(initial?.size ?? "mittel");
  const [price, setPrice] = useState(
    initial ? priceToInput(initial.pricePerMonthCents, locale) : "",
  );
  const [note, setNote] = useState(initial?.note ?? "");

  const [labelError, setLabelError] = useState<string | undefined>(undefined);
  const [priceError, setPriceError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;

    const trimmedLabel = label.trim();
    const parsedPrice = parsePriceInput(price);
    let ok = true;
    if (!trimmedLabel) {
      setLabelError(t("fLabelError"));
      ok = false;
    }
    if (!parsedPrice.ok) {
      setPriceError(t("fPriceError"));
      ok = false;
    }
    if (!ok || !parsedPrice.ok) return;

    const trimmedLocation = location.trim();
    const trimmedNote = note.trim();

    setSubmitting(true);
    try {
      if (value.mode === "create") {
        const input: CreateLockerInput = {
          label: trimmedLabel,
          location: trimmedLocation || undefined,
          size,
          // null wird ABSICHTLICH mitgeschickt und nicht weggelassen: „leer"
          // ist beim Anlegen dieselbe Aussage wie beim Bearbeiten.
          pricePerMonthCents: parsedPrice.cents,
          note: trimmedNote || undefined,
        };
        const created = await data.createLocker(input);
        showToast(t("createdToast", { label: created.label }), { tone: "success" });
      } else {
        const patch: UpdateLockerInput = {
          label: trimmedLabel,
          location: trimmedLocation || null,
          size,
          pricePerMonthCents: parsedPrice.cents,
          note: trimmedNote || null,
        };
        const updated = await data.updateLocker(value.locker.id, patch);
        showToast(t("updatedToast", { label: updated.label }), { tone: "success" });
      }
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbiddenManage") : errorMessage(caught), {
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
      eyebrow={isEdit ? t("editEyebrow") : t("createEyebrow")}
      title={isEdit ? t("editTitle") : t("createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="check" disabled={submitting}>
            {isEdit ? t("save") : t("create")}
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
        <Input
          label={t("fLabel")}
          placeholder={t("fLabelPlaceholder")}
          autoComplete="off"
          error={labelError}
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            if (labelError) setLabelError(undefined);
          }}
        />

        <Input
          label={t("fLocation")}
          placeholder={t("fLocationPlaceholder")}
          autoComplete="off"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t("fSize")}
            value={size}
            onChange={(event) => setSize(event.target.value as LockerSize)}
          >
            {SIZE_ORDER.map((option) => (
              <option key={option} value={option}>
                {t(SIZE_KEY[option])}
              </option>
            ))}
          </Select>

          <Input
            label={t("fPrice")}
            placeholder={t("fPricePlaceholder")}
            // inputMode statt type="number": ein Zahlenfeld blockiert das
            // deutsche Dezimalkomma und verstellt den Wert beim Scrollen.
            inputMode="decimal"
            autoComplete="off"
            hint={t("fPriceHint")}
            error={priceError}
            value={price}
            onChange={(event) => {
              setPrice(event.target.value);
              if (priceError) setPriceError(undefined);
            }}
          />
        </div>

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
