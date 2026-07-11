"use client";

import { useState } from "react";
import { data, errorMessage, fullName, isForbidden, memberById } from "@/lib/data";
import type { Locker, Member } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { schliessfaecherDict, STATUS_ICON, STATUS_KEY, STATUS_TONE } from "../i18n";

/**
 * Schließfach-Karte: Nummer/Kennung, Standort, Status-Badge (frei/belegt/defekt)
 * und — bei Belegung — das zugeordnete Mitglied mit Avatar. Belegen/Freigeben
 * erscheinen für Trainer:innen (canAssign), Stammdaten + Defekt-Meldung für
 * Vereins-Admins (canManage). Freigeben und Defekt-/Repariert-Meldung laufen
 * inline über die Facade; Zuordnen/Bearbeiten/Löschen öffnen die Dialoge oben.
 * Die Rechte-Wahrheit bleibt serverseitig — ein 403 wird als Toast + Rollback
 * (onChanged → Liste neu laden) behandelt.
 */
export function LockerCard({
  locker,
  members,
  canManage,
  canAssign,
  onAssign,
  onReassign,
  onEdit,
  onDelete,
  onChanged,
}: {
  locker: Locker;
  members: Member[];
  canManage: boolean;
  canAssign: boolean;
  onAssign: () => void;
  onReassign: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const t = useT(schliessfaecherDict);
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const assignedMember =
    locker.status === "assigned" && locker.assignedMemberId
      ? memberById(members, locker.assignedMemberId)
      : undefined;

  const run = async (
    action: () => Promise<unknown>,
    successMessage: string,
    forbiddenMessage: string,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      showToast(successMessage, { tone: "success" });
      onChanged();
    } catch (caught) {
      showToast(isForbidden(caught) ? forbiddenMessage : errorMessage(caught), { tone: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const release = () =>
    run(
      () => data.releaseLocker(locker.id),
      t("releasedToast", { label: locker.label }),
      t("forbiddenAssign"),
    );

  const markBroken = () =>
    run(
      () => data.updateLocker(locker.id, { status: "broken", assignedMemberId: null }),
      t("markedBrokenToast", { label: locker.label }),
      t("forbiddenManage"),
    );

  const markRepaired = () =>
    run(
      () => data.updateLocker(locker.id, { status: "free" }),
      t("markedRepairedToast", { label: locker.label }),
      t("forbiddenManage"),
    );

  return (
    <li className="min-w-0">
      <article className="flex h-full flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 break-words font-mono text-h3 font-bold tracking-[-0.01em] text-ink">
            {locker.label}
          </h3>
          <Badge tone={STATUS_TONE[locker.status]} icon={STATUS_ICON[locker.status]} className="ml-auto">
            {t(STATUS_KEY[locker.status])}
          </Badge>
        </div>

        <p className="inline-flex items-center gap-1.5 text-caption text-ink-soft">
          <Icon name="pin" className="ic h-3.5 w-3.5 flex-none text-ink-faint" />
          <span className={locker.location ? "" : "text-ink-faint"}>
            {locker.location || t("noLocation")}
          </span>
        </p>

        {locker.status === "assigned" && (
          <div className="flex items-center gap-2.5 rounded-md bg-sunken px-3 py-2">
            {assignedMember ? (
              <>
                <Avatar
                  personId={assignedMember.id}
                  firstName={assignedMember.firstName}
                  lastName={assignedMember.lastName}
                  size="s"
                />
                <span className="grid min-w-0">
                  <span className="text-caption text-ink-faint">{t("assignedTo")}</span>
                  <span className="truncate text-caption font-semibold text-ink">
                    {fullName(assignedMember)}
                  </span>
                </span>
              </>
            ) : (
              <span className="text-caption text-ink-soft">{t("unknownMember")}</span>
            )}
          </div>
        )}

        {locker.note && <p className="line-clamp-2 text-caption text-ink-soft">{locker.note}</p>}

        {(canAssign || canManage) && (
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
            {canAssign && locker.status === "free" && (
              <Button size="sm" variant="secondary" icon="lock" onClick={onAssign} disabled={busy}>
                {t("assignCta")}
              </Button>
            )}
            {canAssign && locker.status === "assigned" && (
              <>
                <Button size="sm" variant="secondary" onClick={release} disabled={busy}>
                  {t("releaseCta")}
                </Button>
                <Button size="sm" variant="ghost" onClick={onReassign} disabled={busy}>
                  {t("reassignCta")}
                </Button>
              </>
            )}
            {canManage && locker.status !== "broken" && (
              <Button size="sm" variant="ghost" onClick={markBroken} disabled={busy}>
                {t("markBrokenCta")}
              </Button>
            )}
            {canManage && locker.status === "broken" && (
              <Button size="sm" variant="secondary" icon="check" onClick={markRepaired} disabled={busy}>
                {t("markRepairedCta")}
              </Button>
            )}
            {canManage && (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" icon="edit" onClick={onEdit} disabled={busy}>
                  {t("editAction")}
                </Button>
                <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy}>
                  {t("deleteAction")}
                </Button>
              </div>
            )}
          </div>
        )}
      </article>
    </li>
  );
}
