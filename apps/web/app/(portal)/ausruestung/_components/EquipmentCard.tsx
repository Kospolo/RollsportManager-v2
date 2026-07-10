"use client";

import type { Equipment } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ausruestungDict, availableCap, CONDITION_KEY, CONDITION_TONE } from "../i18n";

/**
 * Inventar-Karte: Kategorie-Chip + Zustand-Badge, Name, Verfügbarkeit
 * (verfügbar/gesamt), optionale Notiz. „Reservieren" ist für jedes Mitglied
 * sichtbar (Selbst-Service) und nur bei Bestand 0 gesperrt; Bearbeiten/Löschen
 * erscheinen nur für Trainer:innen (canManage). Die Rechte-Wahrheit bleibt
 * serverseitig — ein 403 wird oben als Toast + Rollback behandelt.
 */
export function EquipmentCard({
  equipment,
  canManage,
  onReserve,
  onEdit,
  onDelete,
}: {
  equipment: Equipment;
  canManage: boolean;
  onReserve: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT(ausruestungDict);

  const cap = availableCap(equipment);
  const soldOut = cap === 0;

  let availability: React.ReactNode;
  if (equipment.availableQuantity === undefined && equipment.totalQuantity === undefined) {
    availability = <span className="text-caption text-ink-faint">{t("availUnknown")}</span>;
  } else {
    const available = equipment.availableQuantity ?? equipment.totalQuantity ?? 0;
    const total = equipment.totalQuantity ?? equipment.availableQuantity ?? 0;
    availability = (
      <span
        className={`inline-flex items-center gap-1.5 text-caption font-semibold ${
          soldOut ? "text-danger" : "text-ink-soft"
        }`}
      >
        <span aria-hidden="true" className="font-mono text-mono-table tabular-nums text-ink">
          {available}/{total}
        </span>
        {soldOut ? t("outOfStock") : t("availValue", { available, total })}
      </span>
    );
  }

  return (
    <li className="min-w-0">
      <article className="flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          {equipment.category && <Badge tone="brand">{equipment.category}</Badge>}
          <Badge tone={CONDITION_TONE[equipment.condition]} className="ml-auto">
            {t(CONDITION_KEY[equipment.condition])}
          </Badge>
        </div>

        <h3 className="font-display text-h3 tracking-[-0.01em] text-ink">{equipment.name}</h3>

        {equipment.notes && (
          <p className="line-clamp-2 text-caption text-ink-soft">{equipment.notes}</p>
        )}

        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-3">
          {availability}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={onReserve}
              disabled={soldOut}
              aria-label={t("reserveTitle", { name: equipment.name })}
            >
              {t("reserveCta")}
            </Button>
            {canManage && (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" icon="edit" onClick={onEdit}>
                  {t("editAction")}
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete}>
                  {t("deleteAction")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </article>
    </li>
  );
}
