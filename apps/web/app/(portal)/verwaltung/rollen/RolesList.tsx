"use client";

import { useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import {
  data,
  errorMessage,
  isForbidden,
  type CapabilityLevel,
  type ClubRoleDef,
} from "@/lib/data";
import type { Id } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/shell/icons";
import { rollenDict } from "./i18n";
import { isValidRoleKey, roleTone, sortRoles, suggestRoleKey } from "./derive";

/**
 * Rollen anlegen, umbenennen, löschen (RBAC-DESIGN §7).
 *
 * ### Die Weigerungen des Servers sind hier Text, kein Stacktrace ###
 * roles.ts wirft an fünf Stellen 409 — Systemrolle löschen, Rolle noch
 * zugewiesen, Schlüssel vergeben, Inhaber-Rolle umbenennen. Alle vier sind
 * ZUSTANDSkonflikte, keine Rechtefragen; sie kommen als verständlicher Satz
 * heraus (der Server liefert ihn bereits zweisprachig in `problem.detail`).
 *
 * ### Löschen wird nie automatisch bestätigt ###
 * Ein eigener Bestätigungs-Dialog mit dem Namen der Rolle. Kein window.confirm,
 * kein Sofort-Löschen.
 */

function RoleForm({
  open,
  role,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = neue Rolle anlegen; sonst umbenennen. */
  role: ClubRoleDef | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(rollenDict);
  const { showToast } = useToast();
  const [nameDe, setNameDe] = useState(role?.nameDe ?? "");
  const [nameEn, setNameEn] = useState(role?.nameEn ?? "");
  const [key, setKey] = useState(role?.key ?? "");
  // Solange der Schlüssel nicht von Hand angefasst wurde, folgt er dem Namen.
  const [keyTouched, setKeyTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isNew = role === null;
  const effectiveKey = isNew && !keyTouched ? suggestRoleKey(nameDe) : key;

  const submit = async () => {
    if (submitting) return;
    // Validieren VOR dem Schreiben (Muster VereinForm.tsx:80-89) — der Server
    // prüft dasselbe noch einmal, das hier erspart nur den Fehlversuch.
    if (nameDe.trim() === "" || nameEn.trim() === "") {
      setError(t("roleNameRequired"));
      return;
    }
    if (isNew && !isValidRoleKey(effectiveKey)) {
      setError(t("roleKeyInvalid"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (isNew) {
        const created = await data.createClubRole({
          key: effectiveKey,
          nameDe: nameDe.trim(),
          nameEn: nameEn.trim(),
        });
        showToast(t("roleCreated", { name: created.nameDe }), { tone: "success" });
      } else {
        const updated = await data.updateClubRole(role.id, {
          nameDe: nameDe.trim(),
          nameEn: nameEn.trim(),
        });
        showToast(t("roleUpdated", { name: updated.nameDe }), { tone: "success" });
      }
      onSaved();
      onClose();
    } catch (err) {
      // 409 (Schlüssel vergeben / Inhaber-Rolle) landet als Klartext im
      // Formular statt als Toast: der Fehler gehört zur Eingabe.
      setError(isForbidden(err) ? t("toastForbidden") : errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={t("rolesEyebrow")}
      title={isNew ? t("roleNewTitle") : t("roleEditTitle")}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("roleCancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {isNew ? t("roleCreate") : t("roleSave")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        {isNew && (
          <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3.5 py-2.5 text-[13px] text-info">
            <Icon name="sparkle" className="ic mt-0.5 h-4 w-4 flex-none" />
            {t("roleNewHint")}
          </p>
        )}
        <Input
          label={t("roleNameDe")}
          value={nameDe}
          onChange={(event) => setNameDe(event.target.value)}
        />
        <Input
          label={t("roleNameEn")}
          value={nameEn}
          onChange={(event) => setNameEn(event.target.value)}
        />
        {isNew ? (
          <Input
            label={t("roleKey")}
            hint={t("roleKeyHint")}
            value={effectiveKey}
            onChange={(event) => {
              setKeyTouched(true);
              setKey(event.target.value);
            }}
          />
        ) : (
          // Der Schlüssel ist unveränderlich (protect_roles, 0024:256-258) —
          // also gar nicht erst als Feld anbieten, das beim Speichern scheitert.
          <p className="text-[13px] text-ink-faint">
            {t("roleKey")}: <span className="font-mono text-ink-soft">{role.key}</span>
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function DeleteRoleDialog({
  role,
  onClose,
  onDeleted,
}: {
  role: ClubRoleDef | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT(rollenDict);
  const { locale } = useLocale();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!role) return null;
  const name = locale === "en" ? role.nameEn : role.nameDe;

  const remove = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await data.deleteClubRole(role.id);
      showToast(t("roleDeleted", { name }), { tone: "success" });
      onDeleted();
      onClose();
    } catch (err) {
      // 409 „noch N Personen zugewiesen" ist die häufigste Antwort hier — und
      // sie ist eine ANLEITUNG, kein Fehler. Deshalb im Dialog, nicht als Toast.
      setError(isForbidden(err) ? t("toastForbidden") : errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow={t("rolesEyebrow")}
      title={t("roleDeleteTitle")}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("roleCancel")}
          </Button>
          <Button variant="danger" onClick={() => void remove()} disabled={submitting}>
            {t("roleDeleteConfirm")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        <p className="text-[14px] text-ink-soft">{t("roleDeleteBody", { name })}</p>
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function RolesList({
  roles,
  permissionsByRole,
  memberCountByRole,
  canManage,
  onChanged,
}: {
  roles: ClubRoleDef[];
  permissionsByRole: ReadonlyMap<string, ReadonlyMap<string, CapabilityLevel>>;
  memberCountByRole: ReadonlyMap<Id, number>;
  canManage: boolean;
  onChanged: () => void;
}) {
  const t = useT(rollenDict);
  const { locale } = useLocale();
  const [formFor, setFormFor] = useState<{ role: ClubRoleDef | null } | null>(null);
  const [deleteFor, setDeleteFor] = useState<ClubRoleDef | null>(null);

  const ordered = sortRoles(roles);
  const name = (role: ClubRoleDef) => (locale === "en" ? role.nameEn : role.nameDe);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="min-w-0">
          <CardHeader eyebrow={t("rolesEyebrow")} title={t("rolesTitle")} />
          <p className="-mt-1 text-[13px] text-ink-soft">{t("rolesSub")}</p>
        </span>
        {canManage && (
          <Button icon="plus" size="sm" onClick={() => setFormFor({ role: null })}>
            {t("roleNew")}
          </Button>
        )}
      </div>

      <ul className="mt-4 grid gap-2">
        {ordered.map((role) => {
          const granted = [...(permissionsByRole.get(role.id) ?? new Map()).values()].filter(
            (level) => level !== "none",
          ).length;
          const people = memberCountByRole.get(role.id) ?? 0;
          return (
            <li
              key={role.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-3"
            >
              <span className="grid min-w-0 flex-1 gap-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <StatusPill tone={roleTone(role)}>{name(role)}</StatusPill>
                  {role.protected && (
                    <Badge tone="brand" icon="lock">
                      {t("roleProtectedBadge")}
                    </Badge>
                  )}
                  {!role.isSystem && <Badge tone="success">{t("roleOwnBadge")}</Badge>}
                  {role.isSystem && !role.protected && (
                    <Badge tone="neutral">{t("roleSystemBadge")}</Badge>
                  )}
                </span>
                <span className="text-[12.5px] text-ink-faint">
                  {granted === 0 ? t("roleNoPermissions") : t("roleMemberCount", { n: people })}
                </span>
              </span>

              {canManage && (
                <span className="flex flex-none gap-2">
                  {/* Die Inhaber-Rolle: Name gesperrt (roles.ts:256) — der Knopf
                      erscheint gar nicht erst, statt in einen 409 zu laufen. */}
                  {!role.protected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="edit"
                      onClick={() => setFormFor({ role })}
                    >
                      {t("roleEdit")}
                    </Button>
                  )}
                  {/* Systemrollen sind nicht löschbar (roles.ts:308). */}
                  {!role.isSystem && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="trash"
                      onClick={() => setDeleteFor(role)}
                    >
                      {t("roleDelete")}
                    </Button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {formFor && (
        <RoleForm
          open
          role={formFor.role}
          onClose={() => setFormFor(null)}
          onSaved={onChanged}
        />
      )}
      <DeleteRoleDialog
        role={deleteFor}
        onClose={() => setDeleteFor(null)}
        onDeleted={onChanged}
      />
    </Card>
  );
}
