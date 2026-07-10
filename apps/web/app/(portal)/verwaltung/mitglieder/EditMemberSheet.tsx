"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import {
  data,
  errorMessage,
  fullName,
  isForbidden,
  type AssignableRole,
  type Permissions,
  type UpdateMemberInput,
} from "@/lib/data";
import type { Id, Member, MemberRole, MemberStatus } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { mitgliederVerwaltungDict, roleKey, statusKey } from "./i18n";
import { ASSIGNABLE_ROLES, EMAIL_PATTERN, STATUS_OPTIONS } from "./derive";

/**
 * Bearbeiten-Sheet eines Mitglieds. Zwei getrennte Speicherpfade der Facade:
 *  - Stammdaten (Vorname/Nachname/E-Mail/Geburtsdatum/Status/Zugang) über
 *    data.updateMember — per „Speichern"-Aktion, Diff-basiert.
 *  - Rolle über data.changeMemberRole — sofort beim Ändern des Selects,
 *    optimistisch mit Rollback + 403-Toast. Optionen graut die Hierarchie aus
 *    (permissions.canChangeRole); die Wahrheit bleibt serverseitig.
 */

type FieldErrors = { firstName?: string; lastName?: string; email?: string };

export function EditMemberSheet({
  member,
  perms,
  currentUserId,
  onClose,
  onPatched,
}: {
  member: Member;
  perms: Permissions;
  currentUserId: Id;
  onClose: () => void;
  onPatched: (member: Member) => void;
}) {
  const t = useT(mitgliederVerwaltungDict);
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState(member.firstName);
  const [lastName, setLastName] = useState(member.lastName);
  const [email, setEmail] = useState(member.email ?? "");
  const [birthDate, setBirthDate] = useState(member.birthDate ?? "");
  const [status, setStatus] = useState<MemberStatus>(member.status);
  const [validUntil, setValidUntil] = useState(member.guestAccessUntil ?? "");
  const [role, setRole] = useState<MemberRole>(member.role);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [savingRole, setSavingRole] = useState(false);

  /* ---------- Rolle (sofortiger Speicherpfad) ---------- */
  const isOwnerRow = member.role === "owner";
  const isSelf = member.id === currentUserId;
  const canEditRole = !isOwnerRow && !isSelf && perms.canChangeRole(member.role);
  const roleHint = !canEditRole
    ? isOwnerRow
      ? t("roleHintOwner")
      : isSelf
        ? t("roleHintSelf")
        : t("roleHintLocked")
    : t("roleHintImmediate");

  const applyRole = async (next: MemberRole) => {
    if (next === role || next === "owner" || savingRole || !canEditRole) return;
    const previous = role;
    setRole(next); // optimistisch — UI folgt sofort
    onPatched({ ...member, role: next });
    setSavingRole(true);
    try {
      await data.changeMemberRole(member.id, next as AssignableRole);
      showToast(t("roleToast", { role: t(roleKey(next)) }), { tone: "success" });
    } catch (err) {
      setRole(previous); // Rollback
      onPatched({ ...member, role: previous });
      showToast(isForbidden(err) ? t("roleForbidden") : errorMessage(err), {
        tone: "danger",
        actionLabel: t("retry"),
        onAction: () => void applyRole(next),
      });
    } finally {
      setSavingRole(false);
    }
  };

  /* ---------- Stammdaten (Speichern-Aktion) ---------- */
  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!firstName.trim()) next.firstName = t("valFirstName");
    if (!lastName.trim()) next.lastName = t("valLastName");
    const em = email.trim();
    if (em && !EMAIL_PATTERN.test(em)) next.email = t("valEmail");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPatch = (): UpdateMemberInput => {
    const patch: UpdateMemberInput = {};
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();
    const bd = birthDate.trim();
    const vu = validUntil.trim();
    if (fn !== member.firstName) patch.firstName = fn;
    if (ln !== member.lastName) patch.lastName = ln;
    if (em !== (member.email ?? "")) patch.email = em === "" ? null : em;
    if (bd !== (member.birthDate ?? "")) patch.birthDate = bd === "" ? null : bd;
    if (status !== member.status) patch.status = status;
    // valid_until nur für Gasttrainer (befristeter Zugang) mitschicken.
    if (role === "guest_coach" && vu !== (member.guestAccessUntil ?? "")) {
      patch.validUntil = vu === "" ? null : vu;
    }
    return patch;
  };

  const save = async () => {
    if (saving) return;
    if (!validate()) return;
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const updated = await data.updateMember(member.id, patch);
      onPatched(updated);
      showToast(t("savedToast", { name: fullName(updated) }), { tone: "success" });
      onClose();
    } catch (err) {
      // Fehler ⇒ Tabelle bleibt unverändert (kein onPatched); Sheet bleibt offen.
      showToast(isForbidden(err) ? t("forbidden") : errorMessage(err), { tone: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow={t("sheetEyebrow")}
      title={fullName(member)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button icon="check" onClick={() => void save()} disabled={saving}>
            {t("save")}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <section className="grid gap-4">
          <h3 className="eyebrow">{t("secMaster")}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t("fldFirstName")}
              value={firstName}
              error={errors.firstName}
              autoComplete="off"
              onChange={(event) => {
                setFirstName(event.target.value);
                if (errors.firstName) setErrors((e) => ({ ...e, firstName: undefined }));
              }}
            />
            <Input
              label={t("fldLastName")}
              value={lastName}
              error={errors.lastName}
              autoComplete="off"
              onChange={(event) => {
                setLastName(event.target.value);
                if (errors.lastName) setErrors((e) => ({ ...e, lastName: undefined }));
              }}
            />
          </div>
          <Input
            label={t("fldEmail")}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder={t("fldEmailPlaceholder")}
            hint={t("emailHint")}
            error={errors.email}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t("fldBirth")}
              type="date"
              hint={t("birthHint")}
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
            />
            <Select
              label={t("fldStatus")}
              value={status}
              onChange={(event) => setStatus(event.target.value as MemberStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(statusKey(option))}
                </option>
              ))}
              {member.status === "pending" && (
                <option value="pending" disabled>
                  {t("statusPending")}
                </option>
              )}
            </Select>
          </div>
          {role === "guest_coach" && (
            <Input
              label={t("fldValidUntil")}
              type="date"
              hint={t("validUntilHint")}
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
            />
          )}
        </section>

        <section className="grid gap-3 border-t border-line pt-5">
          <h3 className="eyebrow">{t("secRole")}</h3>
          <Select
            label={t("roleSelectLabel")}
            hint={roleHint}
            value={role}
            disabled={!canEditRole || savingRole}
            onChange={(event) => void applyRole(event.target.value as MemberRole)}
          >
            {ASSIGNABLE_ROLES.map((option) => (
              <option key={option} value={option} disabled={option !== role && !perms.canChangeRole(option)}>
                {t(roleKey(option))}
              </option>
            ))}
            {isOwnerRow && (
              <option value="owner" disabled>
                {t(roleKey("owner"))}
              </option>
            )}
          </Select>
        </section>

        {/* Enter im Formular löst „Speichern" aus */}
        <button type="submit" className="sr-only">
          {t("save")}
        </button>
      </form>
    </Sheet>
  );
}
