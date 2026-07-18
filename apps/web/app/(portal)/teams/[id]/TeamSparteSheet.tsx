"use client";

import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { Id, Sparte } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/shell/icons";
import { DEFAULT_SPARTE_COLOR, safeIcon } from "../../sparten/_components/options";
import { teamsViewDict } from "../i18n";

/**
 * Sparte EINES Teams zuordnen/ändern (Sheet, EINFACHauswahl — ein Team gehört zu
 * genau EINER Sparte). „Keiner Sparte" ist eine explizite Option (löst die
 * Zuordnung). Beim Speichern über die Facade (data.setTeamSparte, null = lösen).
 * Erfolg: Toast + onSaved() + schließen; 403 → Klartext-Toast, Sheet bleibt offen.
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

function OptionRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className="flex w-full items-center gap-3 py-2.5 text-left"
      >
        {children}
        <span
          aria-hidden="true"
          className={`grid h-5 w-5 flex-none place-items-center rounded-full border-2 transition-colors duration-150 ${
            selected ? "border-brand" : "border-line-strong"
          }`}
        >
          {selected && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
        </span>
      </button>
    </li>
  );
}

export function TeamSparteSheet({
  teamId,
  teamName,
  currentSparteId,
  sparten,
  onClose,
  onSaved,
}: {
  teamId: Id;
  teamName: string;
  currentSparteId: Id | null | undefined;
  sparten: Sparte[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(teamsViewDict);
  const { showToast } = useToast();

  const sorted = useMemo(
    () =>
      [...sparten].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"),
      ),
    [sparten],
  );

  const [selected, setSelected] = useState<Id | null>(currentSparteId ?? null);
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await data.setTeamSparte(teamId, selected);
      showToast(t("sparteSavedToast", { team: teamName }), { tone: "success" });
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("sparteForbidden") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("sparteSheetEyebrow")}
      title={t("sparteSheetTitle", { team: teamName })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("sparteCancel")}
          </Button>
          <Button icon="check" onClick={save} disabled={submitting}>
            {t("sparteSave")}
          </Button>
        </>
      }
    >
      {sparten.length === 0 ? (
        <p className="rounded-md bg-sunken px-4 py-3 text-[13px] text-ink-soft">
          {t("sparteNoOptions")}
        </p>
      ) : (
        <div className="grid gap-4">
          <p className="text-[13px] text-ink-soft">{t("sparteSheetHint")}</p>
          <ul role="radiogroup" aria-label={t("sparteSheetEyebrow")} className="grid divide-y divide-line">
            {/* Explizite „keiner Sparte"-Option zuerst. */}
            <OptionRow selected={selected === null} onSelect={() => setSelected(null)}>
              <span className="grid h-9 w-9 flex-none place-items-center rounded-org bg-sunken text-ink-faint" aria-hidden="true">
                <Icon name="close" className="ic h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">
                {t("sparteOptionNone")}
              </span>
            </OptionRow>

            {sorted.map((sparte) => {
              const color = sparte.color ?? DEFAULT_SPARTE_COLOR;
              return (
                <OptionRow
                  key={sparte.id}
                  selected={selected === sparte.id}
                  onSelect={() => setSelected(sparte.id)}
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
                    {!sparte.active && <Badge tone="neutral">{t("sparteInactive")}</Badge>}
                  </span>
                </OptionRow>
              );
            })}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
