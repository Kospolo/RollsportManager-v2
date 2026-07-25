"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { Sheet } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  data,
  errorMessage,
  fullName,
  isForbidden,
  type AssignableRole,
  type CreateMemberInput,
} from "@/lib/data";
import { mitgliederVerwaltungDict, roleKey } from "./i18n";
import { ASSIGNABLE_ROLES, EMAIL_PATTERN } from "./derive";

/**
 * „Mitglied anlegen" — Sheet zum MANUELLEN Aufnehmen einer Person, auch OHNE
 * E-Mail und ohne Online-Zugang (Marcel: „jemand ohne Telefon/Internet muss
 * trotzdem im System sein"). Analog zum InviteSheet, aber: das E-Mail-Feld ist
 * OPTIONAL und wird NICHT erzwungen (leer = kein Konto). Speichert über
 * data.createMember (api-Modus: POST /clubs/{id}/members mit RLS-Prüfung);
 * 403 ⇒ Toast, das Sheet bleibt offen.
 */

type FieldErrors = { firstName?: string; lastName?: string; email?: string; validUntil?: string };

export function CreateMemberSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useT(mitgliederVerwaltungDict);
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [joinedOn, setJoinedOn] = useState("");
  const [role, setRole] = useState<AssignableRole>("member");
  const [validUntil, setValidUntil] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setBirthDate("");
    setJoinedOn("");
    setRole("member");
    setValidUntil("");
    setErrors({});
  };

  const close = () => {
    reset();
    onClose();
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!firstName.trim()) next.firstName = t("valFirstName");
    if (!lastName.trim()) next.lastName = t("valLastName");
    // KEIN E-Mail-Zwang: leer ist ausdrücklich erlaubt (Mitglied ohne
    // Online-Zugang). Nur eine tatsächlich eingetragene Adresse muss plausibel
    // sein — sonst gäbe es später einen unverständlichen Server-400.
    const em = email.trim();
    if (em && !EMAIL_PATTERN.test(em)) next.email = t("valEmail");
    // guest_coach braucht laut DB-Check ein Ablaufdatum.
    if (role === "guest_coach" && !validUntil.trim()) next.validUntil = t("valGuestValidUntil");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (submitting) return;
    if (!validate()) return;
    const em = email.trim();
    const bd = birthDate.trim();
    const jo = joinedOn.trim();
    const vu = validUntil.trim();
    const input: CreateMemberInput = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      ...(em ? { email: em } : {}),
      ...(bd ? { birthDate: bd } : {}),
      ...(jo ? { joinedOn: jo } : {}),
      // valid_until erwartet die API als ISO-Zeitstempel mit Offset.
      ...(role === "guest_coach" && vu ? { validUntil: new Date(vu).toISOString() } : {}),
    };
    setSubmitting(true);
    try {
      const created = await data.createMember(input);
      showToast(t("createdToast", { name: fullName(created) }), { tone: "success" });
      onCreated();
      close();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("createForbidden") : errorMessage(caught), {
        tone: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      eyebrow={t("createEyebrow")}
      title={t("createTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button icon="plus" onClick={() => void submit()} disabled={submitting}>
            {t("createSubmit")}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <p className="text-caption text-ink-faint">{t("createNote")}</p>
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
          hint={t("cmEmailOptionalHint")}
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
          <Input
            label={t("fldJoined")}
            type="date"
            hint={t("joinedHint")}
            value={joinedOn}
            onChange={(event) => setJoinedOn(event.target.value)}
          />
        </div>
        <Select
          label={t("roleSelectLabel")}
          value={role}
          onChange={(event) => setRole(event.target.value as AssignableRole)}
        >
          {ASSIGNABLE_ROLES.map((option) => (
            <option key={option} value={option}>
              {t(roleKey(option))}
            </option>
          ))}
        </Select>
        {role === "guest_coach" && (
          <Input
            label={t("fldValidUntil")}
            type="date"
            hint={t("validUntilHint")}
            error={errors.validUntil}
            value={validUntil}
            onChange={(event) => {
              setValidUntil(event.target.value);
              if (errors.validUntil) setErrors((e) => ({ ...e, validUntil: undefined }));
            }}
          />
        )}
        {/* Enter im Formular löst „Anlegen" aus */}
        <button type="submit" className="sr-only">
          {t("createSubmit")}
        </button>
      </form>
    </Sheet>
  );
}
