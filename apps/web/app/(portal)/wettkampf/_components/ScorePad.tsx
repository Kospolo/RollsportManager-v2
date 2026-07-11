"use client";

import { useState } from "react";
import { AvatarStack } from "@/components/ui/AvatarStack";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useT, type Locale } from "@/lib/i18n";
import {
  formatScore,
  round2,
  skaterNames,
  type EnteredScore,
  type StartItem,
} from "../derive";
import { wettkampfDict } from "../i18n";

/**
 * RollArt-Schnelleingabe: zwei Stepper für Technik & Komponenten, vorbelegt
 * mit der letzten Wertung. Der lokale State steuert die Eingabe; das Speichern
 * übernimmt der Live-Modus über die Facade (`saveRoutineScore`). `submitting`
 * sperrt die Eingabe, solange die Wertung geschrieben wird.
 */
export function ScorePad({
  item,
  startNumber,
  locale,
  submitting = false,
  onSubmit,
}: {
  item: StartItem;
  startNumber: number;
  locale: Locale;
  submitting?: boolean;
  onSubmit: (score: EnteredScore) => void;
}) {
  const t = useT(wettkampfDict);
  const [technical, setTechnical] = useState(item.lastScore?.technical ?? 0);
  const [components, setComponents] = useState(item.lastScore?.components ?? 0);
  const total = round2(technical + components);

  return (
    <Card>
      <CardHeader
        eyebrow={t("startNo", { n: startNumber })}
        title={t("quickEntryTitle")}
        action={
          <Badge tone="brand" icon="play">
            {t("nowRunning")}
          </Badge>
        }
      />

      <div className="mb-4 flex items-center gap-2.5">
        <AvatarStack
          people={item.skaters.map((skater) => ({
            personId: skater.id,
            firstName: skater.firstName,
            lastName: skater.lastName,
          }))}
          size="m"
        />
        <span className="grid min-w-0 gap-px">
          <b className="text-[14.5px] font-bold text-ink">{skaterNames(item.skaters)}</b>
          <span className="text-caption text-ink-faint">
            {item.routine.title} · {item.routine.category}
          </span>
        </span>
      </div>

      <div className="grid gap-2.5">
        <ScoreStepper
          label={t("technicalLabel")}
          value={technical}
          locale={locale}
          disabled={submitting}
          onChange={setTechnical}
        />
        <ScoreStepper
          label={t("componentsLabel")}
          value={components}
          locale={locale}
          disabled={submitting}
          onChange={setComponents}
        />

        <div className="flex min-h-14 items-center justify-between gap-3 rounded-lg bg-canvas px-4 py-3">
          <span className="eyebrow">{t("totalLabel")}</span>
          <span className="font-mono text-[22px] font-bold tabular-nums text-ink">
            {formatScore(total, locale)}
          </span>
        </div>

        <p className="text-caption text-ink-faint">
          {item.lastScore
            ? t("prefilledHint", { total: formatScore(item.lastScore.total, locale) })
            : t("noPrevHint")}
        </p>

        <Button
          icon="check"
          disabled={total <= 0 || submitting}
          onClick={() => onSubmit({ routineId: item.routine.id, technical, components })}
        >
          {submitting ? t("savingScore") : t("submitScore")}
        </Button>
      </div>
    </Card>
  );
}

const STEPS = [-1, -0.1, 0.1, 1] as const;

function ScoreStepper({
  label,
  value,
  locale,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  locale: Locale;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const t = useT(wettkampfDict);
  const stepText = (step: number) =>
    `${step > 0 ? "+" : "−"}${Math.abs(step) === 1 ? "1" : locale === "de" ? "0,1" : "0.1"}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas px-4 py-3">
      <span className="text-[13.5px] font-bold text-ink">{label}</span>
      <span className="flex items-center gap-1.5">
        {STEPS.slice(0, 2).map((step) => (
          <StepButton
            key={step}
            step={step}
            stepText={stepText(step)}
            value={value}
            disabled={disabled}
            onChange={onChange}
            ariaLabel={t("decreaseAria", { label, step: stepText(step).slice(1) })}
          />
        ))}
        <span className="min-w-[64px] text-center font-mono text-[17px] font-bold tabular-nums text-ink">
          {formatScore(value, locale)}
        </span>
        {STEPS.slice(2).map((step) => (
          <StepButton
            key={step}
            step={step}
            stepText={stepText(step)}
            value={value}
            disabled={disabled}
            onChange={onChange}
            ariaLabel={t("increaseAria", { label, step: stepText(step).slice(1) })}
          />
        ))}
      </span>
    </div>
  );
}

function StepButton({
  step,
  stepText,
  value,
  disabled,
  onChange,
  ariaLabel,
}: {
  step: number;
  stepText: string;
  value: number;
  disabled: boolean;
  onChange: (next: number) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(round2(Math.min(150, Math.max(0, value + step))))}
      className="grid h-11 w-11 place-items-center rounded-full border border-line-strong bg-surface font-mono text-[12px] font-bold text-ink transition-colors duration-150 hover:bg-sunken active:scale-[.98] disabled:pointer-events-none disabled:opacity-45"
    >
      {stepText}
    </button>
  );
}
