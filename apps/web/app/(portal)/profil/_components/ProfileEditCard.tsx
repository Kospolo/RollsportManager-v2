"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, isForbidden, type UpdateMyProfileInput } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { MyProfileMembership } from "@/lib/types";
import { profilDict } from "../i18n";
import { ageYears } from "../derive";

const FORM_ID = "profil-edit-form";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Partial<Record<"firstName" | "lastName" | "email", string>>;

/**
 * Bearbeiten-Karte des eigenen Profils: Vorname/Nachname/E-Mail/Geburtsdatum.
 * Schreibt über die Facade (updateMyProfile → PATCH /me; member_id = self,
 * serverseitig erzwungen). Es wird nur der DIFF gegen den Serverstand gesendet
 * (leere E-Mail/Geburtsdatum → null zum Leeren). Erfolg = Toast; 403 kommt als
 * Klartext-Toast zurück. Nach Erfolg lädt der Screen über onSaved neu, wodurch
 * die Felder auf den frischen Serverstand zurücklaufen. Der Aufrufer setzt
 * dafür einen `key` aus id+updatedAt — so remountet die Karte nach dem
 * Speichern und der lokale „dirty“-Zustand fällt sauber zurück (kein
 * setState-im-Effect-Sync nötig).
 */
export function ProfileEditCard({
  membership,
  onSaved,
}: {
  membership: MyProfileMembership;
  onSaved: () => void;
}) {
  const t = useT(profilDict);
  const { showToast } = useToast();

  const original = useMemo(
    () => ({
      firstName: membership.firstName,
      lastName: membership.lastName,
      email: membership.email ?? "",
      birthDate: membership.birthDate ?? "",
    }),
    [membership.firstName, membership.lastName, membership.email, membership.birthDate],
  );

  const [firstName, setFirstName] = useState(original.firstName);
  const [lastName, setLastName] = useState(original.lastName);
  const [email, setEmail] = useState(original.email);
  const [birthDate, setBirthDate] = useState(original.birthDate);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const patch = useMemo<UpdateMyProfileInput>(() => {
    const next: UpdateMyProfileInput = {};
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();
    if (fn !== original.firstName) next.firstName = fn;
    if (ln !== original.lastName) next.lastName = ln;
    if (em !== original.email) next.email = em === "" ? null : em;
    if (birthDate !== original.birthDate) next.birthDate = birthDate === "" ? null : birthDate;
    return next;
  }, [firstName, lastName, email, birthDate, original]);

  const dirty = Object.keys(patch).length > 0;

  function reset() {
    setFirstName(original.firstName);
    setLastName(original.lastName);
    setEmail(original.email);
    setBirthDate(original.birthDate);
    setErrors({});
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (submitting) return;

    const nextErrors: FieldErrors = {};
    if (!firstName.trim()) nextErrors.firstName = t("errFirstName");
    if (!lastName.trim()) nextErrors.lastName = t("errLastName");
    if (email.trim() && !EMAIL_RE.test(email.trim())) nextErrors.email = t("errEmail");
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    if (Object.keys(patch).length === 0) {
      showToast(t("noChanges"), { tone: "neutral" });
      return;
    }

    setSubmitting(true);
    try {
      await data.updateMyProfile(patch);
      showToast(t("savedToast"), { tone: "success" });
      onSaved();
    } catch (error) {
      showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), {
        tone: "danger",
        actionLabel: t("loadErrorRetry"),
        onAction: () => void handleSubmit(formEvent),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const age = birthDate ? ageYears(birthDate) : null;

  return (
    <Card>
      <CardHeader eyebrow={t("editEyebrow")} title={t("editTitle")} />
      <p className="mb-4 text-[13px] text-ink-soft">{t("editHint")}</p>

      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fFirstName")}
            placeholder={t("fFirstNamePh")}
            autoComplete="given-name"
            value={firstName}
            error={errors.firstName}
            onChange={(event) => {
              setFirstName(event.target.value);
              setErrors((previous) => ({ ...previous, firstName: undefined }));
            }}
          />
          <Input
            label={t("fLastName")}
            placeholder={t("fLastNamePh")}
            autoComplete="family-name"
            value={lastName}
            error={errors.lastName}
            onChange={(event) => {
              setLastName(event.target.value);
              setErrors((previous) => ({ ...previous, lastName: undefined }));
            }}
          />
        </div>

        <Input
          label={t("fEmail")}
          type="email"
          inputMode="email"
          placeholder={t("fEmailPh")}
          autoComplete="email"
          hint={t("fEmailHint")}
          value={email}
          error={errors.email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrors((previous) => ({ ...previous, email: undefined }));
          }}
        />

        <Input
          label={t("fBirth")}
          type="date"
          autoComplete="bday"
          hint={age !== null ? `${t("fBirthHint")} · ${t("ageYears", { age })}` : t("fBirthHint")}
          value={birthDate}
          onChange={(event) => setBirthDate(event.target.value)}
        />

        <div className="mt-1 flex flex-wrap items-center justify-end gap-2.5">
          <Button
            variant="ghost"
            onClick={reset}
            disabled={submitting || !dirty}
          >
            {t("reset")}
          </Button>
          <Button type="submit" form={FORM_ID} icon="check" disabled={submitting || !dirty}>
            {t("save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
