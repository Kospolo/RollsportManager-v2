"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, isForbidden } from "@/lib/data";
import type { CreateRegionalEventInput, UpdateRegionalEventInput } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { RegionalEvent } from "@/lib/types";
import { eventsDict } from "../i18n";
import { safeExternalUrl } from "../helpers";

const FORM_ID = "regional-event-form";

type FieldErrors = Partial<Record<"title" | "start" | "end" | "url", string>>;

/**
 * „Event anlegen / bearbeiten“ als Sheet. Schreiben ist serverseitig auf
 * is_club_trainer beschränkt — ein 403 kommt als Klartext-Toast zurück. Beim
 * Bearbeiten leeren geleerte Felder das jeweilige Attribut serverseitig (null),
 * beim Anlegen werden leere Felder weggelassen (undefined). Erfolg: Toast +
 * onSaved() + schließen.
 */
export function RegionalEventFormSheet({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = neues Event, RegionalEvent = bestehendes bearbeiten */
  editing: RegionalEvent | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(eventsDict);
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [hostOrg, setHostOrg] = useState("");
  const [location, setLocation] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [registrationUrl, setRegistrationUrl] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Beim Öffnen aus dem aktuellen Datensatz vorbelegen (oder leeren beim Anlegen).
  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setDiscipline(editing?.discipline ?? "");
    setHostOrg(editing?.hostOrg ?? "");
    setLocation(editing?.location ?? "");
    setStartsOn(editing?.startsOn ?? new Date().toISOString().slice(0, 10));
    setEndsOn(editing?.endsOn ?? "");
    setRegistrationUrl(editing?.registrationUrl ?? "");
    setDescription(editing?.description ?? "");
    setErrors({});
  }, [open, editing]);

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (submitting) return;

    const nextErrors: FieldErrors = {};
    if (!title.trim()) nextErrors.title = t("errTitle");
    if (!startsOn) nextErrors.start = t("errStart");
    if (startsOn && endsOn && endsOn < startsOn) nextErrors.end = t("errEnd");

    const trimmedUrl = registrationUrl.trim();
    if (trimmedUrl && !safeExternalUrl(trimmedUrl)) nextErrors.url = t("errUrl");

    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const saved = editing
        ? await data.updateRegionalEvent(editing.id, {
            title: title.trim(),
            startsOn,
            endsOn: endsOn || null,
            hostOrg: hostOrg.trim() || null,
            discipline: discipline.trim() || null,
            location: location.trim() || null,
            registrationUrl: trimmedUrl || null,
            description: description.trim() || null,
          } satisfies UpdateRegionalEventInput)
        : await data.createRegionalEvent({
            title: title.trim(),
            startsOn,
            endsOn: endsOn || undefined,
            hostOrg: hostOrg.trim() || undefined,
            discipline: discipline.trim() || undefined,
            location: location.trim() || undefined,
            registrationUrl: trimmedUrl || undefined,
            description: description.trim() || undefined,
          } satisfies CreateRegionalEventInput);
      showToast(t(editing ? "updatedToast" : "createdToast", { title: saved.title }), {
        tone: "success",
      });
      onSaved();
      onClose();
    } catch (error) {
      showToast(isForbidden(error) ? t("noPermission") : errorMessage(error), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={editing ? t("formEyebrowEdit") : t("formEyebrowCreate")}
      title={editing ? t("formTitleEdit") : t("formTitleCreate")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            icon={editing ? "check" : "plus"}
            disabled={submitting}
          >
            {editing ? t("submitEdit") : t("submitCreate")}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid gap-4">
        <Input
          label={t("fTitle")}
          placeholder={t("fTitlePh")}
          value={title}
          error={errors.title}
          onChange={(changeEvent) => {
            setTitle(changeEvent.target.value);
            setErrors((previous) => ({ ...previous, title: undefined }));
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fDiscipline")}
            placeholder={t("fDisciplinePh")}
            value={discipline}
            onChange={(changeEvent) => setDiscipline(changeEvent.target.value)}
          />
          <Input
            label={t("fLocation")}
            placeholder={t("fLocationPh")}
            value={location}
            onChange={(changeEvent) => setLocation(changeEvent.target.value)}
          />
        </div>

        <Input
          label={t("fHost")}
          placeholder={t("fHostPh")}
          value={hostOrg}
          onChange={(changeEvent) => setHostOrg(changeEvent.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t("fStart")}
            type="date"
            value={startsOn}
            error={errors.start}
            onChange={(changeEvent) => {
              setStartsOn(changeEvent.target.value);
              setErrors((previous) => ({ ...previous, start: undefined, end: undefined }));
            }}
          />
          <Input
            label={t("fEnd")}
            hint={t("fEndHint")}
            type="date"
            min={startsOn || undefined}
            value={endsOn}
            error={errors.end}
            onChange={(changeEvent) => {
              setEndsOn(changeEvent.target.value);
              setErrors((previous) => ({ ...previous, end: undefined }));
            }}
          />
        </div>

        <Input
          label={t("fRegUrl")}
          hint={t("fRegUrlHint")}
          type="url"
          inputMode="url"
          placeholder={t("fRegUrlPh")}
          value={registrationUrl}
          error={errors.url}
          onChange={(changeEvent) => {
            setRegistrationUrl(changeEvent.target.value);
            setErrors((previous) => ({ ...previous, url: undefined }));
          }}
        />

        <Textarea
          label={t("fDescription")}
          placeholder={t("fDescriptionPh")}
          rows={4}
          value={description}
          onChange={(changeEvent) => setDescription(changeEvent.target.value)}
        />
      </form>
    </Sheet>
  );
}
