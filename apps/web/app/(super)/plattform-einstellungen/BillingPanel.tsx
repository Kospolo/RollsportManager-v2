"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { einstellungenDict } from "./i18n";
import type { PanelProps } from "./shared";

/**
 * Abrechnungs-Tab (Betreiber-Ebene): die Default-Länge der Selbst-
 * Registrierungs-Testphase in Tagen. Serverseitig gelesen von
 * app.default_trial_days() bei der Vereins-Registrierung (Migration 0089); pro
 * Verein kann der Betreiber die Laufzeit weiterhin unter „Lizenzen" übersteuern.
 */
export function BillingPanel({ settings, applyPatch, savedTone }: PanelProps) {
  const t = useT(einstellungenDict);
  const { showToast } = useToast();
  const [value, setValue] = useState(String(settings.billing.trialDays));
  const [saving, setSaving] = useState(false);

  const parsed = Number.parseInt(value, 10);
  const invalid = !Number.isFinite(parsed) || parsed < 1 || parsed > 365;
  const dirty = String(settings.billing.trialDays) !== value.trim();

  const save = async () => {
    if (invalid || saving) return;
    setSaving(true);
    try {
      const updated = await applyPatch({ billing: { trialDays: parsed } });
      setValue(String(updated.billing.trialDays));
      showToast(t("savedToast"), { tone: savedTone });
    } catch (err) {
      showToast(errorMessage(err), {
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
      <CardHeader eyebrow={t("billingEyebrow")} title={t("billingTitle")} />
      <p className="-mt-2 mb-4 max-w-prose text-caption text-ink-faint">{t("billingDesc")}</p>

      <div className="grid max-w-xs gap-4">
        <Input
          label={t("trialDaysLabel")}
          hint={t("trialDaysHint")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          placeholder="14"
          error={invalid ? t("trialDaysError") : undefined}
        />
        <Button onClick={() => void save()} disabled={saving || invalid || !dirty} icon="check">
          {saving ? t("saving") : t("save")}
        </Button>
      </div>
    </Card>
  );
}
