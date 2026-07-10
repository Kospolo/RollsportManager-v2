"use client";

import { useState } from "react";
import { data, dataSource, errorMessage, isForbidden } from "@/lib/data";
import type { UpdateClubSettingsInput } from "@/lib/data";
import type { Club } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { vereinDict } from "./i18n";

/**
 * Editierbares Formular der Vereins-Einstellungen (owner/admin). Schreibt über
 * die Facade (data.updateClubSettings → PATCH /clubs/{id}). Kein optimistisches
 * Schreiben: bei Erfolg neue Baseline (kein dirty), bei 403/Fehler sauberer
 * Toast, Formular bleibt stehen.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Leichte IBAN-Plausibilität: 2 Buchstaben, 2 Ziffern, dann 11–30 alphanumerisch. */
const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

type FormState = {
  name: string;
  shortName: string;
  city: string;
  discipline: string;
  email: string;
  phone: string;
  address: string;
  iban: string;
  accountHolder: string;
  bankName: string;
  notifyInvoices: boolean;
  notifyEvents: boolean;
  notifyNews: boolean;
};

type FieldErrors = { name?: string; email?: string; iban?: string };

function initialForm(club: Club): FormState {
  return {
    name: club.name,
    shortName: club.shortName,
    city: club.city,
    discipline: club.discipline,
    // Kontakt/Bank/Flags liegen im Server-Settings-Objekt und werden vom
    // Club-View-Typ (noch) nicht zurückgeliefert — Start daher leer/Default.
    email: "",
    phone: "",
    address: "",
    iban: "",
    accountHolder: "",
    bankName: "",
    notifyInvoices: true,
    notifyEvents: true,
    notifyNews: false,
  };
}

export function VereinForm({ club }: { club: Club }) {
  const t = useT(vereinDict);
  const { showToast } = useToast();

  const [form, setForm] = useState<FormState>(() => initialForm(club));
  const [baseline, setBaseline] = useState<FormState>(() => initialForm(club));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = t("errNameRequired");
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) {
      next.email = t("errEmailInvalid");
    }
    const iban = form.iban.replace(/\s+/g, "").toUpperCase();
    if (iban && !IBAN_PATTERN.test(iban)) next.iban = t("errIbanInvalid");
    return next;
  };

  const save = async () => {
    if (saving) return;
    const found = validate();
    setErrors(found);
    if (found.name || found.email || found.iban) return;

    const patch: UpdateClubSettingsInput = {
      name: form.name.trim(),
      shortName: form.shortName.trim() || null,
      city: form.city.trim() || null,
      discipline: form.discipline.trim() || null,
      settings: {
        contact: {
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
        },
        bank: {
          iban: form.iban.replace(/\s+/g, "").toUpperCase() || null,
          accountHolder: form.accountHolder.trim() || null,
          bankName: form.bankName.trim() || null,
        },
        notifications: {
          invoices: form.notifyInvoices,
          events: form.notifyEvents,
          news: form.notifyNews,
        },
      },
    };

    setSaving(true);
    try {
      const updated = await data.updateClubSettings(patch);
      // Kern-Felder aus der Server-Antwort übernehmen, Settings-Felder lokal
      // halten (der Club-View spiegelt sie nicht) → neue Baseline = kein dirty.
      const next: FormState = {
        ...form,
        name: updated.name,
        shortName: updated.shortName,
        city: updated.city,
        discipline: updated.discipline,
      };
      setForm(next);
      setBaseline(next);
      setErrors({});
      showToast(t("savedToast"), { tone: "success" });
    } catch (error) {
      showToast(isForbidden(error) ? t("forbiddenToast") : errorMessage(error), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void save(),
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setForm(baseline);
    setErrors({});
  };

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {/* Kern-Stammdaten */}
      <Card>
        <CardHeader eyebrow={t("coreEyebrow")} title={t("coreTitle")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fName")}
            hint={t("fNameHint")}
            error={errors.name}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="sm:col-span-2"
          />
          <Input
            label={t("fShortName")}
            hint={t("fShortNameHint")}
            value={form.shortName}
            onChange={(e) => set("shortName", e.target.value)}
          />
          <Input label={t("fCity")} value={form.city} onChange={(e) => set("city", e.target.value)} />
          <Input
            label={t("fDiscipline")}
            placeholder={t("fDisciplinePlaceholder")}
            value={form.discipline}
            onChange={(e) => set("discipline", e.target.value)}
            className="sm:col-span-2"
          />
        </div>
      </Card>

      {/* Kontakt */}
      <Card>
        <CardHeader eyebrow={t("contactEyebrow")} title={t("contactTitle")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fEmail")}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder={t("fEmailPlaceholder")}
            error={errors.email}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
          <Input
            label={t("fPhone")}
            type="tel"
            inputMode="tel"
            placeholder={t("fPhonePlaceholder")}
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
          <Input
            label={t("fAddress")}
            placeholder={t("fAddressPlaceholder")}
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            className="sm:col-span-2"
          />
        </div>
      </Card>

      {/* Bankverbindung */}
      <Card>
        <CardHeader eyebrow={t("bankEyebrow")} title={t("bankTitle")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fIban")}
            placeholder={t("fIbanPlaceholder")}
            error={errors.iban}
            value={form.iban}
            onChange={(e) => set("iban", e.target.value)}
            className="sm:col-span-2"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <Input
            label={t("fAccountHolder")}
            placeholder={t("fAccountHolderPlaceholder")}
            value={form.accountHolder}
            onChange={(e) => set("accountHolder", e.target.value)}
          />
          <Input
            label={t("fBankName")}
            placeholder={t("fBankNamePlaceholder")}
            value={form.bankName}
            onChange={(e) => set("bankName", e.target.value)}
          />
        </div>
      </Card>

      {/* Benachrichtigungen */}
      <Card>
        <CardHeader eyebrow={t("notifyEyebrow")} title={t("notifyTitle")} />
        <div className="grid gap-1">
          <NotifyRow
            label={t("notifyInvoices")}
            desc={t("notifyInvoicesDesc")}
            checked={form.notifyInvoices}
            onChange={(v) => set("notifyInvoices", v)}
          />
          <NotifyRow
            label={t("notifyEvents")}
            desc={t("notifyEventsDesc")}
            checked={form.notifyEvents}
            onChange={(v) => set("notifyEvents", v)}
          />
          <NotifyRow
            label={t("notifyNews")}
            desc={t("notifyNewsDesc")}
            checked={form.notifyNews}
            onChange={(v) => set("notifyNews", v)}
          />
        </div>
      </Card>

      {/* Aktionsleiste */}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="submit" icon="check" disabled={!dirty || saving}>
          {saving ? t("saving") : t("save")}
        </Button>
        <Button type="button" variant="ghost" onClick={reset} disabled={!dirty || saving}>
          {t("reset")}
        </Button>
        <p className="w-full text-caption text-ink-faint sm:ml-auto sm:w-auto">
          {dataSource === "api" ? t("saveHintApi") : t("saveHintMock")}
        </p>
      </div>
      <p className="text-caption text-ink-faint">{t("settingsNote")}</p>
    </form>
  );
}

function NotifyRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-3 last:border-b-0">
      <div className="grid min-w-0 max-w-md gap-0.5">
        <span className="text-[14px] font-bold text-ink">{label}</span>
        <span className="text-caption text-ink-faint">{desc}</span>
      </div>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}
