"use client";

import { useMemo, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import {
  data,
  errorMessage,
  isForbidden,
  type CapabilityLevel,
  type ClubRoleDef,
  type ResolvedCapability,
  type RolePermission,
} from "@/lib/data";
import { useCapabilities } from "@/lib/capabilities";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/shell/icons";
import { rollenDict } from "./i18n";
import {
  enforcementHintKey,
  enforcementLabelKey,
  enforcementTone,
  levelLabelKey,
  levelOf,
  mayEditCapability,
  sortCapabilities,
  sortRoles,
} from "./derive";

/**
 * Die EDITIERBARE Rechte-Matrix (RBAC-DESIGN §7) — Fähigkeit × Rolle, je Zelle
 * ein Stufen-Dropdown.
 *
 * ### Was diese Komponente ersetzt ###
 * Die Vorgängerin war eine Attrappe: `grep -c "useData|data\.|apiClient|fetch("`
 * darauf ergab 0. Sie zeigte 5 fest verdrahtete Fähigkeiten × 7 feste Rollen als
 * ✓/– aus hartkodierten Konstanten. Der Server hat 32 Fähigkeiten, editierbare
 * Rollen und ein Stufenmodell.
 *
 * ### Drei Regeln, die der Server vorgibt ###
 *  1. Das Dropdown zeigt NUR `allowedLevels` der Fähigkeit — eine andere Stufe
 *     quittiert der Server mit 422 (roles.ts:426).
 *  2. Geschützte Fähigkeiten (`ownerOnly`, 0032) sind für Nicht-Inhaber
 *     GESPERRT — mit sichtbarer Begründung, nicht nur ausgegraut. Ohne das baut
 *     die Matrix ein Dropdown, das beim Speichern 403 liefert.
 *  3. Die Inhaber-Rolle (`protected`) ist ganz gesperrt (roles.ts:375).
 *
 * ### Die Beschriftung ###
 * „Kein Zugriff" steht NUR an Fähigkeiten mit enforcement = 'enforced'. Sonst
 * heißt die unterste Stufe „Kein Bearbeiten", und jede Zeile trägt ihr Etikett
 * sichtbar. Siehe derive.ts:noneLabelKey und Migration 0033.
 *
 * ### Speichern ###
 * Kein optimistisches Schreiben (Muster VereinForm.tsx): der Entwurf steht in
 * `draft`, gespeichert wird auf Knopfdruck, je geänderter Rolle EIN PUT. Bei
 * Fehler bleibt der Entwurf stehen, damit die Eingabe nicht verloren geht.
 */

/** Zellen-Schlüssel: eine Rolle × eine Fähigkeit. */
function cellKey(roleId: string, capabilityKey: string): string {
  return `${roleId} ${capabilityKey}`;
}

export function PermissionMatrix({
  roles,
  permissionsByRole,
  canManage,
  onSaved,
}: {
  roles: ClubRoleDef[];
  /** roleId → (capabilityKey → Stufe). Der Server-Stand = die Baseline. */
  permissionsByRole: ReadonlyMap<string, ReadonlyMap<string, CapabilityLevel>>;
  canManage: boolean;
  onSaved: () => void;
}) {
  const t = useT(rollenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const caps = useCapabilities();

  /** Geänderte Zellen (cellKey → Stufe). Leer = nichts zu speichern. */
  const [draft, setDraft] = useState<Map<string, CapabilityLevel>>(new Map());
  const [saving, setSaving] = useState(false);

  const catalog = useMemo(
    () => sortCapabilities(caps.resolution?.capabilities ?? []),
    [caps.resolution],
  );
  const orderedRoles = useMemo(() => sortRoles(roles), [roles]);

  const label = (cap: ResolvedCapability) => (locale === "en" ? cap.labelEn : cap.labelDe);
  const roleName = (role: ClubRoleDef) => (locale === "en" ? role.nameEn : role.nameDe);

  /** Der aktuelle Wert einer Zelle: Entwurf schlägt Server-Stand. */
  const valueOf = (role: ClubRoleDef, cap: ResolvedCapability): CapabilityLevel => {
    const drafted = draft.get(cellKey(role.id, cap.key));
    if (drafted) return drafted;
    return levelOf(permissionsByRole.get(role.id) ?? new Map(), cap.key);
  };

  const setCell = (role: ClubRoleDef, cap: ResolvedCapability, next: CapabilityLevel) => {
    const server = levelOf(permissionsByRole.get(role.id) ?? new Map(), cap.key);
    setDraft((current) => {
      const copy = new Map(current);
      // Zurück auf den Server-Stand = keine Änderung mehr (der Zähler stimmt).
      if (next === server) copy.delete(cellKey(role.id, cap.key));
      else copy.set(cellKey(role.id, cap.key), next);
      return copy;
    });
  };

  const save = async () => {
    if (draft.size === 0 || saving) return;
    setSaving(true);
    // Je Rolle EIN PUT — der Endpoint nimmt eine Teilmenge und lässt den Rest
    // unangetastet (roles.ts:344). Sequentiell statt parallel: bei einem Fehler
    // ist so nachvollziehbar, welche Rollen bereits geschrieben sind.
    const byRole = new Map<string, RolePermission[]>();
    for (const [key, level] of draft) {
      const [roleId, capabilityKey] = key.split(" ");
      const list = byRole.get(roleId) ?? [];
      list.push({ capabilityKey, level });
      byRole.set(roleId, list);
    }
    try {
      for (const [roleId, permissions] of byRole) {
        await data.setRolePermissions(roleId, permissions);
      }
      setDraft(new Map());
      showToast(t("matrixSaved"), { tone: "success" });
      // Neu laden: die Baseline UND die eigenen Rechte — wer sich selbst gerade
      // etwas genommen hat, soll das sofort sehen (das ist der 0025-Kniff).
      onSaved();
      caps.reload();
    } catch (error) {
      showToast(isForbidden(error) ? t("toastForbidden") : errorMessage(error), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void save(),
      });
    } finally {
      setSaving(false);
    }
  };

  /** Die Etiketten, die in dieser Matrix wirklich vorkommen — für die Legende. */
  const usedEnforcements = useMemo(() => {
    const seen = new Set(catalog.map((c) => c.enforcement));
    return (["enforced", "partial", "write_only", "unenforced"] as const).filter((e) =>
      seen.has(e),
    );
  }, [catalog]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {/* Legende: warum die Zeilen unterschiedliche Etiketten tragen. */}
      <Card>
        <CardHeader eyebrow={t("matrixEyebrow")} title={t("enfLegendTitle")} />
        <p className="text-[13.5px] text-ink-soft">{t("enfLegendBody")}</p>
        <ul className="mt-3 grid gap-2">
          {usedEnforcements.map((e) => (
            <li key={e} className="flex flex-wrap items-baseline gap-2">
              <Badge tone={enforcementTone(e)}>{t(enforcementLabelKey(e))}</Badge>
              <span className="min-w-0 flex-1 text-[13px] text-ink-soft">
                {t(enforcementHintKey(e))}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <CardHeader eyebrow={t("matrixEyebrow")} title={t("matrixTitle")} />
          <p className="-mt-1 mb-4 text-[13px] text-ink-soft">{t("matrixSub")}</p>
        </div>

        <div className="overflow-x-auto px-5 sm:px-6">
          <table className="w-full border-separate border-spacing-0">
            <caption className="sr-only">{t("matrixCaption")}</caption>
            <thead>
              <tr>
                {/* Die Faehigkeits-Spalte bleibt beim Querscrollen stehen —
                    sonst editiert man ab Spalte 4 eine namenlose Zeile. */}
                <th
                  scope="col"
                  className="sticky left-0 z-20 border-b border-line bg-surface px-3 pb-2 pt-1 text-left text-[11px] font-extrabold uppercase tracking-[.08em] text-ink-faint"
                >
                  {t("colCapability")}
                </th>
                {orderedRoles.map((role) => (
                  <th
                    key={role.id}
                    scope="col"
                    className="border-b border-line px-3 pb-2 pt-1 text-left text-[11px] font-extrabold uppercase tracking-[.08em] text-ink-faint"
                  >
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      {roleName(role)}
                      {role.protected && (
                        <Icon name="lock" className="ic h-3 w-3" aria-hidden="true" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>*]:border-b-0">
              {catalog.map((cap) => {
                const editableCap = mayEditCapability(cap, caps.isOwner);
                return (
                  <tr key={cap.key} className="h-14">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-3 text-left align-middle font-normal"
                    >
                      <span className="grid gap-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[14px] font-bold leading-tight text-ink">
                            {label(cap)}
                          </span>
                          {cap.ownerOnly && (
                            <Badge tone="brand" icon="lock">
                              {t("ownerOnlyBadge")}
                            </Badge>
                          )}
                        </span>
                        <Badge tone={enforcementTone(cap.enforcement)} className="w-fit">
                          {t(enforcementLabelKey(cap.enforcement))}
                        </Badge>
                      </span>
                    </th>

                    {orderedRoles.map((role) => {
                      // Gesperrt: die Inhaber-Rolle immer; geschützte
                      // Fähigkeiten für Nicht-Inhaber; und wer nicht verwalten
                      // darf, sieht überall nur den Stand.
                      const locked = role.protected || !editableCap || !canManage;
                      const value = valueOf(role, cap);
                      const changed = draft.has(cellKey(role.id, cap.key));
                      if (locked) {
                        return (
                          <td key={role.id} className="border-b border-line px-3 py-3 align-middle">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-faint">
                              <Icon name="lock" className="ic h-3.5 w-3.5 flex-none" />
                              {t(levelLabelKey(value, cap.enforcement))}
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={role.id} className="border-b border-line px-3 py-3 align-middle">
                          <span className="relative inline-block">
                            <select
                              aria-label={t("selectAria", {
                                cap: label(cap),
                                role: roleName(role),
                              })}
                              value={value}
                              disabled={saving}
                              onChange={(event) =>
                                setCell(role, cap, event.target.value as CapabilityLevel)
                              }
                              className={`min-h-9 w-full min-w-40 appearance-none rounded-md border bg-sunken py-1 pl-3 pr-9 text-[13px] font-semibold text-ink transition-colors duration-150 hover:bg-sunken/70 disabled:opacity-45 ${
                                changed ? "border-brand" : "border-transparent"
                              }`}
                            >
                              {cap.allowedLevels.map((level) => (
                                <option key={level} value={level}>
                                  {t(levelLabelKey(level, cap.enforcement))}
                                </option>
                              ))}
                            </select>
                            <Icon
                              name="chevronDown"
                              className="ic pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint"
                            />
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Begründungen für gesperrte Zeilen/Spalten — sichtbar, nicht nur ausgegraut. */}
        <div className="grid gap-2 px-5 pb-5 pt-4 text-[12.5px] text-ink-soft sm:px-6 sm:pb-6">
          {catalog.some((c) => c.ownerOnly) && !caps.isOwner && (
            <span className="flex items-start gap-1.5">
              <Icon name="lock" className="ic mt-0.5 h-3.5 w-3.5 flex-none text-brand-ink" />
              {t("ownerOnlyLocked")}
            </span>
          )}
          {orderedRoles.some((r) => r.protected) && (
            <span className="flex items-start gap-1.5">
              <Icon name="lock" className="ic mt-0.5 h-3.5 w-3.5 flex-none text-ink-faint" />
              {t("protectedRoleNote")}
            </span>
          )}
        </div>

        {/* Aktionsleiste (Muster VereinForm.tsx:277-287). */}
        {canManage && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-4 sm:px-6">
            <span aria-live="polite" className="mr-auto text-[13px] text-ink-soft">
              {saving ? t("savingLabel") : draft.size > 0 ? t("dirtyCount", { n: draft.size }) : ""}
            </span>
            <Button
              variant="ghost"
              onClick={() => setDraft(new Map())}
              disabled={draft.size === 0 || saving}
            >
              {t("discard")}
            </Button>
            <Button onClick={() => void save()} disabled={draft.size === 0 || saving}>
              {t("saveAll")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
