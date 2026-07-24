"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { PlatformContentSettings, PlatformLegalSettings } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { einstellungenDict } from "./i18n";
import { DEFAULT_LEGAL } from "@/app/_landing/legal-defaults";
import type { PanelProps } from "./shared";

/**
 * Text-basierte Tabs: Rechtstexte (Impressum/Datenschutz/AGB) und Website & SEO
 * (Titel/Untertitel + Suchmaschinen-Metadaten). Jeder Tab hält einen lokalen
 * Entwurf und speichert nur seinen Abschnitt (Deep-Merge serverseitig); der
 * Speichern-Knopf ist deaktiviert, solange nichts geändert wurde.
 */

/** Gemeinsamer Fuß: rechtsbündiger Speichern-Button. */
function SaveBar({
  saving,
  dirty,
  onSave,
}: {
  saving: boolean;
  dirty: boolean;
  onSave: () => void;
}) {
  const t = useT(einstellungenDict);
  return (
    <div className="mt-5 flex justify-end border-t border-line pt-4">
      <Button onClick={onSave} disabled={saving || !dirty} icon="check">
        {saving ? t("saving") : t("save")}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Rechtstext-Editor — ZWEISPRACHIG. Drei Dokumente (Impressum, Datenschutz,
 * AGB), je ein deutsches und ein englisches Feld. Ein DE/EN-Umschalter zeigt
 * immer nur eine Sprache; gespeichert werden trotzdem alle sechs Felder auf
 * einmal (der Entwurf hält beide Sprachen).
 *
 * LEER = STANDARD: Ein leeres Feld heißt nicht „kein Text", sondern „zeig den
 * eingebauten Standardtext" (LegalPage DEFAULT_LEGAL, dieselbe Quelle wie die
 * öffentliche Seite). „Standardtext einfügen" lädt genau diesen Text ins Feld,
 * damit der Betreiber von einer echten Vorlage aus editiert statt von leer.
 */
type LegalDocKey = "impressum" | "datenschutz" | "agb";

const LEGAL_DOCS: { doc: LegalDocKey; labelKey: "fieldImpressum" | "fieldDatenschutz" | "fieldAgb" }[] =
  [
    { doc: "impressum", labelKey: "fieldImpressum" },
    { doc: "datenschutz", labelKey: "fieldDatenschutz" },
    { doc: "agb", labelKey: "fieldAgb" },
  ];

/** Feldname im Store je Dokument und Sprache. */
const fieldOf = (doc: LegalDocKey, lang: "de" | "en"): keyof PlatformLegalSettings =>
  lang === "de" ? doc : (`${doc}En` as keyof PlatformLegalSettings);

export function LegalPanel({ settings, applyPatch, savedTone }: PanelProps) {
  const t = useT(einstellungenDict);
  const { showToast } = useToast();
  const base = settings.legal;
  const [draft, setDraft] = useState<PlatformLegalSettings>(() => ({ ...base }));
  const [lang, setLang] = useState<"de" | "en">("de");
  const [saving, setSaving] = useState(false);

  const set = (key: keyof PlatformLegalSettings, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const dirty = (Object.keys(base) as (keyof PlatformLegalSettings)[]).some(
    (k) => draft[k] !== base[k],
  );

  const onSave = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const updated = await applyPatch({ legal: { ...draft } });
      setDraft({ ...updated.legal });
      showToast(t("savedToast"), { tone: savedTone });
    } catch (err) {
      showToast(errorMessage(err), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void onSave(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader eyebrow={t("legalEyebrow")} title={t("legalTitle")} />
      <p className="-mt-2 mb-4 max-w-prose text-caption text-ink-faint">{t("legalDesc")}</p>

      {/* Sprach-Umschalter: zeigt immer nur eine Sprache, editiert werden beide. */}
      <div className="mb-5 inline-flex rounded-lg border border-line p-0.5" role="tablist">
        {(["de", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={lang === l}
            onClick={() => setLang(l)}
            className={`rounded-md px-3 py-1.5 text-caption font-semibold transition ${
              lang === l ? "bg-brand text-brand-contrast" : "text-ink-soft hover:text-ink"
            }`}
          >
            {t(l === "de" ? "legalLangDe" : "legalLangEn")}
          </button>
        ))}
      </div>

      <div className="grid gap-5">
        {LEGAL_DOCS.map(({ doc, labelKey }) => {
          const key = fieldOf(doc, lang);
          const value = draft[key];
          const isOverride = value.trim().length > 0;
          return (
            <div key={doc} className="grid gap-1.5">
              <Textarea
                label={t(labelKey)}
                value={value}
                onChange={(e) => set(key, e.target.value)}
                rows={doc === "agb" ? 8 : 6}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-caption text-ink-faint">
                  {isOverride ? t("legalIsOverride") : t("legalIsDefault")} {t("legalEmptyHint")}
                </span>
                <button
                  type="button"
                  onClick={() => set(key, DEFAULT_LEGAL[doc][lang])}
                  className="text-caption font-semibold text-brand underline underline-offset-4 hover:text-brand-ink"
                >
                  {t("legalLoadDefault")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <SaveBar saving={saving} dirty={dirty} onSave={() => void onSave()} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function ContentPanel({ settings, applyPatch, savedTone }: PanelProps) {
  const t = useT(einstellungenDict);
  const { showToast } = useToast();
  const base = settings.content;
  const [draft, setDraft] = useState<PlatformContentSettings>(() => ({ ...base }));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof PlatformContentSettings>(
    key: K,
    value: PlatformContentSettings[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  const dirty =
    draft.websiteTitle !== base.websiteTitle ||
    draft.websiteSubtitle !== base.websiteSubtitle ||
    draft.seoTitle !== base.seoTitle ||
    draft.seoDescription !== base.seoDescription ||
    draft.seoKeywords !== base.seoKeywords;

  const onSave = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const updated = await applyPatch({ content: { ...draft } });
      setDraft({ ...updated.content });
      showToast(t("savedToast"), { tone: savedTone });
    } catch (err) {
      showToast(errorMessage(err), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void onSave(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader eyebrow={t("contentEyebrow")} title={t("contentTitle")} />
      <p className="-mt-2 mb-5 max-w-prose text-caption text-ink-faint">{t("contentDesc")}</p>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fieldWebsiteTitle")}
            value={draft.websiteTitle}
            onChange={(e) => set("websiteTitle", e.target.value)}
          />
          <Input
            label={t("fieldWebsiteSubtitle")}
            value={draft.websiteSubtitle}
            onChange={(e) => set("websiteSubtitle", e.target.value)}
          />
        </div>
        <Input
          label={t("fieldSeoTitle")}
          value={draft.seoTitle}
          onChange={(e) => set("seoTitle", e.target.value)}
        />
        <Textarea
          label={t("fieldSeoDescription")}
          value={draft.seoDescription}
          onChange={(e) => set("seoDescription", e.target.value)}
          rows={3}
        />
        <Input
          label={t("fieldSeoKeywords")}
          value={draft.seoKeywords}
          onChange={(e) => set("seoKeywords", e.target.value)}
          hint={t("seoKeywordsHint")}
        />
      </div>
      <SaveBar saving={saving} dirty={dirty} onSave={() => void onSave()} />
    </Card>
  );
}
