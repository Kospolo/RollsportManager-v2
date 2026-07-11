"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { Card, CardHeader } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { einstellungenDict, type EinstellungenKey } from "./i18n";
import type { PanelProps } from "./shared";

/**
 * Feature-Flags-Tab. Die Flags kommen serverseitig aus settings.featureFlags
 * (flache Bool-Map); hier steuern Betreiber:innen nur ihren Zustand. Jeder
 * Schalter speichert sofort seinen einen Flag (Deep-Merge), reconciled aus der
 * Server-Antwort und gibt eine Klartext-Rückmeldung. Bekannte Flags erhalten
 * ein sprechendes Label, unbekannte werden aus dem Schlüssel gebildet.
 */

const KNOWN_FLAGS = ["wettkampf_live", "bankabgleich", "ki_etikett"] as const;

function humanize(key: string): string {
  return key
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function FlagsPanel({ settings, applyPatch, savedTone }: PanelProps) {
  const t = useT(einstellungenDict);
  const { showToast } = useToast();
  const [pending, setPending] = useState<string | null>(null);

  const flagLabel = (key: string): string =>
    (KNOWN_FLAGS as readonly string[]).includes(key)
      ? t(`flag_${key}` as EinstellungenKey)
      : humanize(key);

  const entries = Object.entries(settings.featureFlags).sort(([a], [b]) => a.localeCompare(b));

  const toggle = async (key: string, value: boolean) => {
    if (pending) return;
    setPending(key);
    try {
      await applyPatch({ featureFlags: { [key]: value } });
      showToast(t(value ? "flagOnToast" : "flagOffToast", { flag: flagLabel(key) }), {
        tone: savedTone,
      });
    } catch (err) {
      showToast(errorMessage(err), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void toggle(key, value),
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <Card>
      <CardHeader eyebrow={t("flagsEyebrow")} title={t("flagsTitle")} />
      <p className="-mt-2 mb-4 max-w-prose text-caption text-ink-faint">{t("flagsDesc")}</p>

      {entries.length === 0 ? (
        <p className="rounded-lg bg-sunken px-4 py-6 text-center text-body text-ink-soft">
          {t("flagsEmpty")}
        </p>
      ) : (
        <div className="grid gap-1">
          {entries.map(([key, value]) => (
            <div
              key={key}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-3 last:border-b-0"
            >
              <div className="grid min-w-0 gap-1">
                <span className="text-[14px] font-bold text-ink">{flagLabel(key)}</span>
                <span className="w-fit rounded bg-sunken px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink-soft">
                  {key}
                </span>
              </div>
              <Switch
                label={flagLabel(key)}
                checked={value}
                onChange={(v) => void toggle(key, v)}
                disabled={pending === key}
              />
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-caption text-ink-faint">{t("flagsHint")}</p>
    </Card>
  );
}
