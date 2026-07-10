"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { CreateAchievementInput, UpdateAchievementInput } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { Achievement, Medal, Member } from "@/lib/types";
import { MEDAL_LABEL_KEY, MEDAL_ORDER, medaillenDict } from "../i18n";

const FORM_ID = "achievement-form";

type FieldErrors = Partial<Record<"member" | "title" | "date" | "placement", string>>;

/**
 * „Erfolg vergeben / bearbeiten“ als Sheet. Schreiben ist serverseitig auf
 * is_club_trainer beschränkt — ein 403 kommt als Klartext-Toast zurück. Das
 * Mitglied wählt nur der Trainer beim Anlegen; im Bearbeiten-Modus bleibt es
 * fest (die Facade kennt kein memberId-Patch). Erfolg: Toast + onSaved().
 */
export function AchievementFormSheet({
  open,
  editing,
  members,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = neuer Erfolg, Achievement = bestehenden bearbeiten */
  editing: Achievement | null;
  /** Auswahlliste für das Anlegen (alphabetisch) */
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(medaillenDict);
  const { showToast } = useToast();

  const [memberId, setMemberId] = useState("");
  const [title, setTitle] = useState("");
  const [competition, setCompetition] = useState("");
  const [placement, setPlacement] = useState("");
  const [medal, setMedal] = useState<Medal | "">("");
  const [achievedOn, setAchievedOn] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => fullName(a).localeCompare(fullName(b), "de")),
    [members],
  );

  // Beim Öffnen aus dem aktuellen Datensatz vorbelegen (oder leeren beim Anlegen).
  useEffect(() => {
    if (!open) return;
    setMemberId(editing?.memberId ?? "");
    setTitle(editing?.title ?? "");
    setCompetition(editing?.competitionName ?? "");
    setPlacement(editing?.placement != null ? String(editing.placement) : "");
    setMedal(editing?.medal ?? "");
    setAchievedOn(editing?.achievedOn ?? new Date().toISOString().slice(0, 10));
    setNote(editing?.note ?? "");
    setErrors({});
  }, [open, editing]);

  const editingMember = editing ? members.find((m) => m.id === editing.memberId) : undefined;

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (submitting) return;

    const nextErrors: FieldErrors = {};
    if (!editing && !memberId) nextErrors.member = t("errMember");
    if (!title.trim()) nextErrors.title = t("errTitle");
    if (!achievedOn) nextErrors.date = t("errDate");

    const trimmedPlacement = placement.trim();
    let placementValue: number | undefined;
    if (trimmedPlacement) {
      const parsed = Number(trimmedPlacement);
      if (!Number.isInteger(parsed) || parsed <= 0) nextErrors.placement = t("errPlacement");
      else placementValue = parsed;
    }

    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      const saved = editing
        ? await data.updateAchievement(editing.id, {
            title: title.trim(),
            competitionName: competition.trim() || null,
            placement: placementValue ?? null,
            medal: medal || undefined,
            achievedOn,
            note: note.trim() || null,
          } satisfies UpdateAchievementInput)
        : await data.createAchievement({
            memberId,
            title: title.trim(),
            competitionName: competition.trim() || undefined,
            placement: placementValue,
            medal: medal || undefined,
            achievedOn,
            note: note.trim() || undefined,
          } satisfies CreateAchievementInput);
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
        {editing ? (
          <div className="grid gap-1.5">
            <span className="text-[13px] font-bold text-ink">{t("fMember")}</span>
            <p className="rounded-md bg-sunken px-4 py-2.5 text-body text-ink-soft">
              {editingMember ? fullName(editingMember) : t("participation")}
            </p>
          </div>
        ) : (
          <Select
            label={t("fMember")}
            hint={t("fMemberHint")}
            error={errors.member}
            value={memberId}
            onChange={(changeEvent) => {
              setMemberId(changeEvent.target.value);
              setErrors((previous) => ({ ...previous, member: undefined }));
            }}
          >
            <option value="" disabled>
              {t("fMemberPh")}
            </option>
            {sortedMembers.map((member) => (
              <option key={member.id} value={member.id}>
                {fullName(member)}
              </option>
            ))}
          </Select>
        )}

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

        <Input
          label={t("fCompetition")}
          placeholder={t("fCompetitionPh")}
          value={competition}
          onChange={(changeEvent) => setCompetition(changeEvent.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label={t("fMedal")}
            value={medal}
            onChange={(changeEvent) => setMedal(changeEvent.target.value as Medal | "")}
          >
            <option value="">{t("medalNone")}</option>
            {MEDAL_ORDER.map((value) => (
              <option key={value} value={value}>
                {t(MEDAL_LABEL_KEY[value])}
              </option>
            ))}
          </Select>

          <Input
            label={t("fPlacement")}
            hint={t("fPlacementHint")}
            placeholder={t("fPlacementPh")}
            type="number"
            min={1}
            inputMode="numeric"
            value={placement}
            error={errors.placement}
            onChange={(changeEvent) => {
              setPlacement(changeEvent.target.value);
              setErrors((previous) => ({ ...previous, placement: undefined }));
            }}
          />
        </div>

        <Input
          label={t("fDate")}
          type="date"
          value={achievedOn}
          error={errors.date}
          onChange={(changeEvent) => {
            setAchievedOn(changeEvent.target.value);
            setErrors((previous) => ({ ...previous, date: undefined }));
          }}
        />

        <Textarea
          label={t("fNote")}
          placeholder={t("fNotePh")}
          rows={3}
          value={note}
          onChange={(changeEvent) => setNote(changeEvent.target.value)}
        />
      </form>
    </Sheet>
  );
}
