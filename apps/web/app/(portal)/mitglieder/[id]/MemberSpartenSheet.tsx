"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Sparte } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { DEFAULT_SPARTE_COLOR, safeIcon } from "../../sparten/_components/options";
import { memberSpartenDict } from "./sparten-i18n";

/**
 * Sparten-Zuordnung EINES Mitglieds (Sheet, Mehrfachauswahl). Startwerte aus
 * der aktuellen Zugehörigkeit (sparte.memberIds enthält die memberId). Beim
 * Speichern wird pro GEÄNDERTER Sparte der Roster als Voll-Replace über die
 * Facade gesetzt (data.setSparteMembers) — die n:m-Wahrheit lebt auf der
 * Sparte, deshalb hier der Diff je Sparte statt einer Mitglied-zentrierten
 * Methode. Erfolg: Toast + onSaved() + schließen; 403 → Klartext-Toast, offen.
 *
 * Pro Öffnung frisch gemountet → die useState-Startwerte genügen.
 */

/** #RRGGBB → rgba(...) mit Alpha. */
function tint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(178, 58, 92, ${alpha})`;
  const int = parseInt(m[1], 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}

function SparteRow({
  sparte,
  selected,
  inactiveLabel,
  onToggle,
}: {
  sparte: Sparte;
  selected: boolean;
  inactiveLabel: string;
  onToggle: () => void;
}) {
  const color = sparte.color ?? DEFAULT_SPARTE_COLOR;
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggle}
        className="flex w-full items-center gap-3 py-2.5 text-left"
      >
        <span
          className="grid h-9 w-9 flex-none place-items-center rounded-org"
          style={{ backgroundColor: tint(color, 0.16), color }}
          aria-hidden="true"
        >
          <Icon name={safeIcon(sparte.icon)} className="ic h-4 w-4" />
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-[14px] font-bold text-ink">{sparte.name}</span>
          {!sparte.active && <Badge tone="neutral">{inactiveLabel}</Badge>}
        </span>
        <span
          aria-hidden="true"
          className={`grid h-6 w-6 flex-none place-items-center rounded-md border transition-colors duration-150 ${
            selected ? "border-brand bg-brand text-brand-contrast" : "border-line text-transparent"
          }`}
        >
          <Icon name="check" className="ic h-4 w-4" />
        </span>
      </button>
    </li>
  );
}

export function MemberSpartenSheet({
  memberId,
  memberName,
  sparten,
  onClose,
  onSaved,
}: {
  memberId: string;
  memberName: string;
  /** ALLE Sparten des Vereins (aktiv + inaktiv) mit aktuellem Roster. */
  sparten: Sparte[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(memberSpartenDict);
  const { showToast } = useToast();

  const sorted = useMemo(
    () =>
      [...sparten].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"),
      ),
    [sparten],
  );

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(sparten.filter((s) => s.memberIds.includes(memberId)).map((s) => s.id)),
  );
  const [submitting, setSubmitting] = useState(false);

  const toggle = (sparteId: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(sparteId)) next.delete(sparteId);
      else next.add(sparteId);
      return next;
    });

  const save = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Nur GEÄNDERTE Sparten anfassen: Diff zwischen Ist (memberIds) und Soll.
      const changed = sparten.filter(
        (sp) => selected.has(sp.id) !== sp.memberIds.includes(memberId),
      );
      for (const sp of changed) {
        const nextMembers = selected.has(sp.id)
          ? [...sp.memberIds, memberId]
          : sp.memberIds.filter((id) => id !== memberId);
        await data.setSparteMembers(sp.id, nextMembers);
      }
      showToast(t("savedToast", { name: memberName }), { tone: "success" });
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  const count = selected.size;
  const summary =
    count === 1 ? t("selectedSummaryOne", { n: count }) : t("selectedSummaryMany", { n: count });

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("sheetEyebrow")}
      title={t("sheetTitle", { name: memberName })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button icon="check" onClick={save} disabled={submitting}>
            {t("save")}
          </Button>
        </>
      }
    >
      {sparten.length === 0 ? (
        <p className="rounded-md bg-sunken px-4 py-3 text-[13px] text-ink-soft">{t("noSparten")}</p>
      ) : (
        <div className="grid gap-4">
          <p className="text-[13px] text-ink-soft">{t("sheetHint", { name: memberName })}</p>
          <p className="text-caption font-semibold text-ink-faint" aria-live="polite">
            {summary}
          </p>
          <ul className="grid divide-y divide-line">
            {sorted.map((sparte) => (
              <SparteRow
                key={sparte.id}
                sparte={sparte}
                selected={selected.has(sparte.id)}
                inactiveLabel={t("inactiveBadge")}
                onToggle={() => toggle(sparte.id)}
              />
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
