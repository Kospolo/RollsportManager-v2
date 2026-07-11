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

export function LegalPanel({ settings, applyPatch, savedTone }: PanelProps) {
  const t = useT(einstellungenDict);
  const { showToast } = useToast();
  const base = settings.legal;
  const [draft, setDraft] = useState<PlatformLegalSettings>(() => ({ ...base }));
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof PlatformLegalSettings>(key: K, value: PlatformLegalSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const dirty =
    draft.impressum !== base.impressum ||
    draft.datenschutz !== base.datenschutz ||
    draft.agb !== base.agb;

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
      <p className="-mt-2 mb-5 max-w-prose text-caption text-ink-faint">{t("legalDesc")}</p>
      <div className="grid gap-4">
        <Textarea
          label={t("fieldImpressum")}
          value={draft.impressum}
          onChange={(e) => set("impressum", e.target.value)}
          rows={5}
        />
        <Textarea
          label={t("fieldDatenschutz")}
          value={draft.datenschutz}
          onChange={(e) => set("datenschutz", e.target.value)}
          rows={6}
        />
        <Textarea
          label={t("fieldAgb")}
          value={draft.agb}
          onChange={(e) => set("agb", e.target.value)}
          rows={6}
        />
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
