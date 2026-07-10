"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useT, useLocale } from "@/lib/i18n";
import { formatEUR } from "@/lib/format";
import {
  data,
  errorMessage,
  fullName,
  isForbidden,
  type DunningRunOutcome,
} from "@/lib/data";
import type { Id, Member } from "@/lib/types";
import { Sheet } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Field";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { Icon } from "@/components/shell/icons";
import { useToast } from "@/components/ui/Toast";
import { mahnungenDict, type MahnungenKey } from "../i18n";
import { buildRunPlan, type DunningItem, type RunPlanItem } from "../derive";

/**
 * Mahnlauf ausführen — zweistufiger Fluss (kein Auto-Confirm):
 *   1) Vorschau via data.runDunning({ dryRun: true }) — zeigt, was PASSIEREN
 *      würde, ohne etwas zu versenden (dryBadge).
 *   2) Anwenden via data.applyDunning(...) — Stufe 1 (Erinnerung) läuft als
 *      Routine automatisch mit; Stufe ≥ 2 (Mahnung/Übergabe) NUR mit
 *      ausdrücklicher Freigabe pro Posten (Switch). Der Server prüft die
 *      Freigabe zusätzlich (403 ohne approveEscalation) — 403 ⇒ ruhiger Toast.
 *
 * Übersprungene Rechnungen (nicht mehr offen / schon höher) kommen als
 * skipped zurück — das ist KEIN Fehler.
 */

type PreviewState =
  | { status: "running" }
  | { status: "ready"; outcome: DunningRunOutcome }
  | { status: "error"; error: unknown };

/** Zielstufe → Klartext-Label (Wort statt reiner Zahl, DESIGN §3.6). */
const TARGET_KEY: Record<number, MahnungenKey> = {
  1: "targetReminder",
  2: "targetDunning1",
  3: "targetDunning2",
  4: "targetHandover",
};

