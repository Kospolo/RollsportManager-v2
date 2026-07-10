"use client";

import { useT } from "@/lib/i18n";
import { Card, CardHeader } from "@/components/ui/Card";
import { Timeline, type TimelineStep } from "@/components/ui/Timeline";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { financeDict } from "../i18n";

type StageDef = {
  id: string;
  dayKey: "day7" | "day21" | "day35" | "day49";
  titleKey: "step1" | "step2" | "step3" | "step4";
  chipKey: "chipAuto" | "chipAutoPreview" | "chipManual";
  manual: boolean;
};

const STAGES: StageDef[] = [
  { id: "s1", dayKey: "day7", titleKey: "step1", chipKey: "chipAuto", manual: false },
  { id: "s2", dayKey: "day21", titleKey: "step2", chipKey: "chipAutoPreview", manual: false },
  { id: "s3", dayKey: "day35", titleKey: "step3", chipKey: "chipManual", manual: true },
  { id: "s4", dayKey: "day49", titleKey: "step4", chipKey: "chipManual", manual: true },
];

/**
 * Mahn-Automatik (DESIGN-SYSTEM §3.7): explizite Regel-Zeitleiste als vier
 * Kacheln — jede Automatik zeigt ihre Regeln und ihren Freigabepunkt im UI.
 * Stufe 2+ trägt das Schloss: nur mit manueller Freigabe, niemals automatisch.
 */
export function DunningAutomationCard({
  masterOn,
  onMasterChange,
  stagesOn,
  onStageChange,
  onPreview,
}: {
  masterOn: boolean;
  onMasterChange: (on: boolean) => void;
  stagesOn: boolean[];
  onStageChange: (index: number, on: boolean) => void;
  /** Öffnet das E-Mail-Vorschau-Modal (Beispiel-Mahnmail) */
  onPreview: () => void;
}) {
  const t = useT(financeDict);

  const steps: TimelineStep[] = STAGES.map((stage, index) => ({
    id: stage.id,
    day: t(stage.dayKey),
    title: t(stage.titleKey),
    chip: (
      <span className="grid justify-items-start gap-2.5">
        <Badge tone={stage.manual ? "warn" : "success"} icon={stage.manual ? "lock" : "zap"}>
          {t(stage.chipKey)}
        </Badge>
        <Switch
          checked={stagesOn[index]}
          disabled={!masterOn}
          onChange={(on) => onStageChange(index, on)}
          label={t("stageSwitchLabel", { title: t(stage.titleKey) })}
        />
      </span>
    ),
  }));

  return (
    <Card>
      <CardHeader
        eyebrow={t("autoEyebrow")}
        title={t("autoTitle")}
        action={
          <>
            <Button variant="ghost" size="sm" icon="mail" onClick={onPreview}>
              {t("emailPreview")}
            </Button>
            <Switch checked={masterOn} onChange={onMasterChange} label={t("autoMasterLabel")} />
          </>
        }
      />
      <Timeline steps={steps} />
      <p className="mt-3 flex items-center gap-2 text-caption text-ink-faint">
        <Icon name="lock" className="ic h-[15px] w-[15px] flex-none" />
        {t("microcopy")}
      </p>
    </Card>
  );
}
