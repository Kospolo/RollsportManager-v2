"use client";

import { useT, type Dict } from "@/lib/i18n";

/**
 * Switch (DESIGN-SYSTEM §3.4): 46×27, An = success — IMMER mit
 * sichtbarem Wortlabel („Aktiv“/„Aus“), Status nie nur über Farbe.
 * Die unsichtbare Vergrößerung (before) stellt das 44-px-Touch-Ziel her.
 */

const dict = {
  de: { on: "Aktiv", off: "Aus" },
  en: { on: "On", off: "Off" },
} satisfies Dict;

export function Switch({
  checked,
  onChange,
  label,
  words,
  disabled,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Name der Einstellung (aria-label), z. B. „Automatische Zahlungserinnerungen“ */
  label: string;
  /** Eigene Zustandswörter; Standard: Aktiv/Aus bzw. On/Off */
  words?: { on: string; off: string };
  disabled?: boolean;
  className?: string;
}) {
  const t = useT(dict);
  const onWord = words?.on ?? t("on");
  const offWord = words?.off ?? t("off");

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-[27px] w-[46px] flex-none rounded-full transition-colors duration-150 before:absolute before:-inset-[9px] before:content-[''] disabled:pointer-events-none disabled:opacity-45 ${
          checked ? "bg-success" : "bg-line-strong"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-[3px] h-[21px] w-[21px] rounded-full bg-surface shadow-card transition-[left] duration-150 ${
            checked ? "left-[22px]" : "left-[3px]"
          }`}
        />
      </button>
      <span
        aria-hidden="true"
        className={`text-[12.5px] font-extrabold ${checked ? "text-success" : "text-ink-faint"}`}
      >
        {checked ? onWord : offWord}
      </span>
    </span>
  );
}