export function MahnlaufModal({
  open,
  onClose,
  clubId,
  items,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  clubId: Id;
  items: DunningItem[];
  /** Nach erfolgreichem Anwenden: Rechnungen + Mahnprotokoll neu laden. */
  onApplied: () => void;
}) {
  const t = useT(mahnungenDict);
  const { showToast } = useToast();

  const [preview, setPreview] = useState<PreviewState>({ status: "running" });
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [applying, setApplying] = useState(false);

  const plan = useMemo(() => buildRunPlan(items), [items]);
  const routineItems = useMemo(() => plan.filter((p) => !p.needsApproval), [plan]);
  const approvalItems = useMemo(() => plan.filter((p) => p.needsApproval), [plan]);

  /**
   * Vorschau (Trockenlauf) beim Öffnen laden. Die Komponente wird pro Öffnen
   * frisch gemountet (Parent rendert nur bei open) — daher genügt ein
   * Mount-Effekt; setState passiert erst im asynchronen Callback (kein
   * synchrones setState im Effekt-Body).
   */
  useEffect(() => {
    let alive = true;
    data
      .runDunning({ dryRun: true })
      .then((outcome) => {
        if (alive) setPreview({ status: "ready", outcome });
      })
      .catch((error: unknown) => {
        if (alive) setPreview({ status: "error", error });
      });
    return () => {
      alive = false;
    };
  }, []);

  /** Erneuter Trockenlauf (Button im Fehlerfall — Event-Handler). */
  const retryPreview = () => {
    setPreview({ status: "running" });
    data
      .runDunning({ dryRun: true })
      .then((outcome) => setPreview({ status: "ready", outcome }))
      .catch((error: unknown) => setPreview({ status: "error", error }));
  };

  const approveAll = () =>
    setApproved(Object.fromEntries(approvalItems.map((p) => [p.invoice.id, true])));

  const selected = useMemo(
    () => [...routineItems, ...approvalItems.filter((p) => approved[p.invoice.id])],
    [routineItems, approvalItems, approved],
  );

  const apply = async () => {
    if (applying || selected.length === 0) return;
    // Nach Zielstufe gruppieren — applyDunning nimmt je Aufruf eine toStage.
    const byStage = new Map<number, Id[]>();
    for (const p of selected) {
      const ids = byStage.get(p.targetStage) ?? [];
      ids.push(p.invoice.id);
      byStage.set(p.targetStage, ids);
    }
    const trimmedNote = note.trim() || undefined;

    setApplying(true);
    try {
      let applied = 0;
      let skipped = 0;
      for (const [toStage, invoiceIds] of byStage) {
        const outcome = await data.applyDunning(clubId, {
          invoiceIds,
          toStage,
          approveEscalation: toStage >= 2 ? true : undefined,
          note: trimmedNote,
        });
        applied += outcome.applied;
        skipped += outcome.skipped.length;
      }

      const base =
        applied === 0
          ? t("resultNone")
          : applied === 1
            ? t("resultAppliedOne")
            : t("resultAppliedMany", { n: applied });
      const message = skipped > 0 ? `${base} ${t("resultSkipped", { n: skipped })}` : base;
      showToast(message, { tone: applied > 0 ? "success" : "neutral" });
      onApplied();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("toastForbidden") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setApplying(false);
    }
  };

  const ready = preview.status === "ready";
  const empty = ready && (plan.length === 0 || preview.outcome.total === 0);
  const canApply = ready && !empty && selected.length > 0 && !applying;

  return (
    <Sheet open={open} onClose={onClose} eyebrow={t("runEyebrow")} title={t("runTitle")}>
      {preview.status === "running" && (
        <div className="grid gap-3" aria-busy="true">
          <Skeleton className="h-6 w-2/5" />
          <SkeletonText lines={2} />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {preview.status === "error" && (
        <div className="grid justify-items-start gap-3 rounded-lg border border-line bg-canvas p-4">
          <Badge tone="danger" icon="zap">
            {t("runErrorTitle")}
          </Badge>
          <p className="text-[13.5px] text-ink-soft">
            {isForbidden(preview.error) ? t("runNoPermission") : errorMessage(preview.error)}
          </p>
          {!isForbidden(preview.error) && (
            <Button variant="secondary" size="sm" onClick={retryPreview}>
              {t("retry")}
            </Button>
          )}
        </div>
      )}

      {empty && (
        <div className="grid justify-items-start gap-2 rounded-lg border border-line bg-canvas p-4">
          <Badge tone="success" icon="check">
            {t("runEmptyTitle")}
          </Badge>
          <p className="text-[13.5px] text-ink-soft">{t("runEmptyBody")}</p>
        </div>
      )}

      {ready && !empty && (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[14px] font-bold text-ink">
              {preview.outcome.total === 1
                ? t("previewOne")
                : t("previewMany", { n: preview.outcome.total })}
            </span>
            {preview.outcome.dryRun && (
              <Badge tone="info" icon="sparkle">
                {t("dryBadge")}
              </Badge>
            )}
          </div>

          {/* Stufe 1 — Routine, läuft automatisch mit */}
          <section className="grid gap-2.5">
            <SectionHead
              title={t("routineTitle")}
              hint={t("routineHint")}
              tone="info"
              icon="bell"
            />
            {routineItems.length === 0 ? (
              <EmptyRow text={t("routineEmpty")} />
            ) : (
              <ul className="grid list-none gap-2">
                {routineItems.map((item) => (
                  <PlanRow key={item.invoice.id} item={item} member={item.member} />
                ))}
              </ul>
            )}
          </section>

          {/* Stufe ≥ 2 — Mahnung/Übergabe, nur mit ausdrücklicher Freigabe */}
          <section className="grid gap-2.5">
            <SectionHead
              title={t("approvalTitle")}
              hint={t("approvalHint")}
              tone="warn"
              icon="lock"
              action={
                approvalItems.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={approveAll}>
                    {t("approveAll")}
                  </Button>
                ) : undefined
              }
            />
            {approvalItems.length === 0 ? (
              <EmptyRow text={t("approvalEmpty")} />
            ) : (
              <ul className="grid list-none gap-2">
                {approvalItems.map((item) => (
                  <PlanRow key={item.invoice.id} item={item} member={item.member}>
                    <Switch
                      checked={approved[item.invoice.id] ?? false}
                      onChange={(value) =>
                        setApproved((current) => ({ ...current, [item.invoice.id]: value }))
                      }
                      label={t("approveOneAria", {
                        name: item.member ? fullName(item.member) : item.invoice.number,
                      })}
                      words={{ on: t("approveWordOn"), off: t("approveWordOff") }}
                    />
                  </PlanRow>
                ))}
              </ul>
            )}
          </section>

          <Textarea
            label={t("noteLabel")}
            placeholder={t("notePlaceholder")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
          />
        </div>
      )}

      <p className="mt-4 flex items-start gap-2 text-caption text-ink-faint">
        <Icon name="lock" className="ic mt-px h-[15px] w-[15px] flex-none" />
        {t("runMicro")}
      </p>

      <footer className="mt-5 flex flex-wrap justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose} disabled={applying}>
          {t("cancel")}
        </Button>
        {ready && !empty && (
          <Button icon="mail" onClick={apply} disabled={!canApply}>
            {applying ? t("applyingButton") : t("applyButton")}
          </Button>
        )}
      </footer>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

function SectionHead({
  title,
  hint,
  tone,
  icon,
  action,
}: {
  title: string;
  hint: string;
  tone: "info" | "warn";
  icon: "bell" | "lock";
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-2.5">
      <Badge tone={tone} icon={icon}>
        {title}
      </Badge>
      <span className="text-caption text-ink-faint">{hint}</span>
      {action && <span className="ml-auto">{action}</span>}
    </header>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-line bg-canvas px-3.5 py-2.5 text-[13px] text-ink-faint">
      {text}
    </p>
  );
}

/** Eine Zeile des Laufs: Mitglied + Rechnung + Zielstufe (Mono-Betrag rechts). */
function PlanRow({
  item,
  member,
  children,
}: {
  item: RunPlanItem;
  member?: Member;
  children?: ReactNode;
}) {
  const t = useT(mahnungenDict);
  const { locale } = useLocale();

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-line bg-canvas px-3.5 py-2.5">
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <b className="truncate text-[14px] font-bold text-ink">
            {member ? fullName(member) : "—"}
          </b>
          <span className="font-mono text-[11.5px] tabular-nums text-ink-faint">
            {item.invoice.number}
          </span>
        </span>
        <span className="text-caption text-ink-faint">{t(TARGET_KEY[item.targetStage])}</span>
      </span>
      <span className="font-mono text-mono-table tabular-nums text-ink">
        {formatEUR(item.invoice.amountCents, locale)}
      </span>
      {children && <span className="w-full sm:w-auto">{children}</span>}
    </li>
  );
}
