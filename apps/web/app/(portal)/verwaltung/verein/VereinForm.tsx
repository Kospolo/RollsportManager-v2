"use client";

import { useEffect, useRef, useState } from "react";
import { data, dataSource, errorMessage, isForbidden } from "@/lib/data";
import type { UpdateClubSettingsInput, UpdateClubSmtpInput } from "@/lib/data";
import { useData } from "@/lib/data/useData";
import type { Club, ClubSmtpSettings } from "@/lib/types";
import {
  applyBrandCss,
  BRAND_PRESETS,
  commitBrand,
  deriveBrandTheme,
  isDefaultBrand,
  isHex,
  readBrandSelection,
  renderBrandCss,
  resolveBrandTheme,
} from "@/lib/brand";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/components/shell/icons";
import { useT } from "@/lib/i18n";
import { vereinDict } from "./i18n";

/**
 * Editierbares Formular der Vereins-Einstellungen (owner/admin). Schreibt über
 * die Facade (data.updateClubSettings → PATCH /clubs/{id}). Kein optimistisches
 * Schreiben: bei Erfolg neue Baseline (kein dirty), bei 403/Fehler sauberer
 * Toast, Formular bleibt stehen.
 *
 * Stammdaten, Kontakt/Anschrift, „Über den Verein" und das öffentliche Profil
 * sind seit 0081 echte Spalten und werden vom Club-View zurückgeliefert — das
 * Formular startet also mit den echten Werten. Der SMTP-Abschnitt (write-only
 * Passwort) lädt/speichert separat über einen eigenen, admin-gesperrten Endpunkt.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Leichte IBAN-Plausibilität: 2 Buchstaben, 2 Ziffern, dann 11–30 alphanumerisch. */
const IBAN_PATTERN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

type FormState = {
  /** Marken-/Akzentfarbe: Seed-Hex ("" = keiner) + Preset-Schlüssel ("" = frei/Standard). */
  brandColor: string;
  brandPreset: string;
  name: string;
  shortName: string;
  foundedYear: string;
  discipline: string;
  websiteUrl: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  description: string;
  publicProfileEnabled: boolean;
  publicDescription: string;
  publicImage: string;
  iban: string;
  accountHolder: string;
  bankName: string;
  notifyInvoices: boolean;
  notifyEvents: boolean;
  notifyNews: boolean;
};

type FieldErrors = { name?: string; email?: string; iban?: string; foundedYear?: string; brand?: string };

/**
 * Anfangs-Auswahl der Markenfarbe. Im Mock-Modus ist der localStorage-Spiegel
 * die dauerhafte Persistenz (der In-Memory-Store startet nach jedem Reload leer),
 * darum hat er hier Vorrang. Im api-Modus zählt der Verein (getClub).
 */
function initialBrand(club: Club): { brandColor: string; brandPreset: string } {
  if (dataSource !== "api") {
    const stored = readBrandSelection();
    if (stored && (stored.color || stored.preset)) {
      return { brandColor: stored.color ?? "", brandPreset: stored.preset ?? "" };
    }
  }
  return { brandColor: club.brandColor ?? "", brandPreset: club.brandPreset ?? "" };
}

