"use client";

import { useMemo, useState } from "react";
import { data, errorMessage, fullName, isForbidden } from "@/lib/data";
import type { Event, Id, Member } from "@/lib/types";
import { useT, useLocale } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { checkinDict } from "../i18n";
import { EventSelect } from "./EventSelect";

/**
 * „Mitglied einchecken" (nur Trainer:innen): manuelles Einchecken eines
 * beliebigen Vereinsmitglieds über die Facade (data.createCheckin, method
 * 'manual'). Serverseitig darf das NUR der Trainerstab — ein 403 kommt als
 * Klartext-Toast zurück, die Auswahl bleibt erhalten (Rollback).
 */
export function TrainerCheckinCard({
  members,
  events,
  now,
  onCheckedIn,
}: {
  members: Member[];
  events: Event[];
  now: Date;
  onCheckedIn: () => void;
}) {
  const t = useT(checkinDict);
  const { locale } = useLocale();
  const { showToast } = useToast();

  const [memberId, setMemberId] = useState<string>("");
  const [eventId, setEventId] = useState<string>("");
  const [memberError, setMemberError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const sortedMembers = useMemo(
    () =>
      members
        .filter((member) => member.status === "active")
        .sort((a, b) => fullName(a).localeCompare(fullName(b), locale)),
    [members, locale],
  );

  const submit = async () => {
    if (submitting) return;
    if (!memberId) {
      setMemberError(t("trainerMemberError"));
      return;
    }
    setSubmitting(true);
    try {
      await data.createCheckin({
        memberId,
        eventId: eventId || undefined,
        method: "manual",
      });
      const member = members.find((m) => m.id === (memberId as Id));
      showToast(t("trainerDoneToast", { name: member ? fullName(member) : memberId }), {
        tone: "success",
      });
      setMemberId("");
      onCheckedIn();
    } catch (caught) {
      showToast(isForbidden(caught) ? t("forbidden") : errorMessage(caught), { tone: "danger" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="grid gap-4">
      <SectionHeader level={2} title={t("trainerTitle")} sub={t("trainerSub")} />

      <div className="grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-card">
        <Select
          label={t("trainerMemberLabel")}
          error={memberError}
          value={memberId}
          onChange={(event) => {
            setMemberId(event.target.value);
            if (memberError) setMemberError(undefined);
          }}
        >
          <option value="">{t("trainerMemberPlaceholder")}</option>
          {sortedMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {fullName(member)}
            </option>
          ))}
        </Select>

        <EventSelect value={eventId} onChange={setEventId} events={events} now={now} />

        <div className="flex justify-end">
          <Button icon="check" onClick={submit} disabled={submitting}>
            {t("trainerCta")}
          </Button>
        </div>
      </div>
    </section>
  );
}
