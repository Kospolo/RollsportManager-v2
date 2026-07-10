"use client";

import { useT } from "@/lib/i18n";
import { isForbidden, errorMessage, type DunningRunOutcome } from "@/lib/data";
import { Sheet } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { financeDict } from "../i18n";

/** Zustand des Mahnlauf-Trockenlaufs — lebt im FinanceClient. */
export type DunningRunState =
  | { status: "running" }
  | { status: "ready"; outcome: DunningRunOutcome }
  | { status: "error"; error: unknown };

/**
 * „Mahnlauf (Vorschau)" — zeigt das Ergebnis von data.runDunning({dryRun:true})
 * als Sheet: Was WÜRDE passieren, ohne dass etwas versendet wird.
 * mock: aus den Mock-Rechnungen berechnet; api: POST …/dunning/run (dry_run).
 */
export function DunningRunSheet({
  open,
  onClose,
  state,
  onRetry,
}: {
  open: boolean;
  onClose: () => void;
  state: DunningRunState;
  onRetry: () => void;
}) {
  const t = useT(financeDict);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={t("autoEyebrow")}
      title={t("dunningRunTitle")}
    >
      {state.status === "running" && (
        <div className="grid gap-3" aria-busy="true">
          <Skeleton className="h-6 w-2/5" />
          <SkeletonText lines={2} />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {state.status === "error" && (
        <div className="grid justify-items-start gap-3 rounded-lg border border-line bg-canvas p-4">
          <Badge tone="danger" icon="zap">
            {t("dunningRunErrorTitle")}
          </Badge>
          <p className="text-[13.5px] text-ink-soft">
            {isForbidden(state.error)
              ? t("dunningRunNoPermission")
              : errorMessage(state.error)}
          </p>
          {!isForbidden(state.error) && (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {t("retry")}
            </Button>
          )}
        </div>
      )}

      {state.status === "ready" && <OutcomeView outcome={state.outcome} />}

      <p className="mt-4 flex items-start gap-2 text-caption text-ink-faint">
        <Icon name="lock" className="ic mt-px h-[15px] w-[15px] flex-none" />
        {t("dunningRunMicro")}
      </p>
    </Sheet>
  );
}

function OutcomeView({ outcome }: { outcome: DunningRunOutcome }) {
  const t = useT(financeDict);

  if (outcome.total === 0) {
    return (
      <div className="grid justify-items-start gap-2 rounded-lg border border-line bg-canvas p-4">
        <Badge tone="success" icon="check">
          {t("dunningRunEmptyTitle")}
        </Badge>
        <p className="text-[13.5px] text-ink-soft">{t("dunningRunEmptyBody")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-display text-[24px] font-extrabold tracking-[-0.015em] text-ink tabular-nums">
          {outcome.total === 1
            ? t("dunningRunTotalOne")
            : t("dunningRunTotalMany", { n: outcome.total })}
        </span>
        {outcome.dryRun && (
          <Badge tone="info" icon="sparkle">
            {t("dunningRunDryBadge")}
          </Badge>
        )}
      </div>

      <ul className="grid list-none gap-3">
        <OutcomeRow
          count={outcome.auto}
          title={t("dunningRunAuto")}
          hint={t("dunningRunAutoHint")}
          tone="success"
          icon="zap"
        />
        <OutcomeRow
          count={outcome.pendingApproval}
          title={t("dunningRunApproval")}
          hint={t("dunningRunApprovalHint")}
          tone="warn"
          icon="lock"
        />
        <OutcomeRow
          count={outcome.none}
          title={t("dunningRunNone")}
          hint={t("dunningRunNoneHint")}
          tone="neutral"
          icon="check"
        />
      </ul>
    </div>
  );
}

function OutcomeRow({
  count,
  title,
  hint,
  tone,
  icon,
}: {
  count: number;
  title: string;
  hint: string;
  tone: "success" | "warn" | "neutral";
  icon: "zap" | "lock" | "check";
}) {
  return (
    <li className="flex items-center gap-4 rounded-lg border border-line bg-canvas p-4">
      <span className="w-10 flex-none text-center font-display text-[22px] font-extrabold tabular-nums text-ink">
        {count}
      </span>
      <span className="grid min-w-0 gap-1">
        <Badge tone={tone} icon={icon}>
          {title}
        </Badge>
        <span className="text-caption text-ink-faint">{hint}</span>
      </span>
    </li>
  );
}