function initialForm(club: Club): FormState {
  return {
    ...initialBrand(club),
    name: club.name,
    shortName: club.shortName,
    // 0 (kein Jahr) als leeres Feld zeigen.
    foundedYear: club.foundedYear ? String(club.foundedYear) : "",
    discipline: club.discipline,
    websiteUrl: club.websiteUrl,
    email: club.contactEmail,
    phone: club.contactPhone,
    street: club.street,
    postalCode: club.postalCode,
    city: club.city,
    country: club.country,
    description: club.description,
    publicProfileEnabled: club.publicProfileEnabled,
    publicDescription: club.publicDescription,
    publicImage: club.publicImage,
    // Bank/Benachrichtigungen liegen weiterhin im Settings-JSON und werden vom
    // Club-View nicht gespiegelt — Start daher leer/Default.
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

  // Live-Vorschau: die gewählte Marke sofort auf die GANZE App anwenden (nur
  // visuell, ohne Speichern). Standard/Beere ⇒ Override weg; eine ungültige freie
  // Farbe lässt die bestehende Vorschau stehen (kein hartes Zurücksetzen).
  useEffect(() => {
    if (isDefaultBrand(form.brandColor || null, form.brandPreset || null)) {
      applyBrandCss(null);
      return;
    }
    const theme = resolveBrandTheme(form.brandColor || null, form.brandPreset || null);
    if (theme) applyBrandCss(renderBrandCss(theme));
  }, [form.brandColor, form.brandPreset]);

  // Verlässt man die Seite mit einer NICHT gespeicherten Vorschau, den zuletzt
  // persistierten Stand (baseline) wiederherstellen — kein „hängender" Look.
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  useEffect(
    () => () => {
      const b = baselineRef.current;
      if (isDefaultBrand(b.brandColor || null, b.brandPreset || null)) applyBrandCss(null);
      else applyBrandCss(renderBrandCss(resolveBrandTheme(b.brandColor || null, b.brandPreset || null)));
    },
    [],
  );

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = t("errNameRequired");
    if (form.email.trim() && !EMAIL_PATTERN.test(form.email.trim())) {
      next.email = t("errEmailInvalid");
    }
    const year = form.foundedYear.trim();
    if (year) {
      const n = Number(year);
      if (!Number.isInteger(n) || n < 1800 || n > 2100) next.foundedYear = t("errFoundedYear");
    }
    const iban = form.iban.replace(/\s+/g, "").toUpperCase();
    if (iban && !IBAN_PATTERN.test(iban)) next.iban = t("errIbanInvalid");
    // Freie Farbe (kein Preset): hartes AA-Gate — nicht ableitbar ⇒ ablehnen.
    if (!form.brandPreset && form.brandColor) {
      if (!isHex(form.brandColor) || !deriveBrandTheme(form.brandColor)) {
        next.brand = t("brandUnreadable");
      }
    }
    return next;
  };

  const save = async () => {
    if (saving) return;
    const found = validate();
    setErrors(found);
    if (found.name || found.email || found.iban || found.foundedYear || found.brand) return;

    // Marke: Beere/leer = Standard (Override entfernen), sonst gewählte Farbe.
    const brandDefault = isDefaultBrand(form.brandColor || null, form.brandPreset || null);
    const brandColor = brandDefault ? null : form.brandColor || null;
    const brandPreset = brandDefault ? null : form.brandPreset || null;

    const yearTrim = form.foundedYear.trim();
    const patch: UpdateClubSettingsInput = {
      brandColor,
      brandPreset,
      name: form.name.trim(),
      shortName: form.shortName.trim() || null,
      city: form.city.trim() || null,
      discipline: form.discipline.trim() || null,
      foundedYear: yearTrim ? Number(yearTrim) : null,
      contactEmail: form.email.trim(),
      contactPhone: form.phone.trim(),
      street: form.street.trim(),
      postalCode: form.postalCode.trim(),
      country: form.country.trim(),
      websiteUrl: form.websiteUrl.trim(),
      description: form.description.trim(),
      publicProfileEnabled: form.publicProfileEnabled,
      publicDescription: form.publicDescription.trim(),
      publicImage: form.publicImage.trim(),
      // Bank + Benachrichtigungen bleiben im freien Settings-Objekt (kein
      // Contact mehr — das sind seit 0081 echte Spalten).
      settings: {
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
      // Marke dauerhaft festschreiben: Style + localStorage-Spiegel (No-Flash-Boot).
      // Bewusst aus den GESENDETEN Werten — im api-Modus liefert der Wire die Farbe
      // (nachgelagert) noch nicht zurück.
      commitBrand(brandColor, brandPreset);
      // Baseline neu aus der Server-Antwort (Stammdaten/Kontakt/Öffentlich sind
      // echte Spalten und kommen zurück); Bank/Benachrichtigungen lokal halten.
      const next: FormState = {
        ...form,
        name: updated.name,
        shortName: updated.shortName,
        foundedYear: updated.foundedYear ? String(updated.foundedYear) : "",
        discipline: updated.discipline,
        websiteUrl: updated.websiteUrl,
        email: updated.contactEmail,
        phone: updated.contactPhone,
        street: updated.street,
        postalCode: updated.postalCode,
        city: updated.city,
        country: updated.country,
        description: updated.description,
        publicProfileEnabled: updated.publicProfileEnabled,
        publicDescription: updated.publicDescription,
        publicImage: updated.publicImage,
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
      {/* Marken-/Akzentfarbe — direkt unter der Logo-Karte, über den Stammdaten */}
      <BrandColorCard
        color={form.brandColor}
        preset={form.brandPreset}
        error={errors.brand}
        onSelectPreset={(hex, key) => {
          setForm((f) => ({ ...f, brandColor: hex, brandPreset: key }));
          setErrors((e) => ({ ...e, brand: undefined }));
        }}
        onCustomColor={(hex) => {
          setForm((f) => ({ ...f, brandColor: hex, brandPreset: "" }));
          setErrors((e) => ({ ...e, brand: undefined }));
        }}
      />

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
          <Input
            label={t("fFoundedYear")}
            placeholder={t("fFoundedYearPlaceholder")}
            inputMode="numeric"
            error={errors.foundedYear}
            value={form.foundedYear}
            onChange={(e) => set("foundedYear", e.target.value)}
          />
          <Input
            label={t("fDiscipline")}
            placeholder={t("fDisciplinePlaceholder")}
            value={form.discipline}
            onChange={(e) => set("discipline", e.target.value)}
          />
          <Input
            label={t("fWebsite")}
            type="url"
            inputMode="url"
            placeholder={t("fWebsitePlaceholder")}
            value={form.websiteUrl}
            onChange={(e) => set("websiteUrl", e.target.value)}
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
      </Card>

      {/* Kontakt & Anschrift */}
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
            label={t("fStreet")}
            placeholder={t("fStreetPlaceholder")}
            value={form.street}
            onChange={(e) => set("street", e.target.value)}
            className="sm:col-span-2"
          />
          <Input
            label={t("fPostalCode")}
            placeholder={t("fPostalCodePlaceholder")}
            inputMode="numeric"
            value={form.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
          />
          <Input label={t("fCity")} value={form.city} onChange={(e) => set("city", e.target.value)} />
          <Input
            label={t("fCountry")}
            placeholder={t("fCountryPlaceholder")}
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
            className="sm:col-span-2"
          />
        </div>
      </Card>

      {/* Über den Verein */}
      <Card>
        <CardHeader eyebrow={t("aboutEyebrow")} title={t("aboutTitle")} />
        <Textarea
          label={t("fDescription")}
          hint={t("fDescriptionHint")}
          placeholder={t("fDescriptionPlaceholder")}
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Card>

      {/* Öffentliches Profil + Aktivieren-Schalter */}
      <Card>
        <CardHeader eyebrow={t("publicEyebrow")} title={t("publicTitle")} />
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line pb-3">
            <div className="grid min-w-0 max-w-md gap-0.5">
              <span className="text-[14px] font-bold text-ink">{t("publicToggle")}</span>
              <span className="text-caption text-ink-faint">{t("publicToggleDesc")}</span>
            </div>
            <Switch
              label={t("publicToggle")}
              checked={form.publicProfileEnabled}
              onChange={(v) => set("publicProfileEnabled", v)}
            />
          </div>
          <Textarea
            label={t("fPublicDescription")}
            hint={t("fPublicDescriptionHint")}
            placeholder={t("fPublicDescriptionPlaceholder")}
            rows={3}
            value={form.publicDescription}
            onChange={(e) => set("publicDescription", e.target.value)}
          />
          <Input
            label={t("fPublicImage")}
            type="url"
            inputMode="url"
            placeholder={t("fPublicImagePlaceholder")}
            value={form.publicImage}
            onChange={(e) => set("publicImage", e.target.value)}
            autoCapitalize="none"
            spellCheck={false}
          />
          <p className="text-caption text-ink-faint">{t("publicNote")}</p>
        </div>
      </Card>

      {/* Aktionsleiste (gilt für alle obigen Abschnitte) */}
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

      {/* E-Mail-Versand (SMTP) — eigener Lade-/Speicher-Zyklus, admin-only Endpunkt */}
      <ClubSmtpSection />

      {/* Bankverbindung (Settings-JSON) */}
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

      {/* Benachrichtigungen (Settings-JSON) */}
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

      <p className="text-caption text-ink-faint">{t("settingsNote")}</p>
    </form>
  );
}

/* ------------------------------------------------------------------ */

type SmtpDraft = {
  host: string;
  port: string;
  user: string;
  from: string;
  secure: boolean;
};

function smtpToDraft(s: ClubSmtpSettings): SmtpDraft {
  return {
    host: s.host,
    port: s.port ? String(s.port) : "",
    user: s.user,
    from: s.from,
    secure: s.secure,
  };
}

/**
 * E-Mail-Versand (SMTP) des Vereins. Eigener Lade-/Speicher-Zyklus über den
 * admin-gesperrten Endpunkt (getClubSmtp/updateClubSmtp). Das Passwort ist
 * WRITE-ONLY: separates Feld mit Platzhalter „unverändert lassen", es wird nie
 * geladen — nur gesetzt, wenn wirklich etwas eingegeben wurde. Der hinterlegte
 * Zustand kommt aus passwordSet (nie der Klartext). Steht innerhalb der
 * VereinForm und ist damit ohnehin nur für owner/admin sichtbar; der Server
 * setzt is_club_admin zusätzlich durch.
 */
function ClubSmtpSection() {
  const t = useT(vereinDict);
  const loaded = useData((repo) => repo.getClubSmtp());

  if (loaded.status === "loading") {
    return (
      <Card>
        <SkeletonCard lines={5} />
      </Card>
    );
  }
  if (loaded.status === "error") {
    return (
      <Card>
        <CardHeader eyebrow={t("smtpEyebrow")} title={t("smtpTitle")} />
        <EmptyState
          icon="zap"
          title={t("smtpLoadError")}
          body={errorMessage(loaded.error)}
          action={<Button onClick={loaded.reload}>{t("retry")}</Button>}
        />
      </Card>
    );
  }
  return <ClubSmtpForm initial={loaded.data} />;
}

function ClubSmtpForm({ initial }: { initial: ClubSmtpSettings }) {
  const t = useT(vereinDict);
  const { showToast } = useToast();
  const [base, setBase] = useState<ClubSmtpSettings>(initial);
  const [draft, setDraft] = useState<SmtpDraft>(() => smtpToDraft(initial));
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof SmtpDraft>(key: K, value: SmtpDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const portTrim = draft.port.trim();
  const portValue = portTrim === "" ? undefined : Number(portTrim);
  const portInvalid =
    portTrim !== "" &&
    (!Number.isInteger(portValue) || (portValue as number) < 1 || (portValue as number) > 65535);

  const baseDraft = smtpToDraft(base);
  const dirty =
    draft.host !== baseDraft.host ||
    draft.port !== baseDraft.port ||
    draft.user !== baseDraft.user ||
    draft.from !== baseDraft.from ||
    draft.secure !== baseDraft.secure ||
    password.length > 0;

  const save = async () => {
    if (saving || portInvalid || !dirty) return;
    setSaving(true);
    const patch: UpdateClubSmtpInput = {
      host: draft.host.trim(),
      user: draft.user.trim(),
      from: draft.from.trim(),
      secure: draft.secure,
    };
    if (portValue !== undefined) patch.port = portValue;
    if (password.length > 0) patch.password = password; // WRITE-ONLY: nur wenn gesetzt.
    try {
      const updated = await data.updateClubSmtp(patch);
      setBase(updated);
      setDraft(smtpToDraft(updated));
      setPassword("");
      showToast(t("smtpSavedToast"), { tone: "success" });
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

  return (
    <Card>
      <CardHeader eyebrow={t("smtpEyebrow")} title={t("smtpTitle")} />
      <p className="-mt-2 mb-5 max-w-prose text-caption text-ink-faint">{t("smtpDesc")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("fHost")}
          value={draft.host}
          onChange={(e) => set("host", e.target.value)}
          placeholder={t("fHostPlaceholder")}
          autoComplete="off"
          spellCheck={false}
        />
        <Input
          label={t("fPort")}
          value={draft.port}
          onChange={(e) => set("port", e.target.value)}
          inputMode="numeric"
          placeholder="587"
          error={portInvalid ? t("fPortError") : undefined}
        />
        <Input
          label={t("fSmtpUser")}
          value={draft.user}
          onChange={(e) => set("user", e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <Input
          label={t("fSmtpFrom")}
          value={draft.from}
          onChange={(e) => set("from", e.target.value)}
          placeholder={t("fSmtpFromPlaceholder")}
          autoComplete="off"
          spellCheck={false}
        />
        <Input
          label={t("fSmtpPassword")}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("smtpPasswordPlaceholder")}
          hint={t("smtpPasswordHint")}
          autoComplete="new-password"
        />
        <div className="grid content-start gap-1.5">
          <span className="text-[13px] font-bold text-ink">{t("fSecure")}</span>
          <div className="flex min-h-11 items-center">
            <Switch
              label={t("fSecure")}
              checked={draft.secure}
              onChange={(v) => set("secure", v)}
              words={{ on: t("secureOn"), off: t("secureOff") }}
            />
          </div>
          <p className="text-caption text-ink-faint">{t("secureDesc")}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <Badge tone={base.passwordSet ? "success" : "neutral"} icon={base.passwordSet ? "check" : "lock"}>
          {base.passwordSet ? t("smtpPasswordSet") : t("smtpPasswordUnset")}
        </Badge>
        <Button onClick={() => void save()} disabled={saving || !dirty || portInvalid} icon="check">
          {saving ? t("smtpSaving") : t("smtpSave")}
        </Button>
      </div>
    </Card>
  );
}

/**
 * Marken-/Akzentfarbe: kuratierte Presets (Standard) + optional freie Farbe mit
 * AA-Ampel. Die Wort-Labels machen die Auswahl auch ohne Farbwahrnehmung
 * eindeutig. Die eigentliche Live-Wirkung + Persistenz liegt in VereinForm
 * (Vorschau-Effekt + Speichern); diese Karte ist reine Auswahl.
 */
function BrandColorCard({
  color,
  preset,
  error,
  onSelectPreset,
  onCustomColor,
}: {
  color: string;
  preset: string;
  error?: string;
  onSelectPreset: (hex: string, key: string) => void;
  onCustomColor: (hex: string) => void;
}) {
  const t = useT(vereinDict);
  const isCustom = !preset && color.length > 0;
  const [customOpen, setCustomOpen] = useState(isCustom);

  // Hervorhebung: gewähltes Preset, sonst (nichts gewählt) „Beere" = Standard.
  const activePreset = preset || (color ? "" : "beere");

  const customHex = isCustom ? color : "";
  const customValid = isHex(customHex) && deriveBrandTheme(customHex) != null;
  const pickerValue = isHex(customHex) ? customHex : "#B23A5C";
  const previewTheme = customValid ? deriveBrandTheme(customHex) : null;

  return (
    <Card>
      <CardHeader eyebrow={t("brandEyebrow")} title={t("brandTitle")} />
      <p className="-mt-2 mb-5 max-w-prose text-caption text-ink-faint">{t("brandDesc")}</p>

      <div
        role="radiogroup"
        aria-label={t("brandPresetsLabel")}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {BRAND_PRESETS.map((p) => {
          const active = activePreset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelectPreset(p.hex, p.key)}
              className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors duration-150 ${
                active
                  ? "border-brand bg-brand-soft"
                  : "border-line bg-sunken hover:border-line-strong"
              }`}
            >
              <span
                className="h-6 w-6 flex-none rounded-full border border-black/10"
                style={{ background: p.hex }}
                aria-hidden="true"
              />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate text-[13px] font-bold text-ink">{t(p.labelKey)}</span>
                {p.key === "beere" && (
                  <span className="text-[11px] font-semibold text-ink-faint">{t("brandDefaultTag")}</span>
                )}
              </span>
              {active && <Icon name="check" className="ic h-4 w-4 flex-none text-brand" />}
            </button>
          );
        })}
      </div>

      {/* Eigene Farbe (aufklappbar) */}
      <div className="mt-4 border-t border-line pt-4">
        <button
          type="button"
          aria-expanded={customOpen}
          onClick={() => setCustomOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="text-[14px] font-bold text-ink">{t("brandCustomToggle")}</span>
          <Icon
            name={customOpen ? "chevronDown" : "chevronRight"}
            className="ic h-4 w-4 flex-none text-ink-faint"
          />
        </button>

        {customOpen && (
          <div className="mt-3 grid gap-3">
            <p className="text-caption text-ink-faint">{t("brandCustomHint")}</p>
            <div className="flex flex-wrap items-end gap-3">
              <input
                type="color"
                aria-label={t("brandPickerLabel")}
                value={pickerValue}
                onChange={(e) => onCustomColor(e.target.value.toUpperCase())}
                className="h-11 w-14 flex-none cursor-pointer rounded-md border border-line bg-sunken p-1"
              />
              <div className="min-w-[10rem] flex-1">
                <Input
                  label={t("brandHexLabel")}
                  value={isCustom ? color : ""}
                  onChange={(e) => onCustomColor(e.target.value.toUpperCase())}
                  placeholder={t("brandHexPlaceholder")}
                  error={error}
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              </div>
            </div>

            {isCustom && (
              <p
                className={`flex items-center gap-1.5 text-caption font-semibold ${
                  customValid ? "text-success" : "text-danger"
                }`}
              >
                <Icon name={customValid ? "check" : "zap"} className="ic h-4 w-4 flex-none" />
                {customValid ? t("brandReadable") : t("brandUnreadable")}
              </p>
            )}

            {previewTheme && (
              <div className="flex flex-wrap items-center gap-2" aria-label={t("brandPreviewLabel")}>
                <span
                  className="rounded-full px-3 py-1 text-[12px] font-bold"
                  style={{ background: previewTheme.light.brand, color: previewTheme.light.brandContrast }}
                >
                  {t("brandSwatchBrand")}
                </span>
                <span
                  className="rounded-full px-3 py-1 text-[12px] font-bold"
                  style={{ background: previewTheme.light.brandSoft, color: previewTheme.light.brandInk }}
                >
                  {t("brandSwatchInk")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-4 text-caption text-ink-faint">{t("brandPreviewNote")}</p>
    </Card>
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
