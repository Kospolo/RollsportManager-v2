"use client";

import { useT } from "@/lib/i18n";
import type { LedgerCategory } from "@/lib/types";
import { Select } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { invoicesDict } from "../i18n";

/** Zahlweg-Optionen (Wert = i18n-Key; Anzeige lokalisiert, gespeichert wird der Klartext). */
export const VIA_KEYS = ["viaSepa", "viaTransfer", "viaCash", "viaPaypal", "viaOther"] as const;
export type ViaKey = (typeof VIA_KEYS)[number];

/** Beschriftetes Wertepaar (Empfänger-/Rechnungs-Metadaten im Detail-Sheet). */
export function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="grid gap-0.5">
      <span className="text-caption text-ink-faint">{label}</span>
      <span className="text-[14px] font-semibold text-ink">{value}</span>
    </span>
  );
}

/** „Als bezahlt"-Panel: Zahlweg wählen + optionale Kassenbuch-Einnahme buchen. */
export function SettlePanel({
  via,
  onViaChange,
  postToLedger,
  onPostChange,
  categoryId,
  onCategoryChange,
  categories,
}: {
  via: ViaKey;
  onViaChange: (via: ViaKey) => void;
  postToLedger: boolean;
  onPostChange: (on: boolean) => void;
  categoryId: string;
  onCategoryChange: (id: string) => void;
  categories: LedgerCategory[];
}) {
  const t = useT(invoicesDict);
  return (
    <div className="mb-5 grid gap-4 rounded-lg border border-line bg-sunken/50 p-4">
      <p className="text-[14px] font-bold text-ink">{t("settleTitle")}</p>
      <Select
        label={t("settleVia")}
        value={via}
        onChange={(event) => onViaChange(event.target.value as ViaKey)}
      >
        {VIA_KEYS.map((key) => (
          <option key={key} value={key}>
            {t(key)}
          </option>
        ))}
      </Select>
      <div className="grid gap-1.5">
        <span className="text-[13px] font-bold text-ink">{t("settlePostLabel")}</span>
        <Switch checked={postToLedger} onChange={onPostChange} label={t("settlePostLabel")} />
      </div>
      {postToLedger && (
        <Select
          label={t("settleCategory")}
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="">{t("categoryNone")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
