"use client";

import type { Sparte } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { spartenDict } from "../i18n";
import { DEFAULT_SPARTE_COLOR, safeIcon } from "./options";

/**
 * Sparten-Karte im „Heimspiel"-Charakter: farbiger Icon-Chip (Akzentfarbe der
 * Sparte), Name, Aktiv-/Eigene-Finanzen-Badges, Mitglieder- und Team-Zahl.
 * Inaktive Sparten sind sichtbar abgesetzt (gedämpft + gestrichelter Rand).
 * Bearbeiten/(De-)Aktivieren/Löschen erscheinen nur für Berechtigte (canManage);
 * die Rechte-Wahrheit bleibt serverseitig (403 → Toast + Rollback).
 */

/** #RRGGBB → rgba(...) mit Alpha — für den zarten Kachel-Hintergrund. */
function tint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(178, 58, 92, ${alpha})`;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function SparteCard({
  sparte,
  memberCount,
  teamCount,
  canManage,
  busy,
  onEdit,
  onToggleActive,
  onDelete,
}: {
  sparte: Sparte;
  memberCount: number;
  teamCount: number;
  canManage: boolean;
  busy: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const t = useT(spartenDict);
  const color = sparte.color ?? DEFAULT_SPARTE_COLOR;

  const memberLabel =
    memberCount === 1
      ? t("memberCountOne", { n: memberCount })
      : t("memberCountMany", { n: memberCount });
  const teamLabel =
    teamCount === 1 ? t("teamCountOne", { n: teamCount }) : t("teamCountMany", { n: teamCount });

  return (
    <li className="min-w-0">
      <article
        className={`flex h-full flex-col gap-4 rounded-xl border bg-surface p-5 shadow-card transition-opacity ${
          sparte.active ? "border-line" : "border-dashed border-line-strong opacity-70"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className="grid h-11 w-11 flex-none place-items-center rounded-org"
            style={{ backgroundColor: tint(color, 0.16), color }}
            aria-hidden="true"
          >
            <Icon name={safeIcon(sparte.icon)} className="ic h-5 w-5" />
          </span>

          <div className="grid min-w-0 flex-1 gap-1">
            <h3 className="truncate font-display text-h3 tracking-[-0.01em] text-ink">
              {sparte.name}
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={sparte.active ? "success" : "neutral"}>
                {sparte.active ? t("activeBadge") : t("inactiveBadge")}
              </Badge>
              {sparte.ownFinances && <Badge tone="warn">{t("ownFinancesBadge")}</Badge>}
            </div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-caption font-semibold text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="members" className="ic h-4 w-4 text-ink-faint" />
            {memberLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="teams" className="ic h-4 w-4 text-ink-faint" />
            {teamLabel}
          </span>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" icon="edit" onClick={onEdit} disabled={busy}>
              {t("editAction")}
            </Button>
            <Button size="sm" variant="ghost" onClick={onToggleActive} disabled={busy}>
              {sparte.active ? t("deactivateAction") : t("activateAction")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="trash"
              onClick={onDelete}
              disabled={busy}
              className="ml-auto"
            >
              {t("deleteAction")}
            </Button>
          </div>
        )}
      </article>
    </li>
  );
}
