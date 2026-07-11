"use client";

import type { Department, Member } from "@/lib/types";
import { fullName } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarStack, type AvatarStackPerson } from "@/components/ui/AvatarStack";
import { Button } from "@/components/ui/Button";
import { abteilungenDict } from "../i18n";

/**
 * Abteilungs-Karte: Name, optionale Beschreibung, Leitung (Avatar + Name) und
 * Mitgliederzahl mit Avatar-Stapel. Die ganze Karte öffnet die Mitglieder-Sicht
 * (Klick → Mitglieder der Abteilung). Bearbeiten/Löschen erscheinen nur für
 * Vereins-Admins (canManage); die Rechte-Wahrheit bleibt serverseitig
 * (403 → Toast + Rollback).
 */
export function DepartmentCard({
  department,
  lead,
  roster,
  canManage,
  onOpenMembers,
  onEdit,
  onDelete,
}: {
  department: Department;
  lead: Member | undefined;
  roster: AvatarStackPerson[];
  canManage: boolean;
  onOpenMembers: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useT(abteilungenDict);
  const count = roster.length;
  const countLabel =
    count === 1 ? t("memberCountOne", { n: count }) : t("memberCountMany", { n: count });

  return (
    <li className="min-w-0">
      <article className="flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-card">
        <button
          type="button"
          onClick={onOpenMembers}
          className="grid gap-2 text-left"
          aria-label={t("openMembers")}
        >
          <h3 className="font-display text-h3 tracking-[-0.01em] text-ink">{department.name}</h3>
          {department.description && (
            <p className="line-clamp-2 text-caption text-ink-soft">{department.description}</p>
          )}
        </button>

        <div className="flex items-center gap-2.5">
          {lead ? (
            <Avatar
              personId={lead.id}
              firstName={lead.firstName}
              lastName={lead.lastName}
              size="s"
            />
          ) : (
            <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-sunken text-ink-faint">
              —
            </span>
          )}
          <span className="grid min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              {t("leadLabel")}
            </span>
            <span className="truncate text-caption font-semibold text-ink">
              {lead ? fullName(lead) : t("noLead")}
            </span>
          </span>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-3">
          {count > 0 ? (
            <AvatarStack people={roster} max={5} size="s" label={countLabel} />
          ) : null}
          <span className="text-caption font-semibold text-ink-soft">
            {count > 0 ? countLabel : t("noMembers")}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onOpenMembers}>
              {t("openMembers")}
            </Button>
            {canManage && (
              <>
                <Button size="sm" variant="ghost" icon="edit" onClick={onEdit}>
                  {t("editAction")}
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete}>
                  {t("deleteAction")}
                </Button>
              </>
            )}
          </div>
        </div>
      </article>
    </li>
  );
}
