"use client";

import { useState } from "react";
import { useT, type Dict } from "@/lib/i18n";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Modal, Sheet } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { Spec, SpecRow } from "./Spec";

const dict = {
  de: {
    forms: "Input / Select / Textarea",
    nameLabel: "Name der Kür",
    namePlaceholder: "z. B. Sommernachtstraum",
    nameHint: "Wird auf der Wettkampfmeldung angezeigt.",
    emailLabel: "E-Mail-Adresse",
    emailError: "Bitte eine gültige E-Mail-Adresse angeben — z. B. name@verein.de.",
    teamLabel: "Gruppe",
    teamHint: "Bestimmt, wer den Termin sieht.",
    team1: "Minis & Anfänger",
    team2: "Nachwuchs Pflicht",
    team3: "Kürgruppe Leistung",
    noteLabel: "Notiz an die Eltern",
    notePlaceholder: "Bitte Schoner nicht vergessen …",
    switch: "Switch",
    switchAuto: "Automatische Zahlungserinnerungen",
    switchNote: "An = success, immer mit Wortlabel — Status nie nur über Farbe.",
    modal: "Modal / Sheet",
    openModal: "Modal öffnen",
    openSheet: "Sheet öffnen",
    modalEyebrow: "Mahnwesen",
    modalTitle: "Erinnerung ansehen",
    modalBody: "Vor jedem Versand siehst du die E-Mail pro Empfänger. Stufe 2+ wird nie automatisch versendet — Freigabe durch den Vorstand.",
    modalCancel: "Abbrechen",
    modalConfirm: "Erinnerung senden",
    sheetEyebrow: "Mitglied",
    sheetTitle: "Details ansehen",
    sheetBody: "Seitliches Panel für Detail-Ansichten mit mehr Inhalt — schließt über Escape, Backdrop oder den Schließen-Knopf.",
    sheetStatus: "aktiv",
    toast: "Toast",
    toastSuccess: "Erfolgs-Toast zeigen",
    toastError: "Fehler-Toast mit Aktion zeigen",
    toastSavedMsg: "Gespeichert — die Änderung ist angekommen.",
    toastErrorMsg: "Senden fehlgeschlagen — keine Verbindung.",
    toastRetry: "Wiederholen",
    toastNote: "Fehler nie still scheitern lassen: Klartext + Wiederholen-Aktion.",
  },
  en: {
    forms: "Input / Select / Textarea",
    nameLabel: "Routine name",
    namePlaceholder: "e.g. A Midsummer Night’s Dream",
    nameHint: "Shown on the competition entry.",
    emailLabel: "Email address",
    emailError: "Please enter a valid email address — e.g. name@club.org.",
    teamLabel: "Group",
    teamHint: "Determines who can see the event.",
    team1: "Minis & beginners",
    team2: "Youth compulsory",
    team3: "Free-skating squad",
    noteLabel: "Note to parents",
    notePlaceholder: "Please don’t forget the pads …",
    switch: "Switch",
    switchAuto: "Automatic payment reminders",
    switchNote: "On = success, always with a word label — status never colour-only.",
    modal: "Modal / Sheet",
    openModal: "Open modal",
    openSheet: "Open sheet",
    modalEyebrow: "Dunning",
    modalTitle: "Review reminder",
    modalBody: "Before every send you see the email per recipient. Stage 2+ is never sent automatically — board approval required.",
    modalCancel: "Cancel",
    modalConfirm: "Send reminder",
    sheetEyebrow: "Member",
    sheetTitle: "View details",
    sheetBody: "Side panel for detail views with more content — closes via Escape, backdrop or the close button.",
    sheetStatus: "active",
    toast: "Toast",
    toastSuccess: "Show success toast",
    toastError: "Show error toast with action",
    toastSavedMsg: "Saved — your change went through.",
    toastErrorMsg: "Sending failed — no connection.",
    toastRetry: "Retry",
    toastNote: "Never fail silently: plain language plus a retry action.",
  },
} satisfies Dict;

export function SectionsForms() {
  const t = useT(dict);
  const { showToast } = useToast();
  const [autoRemind, setAutoRemind] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="grid gap-5">
      <Spec title={t("forms")} importPath='import { Input, Select, Textarea } from "@/components/ui/Field"'>
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Input label={t("nameLabel")} placeholder={t("namePlaceholder")} hint={t("nameHint")} />
          <Input
            label={t("emailLabel")}
            type="email"
            defaultValue="name(at)verein"
            error={t("emailError")}
          />
          <Select label={t("teamLabel")} hint={t("teamHint")} defaultValue="t-03">
            <option value="t-01">{t("team1")}</option>
            <option value="t-02">{t("team2")}</option>
            <option value="t-03">{t("team3")}</option>
          </Select>
          <Textarea
            label={t("noteLabel")}
            placeholder={t("notePlaceholder")}
            className="sm:col-span-2"
          />
        </div>
      </Spec>

      <Spec title={t("switch")} importPath='import { Switch } from "@/components/ui/Switch"'>
        <SpecRow label={t("switchAuto")}>
          <Switch checked={autoRemind} onChange={setAutoRemind} label={t("switchAuto")} />
          <Switch checked={false} onChange={() => {}} label={t("switchAuto")} disabled />
        </SpecRow>
        <p className="text-caption text-ink-faint">{t("switchNote")}</p>
      </Spec>

      <Spec title={t("modal")} importPath='import { Modal, Sheet } from "@/components/ui/Modal"'>
        <SpecRow label={t("modal")}>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            {t("openModal")}
          </Button>
          <Button variant="ghost" onClick={() => setSheetOpen(true)}>
            {t("openSheet")}
          </Button>
        </SpecRow>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          eyebrow={t("modalEyebrow")}
          title={t("modalTitle")}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                {t("modalCancel")}
              </Button>
              <Button
                onClick={() => {
                  setModalOpen(false);
                  showToast(t("toastSavedMsg"), { tone: "success" });
                }}
              >
                {t("modalConfirm")}
              </Button>
            </>
          }
        >
          <p className="text-ink-soft">{t("modalBody")}</p>
        </Modal>
        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          eyebrow={t("sheetEyebrow")}
          title={t("sheetTitle")}
        >
          <div className="grid gap-3">
            <p className="text-ink-soft">{t("sheetBody")}</p>
            <Badge tone="success" className="justify-self-start">
              {t("sheetStatus")}
            </Badge>
          </div>
        </Sheet>
      </Spec>

      <Spec title={t("toast")} importPath='import { ToastProvider, useToast } from "@/components/ui/Toast"'>
        <SpecRow label={t("toast")}>
          <Button
            variant="secondary"
            onClick={() => showToast(t("toastSavedMsg"), { tone: "success" })}
          >
            {t("toastSuccess")}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              showToast(t("toastErrorMsg"), {
                tone: "danger",
                actionLabel: t("toastRetry"),
                onAction: () => showToast(t("toastSavedMsg"), { tone: "success" }),
              })
            }
          >
            {t("toastError")}
          </Button>
        </SpecRow>
        <p className="text-caption text-ink-faint">{t("toastNote")}</p>
      </Spec>
    </div>
  );
}
