"use client";

import { useState } from "react";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { CreateSparteInput, UpdateSparteInput } from "@/lib/data";
import type { Sparte } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Icon, type IconName } from "@/components/shell/icons";
import { spartenDict } from "../i18n";
import { DEFAULT_SPARTE_COLOR, SPARTE_COLORS, SPARTE_ICONS, safeIcon } from "./options";

/**
 * Anlegen ODER Bearbeiten einer Sparte über die Facade (data.*Sparte). Nur bei
 * geöffnetem Zustand gemountet → frische useState-Startwerte je Öffnung. Icon-
 * und Farb-Auswahl als Raster/Swatches; „Aktiv" und „Eigene Finanzen" als
 * Switch. Der „Eigene Finanzen"-Schalter ist deaktiviert, wenn das Finanz-Modul
 * des Vereins aus ist (financeAvailable=false) — ehrlich beschriftet.
 *
 * Erfolg: Toast + onSaved() + schließen; 403 → Klartext-Toast, Sheet bleibt offen.
 */
export type SparteFormValue = { mode: "create" } | { mode: "edit"; sparte: Sparte };

function tint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(178, 58, 92, ${alpha})`;
  const int = parseInt(m[1], 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}

export function SparteFormSheet({
  value,
  financeAvailable,
  onClose,
  onSaved,
}: {
  value: SparteFormValue;
  financeAvailable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(spartenDict);
  const { showToast } = useToast();
  const isEdit = value.mode === "edit";
  const initial = isEdit ? value.sparte : undefined;

  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState<IconName>(safeIcon(initial?.icon));
  const [color, setColor] = useState<string>(initial?.color ?? DEFAULT_SPARTE_COLOR);
  const [active, setActive] = useState(initial?.active ?? true);
  const [sortOrder, setSortOrder] = useState(
    initial?.sortOrder !== undefined ? String(initial.sortOrder) : "",
  );
  const [ownFinances, setOwnFinances] = useState((initial?.ownFinances ?? false) && financeAvailable);

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [sortError, setSortError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const parseSort = (raw: string): number | null | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
  };

  const submit = async () => {
    if (submitting) return;

    const trimmedName = name.trim();
    let ok = true;
    if (!trimmedName) {
      setNameError(t("fNameError"));
      ok = false;
    }
    const sort = parseSort(sortOrder);
    if (sort === null) {
      setSortError(t("fSortOrderError"));
      ok = false;
    }
    if (!ok) return;

    setSubmitting(true);
    try {
      if (value.mode === "create") {
        const input: CreateSparteInput = {
          name: trimmedName,
          icon,
          color,
          active,
          sortOrder: sort ?? undefined,
          ownFinances: financeAvailable ? ownFinances : false,
        };
        const created = await data.createSparte(input);
        showToast(t("createdToast", { name: created.name }), { tone: "success" });
      } else {
        const patch: UpdateSparteInput = {
          name: trimmedName,
          icon,
          color,
          active,
          sortOrder: sort ?? undefined,
          ownFinances: financeAvailable ? ownFinances : false,
        };
        const updated = await data.updateSparte(value.sparte.id, patch);
        showToast(t("updatedToast", { name: updated.name }), { tone: "success" });
      }
      onSaved();
      onClose();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={isEdit ? t("editEyebrow") : t("createEyebrow")}
      title={isEdit ? t("editTitle") : t("createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button icon="check" onClick={submit} disabled={submitting}>
            {isEdit ? t("save") : t("create")}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Input
          label={t("fName")}
          placeholder={t("fNamePlaceholder")}
          autoComplete="off"
          error={nameError}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setNameError(undefined);
          }}
        />

        {/* Icon-Auswahl */}
        <fieldset className="grid gap-2">
          <legend className="text-[13px] font-bold text-ink">{t("fIcon")}</legend>
          <p className="text-caption text-ink-faint">{t("fIconHint")}</p>
          <div className="flex flex-wrap gap-2">
            {SPARTE_ICONS.map((name) => {
              const selected = icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={selected}
                  aria-label={name}
                  onClick={() => setIcon(name)}
                  className={`grid h-11 w-11 place-items-center rounded-org border transition-colors duration-150 ${
                    selected
                      ? "border-transparent text-[color:var(--sel)]"
                      : "border-line bg-surface text-ink-soft hover:bg-sunken"
                  }`}
                  style={
                    selected
                      ? ({ backgroundColor: tint(color, 0.16), "--sel": color } as React.CSSProperties)
                      : undefined
                  }
                >
                  <Icon name={name} className="ic h-5 w-5" />
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Farb-Auswahl */}
        <fieldset className="grid gap-2">
          <legend className="text-[13px] font-bold text-ink">{t("fColor")}</legend>
          <p className="text-caption text-ink-faint">{t("fColorHint")}</p>
          <div className="flex flex-wrap gap-2.5">
            {SPARTE_COLORS.map((hex) => {
              const selected = color.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  aria-pressed={selected}
                  aria-label={hex}
                  onClick={() => setColor(hex)}
                  className={`grid h-9 w-9 place-items-center rounded-full transition-transform duration-150 ${
                    selected ? "scale-110 ring-2 ring-offset-2 ring-offset-surface" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: hex, "--tw-ring-color": hex } as React.CSSProperties}
                >
                  {selected && <Icon name="check" className="ic h-4 w-4 text-white" />}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <span className="text-[13px] font-bold text-ink">{t("fActive")}</span>
            <Switch checked={active} onChange={setActive} label={t("fActive")} />
            <p className="text-caption text-ink-faint">{t("fActiveHint")}</p>
          </div>

          <Input
            label={t("fSortOrder")}
            hint={t("fSortOrderHint")}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            autoComplete="off"
            error={sortError}
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value);
              if (sortError) setSortError(undefined);
            }}
          />
        </div>

        {/* Eigene Finanzen — nur bei aktivem Finanz-Modul bedienbar */}
        <div className="grid gap-1.5 rounded-xl border border-line bg-sunken/60 p-4">
          <span className="text-[13px] font-bold text-ink">{t("fOwnFinances")}</span>
          <Switch
            checked={ownFinances && financeAvailable}
            onChange={setOwnFinances}
            label={t("fOwnFinances")}
            disabled={!financeAvailable}
          />
          <p className="text-caption text-ink-faint">
            {financeAvailable ? t("fOwnFinancesHint") : t("fOwnFinancesOffHint")}
          </p>
        </div>

        <button type="submit" className="sr-only">
          {isEdit ? t("save") : t("create")}
        </button>
      </form>
    </Sheet>
  );
}
